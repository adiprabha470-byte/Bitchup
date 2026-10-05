import {
  state,
  esc,
  money,
  token,
  entity,
  entities,
  myPlayer,
  assets,
  worth,
  ecolor,
  playerColor,
} from "./state.js";
export const coordinates = (i) =>
  i <= 10
    ? [1, i + 1]
    : i <= 20
      ? [i - 9, 11]
      : i <= 30
        ? [11, 31 - i]
        : [41 - i, 1];
const icons = {
  go: "✦",
  tre: "◆",
  sur: "?",
  caught: "▥",
  goto: "↳",
  getaway: "☾",
  air: "✈",
  util: "ϟ",
  tax: "↘",
};
export function dice(n) {
  const spots = {
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  }[n] || [4];
  return `<div class="die" aria-label="Die ${n}">${Array.from({ length: 9 }, (_, i) => `<i class="${spots.includes(i) ? "pip" : ""}"></i>`).join("")}</div>`;
}
function tile(b, i) {
  const [row, col] = coordinates(i),
    o = state.room.props[i],
    owner = o && entities().find((e) => e.id === o.o);
  return `<button class="tile ${[0, 10, 20, 30].includes(i) ? "corner" : ""} ${o ? "owned" : ""} ${o?.mortgage ? "mortgaged" : ""}" data-tile="${i}" style="grid-area:${row}/${col};--stripe:${b.c || "#8e708f"};--owner:${owner ? ecolor(owner) : "transparent"}" aria-label="${esc(b.n)}${owner ? " owned by " + esc(owner.name) : ""}"><span class="tile-stripe"></span><span class="tile-icon">${b.t === "prop" ? "◆" : icons[b.t]}</span><b>${esc(b.n)}</b><small>${b.city || ""}</small><span class="tile-price">${b.p ? money(b.p) : i === 0 ? "+$200" : i === 20 ? "+$100" : b.t === "sur" ? "SURPRISE" : b.t === "tre" ? "TREASURE" : ""}</span><span class="building">${o?.mortgage ? "M" : o?.level === 5 ? "♜" : o?.level ? "▰".repeat(o.level) : ""}</span><span class="tile-number">${String(i).padStart(2, "0")}</span></button>`;
}
export function board() {
  const r = state.room,
    p = r.players[r.cur],
    mine = myPlayer();
  const owners = entities();
  return `<div class="game page"><div class="game-heading"><div><span class="eyebrow">THE NIGHT IS IN PLAY</span><h1>Own the night.</h1></div><div class="game-status"><span class="badge">${r.mode === "team" ? "TEAM TABLE" : "INDIVIDUAL TABLE"} · ${r.code}</span><span id="clock" class="clock"></span></div></div><div class="game-layout"><section class="board-panel"><div class="board-scroll ${state.boardZoom ? "is-zoomed" : ""}"><div class="board">${state.board.map(tile).join("")}<div class="board-center"><div class="board-watermark">B</div><span class="eyebrow">FORTUNE FAVOURS THE BOLD</span><div class="center-brand">BITCH<span>UP</span><i>✦</i></div><p class="center-tagline">ROLL. BUY. FLIRT. FLEX.</p><div id="dice" class="dice-pair">${r.dice.map(dice).join("")}</div><div class="turn-label"><span class="turn-dot" style="background:${playerColor(p)}"></span>${p.id === state.pid ? "Your turn" : esc(p.name) + "’s turn"}</div><div id="turn-actions">${actions()}</div><div class="board-footer"><span>SURPRISE <i>?</i></span><small>AFTER HOURS / EST. 2026</small><span><i>◆</i> TREASURE</span></div></div><div class="token-layer" id="token-layer">${r.players
    .filter((p) => !p.out)
    .map(
      (p) =>
        `<div class="moving-token" data-token="${p.id}" aria-label="${esc(p.name)}">${token(p)}</div>`,
    )
    .join(
      "",
    )}</div></div></div><div class="mobile-controls"><div class="mobile-turn"><small>YOUR WALLET</small><b>${money(entity(mine).cash)}</b><span>${esc(entity(mine).name)}</span></div>${actions()}</div><div class="board-toolbar"><span><i class="legend-dot"></i> Tap any space to inspect it</span><button class="text-button zoom-button" data-zoom>${state.boardZoom ? "Fit board" : "Zoom board"} ⊕</button><button class="text-button" data-portfolio>My portfolio ↗</button><button class="text-button" data-trade>Make a deal ↗</button></div></section><aside class="game-sidebar"><section class="panel standings"><div class="section-title"><h2>${r.tm ? "The crews" : "The players"}</h2><small>NET WORTH</small></div>${owners
    .map(
      (e) =>
        `<article class="wallet ${e.out ? "out" : ""} ${entity(p).id === e.id ? "active" : ""}" data-wallet="${e.id}" style="--accent:${ecolor(e)}"><div class="wallet-top"><span class="owner-mark">${r.tm ? "◆" : token(e)}</span><div><b>${esc(e.name)}</b><small>${
          r.tm
            ? r.players
                .filter((p) => p.team === e.id)
                .map((p) => esc(p.name))
                .join(" · ")
            : e.caught
              ? "CAUGHT"
              : e.id === state.pid
                ? "YOUR EMPIRE"
                : "INDEPENDENT"
        }</small></div><span class="net">${money(worth(e))}</span></div><div class="wallet-bottom"><span><small>WALLET</small><b data-cash="${e.id}">${money(e.cash)}</b></span><span><small>PROPERTIES</small><b>${assets(e).length}</b></span><span class="wallet-state">${e.out ? "BANKRUPT" : entity(p).id === e.id ? "● Playing" : "In the night"}</span></div></article>`,
    )
    .join(
      "",
    )}</section><section class="panel feed"><div class="section-title"><h2>The night’s story</h2><span class="live-dot"></span></div><div class="event-log">${r.log
    .slice(-14)
    .map((l) => `<p>${esc(l)}</p>`)
    .join(
      "",
    )}</div></section><section class="panel chat-panel"><div class="section-title"><h2>Table talk</h2><select id="chat-scope" aria-label="Chat channel"><option value="room" ${state.chatScope === "room" ? "selected" : ""}>Room</option>${r.tm ? `<option value="team" ${state.chatScope === "team" ? "selected" : ""}>Team only</option>` : ""}</select></div><div id="messages" class="messages">${
    state.chat
      .slice(-40)
      .map(
        (m) =>
          `<p><b>${esc(m.name)}${m.scope === "team" ? " <i>TEAM</i>" : ""}</b> ${esc(m.text)}</p>`,
      )
      .join("") ||
    '<p class="muted">A little friendly rivalry goes a long way.</p>'
  }</div><form id="chat-form"><input id="chat-input" value="${esc(state.chatDraft)}" maxlength="240" placeholder="Say something…" aria-label="Chat message" autocomplete="off"><button class="icon-button" aria-label="Send message">↗</button></form></section></aside></div></div>`;
}
export function actions() {
  const r = state.room,
    p = r.players[r.cur],
    b = state.board[p.pos];
  if (r.phase === "over") {
    const w = entities().find((e) => e.id === r.winner);
    return `<div class="champion"><span>♜</span><h2>${esc(w?.name || "Nobody")} owns the night.</h2><p>BITCHUP CHAMPION · ${money(w ? worth(w) : 0)}</p><button class="secondary" data-portfolio>Inspect portfolio</button></div>`;
  }
  if (r.phase === "debt") {
    const d = r.debts[0],
      q = r.players.find((p) => p.id === d.pid);
    const owes = entity(q).id === entity(myPlayer()).id;
    return `<div class="debt-banner"><span class="eyebrow">CASH CALL</span><p>${esc(entity(q).name)} owes ${money(d.amount)}.<br>Sell upgrades or mortgage properties to raise cash.</p>${owes ? '<button class="primary" data-act="settle">Settle debt</button><button class="secondary" data-portfolio>Raise cash</button><button class="text-button danger" data-act="bankrupt">Declare bankruptcy</button>' : "<small>Waiting for the debtor…</small>"}</div>`;
  }
  if (p.id !== state.pid)
    return `<p class="waiting">${r.phase === "buy" ? "Considering an acquisition…" : r.phase === "choice" || r.phase === "jet" ? "Making a choice…" : "A little patience. Your moment is coming."}</p>`;
  if (r.phase === "roll")
    return `${p.caught ? '<p class="caught-label">CAUGHT · Time to call in a favour.</p>' : ""}<button class="primary roll-button" data-act="roll">${p.caught ? "Roll for doubles" : "Roll the dice"} <span>↗</span></button>${p.caught ? `<div class="caught-options"><button class="secondary" data-act="fine">Pay $100</button><button class="secondary" data-act="lawyer">Lawyer · $250</button>${p.goojf ? '<button class="secondary" data-act="card">Use free pass</button>' : ""}</div>` : ""}`;
  if (r.phase === "buy")
    return `<div class="purchase-prompt"><small>AVAILABLE TONIGHT</small><h2>${esc(b.n)}</h2><p>${money(Math.round(b.p * (p.disc || 1)))} ${b.rent ? "· Base rent " + money(b.rent) : ""}</p><button class="primary" data-act="buy">Make it yours ↗</button><button class="secondary" data-act="pass">Pass</button></div>`;
  if (r.phase === "jet" || r.phase === "choice")
    return '<button class="primary" data-choice>Choose your next move ↗</button>';
  if (r.phase === "end")
    return '<button class="primary" data-act="end">End your turn ↗</button>';
  return "";
}
export function positionTokens(positions = {}) {
  const r = state.room;
  for (const p of r.players) {
    const el = document.querySelector(`[data-token="${p.id}"]`);
    if (!el) continue;
    const index = positions[p.id] ?? p.pos,
      [row, col] = coordinates(index);
    const peers = r.players.filter(
      (q) => !q.out && (positions[q.id] ?? q.pos) === index,
    );
    const slot = peers.findIndex((q) => q.id === p.id);
    el.style.left = ((col - 0.5) / 11) * 100 + ((slot % 4) - 1.5) * 0.95 + "%";
    el.style.top =
      ((row - 0.5) / 11) * 100 + Math.floor(slot / 4) * 2.2 + 2 + "%";
  }
}
