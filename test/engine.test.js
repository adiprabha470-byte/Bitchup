const test = require("node:test"),
  assert = require("node:assert");
const G = require("../server/game");
const mkRoom = (n) => {
  const r = G.mk("TEST", "p0", 1500, false);
  for (let i = 0; i < n; i++)
    r.players.push({
      id: "p" + i,
      name: "P" + i,
      ready: true,
      on: true,
      token: "x",
    });
  G.start(r);
  return r;
};
const pick = (a) => a[Math.floor(Math.random() * a.length)];

test("board has 40 spaces, 22 properties, 4 airports, 2 utilities", () => {
  assert.equal(G.B.length, 40);
  assert.equal(G.B.filter((s) => s.t === "prop").length, 22);
  assert.equal(G.B.filter((s) => s.t === "air").length, 4);
  assert.equal(G.B.filter((s) => s.t === "util").length, 2);
});
test("rejects out-of-turn and malformed actions", () => {
  const r = mkRoom(3),
    other = r.players.find((p) => p.id !== r.players[r.cur].id);
  assert.equal(G.act(r, other.id, "roll"), "Not your turn.");
  assert.ok(G.act(r, r.players[r.cur].id, "buy"));
});
test("300 random games: invariants hold, no stalls, always terminate", () => {
  for (let g = 0; g < 300; g++) {
    const r = mkRoom(2 + (g % 7));
    let n = 0;
    while (r.phase !== "over" && n++ < 4000) {
      const p = r.players[r.cur],
        ph = r.phase;
      assert.ok(!p.out, "current player is eliminated");
      let a = {
        roll: "roll",
        buy: pick(["buy", "pass"]),
        end: "end",
        jet: "jet",
        debt: "bankrupt",
        choice: "choice",
      }[ph];
      if (p.caught && ph === "roll" && Math.random() < 0.3)
        a = pick(["fine", "lawyer", "card"]);
      assert.ok(a, "stuck phase " + ph);
      G.act(
        r,
        r.phase === "debt" ? r.debts[0].pid : p.id,
        a,
        r.phase === "choice"
          ? r.choice.options[0]
          : Math.floor(Math.random() * 40),
      );
      for (const q of r.players) {
        assert.ok(Number.isFinite(q.cash) && q.cash >= 0, "bad cash " + q.cash);
        assert.ok(q.pos >= 0 && q.pos < 40);
      }
      for (const [i, o] of Object.entries(r.props))
        assert.ok(
          ["prop", "air", "util"].includes(G.B[i].t) &&
            r.players.find((q) => q.id === o.o && !q.out),
          "orphan property",
        );
    }
    if (r.phase === "over")
      assert.ok(r.players.filter((q) => !q.out).length <= 1);
  }
});
test("skip() advances a departed player and leaves others alone", () => {
  const r = mkRoom(3),
    p = r.players[r.cur],
    other = r.players.find((q) => q !== p);
  assert.equal(G.skip(r, other.id), false);
  assert.equal(G.skip(r, p.id), true);
  assert.notEqual(r.players[r.cur].id, p.id);
});
