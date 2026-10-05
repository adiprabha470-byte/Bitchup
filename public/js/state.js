export const state = {
  room: null,
  board: [],
  pid: sessionStorage.getItem("pid"),
  seenCard: 0,
  chat: [],
  chatScope: "room",
  chatDraft: "",
  boardZoom: false,
  animating: false,
};
export const $ = (id) => document.getElementById(id);
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const money = (n) => "$" + Math.round(n || 0).toLocaleString("en-US");
export const colors = [
  "#ed75a5",
  "#a191ef",
  "#66d4c5",
  "#edbc70",
  "#ec9362",
  "#8ab878",
  "#779cf0",
  "#d8b5de",
];
export const teamColor = (id) =>
  colors[Object.keys(state.room.teams).indexOf(id) % 8];
export const playerColor = (p) => colors[p.token % 8];
export const entity = (p) => (state.room.tm ? state.room.tm[p.team] : p);
export const entities = () =>
  state.room.tm ? Object.values(state.room.tm) : state.room.players;
export const myPlayer = () =>
  state.room.players.find((p) => p.id === state.pid);
export const assets = (e) =>
  Object.keys(state.room.props)
    .map(Number)
    .filter((i) => state.room.props[i].o === e?.id);
export const worth = (e) =>
  e.cash -
  (state.room.debts || [])
    .filter(
      (d) => entity(state.room.players.find((p) => p.id === d.pid)).id === e.id,
    )
    .reduce((n, d) => n + d.amount, 0) +
  assets(e).reduce((n, i) => {
    const o = state.room.props[i];
    return (
      n +
      state.board[i].p * (o.mortgage ? 0.5 : 1) +
      ((o.level || 0) * Math.ceil(state.board[i].p / 2)) / 2
    );
  }, 0);
export const ecolor = (e) => (state.room.tm ? teamColor(e.id) : playerColor(e));
export const toast = (m) => {
  const t = $("toast");
  t.textContent = m;
  t.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.remove("show"), 3500);
};
export const token = (p) =>
  `<span class="token" style="--token:${playerColor(p)}" title="${esc(p.name)}"><span>${["◆", "♠", "♣", "✦", "♥", "⬡", "✧", "♜"][p.token % 8]}</span></span>`;
