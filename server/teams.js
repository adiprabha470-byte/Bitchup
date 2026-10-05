// BitchUp teams: 8 fixed, never locked/hidden. memberIds is the single source of truth for membership.
const DEFS = [
  ["missionary", "MISSIONARY", "🔥"],
  ["doggyStyle", "DOGGY STYLE", "🍑"],
  ["cowgirl", "COWGIRL", "💋"],
  ["reverseCowgirl", "REVERSE COWGIRL", "😈"],
  ["spooning", "SPOONING", "💦"],
  ["standing", "STANDING", "👠"],
  ["sixtyNine", "69", "💋"],
  ["scissors", "SCISSORS", "✂️"],
];
const CFGS = ["any", "4v4", "3v3", "2v2", "3+3+2", "2+2+2", "2+2+2+2", "5v3"];
const create = () =>
  Object.fromEntries(
    DEFS.map(([id, name, icon]) => [
      id,
      { id, name, icon, captainId: null, memberIds: [] },
    ]),
  );
const teamOf = (r, pid) =>
  Object.values(r.teams).find((t) => t.memberIds.includes(pid));

function check(r, pid, id) {
  if (!r) return "NO_ROOM";
  if (r.mode !== "team") return "NOT_TEAM_MODE";
  if (r.started) return "GAME_STARTED";
  if (!r.players.some((p) => p.id === pid)) return "NO_PLAYER";
  if (id !== undefined && !Object.hasOwn(r.teams, id)) return "NO_TEAM";
  return null;
}
function leave(r, pid) {
  const t = r && r.teams && teamOf(r, pid);
  if (!t) return null;
  t.memberIds = t.memberIds.filter((x) => x !== pid);
  t.captainId = t.memberIds.length
    ? t.captainId === pid
      ? t.memberIds[0]
      : t.captainId
    : null; // empty => AVAILABLE again
  return null;
}
// Claiming/joining while on another team moves the player atomically (validate target first, then leave old).
function claim(r, pid, id) {
  const e = check(r, pid, id);
  if (e) return e;
  const t = r.teams[id];
  if (t.captainId) return "TEAM_ALREADY_CLAIMED";
  if (t.memberIds.includes(pid)) return "ALREADY_ON_TEAM";
  leave(r, pid);
  t.captainId = pid;
  t.memberIds.push(pid);
  return null;
}
function join(r, pid, id) {
  const e = check(r, pid, id);
  if (e) return e;
  const t = r.teams[id];
  if (!t.captainId) return "TEAM_NOT_CLAIMED";
  if (t.memberIds.includes(pid)) return "ALREADY_ON_TEAM";
  leave(r, pid);
  t.memberIds.push(pid);
  return null;
}
const leaveTeam = (r, pid) => check(r, pid) || leave(r, pid);
const reset = (r) => {
  r.teams = create();
};
const parts = (cfg) =>
  cfg === "any"
    ? null
    : cfg
        .split(/[v+]/)
        .map(Number)
        .sort((a, b) => b - a);

// Server-side start validation for team mode; returns an error message or null.
function validateStart(r) {
  if (r.mode !== "team") return null;
  const ts = Object.values(r.teams).filter((t) => t.memberIds.length);
  if (ts.length < 2) return "Need at least 2 teams.";
  const seen = new Set(),
    ids = new Set(r.players.map((p) => p.id));
  for (const t of ts)
    for (const m of t.memberIds) {
      if (!ids.has(m) || seen.has(m)) return "Invalid team memberships.";
      seen.add(m);
    }
  if (ts.some((t) => !t.memberIds.includes(t.captainId)))
    return "Every team needs a captain.";
  if (seen.size !== r.players.length) return "Every player must join a team.";
  const want = parts(r.cfg || "any");
  if (want) {
    const got = ts.map((t) => t.memberIds.length).sort((a, b) => b - a);
    if (got.join() !== want.join())
      return `Teams must be ${r.cfg}; currently ${got.join("+")}.`;
  }
  return null;
}
module.exports = {
  DEFS,
  CFGS,
  create,
  teamOf,
  claim,
  join,
  leave: leaveTeam,
  drop: leave,
  reset,
  validateStart,
};
