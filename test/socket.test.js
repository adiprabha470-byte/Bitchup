const test = require("node:test"),
  assert = require("node:assert/strict"),
  { io: client } = require("socket.io-client"),
  { createServer } = require("../server/index");
const request = (s, event, data = {}) =>
  new Promise((resolve, reject) =>
    s
      .timeout(4000)
      .emit(event, data, (err, r) => (err ? reject(err) : resolve(r))),
  );
async function setup(t) {
  const server = createServer();
  await new Promise((r) => server.srv.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + server.srv.address().port;
  const clients = [];
  const connect = async () => {
    const s = client(url, { transports: ["websocket"], forceNew: true });
    clients.push(s);
    await new Promise((r, j) => {
      s.once("connect", r);
      s.once("connect_error", j);
    });
    return s;
  };
  t.after(() => {
    clients.forEach((s) => s.disconnect());
    server.close();
  });
  return { ...server, url, connect };
}
test("real WebSockets: rooms, team claim race, start, server dice and forged reconnect rejection", async (t) => {
  const server = await setup(t),
    a = await server.connect(),
    b = await server.connect(),
    attacker = await server.connect();
  const first = await request(a, "create", {
    name: "A",
    mode: "team",
    pid: "forged",
    cash: 9e8,
  });
  assert.notEqual(first.pid, "forged");
  const second = await request(b, "join", { name: "B", code: first.code });
  const r = server.rooms.get(first.code);
  assert.equal(r.cash, 1500);
  assert.ok(
    (await request(attacker, "join", { code: first.code, pid: first.pid })).err,
  );
  assert.ok(
    (
      await request(attacker, "join", {
        code: first.code,
        pid: first.pid,
        secret: "wrong",
      })
    ).err,
  );
  const races = await Promise.all([
    request(a, "team:claim", { team: "missionary" }),
    request(b, "team:claim", { team: "missionary" }),
  ]);
  assert.equal(races.filter((r) => r.ok).length, 1);
  assert.equal(races.filter((r) => r.err).length, 1);
  const other = r.teams.missionary.captainId === first.pid ? b : a;
  await request(other, "team:claim", { team: "cowgirl" });
  await request(b, "ready");
  assert.equal(await request(a, "start"), null);
  assert.equal(r.started, true);
  assert.equal(
    Object.values(r.tm).reduce((n, e) => n + e.cash, 0),
    3000,
  );
  const current = r.players[r.cur],
    s = current.id === first.pid ? a : b;
  assert.equal(
    await request(s, "act", { a: "roll", d: { dice: [6, 6], cash: 1e9 } }),
    null,
  );
  assert.ok(r.dice.every((n) => n >= 1 && n <= 6));
  assert.ok(await request(attacker, "act", { a: "end", pid: current.id }));
  const views = [];
  a.once("state", (s) => views.push(s));
  await request(s, "act", { a: "bogus" });
  assert.ok(views.length);
  assert.ok(views[0].players.every((p) => !p.secret && !p.socketId));
});
test("reconnect requires secret, preserves team seat, revokes replaced socket authority", async (t) => {
  const server = await setup(t),
    a = await server.connect(),
    b = await server.connect();
  const first = await request(a, "create", { name: "A", mode: "team" });
  await request(a, "team:claim", { team: "scissors" });
  const re = await request(b, "join", {
    code: first.code,
    pid: first.pid,
    secret: first.secret,
  });
  assert.equal(re.pid, first.pid);
  const r = server.rooms.get(first.code);
  assert.equal(r.players.length, 1);
  assert.equal(r.teams.scissors.captainId, first.pid);
  assert.ok((await request(a, "team:claim", { team: "cowgirl" })).err);
  a.disconnect();
  assert.equal(r.players[0].on, true);
});
test("team chat is private; spam is bounded; kick revokes authority", async (t) => {
  const server = await setup(t),
    a = await server.connect(),
    b = await server.connect(),
    c = await server.connect();
  const first = await request(a, "create", { name: "A", mode: "team" }),
    second = await request(b, "join", { name: "B", code: first.code });
  await request(c, "join", { name: "C", code: first.code });
  await request(a, "team:claim", { team: "missionary" });
  await request(b, "team:join", { team: "missionary" });
  await request(c, "team:claim", { team: "cowgirl" });
  let teamReceived = 0,
    opponentReceived = 0;
  b.on("chat", () => teamReceived++);
  c.on("chat", () => opponentReceived++);
  assert.equal(
    (await request(a, "chat", { scope: "team", text: "Private" })).ok,
    1,
  );
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(teamReceived, 1);
  assert.equal(opponentReceived, 0);
  for (let i = 0; i < 4; i++) await request(a, "chat", { text: "Hi" });
  assert.ok((await request(a, "chat", { text: "spam" })).err);
  await request(a, "kick", second.pid);
  assert.ok(await request(b, "act", { a: "roll" }));
  assert.ok(
    (
      await request(b, "join", {
        code: first.code,
        pid: second.pid,
        secret: second.secret,
      })
    ).ok,
  );
  const r = server.rooms.get(first.code);
  assert.notEqual(r.players.find((p) => p.name === "Guest")?.id, second.pid);
});
test("malformed handlers without acknowledgement do not crash; health and headers work", async (t) => {
  const server = await setup(t),
    a = await server.connect();
  a.emit("start");
  a.emit("create", null);
  await request(a, "ready");
  const health = await fetch(server.url + "/health");
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);
  assert.ok(health.headers.get("content-security-policy"));
});
test("eight real seats fill a room; ninth is rejected; non-host cannot alter settings or start", async (t) => {
  const server = await setup(t),
    sockets = [];
  for (let i = 0; i < 9; i++) sockets.push(await server.connect());
  const first = await request(sockets[0], "create", { name: "Host" });
  for (let i = 1; i < 8; i++)
    assert.equal(
      (await request(sockets[i], "join", { code: first.code, name: "P" + i }))
        .ok,
      1,
    );
  assert.match(
    (await request(sockets[8], "join", { code: first.code })).err,
    /full/,
  );
  assert.ok((await request(sockets[1], "settings", { mode: "team" })).err);
  assert.equal(await request(sockets[1], "start"), "Host only.");
  for (let i = 1; i < 8; i++) await request(sockets[i], "ready");
  assert.equal(await request(sockets[0], "start"), null);
  assert.equal(server.rooms.get(first.code).players.length, 8);
});
