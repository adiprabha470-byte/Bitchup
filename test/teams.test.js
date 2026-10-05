const test = require("node:test"),
  assert = require("node:assert");
const G = require("../server/game"),
  T = require("../server/teams");
const room = (n, mode = "team") => {
  const r = G.mk("TEAMS1", "p0", 1500, false);
  r.mode = mode;
  for (let i = 0; i < n; i++)
    r.players.push({
      id: "p" + i,
      name: "P" + i,
      ready: true,
      on: true,
      token: "x",
    });
  return r;
};
const sizes = (r) => Object.values(r.teams).map((t) => t.memberIds.length);

test("T1 room has the 8 fixed team definitions", () => {
  const r = room(2),
    names = Object.values(r.teams).map((t) => t.name);
  assert.deepEqual(names, [
    "MISSIONARY",
    "DOGGY STYLE",
    "COWGIRL",
    "REVERSE COWGIRL",
    "SPOONING",
    "STANDING",
    "69",
    "SCISSORS",
  ]);
  assert.ok(
    Object.values(r.teams).every(
      (t) => t.captainId === null && !t.memberIds.length,
    ),
  );
});
test("T2 claiming makes the player captain and member", () => {
  const r = room(2);
  assert.equal(T.claim(r, "p0", "missionary"), null);
  assert.equal(r.teams.missionary.captainId, "p0");
  assert.deepEqual(r.teams.missionary.memberIds, ["p0"]);
});
test("T3 second player cannot claim a claimed team", () => {
  const r = room(2);
  T.claim(r, "p0", "missionary");
  assert.equal(T.claim(r, "p1", "missionary"), "TEAM_ALREADY_CLAIMED");
  assert.equal(r.teams.missionary.captainId, "p0");
});
test("T4 second player can join", () => {
  const r = room(2);
  T.claim(r, "p0", "missionary");
  assert.equal(T.join(r, "p1", "missionary"), null);
  assert.deepEqual(r.teams.missionary.memberIds, ["p0", "p1"]);
  assert.equal(T.join(r, "p1", "cowgirl"), "TEAM_NOT_CLAIMED"); // cannot join an unclaimed team
});
test("T5 no duplicate MISSIONARY teams", () => {
  const r = room(3);
  T.claim(r, "p0", "missionary");
  T.claim(r, "p1", "missionary");
  T.claim(r, "p2", "missionary");
  assert.equal(Object.keys(r.teams).length, 8);
  assert.equal(
    Object.values(r.teams).filter((t) => t.name === "MISSIONARY").length,
    1,
  );
});
test("T6 player can leave one team and join another", () => {
  const r = room(2);
  T.claim(r, "p0", "missionary");
  T.claim(r, "p1", "cowgirl");
  assert.equal(T.join(r, "p1", "missionary"), null);
  assert.deepEqual(r.teams.cowgirl.memberIds, []);
  assert.deepEqual(r.teams.missionary.memberIds, ["p0", "p1"]);
});
test("T7 empty team becomes available again", () => {
  const r = room(2);
  T.claim(r, "p0", "missionary");
  T.leave(r, "p0");
  assert.equal(r.teams.missionary.captainId, null);
  assert.equal(T.claim(r, "p1", "missionary"), null);
});
test("T8 captain leaving promotes another member", () => {
  const r = room(3);
  T.claim(r, "p0", "missionary");
  T.join(r, "p1", "missionary");
  T.join(r, "p2", "missionary");
  T.leave(r, "p0");
  assert.equal(r.teams.missionary.captainId, "p1");
});
test("T9 simultaneous claims: exactly one captain", () => {
  const r = room(2),
    res = [T.claim(r, "p0", "standing"), T.claim(r, "p1", "standing")];
  assert.deepEqual(res.sort(), [null, "TEAM_ALREADY_CLAIMED"].sort());
  assert.equal(r.teams.standing.memberIds.length, 1);
});
test("T10 a player never belongs to two teams", () => {
  const r = room(2);
  T.claim(r, "p0", "missionary");
  T.claim(r, "p0", "scissors");
  T.claim(r, "p1", "sixtyNine");
  T.join(r, "p0", "sixtyNine");
  for (const p of r.players)
    assert.equal(
      Object.values(r.teams).filter((t) => t.memberIds.includes(p.id)).length,
      1,
    );
  assert.equal(T.claim(r, "p0", "sixtyNine"), "TEAM_ALREADY_CLAIMED");
});
test("T10b rejects bad requests: unknown team, individual mode, started game", () => {
  const r = room(2);
  assert.equal(T.claim(r, "p0", "nope"), "NO_TEAM");
  assert.equal(T.claim(r, "ghost", "cowgirl"), "NO_PLAYER");
  r.mode = "individual";
  assert.equal(T.claim(r, "p0", "cowgirl"), "NOT_TEAM_MODE");
  r.mode = "team";
  r.started = true;
  assert.equal(T.claim(r, "p0", "cowgirl"), "GAME_STARTED");
});
test("T11 individual mode still works: no teams, per-player cash and ownership", () => {
  const r = room(3, "individual");
  G.start(r);
  assert.equal(r.tm, undefined);
  assert.ok(r.players.every((p) => p.cash === 1500));
  const q = r.players[r.cur];
  q.pos = 1;
  r.phase = "buy";
  r.props = {};
  assert.equal(G.act(r, q.id, "buy"), null);
  assert.equal(r.props[1].o, q.id);
  assert.equal(q.cash, 1500 - 60);
});
function teamGame() {
  // missionary p0,p1  vs  doggyStyle p2,p3
  const r = room(4);
  T.claim(r, "p0", "missionary");
  T.join(r, "p1", "missionary");
  T.claim(r, "p2", "doggyStyle");
  T.join(r, "p3", "doggyStyle");
  assert.equal(T.validateStart(r), null);
  G.start(r);
  return r;
}
const P = (r, id) => r.players.find((p) => p.id === id);
test("T12 team mode: wallet is shared, ownership references teamId", () => {
  const r = teamGame();
  assert.equal(r.tm.missionary.cash, 3000);
  assert.ok(r.players.every((p) => p.cash === 0));
  const p = r.players[r.cur];
  p.pos = 1;
  r.phase = "buy";
  r.props = {};
  assert.equal(G.act(r, p.id, "buy"), null);
  assert.equal(r.props[1].o, p.team);
  assert.equal(r.tm[p.team].cash, 3000 - 60);
});
test("T13 teammates do not pay rent to each other", () => {
  const r = teamGame();
  r.props = { 1: { o: "missionary", mult: 1 } };
  const j = P(r, "p1");
  r.cur = r.players.indexOf(j);
  j.pos = 1;
  G._land(r, j);
  assert.equal(r.tm.missionary.cash, 3000);
  assert.equal(r.tm.doggyStyle.cash, 3000);
});
test("T14 opposing team pays rent to the owning team", () => {
  const r = teamGame();
  r.props = { 1: { o: "missionary", mult: 1 } };
  const s = P(r, "p2");
  r.cur = r.players.indexOf(s);
  s.pos = 1;
  G._land(r, s);
  const rent = G.B[1].rent;
  assert.equal(r.tm.doggyStyle.cash, 3000 - rent);
  assert.equal(r.tm.missionary.cash, 3000 + rent);
});
test("T15 team configuration validation", () => {
  const r = room(4);
  T.claim(r, "p0", "missionary");
  T.join(r, "p1", "missionary");
  T.claim(r, "p2", "cowgirl");
  assert.match(T.validateStart(r), /every player/i); // p3 has no team
  T.join(r, "p3", "missionary");
  r.cfg = "2v2";
  assert.match(T.validateStart(r), /2v2/); // 3+1
  T.join(r, "p3", "cowgirl");
  assert.equal(T.validateStart(r), null); // 2+2
  r.cfg = "3+3+2";
  assert.ok(T.validateStart(r));
  r.cfg = "any";
  assert.equal(T.validateStart(r), null);
  const one = room(2);
  T.claim(one, "p0", "missionary");
  T.join(one, "p1", "missionary");
  assert.match(T.validateStart(one), /2 teams/);
});
test("team bankruptcy eliminates all members and a team wins; 100 random team games stay consistent", () => {
  for (let g = 0; g < 100; g++) {
    const r = room(6);
    ["p0", "p1", "p2"].forEach((id, k) =>
      k ? T.join(r, id, "missionary") : T.claim(r, id, "missionary"),
    );
    ["p3", "p4", "p5"].forEach((id, k) =>
      k ? T.join(r, id, "cowgirl") : T.claim(r, id, "cowgirl"),
    );
    G.start(r);
    let n = 0;
    while (r.phase !== "over" && n++ < 4000) {
      const p = r.players[r.cur],
        a = {
          roll: "roll",
          buy: Math.random() < 0.7 ? "buy" : "pass",
          end: "end",
          jet: "jet",
          debt: "bankrupt",
          choice: "choice",
        }[r.phase];
      assert.ok(a && !p.out);
      G.act(
        r,
        r.phase === "debt" ? r.debts[0].pid : p.id,
        a,
        r.phase === "choice"
          ? r.choice.options[0]
          : Math.floor(Math.random() * 40),
      );
      for (const t of Object.values(r.tm))
        assert.ok(t.cash >= 0 && Number.isFinite(t.cash));
      for (const o of Object.values(r.props))
        assert.ok(r.tm[o.o] && !r.tm[o.o].out, "orphan team property");
    }
    if (r.phase === "over") {
      assert.ok(r.tm[r.winner]);
      assert.ok(
        r.players.filter((p) => !p.out).every((p) => p.team === r.winner),
      );
    }
  }
});
