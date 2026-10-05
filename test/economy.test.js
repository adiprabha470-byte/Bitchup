const test = require("node:test"),
  assert = require("node:assert/strict"),
  G = require("../server/game"),
  T = require("../server/teams");
function game(team = false) {
  const r = G.mk("TEST", "a", 1500, false);
  r.players = ["a", "b", "c", "d"].map((id) => ({ id, name: id, on: true }));
  if (team) {
    r.mode = "team";
    T.claim(r, "a", "missionary");
    T.join(r, "b", "missionary");
    T.claim(r, "c", "cowgirl");
    T.join(r, "d", "cowgirl");
  }
  G.start(r);
  return r;
}
const current = (r) => r.players[r.cur],
  own = (r, i, p = current(r)) => (r.props[i] = { o: G._E(r, p).id, mult: 1 });
test("full collection, even build/sell, five upgrades and luxury discount", () => {
  const r = game(),
    p = current(r);
  own(r, 1);
  assert.match(G.act(r, p.id, "upgrade", 1), /complete/);
  own(r, 3);
  p.lux = 1;
  let cash = p.cash;
  assert.equal(G.act(r, p.id, "upgrade", 1), null);
  assert.equal(p.cash, cash - 15);
  assert.equal(p.lux, 0);
  assert.match(G.act(r, p.id, "upgrade", 1), /evenly/);
  G.act(r, p.id, "upgrade", 3);
  for (let l = 1; l < 5; l++) {
    G.act(r, p.id, "upgrade", 1);
    G.act(r, p.id, "upgrade", 3);
  }
  assert.equal(r.props[1].level, 5);
  assert.match(G.act(r, p.id, "upgrade", 1), /Cannot/);
  assert.equal(G.act(r, p.id, "sell", 1), null);
  assert.match(G.act(r, p.id, "sell", 1), /evenly/);
});
test("mortgage pays half; rent stops; redeem costs 55%; improved collection rejected", () => {
  const r = game(),
    p = current(r),
    q = r.players.find((q) => q !== p);
  own(r, 1);
  const cash = p.cash;
  assert.equal(G.act(r, p.id, "mortgage", 1), null);
  assert.equal(p.cash, cash + 30);
  q.pos = 1;
  r.cur = r.players.indexOf(q);
  const before = q.cash;
  G._land(r, q);
  assert.equal(q.cash, before);
  assert.equal(G.act(r, p.id, "redeem", 1), null);
  assert.equal(p.cash, cash - 3);
  own(r, 3, p);
  r.props[3].level = 1;
  assert.match(G.act(r, p.id, "mortgage", 1), /Sell/);
});
test("debt holds turn, raises cash, settles creditor, and resumes", () => {
  const r = game(),
    p = current(r),
    q = r.players.find((q) => q !== p);
  p.cash = 0;
  own(r, 39);
  const old = q.cash;
  G._pay(r, p, 150, q, "rent");
  assert.equal(r.phase, "debt");
  assert.ok(G.act(r, p.id, "end"));
  assert.equal(G.act(r, p.id, "mortgage", 39), null);
  assert.equal(p.cash, 200);
  assert.equal(G.act(r, p.id, "settle"), null);
  assert.equal(q.cash, old + 150);
  assert.equal(p.cash, 50);
  assert.equal(r.debts.length, 0);
  assert.equal(r.phase, "end");
});
test("team bankruptcy eliminates all members and transfers assets to opponent", () => {
  const r = game(true),
    p = current(r),
    q = r.players.find((q) => q.team !== p.team),
    e = G._E(r, p);
  e.cash = 0;
  own(r, 39);
  G._pay(r, p, 200, q, "rent");
  assert.equal(G.act(r, p.id, "bankrupt"), null);
  assert.ok(r.players.filter((q) => q.team === p.team).every((q) => q.out));
  assert.equal(r.props[39].o, q.team);
  assert.equal(r.phase, "over");
  assert.equal(r.winner, q.team);
});
test("trade both sides, rejects foreign/duplicate/malformed assets, no double acceptance", () => {
  const r = game(),
    p = current(r),
    q = r.players.find((q) => q !== p);
  own(r, 1, p);
  own(r, 3, q);
  const offer = {
    to: q.id,
    give: { cash: 100, props: [1] },
    want: { cash: 50, props: [3] },
  };
  assert.ok(
    G.act(r, p.id, "offer", { ...offer, give: { cash: 0, props: [3] } }),
  );
  assert.ok(
    G.act(r, p.id, "offer", { ...offer, give: { cash: -1, props: [] } }),
  );
  assert.ok(
    G.act(r, p.id, "offer", { ...offer, give: { cash: 0, props: [1, 1] } }),
  );
  assert.equal(G.act(r, p.id, "offer", offer), null);
  const t = r.trades[0];
  assert.ok(G.act(r, p.id, "accept", t.id));
  assert.equal(G.act(r, q.id, "accept", t.id), null);
  assert.equal(r.props[1].o, q.id);
  assert.equal(r.props[3].o, p.id);
  assert.equal(p.cash, 1450);
  assert.equal(q.cash, 1550);
  assert.ok(G.act(r, q.id, "accept", t.id));
});
test("trade revalidates wallet and ownership after offer", () => {
  const r = game(),
    p = current(r),
    q = r.players.find((q) => q !== p);
  own(r, 1);
  G.act(r, p.id, "offer", {
    to: q.id,
    give: { cash: 100, props: [1] },
    want: { cash: 0, props: [] },
  });
  p.cash = 0;
  assert.match(G.act(r, q.id, "accept", r.trades[0].id), /expired/);
  assert.equal(r.props[1].o, p.id);
});
test("team trade can be accepted by recipient teammate and uses shared finances", () => {
  const r = game(true),
    p = current(r),
    e = G._E(r, p),
    q = r.players.find((q) => q.team !== p.team),
    target = G._E(r, q);
  own(r, 1);
  G.act(r, p.id, "offer", {
    to: target.id,
    give: { cash: 100, props: [1] },
    want: { cash: 50, props: [] },
  });
  assert.equal(G.act(r, q.id, "accept", r.trades[0].id), null);
  assert.equal(e.cash, 2950);
  assert.equal(target.cash, 3050);
  assert.equal(r.props[1].o, target.id);
});
test("card property choice rejects invalid/foreign location", () => {
  const r = game(),
    p = current(r);
  own(r, 1);
  r.deck.sur = [18];
  G._draw(r, p, "sur");
  assert.equal(r.phase, "choice");
  assert.ok(G.act(r, p.id, "choice", 39));
  assert.equal(G.act(r, p.id, "choice", 1), null);
  assert.equal(r.props[1].mult, 2);
});
test("all 30 Surprise and 20 Treasure effects execute without invalid money or position", () => {
  for (const [kind, count] of [
    ["sur", 30],
    ["tre", 20],
  ])
    for (let i = 0; i < count; i++) {
      const r = game(),
        p = current(r);
      own(r, 1);
      own(r, 3);
      p.lastFee = 75;
      r.deck[kind] = [i];
      G._draw(r, p, kind);
      assert.ok(r.card);
      assert.ok(
        r.players.every(
          (q) =>
            Number.isFinite(q.cash) && q.cash >= 0 && q.pos >= 0 && q.pos < 40,
        ),
      );
      if (r.phase === "choice")
        assert.equal(G.act(r, p.id, "choice", r.choice.options[0]), null);
      if (r.phase === "jet") {
        assert.ok(G.act(r, p.id, "jet", "4abc"));
        assert.equal(G.act(r, p.id, "jet", 20), null);
      }
    }
});
test("fan club charges opposing team once; teammate never pays", () => {
  const r = game(true),
    p = current(r),
    e = G._E(r, p);
  r.deck.tre = [9];
  G._draw(r, p, "tre");
  assert.equal(e.cash, 3050);
  const other = Object.values(r.tm).find((q) => q !== e);
  assert.equal(other.cash, 2950);
});
test("authoritative timer handles every decision, respects OFF and debt", () => {
  const r = game(),
    p = current(r);
  r.timer = 30;
  r.deadline = 100;
  r.phase = "buy";
  p.pos = 1;
  assert.equal(G.timeout(r, 99), false);
  assert.equal(G.timeout(r, 101), true);
  assert.equal(r.phase, "end");
  r.deadline = 100;
  G.timeout(r, 101);
  assert.equal(r.phase, "roll");
  r.deadline = null;
  assert.equal(G.timeout(r, 1e15), false);
  r.deck.sur = [18];
  own(r, 1);
  G._draw(r, current(r), "sur");
  r.deadline = 100;
  G.timeout(r, 101);
  assert.equal(r.choice, null);
});
test("movement paths are generated by server and client dice are ignored", () => {
  const r = game(),
    p = current(r);
  p.pos = 37;
  assert.equal(G.act(r, p.id, "roll", { dice: [100, 100], cash: 1e9 }), null);
  assert.ok(r.dice.every((n) => n >= 1 && n <= 6));
  assert.ok(r.motion.length);
  assert.ok(r.motion.every((m) => m.path.every((i) => i >= 0 && i < 40)));
});
test("view redacts reconnect secrets and internal socket identity", () => {
  const r = game();
  r.players[0].secret = "private";
  r.players[0].socketId = "socket";
  const v = G.view(r);
  assert.equal(v.players[0].secret, undefined);
  assert.equal(v.players[0].socketId, undefined);
  assert.equal(v.deck, undefined);
});
test("prototype team identifiers rejected safely", () => {
  const r = game(true);
  r.started = false;
  assert.equal(T.claim(r, current(r).id, "__proto__"), "NO_TEAM");
});
test("configuration options validate all requested distributions", () => {
  for (const cfg of T.CFGS.filter((c) => c !== "any")) {
    const sizes = cfg.split(/[v+]/).map(Number),
      r = G.mk("TEST", "a", 1500, false);
    r.mode = "team";
    r.cfg = cfg;
    let n = 0;
    sizes.forEach((size, i) => {
      const id = T.DEFS[i][0];
      for (let k = 0; k < size; k++) {
        const pid = "p" + n++;
        r.players.push({ id: pid });
        if (k) T.join(r, pid, id);
        else T.claim(r, pid, id);
      }
    });
    assert.equal(T.validateStart(r), null);
  }
});
test("third CAUGHT fine debt resumes movement after payment instead of charging twice", () => {
  const r = game(),
    p = current(r);
  p.cash = 0;
  p.caught = 1;
  p.ct = 3;
  own(r, 39);
  G._pay(r, p, 100, null, "fine");
  r.resume = { kind: "caught", pid: p.id, steps: 7 };
  G.act(r, p.id, "mortgage", 39);
  assert.equal(G.act(r, p.id, "settle"), null);
  assert.equal(p.caught, 0);
  assert.equal(p.pos, 7);
  assert.equal(p.cash, 100);
  assert.equal(r.resume, null);
});
test("forged upgrade, mortgage, and purchase cannot spend another player wallet", () => {
  const r = game(),
    p = current(r),
    q = r.players.find((x) => x !== p);
  own(r, 1, p);
  own(r, 3, p);
  const before = p.cash;
  assert.ok(G.act(r, q.id, "upgrade", 1));
  assert.ok(G.act(r, q.id, "mortgage", 1));
  assert.ok(G.act(r, q.id, "buy", 1));
  assert.equal(p.cash, before);
  assert.equal(r.props[1].o, p.id);
});
test("double buy intent is serialized and spends only once", () => {
  const r = game(),
    p = current(r);
  p.pos = 1;
  r.phase = "buy";
  assert.equal(G.act(r, p.id, "buy"), null);
  assert.ok(G.act(r, p.id, "buy"));
  assert.equal(p.cash, 1440);
  assert.equal(r.props[1].o, p.id);
});
