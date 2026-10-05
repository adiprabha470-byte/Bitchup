const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { RoomStore } = require("../server/store"),
  { createServer } = require("../server/index"),
  { io: client } = require("socket.io-client");
const request = (s, event, data) =>
  new Promise((resolve, reject) =>
    s
      .timeout(4000)
      .emit(event, data, (err, r) => (err ? reject(err) : resolve(r))),
  );
test("atomic snapshot persists wallets and reconnect credentials; internal sockets excluded", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bitchup-store-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "rooms.json"),
    rooms = new Map([
      [
        "ABC123",
        {
          code: "ABC123",
          started: true,
          timer: 60,
          phase: "roll",
          players: [
            {
              id: "p",
              cash: 900,
              secret: "private",
              on: true,
              socketId: "socket",
            },
          ],
          props: { 1: { o: "p" } },
        },
      ],
    ]),
    store = new RoomStore(file, rooms);
  await store.flush();
  const raw = fs.readFileSync(file, "utf8");
  assert.ok(!raw.includes("socketId"));
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  const restored = new Map();
  new RoomStore(file, restored);
  const r = restored.get("ABC123");
  assert.equal(r.players[0].cash, 900);
  assert.equal(r.players[0].secret, "private");
  assert.equal(r.players[0].on, false);
  assert.ok(r.deadline > Date.now() + 110000);
  assert.equal(r.props[1].o, "p");
  assert.equal(fs.existsSync(file + ".tmp"), false);
});
test("snapshot corruption fails closed; disabled store performs no writes", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bitchup-corrupt-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "rooms.json");
  fs.writeFileSync(file, '{"version":100,"rooms":[]}');
  assert.throws(() => new RoomStore(file, new Map()), /Unsupported/);
  const disabled = new RoomStore(null, new Map());
  await disabled.flush();
  assert.equal(disabled.file, null);
});
test("real server restart restores seat and allows authenticated reconnect", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bitchup-restart-"));
  const file = path.join(dir, "rooms.json");
  const first = createServer({ storePath: file });
  await new Promise((r) => first.srv.listen(0, "127.0.0.1", r));
  const a = client("http://127.0.0.1:" + first.srv.address().port, {
    transports: ["websocket"],
  });
  await new Promise((r) => a.once("connect", r));
  const seat = await request(a, "create", { name: "Persistent", mode: "team" });
  await request(a, "team:claim", { team: "missionary" });
  await first.close();
  a.disconnect();
  const second = createServer({ storePath: file });
  await new Promise((r) => second.srv.listen(0, "127.0.0.1", r));
  const b = client("http://127.0.0.1:" + second.srv.address().port, {
    transports: ["websocket"],
  });
  t.after(async () => {
    b.disconnect();
    await second.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
  await new Promise((r) => b.once("connect", r));
  const restored = await request(b, "join", {
    code: seat.code,
    pid: seat.pid,
    secret: seat.secret,
  });
  assert.equal(restored.pid, seat.pid);
  assert.equal(
    second.rooms.get(seat.code).teams.missionary.captainId,
    seat.pid,
  );
  const health = await fetch(
    "http://127.0.0.1:" + second.srv.address().port + "/health",
  );
  assert.equal((await health.json()).persistence, "healthy");
});
test("concurrent snapshot requests serialize atomic replacement without losing the latest state", async (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bitchup-concurrent-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "rooms.json"),
    r = { code: "ABC123", players: [{ cash: 1 }] },
    store = new RoomStore(file, new Map([[r.code, r]]));
  const a = store.flush();
  r.players[0].cash = 2;
  const b = store.flush();
  r.players[0].cash = 3;
  const c = store.flush();
  await Promise.all([a, b, c]);
  assert.equal(
    JSON.parse(fs.readFileSync(file, "utf8")).rooms[0].players[0].cash,
    3,
  );
  assert.equal(store.lastError, null);
  assert.equal(fs.existsSync(file + ".tmp"), false);
});
