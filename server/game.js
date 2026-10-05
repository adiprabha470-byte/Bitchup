const B = require("./board");
const T = require("./teams");
const { randomInt } = require("node:crypto");
const d6 = () => randomInt(1, 7);
const shuf = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const C = (a) => a.map(([t, x, k, v]) => ({ t, x, k, v }));
const AIR = [5, 15, 25, 35];

const SUR = C([
  ["PREMIUM SUBSCRIPTION RENEWED", "Pay $100.", "pay", 100],
  ["FORGOT TO CANCEL TRIAL", "Pay $150.", "pay", 150],
  ["VIP MEMBERSHIP", "Pay $200 and collect $300.", "vip"],
  ["ALGORITHM LOVES YOU", "Collect $250.", "gain", 250],
  ["BAD REVIEW", "Pay $100 for reputation management.", "pay", 100],
  ["PRIVATE PROMOTION", "Collect $200.", "gain", 200],
  ["SUBSCRIPTION LEAK", "Pay $150.", "pay", 150],
  ["TOO MUCH ATTENTION", "Collect $100 from every other player.", "all", 100],
  ["VERIFICATION FEE", "Pay $75.", "pay", 75],
  ["EXCLUSIVE CONTENT BONUS", "Collect $300.", "gain", 300],
  ["WRONG WEBSITE", "Pay $125.", "pay", 125],
  ["VIP AFTER-PARTY", "Move forward 3 spaces.", "move", 3],
  [
    "CAUGHT WITHOUT A PASS",
    "Go directly to CAUGHT. No passing bonus.",
    "caught",
  ],
  ["PREMIUM ACCESS PASS", "Get out of CAUGHT free. Keep until used.", "goojf"],
  ["UNEXPECTED TIP", "Collect $50 from every other player.", "all", 50],
  ["TAX SEASON", "Pay $200.", "pay", 200],
  ["INFLUENCER FEE", "Pay $50 per owned property (max $300).", "prop", 50],
  ["LUCKY NIGHT", "Roll again.", "again"],
  [
    "CONTRACT UPGRADE",
    "Choose a property: its next rent is doubled.",
    "mult",
    2,
  ],
  ["BAD CONTRACT", "Choose a property: its next rent is halved.", "mult", 0.5],
  ["BACK TO SPOTLIGHT", "Move to SPOTLIGHT and collect the bonus.", "goto", 0],
  ["THREE STEPS BACK", "Move back 3 spaces.", "move", -3],
  ["FIVE STEPS FORWARD", "Move forward 5 spaces.", "move", 5],
  ["WRONG TURN", "Move back 2 spaces.", "move", -2],
  ["MAKE AN ENTRANCE", "Move to SPOTLIGHT and get an extra $100.", "entr"],
  ["LATE-NIGHT DETOUR", "Move to AFTER DARK AIRPORT.", "goto", 5],
  ["VIP SHORTCUT", "Move to VIP TERMINAL.", "goto", 15],
  ["PRIVATE JET", "Move to any board location.", "jet"],
  ["CAUGHT RED-HANDED", "Go directly to CAUGHT.", "caught"],
  ["WEEKEND ESCAPE", "Move to PRIVATE GETAWAY.", "goto", 20],
]);
const TRE = C([
  ["SECRET STASH", "Collect $300.", "gain", 300],
  ["VIP PASS", "Move to the nearest airport.", "air"],
  [
    "GOLDEN MEMBERSHIP",
    "Next 3 passes of SPOTLIGHT pay an extra $100.",
    "gold",
  ],
  ["FREE SUBSCRIPTION", "Your next subscription fee is $0.", "freesub"],
  ["SPONSOR DEAL", "Collect $250.", "gain", 250],
  ["PRIVATE JET", "Move to any location.", "jet"],
  ["GET OUT OF CAUGHT FREE", "Keep until used.", "goojf"],
  ["DOUBLE BOOKING", "Your next rent collection is doubled.", "dbl"],
  ["LUXURY UPGRADE", "50% off one property upgrade.", "lux"],
  ["FAN CLUB", "Collect $50 from every other player.", "all", 50],
  [
    "SECRET CONTRACT",
    "Collect $200 but skip your next purchase opportunity.",
    "secret",
  ],
  ["LUCKY TIP", "Roll again.", "again"],
  ["FREE PASS", "Move forward 5 spaces.", "move", 5],
  ["PREMIUM REFUND", "Recover your latest fee (up to $200).", "refund"],
  ["EXCLUSIVE DEAL", "Your next property purchase is 20% off.", "deal"],
  ["SCANDAL SETTLEMENT", "Collect $150.", "gain", 150],
  ["MYSTERY SPONSOR", "Roll a die and collect $50 x result.", "mystery"],
  ["WEEKEND GETAWAY", "Move to PRIVATE GETAWAY.", "goto", 20],
  ["HOT PROPERTY", "Choose a property: +50% rent until your next turn.", "hot"],
  ["ULTIMATE VIP", "Collect $500, then pay a $100 VIP fee.", "ult"],
]);

const mk = (code, host, cash, pub) => ({
  code,
  host,
  cash,
  pub,
  mode: "individual",
  cfg: "any",
  teams: T.create(),
  players: [],
  started: false,
  phase: "lobby",
  cur: 0,
  dice: [1, 1],
  log: [],
  props: {},
  card: null,
  cn: 0,
  extra: false,
  dbl: 0,
});
const log = (r, m) => {
  r.log.push(m);
  if (r.log.length > 60) r.log.shift();
};
const cur = (r) => r.players[r.cur];
// Entity = who holds cash/properties: the player (individual mode) or the player's team (team mode).
const E = (r, p) => (r.tm ? r.tm[p.team] : p);
// Accepts a player or an entity (team) and returns the entity.
const EE = (r, x) => (r.tm && r.tm[x.id] === x ? x : E(r, x));
const entById = (r, id) =>
  (r.tm && Object.hasOwn(r.tm, id) && r.tm[id]) ||
  r.players.find((q) => q.id === id);
const ownedBy = (r, id) =>
  Object.keys(r.props)
    .filter((i) => r.props[i].o === id)
    .map(Number);
const owned = (r, p) => ownedBy(r, E(r, p).id);

function broke(r, p, to) {
  const e = E(r, p),
    target = to && EE(r, to),
    te = target && !target.out ? target : null;
  log(r, `${e.name} is BANKRUPT!`);
  if (te) te.cash += e.cash;
  e.cash = 0;
  e.out = true;
  if (r.tm)
    r.players.forEach((q) => {
      if (q.team === e.id) q.out = true;
    });
  for (const i of ownedBy(r, e.id)) {
    if (te) r.props[i] = { ...r.props[i], o: te.id, level: 0, mult: 1 };
    else delete r.props[i];
  }
}
function pay(r, p, n, to, why = "") {
  const e = E(r, p);
  if (to && EE(r, to) === e) return true; // teammates never pay each other
  if (p.sub && /SUBSCRIPTION|TRIAL/.test(why)) {
    p.sub = 0;
    log(r, `${p.name}'s free subscription covers it.`);
    return true;
  }
  if (e.cash >= n) {
    e.cash -= n;
    if (to) EE(r, to).cash += n;
    else p.lastFee = n;
    return true;
  }
  r.debts ||= [];
  r.debts.push({ pid: p.id, amount: n, to: to ? EE(r, to).id : null, why });
  r.phase = "debt";
  r.deadline = r.timer ? Date.now() + r.timer * 1000 : null;
  return false;
}
function rent(r, i, roll) {
  const s = B[i],
    o = r.props[i];
  if (o.mortgage) return 0;
  const ow = entById(r, o.o),
    has = (a) => r.props[a] && r.props[a].o === o.o;
  let m;
  if (s.t === "air") m = 25 * 2 ** (AIR.filter(has).length - 1);
  else if (s.t === "util")
    m = ([12, 27].filter(has).length > 1 ? 10 : 4) * roll;
  else {
    m = s.rent * [1, 3, 7, 14, 22, 35][o.level || 0];
    if (!o.level && B.every((x, k) => x.g !== s.g || has(k))) m *= 2;
  }
  m *= o.mult || 1;
  if (o.hot) m *= 1.5;
  if (ow.dbl) {
    m *= 2;
    ow.dbl = 0;
  }
  o.mult = 1;
  return Math.round(m);
}
function pass(r, p) {
  E(r, p).cash += 200;
  let m = `${p.name} passes SPOTLIGHT (+$200)`;
  if (p.gold > 0) {
    p.gold--;
    E(r, p).cash += 100;
    m += " +$100 Golden Membership";
  }
  log(r, m + ".");
}
const movePath = (r, p, path) => {
  r.motion ||= [];
  r.motion.push({ n: ++r.mn, pid: p.id, path });
  r.motion = r.motion.slice(-12);
};
const gotoIdx = (r, p, i) => {
  const steps = (i - p.pos + 40) % 40;
  movePath(
    r,
    p,
    Array.from({ length: steps }, (_, k) => (p.pos + k + 1) % 40),
  );
  if (i < p.pos) pass(r, p);
  p.pos = i;
};
const step = (r, p, n) => {
  movePath(
    r,
    p,
    Array.from(
      { length: Math.abs(n) },
      (_, k) => (p.pos + Math.sign(n) * (k + 1) + 80) % 40,
    ),
  );
  const np = (p.pos + n + 40) % 40;
  if (n > 0 && np < p.pos) pass(r, p);
  p.pos = np;
};
function caught(r, p) {
  movePath(r, p, [10]);
  p.caught = 1;
  p.pos = 10;
  p.ct = 0;
  r.extra = false;
  log(r, `${p.name} has been CAUGHT!`);
}

function done(r) {
  const p = cur(r);
  if (r.debts?.length) {
    r.phase = "debt";
    return;
  }
  if (p.out) return next(r);
  r.phase = r.extra && !p.caught ? "roll" : "end";
  r.extra = false;
}
function next(r) {
  const alive = r.players.filter((q) => !q.out),
    w = alive[0];
  if (new Set(alive.map((q) => E(r, q).id)).size < 2) {
    r.phase = "over";
    r.winner = w && E(r, w).id;
    log(r, `${w ? E(r, w).name : "Nobody"} is the BITCHUP CHAMPION!`);
    return;
  }
  do {
    r.cur = (r.cur + 1) % r.players.length;
  } while (cur(r).out);
  owned(r, cur(r)).forEach((i) => {
    r.props[i].hot = 0;
  });
  r.phase = "roll";
  r.extra = false;
  r.dbl = 0;
  r.turn = (r.turn || 0) + 1;
  r.deadline = r.timer ? Date.now() + r.timer * 1000 : null;
}
function land(r, p) {
  const i = p.pos,
    s = B[i];
  switch (s.t) {
    case "prop":
    case "air":
    case "util": {
      const o = r.props[i];
      if (!o) {
        if (p.skip) {
          p.skip = 0;
          log(r, `${p.name} skips the purchase (Secret Contract).`);
        } else {
          r.phase = "buy";
          return;
        }
      } else if (o.o !== E(r, p).id) {
        const ow = entById(r, o.o),
          n = rent(r, i, r.dice[0] + r.dice[1]);
        log(r, `${p.name} pays $${n} rent to ${ow.name} at ${s.n}.`);
        pay(r, p, n, ow, "rent");
      }
      break;
    }
    case "tax": {
      const n = i === 4 ? Math.min(150, Math.round(E(r, p).cash * 0.1)) : 75;
      log(r, `${p.name} pays $${n} at ${s.n}.`);
      pay(r, p, n, null, "tax");
      break;
    }
    case "sur":
    case "tre":
      return draw(r, p, s.t);
    case "goto":
      caught(r, p);
      break;
    case "getaway":
      E(r, p).cash += 100;
      log(r, `${p.name} enjoys PRIVATE GETAWAY (+$100).`);
      break;
  }
  done(r);
}
function draw(r, p, kind) {
  const src = kind === "sur" ? SUR : TRE;
  if (!r.deck[kind].length) r.deck[kind] = shuf(src.map((_, i) => i));
  const c = src[r.deck[kind].pop()];
  r.card = { kind, t: c.t, x: c.x, pid: p.id, n: ++r.cn };
  log(
    r,
    `${p.name} drew a ${kind === "sur" ? "Surprise" : "Treasure"} card: ${c.t}.`,
  );
  const v = c.v,
    mine = owned(r, p)
      .filter((i) => B[i].t === "prop")
      .sort((a, b) => B[b].p - B[a].p);
  switch (c.k) {
    case "pay":
      pay(r, p, v, null, c.t);
      break;
    case "gain":
      E(r, p).cash += v;
      break;
    case "vip":
      pay(r, p, 200, null, "VIP fee");
      E(r, p).cash += 300;
      break;
    case "all": {
      const seen = new Set();
      r.players
        .filter((q) => !q.out && E(r, q) !== E(r, p))
        .forEach((q) => {
          const id = E(r, q).id;
          if (!seen.has(id)) {
            seen.add(id);
            pay(r, q, v, p, "fan");
          }
        });
      break;
    }
    case "prop":
      pay(r, p, Math.min(300, v * owned(r, p).length), null, "fee");
      break;
    case "move":
      step(r, p, v);
      return land(r, p);
    case "goto":
      gotoIdx(r, p, v);
      return land(r, p);
    case "entr":
      gotoIdx(r, p, 0);
      E(r, p).cash += 100;
      return land(r, p);
    case "air":
      gotoIdx(r, p, AIR.find((a) => a > p.pos) ?? 5);
      return land(r, p);
    case "caught":
      caught(r, p);
      break;
    case "goojf":
      p.goojf++;
      break;
    case "again":
      r.extra = true;
      break;
    case "jet":
      r.phase = "jet";
      return;
    case "mult":
      if (mine.length) {
        r.choice = { kind: "mult", value: v, options: mine };
        r.phase = "choice";
        return;
      }
      break;
    case "hot":
      if (mine.length) {
        r.choice = { kind: "hot", options: mine };
        r.phase = "choice";
        return;
      }
      break;
    case "gold":
      p.gold = 3;
      break;
    case "freesub":
      p.sub = 1;
      break;
    case "dbl":
      E(r, p).dbl = 1;
      break;
    case "lux":
      p.lux = 1;
      break; // consumed by upgrades in Phase 2
    case "secret":
      E(r, p).cash += 200;
      p.skip = 1;
      break;
    case "refund":
      E(r, p).cash += Math.min(200, p.lastFee || 0);
      p.lastFee = 0;
      break;
    case "deal":
      p.disc = 0.8;
      break;
    case "mystery": {
      const n = d6();
      E(r, p).cash += 50 * n;
      log(r, `${p.name} rolled ${n} and collects $${50 * n}.`);
      break;
    }
    case "ult":
      E(r, p).cash += 500;
      pay(r, p, 100, null, "VIP fee");
      break;
  }
  done(r);
}

function start(r) {
  r.started = true;
  r.props = {};
  r.cn = 0;
  r.winner = null;
  r.debts = [];
  r.trades = [];
  r.motion = [];
  r.mn = 0;
  r.rollN = 0;
  r.turn = 0;
  r.choice = null;
  r.resume = null;
  r.deck = { sur: shuf(SUR.map((_, i) => i)), tre: shuf(TRE.map((_, i) => i)) };
  r.tm = undefined;
  if (r.mode === "team") {
    // shared wallet: each member contributes the starting cash
    r.tm = {};
    for (const t of Object.values(r.teams))
      if (t.memberIds.length)
        r.tm[t.id] = {
          id: t.id,
          name: t.name,
          icon: t.icon,
          cash: r.cash * t.memberIds.length,
          out: false,
          dbl: 0,
          captainId: t.captainId,
          memberIds: [...t.memberIds],
        };
  }
  r.players.forEach((p) =>
    Object.assign(p, {
      team: r.tm ? (T.teamOf(r, p.id) || {}).id : undefined,
      cash: r.tm ? 0 : r.cash,
      pos: 0,
      caught: 0,
      ct: 0,
      out: false,
      goojf: 0,
      gold: 0,
    }),
  );
  shuf(r.players);
  r.cur = -1;
  r.log = ["The night begins. Roll. Buy. Flirt. Flex."];
  next(r);
}

// All player intents go through here; returns an error string or null.
function act(r, pid, a, d) {
  if (
    [
      "upgrade",
      "sell",
      "mortgage",
      "redeem",
      "settle",
      "bankrupt",
      "offer",
      "accept",
      "reject",
    ].includes(a)
  )
    return economy(r, pid, a, d);
  const p = cur(r);
  if (!r.started || r.phase === "over" || !p || p.id !== pid)
    return "Not your turn.";
  const ph = r.phase;
  if (a === "roll" && ph === "roll") {
    const x = d6(),
      y = d6(),
      n = x + y,
      dbl = x === y;
    r.dice = [x, y];
    r.rollN = (r.rollN || 0) + 1;
    log(r, `${p.name} rolled ${x}+${y}${dbl ? " (doubles!)" : ""}.`);
    if (p.caught) {
      if (dbl) {
        p.caught = 0;
        log(r, `${p.name} escaped CAUGHT with doubles!`);
      } else if (++p.ct >= 3) {
        log(r, `${p.name} pays the $100 fine and leaves CAUGHT.`);
        if (!pay(r, p, 100, null, "fine")) {
          r.resume = { kind: "caught", pid: p.id, steps: n };
          done(r);
          return null;
        }
        p.caught = 0;
      } else {
        r.phase = "end";
        return null;
      }
      r.extra = false;
      step(r, p, n);
      land(r, p);
      return null;
    }
    if (dbl) {
      if (++r.dbl === 3) {
        caught(r, p);
        r.phase = "end";
        return null;
      }
      r.extra = true;
    }
    step(r, p, n);
    land(r, p);
    return null;
  }
  if (p.caught && ph === "roll" && ["fine", "lawyer", "card"].includes(a)) {
    const c = { fine: 100, lawyer: 250 }[a];
    if (c) {
      if (E(r, p).cash < c) return "Not enough cash.";
      E(r, p).cash -= c;
    } else {
      if (!p.goojf) return "No Get Out of CAUGHT card.";
      p.goojf--;
    }
    p.caught = 0;
    log(
      r,
      `${p.name} leaves CAUGHT (${a === "lawyer" ? "called a lawyer" : a === "fine" ? "paid $100" : "used a card"}).`,
    );
    return null;
  }
  if (a === "buy" && ph === "buy") {
    const s = B[p.pos],
      price = Math.round(s.p * (p.disc || 1));
    if (E(r, p).cash < price) return `You need $${price - E(r, p).cash} more.`;
    E(r, p).cash -= price;
    p.disc = 0;
    r.props[p.pos] = { o: E(r, p).id, mult: 1 };
    log(
      r,
      `${p.name} bought ${s.n}${s.city ? " (" + s.city + ")" : ""} for $${price}.`,
    );
    done(r);
    return null;
  }
  if (a === "pass" && ph === "buy") {
    log(r, `${p.name} passes on ${B[p.pos].n}.`);
    done(r);
    return null;
  }
  if (a === "end" && ph === "end") {
    next(r);
    return null;
  }
  if (a === "jet" && ph === "jet") {
    const i = d;
    if (!Number.isInteger(i) || !(i >= 0 && i < 40)) return "Bad location.";
    gotoIdx(r, p, i);
    land(r, p);
    return null;
  }
  if (a === "choice" && ph === "choice") {
    const i = d;
    if (
      !Number.isInteger(i) ||
      !r.choice.options.includes(i) ||
      r.props[i]?.o !== E(r, p).id
    )
      return "Invalid choice.";
    if (r.choice.kind === "mult") r.props[i].mult = r.choice.value;
    else r.props[i].hot = 1;
    r.choice = null;
    done(r);
    return null;
  }
  return "Not allowed right now.";
}
const view = (r) => ({
  ...r,
  deck: undefined,
  players: r.players.map(({ secret, socketId, awayAt, ...p }) => p),
});
// Forfeit the turn of a player who left mid-turn so the table never stalls.
function skip(r, pid) {
  if (r.debts?.length) {
    const d = r.debts[0];
    if (d.pid === pid) {
      const q = r.players.find((x) => x.id === pid);
      economy(r, pid, E(r, q).cash >= d.amount ? "settle" : "bankrupt");
      return true;
    }
    return false;
  }
  const p = cur(r);
  if (!r.started || r.phase === "over" || !p || p.id !== pid) return false;
  log(r, `${p.name} is away - turn skipped.`);
  next(r);
  return true;
}
module.exports = {
  mk,
  start,
  act,
  view,
  skip,
  timeout,
  B,
  _land: land,
  _E: E,
  _draw: draw,
  _pay: pay,
};

// Asset actions and trades are validated against the same entity wallet used by rent.
const upgradeCost = (i) => Math.ceil(B[i].p / 2);
function economy(r, pid, a, d = {}) {
  const p = r.players.find((x) => x.id === pid);
  if (!r.started || r.phase === "over" || !p || p.out)
    return "Game is not active.";
  const e = E(r, p),
    debt = r.debts?.[0];
  if (["offer", "accept", "reject"].includes(a)) return trade(r, p, e, a, d);
  if (a === "settle" || a === "bankrupt") {
    if (
      !debt ||
      E(
        r,
        r.players.find((x) => x.id === debt.pid),
      ).id !== e.id
    )
      return "No debt to resolve.";
    if (a === "settle") {
      if (e.cash < debt.amount) return "Raise more cash first.";
      e.cash -= debt.amount;
      if (debt.to && !entById(r, debt.to)?.out)
        entById(r, debt.to).cash += debt.amount;
      else p.lastFee = debt.amount;
    } else
      broke(
        r,
        r.players.find((x) => x.id === debt.pid),
        debt.to ? entById(r, debt.to) : null,
      );
    r.debts.shift();
    if (r.debts.length) {
      r.phase = "debt";
      r.deadline = r.timer ? Date.now() + r.timer * 1000 : null;
      return null;
    }
    if (r.resume) {
      const continuation = r.resume;
      r.resume = null;
      const q = r.players.find((x) => x.id === continuation.pid);
      if (!q.out) {
        q.caught = 0;
        r.extra = false;
        step(r, q, continuation.steps);
        land(r, q);
        return null;
      }
    }
    done(r);
    return null;
  }
  const i = d,
    o = r.props[i];
  if (!Number.isInteger(i) || !o || o.o !== e.id)
    return "You do not own this property.";
  if (a === "upgrade") {
    if (cur(r).id !== pid || !["roll", "end"].includes(r.phase))
      return "Upgrade on your turn before rolling or ending.";
    if (B[i].t !== "prop" || o.mortgage || (o.level || 0) >= 5)
      return "Cannot upgrade this property.";
    const group = B.map((x, k) => (x.g === B[i].g ? k : -1)).filter(
      (k) => k >= 0,
    );
    if (group.some((k) => r.props[k]?.o !== e.id || r.props[k].mortgage))
      return "Own the complete, unmortgaged collection first.";
    if (group.some((k) => (r.props[k].level || 0) < (o.level || 0)))
      return "Build evenly across the collection.";
    const cost = Math.round(upgradeCost(i) * (p.lux ? 0.5 : 1));
    if (e.cash < cost) return "Not enough cash.";
    e.cash -= cost;
    p.lux = 0;
    o.level = (o.level || 0) + 1;
  } else if (a === "sell") {
    if (!o.level) return "No upgrade to sell.";
    if (B.some((x, k) => x.g === B[i].g && (r.props[k]?.level || 0) > o.level))
      return "Sell evenly across the collection.";
    o.level--;
    e.cash += Math.floor(upgradeCost(i) / 2);
  } else if (a === "mortgage") {
    if (
      o.mortgage ||
      B.some((x, k) => x.g && x.g === B[i].g && r.props[k]?.level)
    )
      return "Sell collection upgrades before mortgaging.";
    o.mortgage = true;
    e.cash += Math.floor(B[i].p / 2);
  } else if (a === "redeem") {
    const cost = Math.ceil(B[i].p * 0.55);
    if (!o.mortgage || e.cash < cost) return "Cannot redeem this mortgage.";
    o.mortgage = false;
    e.cash -= cost;
  } else return "Unknown asset action.";
  log(r, `${e.name}: ${a} · ${B[i].n}.`);
  return null;
}
function trade(r, p, e, a, d) {
  r.trades ||= [];
  if (a === "offer") {
    if (r.debts?.length) return "Resolve outstanding debt before trading.";
    if (!d || typeof d !== "object") return "Invalid offer.";
    const target = entById(r, d.to);
    if (!target || target === e || target.out)
      return "Choose an opposing owner.";
    const asset = (x, id) =>
      x &&
      Number.isSafeInteger(x.cash) &&
      x.cash >= 0 &&
      x.cash <= entById(r, id).cash &&
      Array.isArray(x.props) &&
      x.props.length <= 28 &&
      new Set(x.props).size === x.props.length &&
      x.props.every(
        (i) =>
          Number.isInteger(i) &&
          r.props[i]?.o === id &&
          !r.props[i].level &&
          !r.props[i].mortgage &&
          !B.some((b, k) => b.g && b.g === B[i].g && r.props[k]?.level),
      );
    if (!asset(d.give, e.id) || !asset(d.want, target.id))
      return "Invalid cash or properties. Improved and mortgaged assets cannot be traded.";
    if (
      !d.give.cash &&
      !d.want.cash &&
      !d.give.props.length &&
      !d.want.props.length
    )
      return "Offer cannot be empty.";
    if (r.trades.filter((t) => t.status === "open").length >= 8)
      return "Resolve existing offers first.";
    r.trades.push({
      id: require("node:crypto").randomUUID(),
      from: e.id,
      to: target.id,
      give: { cash: d.give.cash, props: [...d.give.props] },
      want: { cash: d.want.cash, props: [...d.want.props] },
      status: "open",
      turn: r.turn,
    });
    return null;
  }
  const t = r.trades.find((x) => x.id === d && x.status === "open");
  if (!t || ![t.from, t.to].includes(e.id)) return "Offer is unavailable.";
  if (a === "reject") {
    t.status = "rejected";
    return null;
  }
  if (e.id !== t.to) return "Only the recipient may accept.";
  if (r.debts?.length) return "Resolve debt first.";
  const from = entById(r, t.from),
    to = entById(r, t.to);
  const valid = (x, id) =>
    x.cash <= entById(r, id).cash &&
    x.props.every(
      (i) =>
        r.props[i]?.o === id &&
        !r.props[i].level &&
        !r.props[i].mortgage &&
        !B.some((b, k) => b.g && b.g === B[i].g && r.props[k]?.level),
    );
  if (from.out || to.out || !valid(t.give, t.from) || !valid(t.want, t.to)) {
    t.status = "expired";
    return "Offer expired: assets changed.";
  }
  from.cash += t.want.cash - t.give.cash;
  to.cash += t.give.cash - t.want.cash;
  t.give.props.forEach((i) => (r.props[i].o = t.to));
  t.want.props.forEach((i) => (r.props[i].o = t.from));
  t.status = "accepted";
  log(r, `${from.name} and ${to.name} closed a deal.`);
  return null;
}
function timeout(r, now = Date.now()) {
  if (!r.started || r.phase === "over" || !r.deadline || now < r.deadline)
    return false;
  const p = cur(r);
  if (r.phase === "debt") {
    const d = r.debts[0],
      q = r.players.find((x) => x.id === d.pid);
    economy(r, q.id, E(r, q).cash >= d.amount ? "settle" : "bankrupt");
  } else if (r.phase === "buy") act(r, p.id, "pass");
  else if (r.phase === "jet") act(r, p.id, "jet", 0);
  else if (r.phase === "choice") act(r, p.id, "choice", r.choice.options[0]);
  else if (r.phase === "roll") act(r, p.id, "roll");
  else if (r.phase === "end") act(r, p.id, "end");
  if (r.deadline && r.deadline <= now) r.deadline = now + 8000;
  return true;
}
