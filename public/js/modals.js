import {
  state,
  $,
  esc,
  money,
  entities,
  assets,
  entity,
  myPlayer,
  ecolor,
  worth,
} from "./state.js";
import { act, emit, forget } from "./socket.js";
import { setSound, soundOn } from "./sound.js";
const levels = ["Bare", "Glow", "VIP", "Luxury", "Premium", "BitchUp Palace"];
let restoreFocus;
export function closeModal() {
  $("modal-root").innerHTML = "";
  restoreFocus?.focus();
}
export function modal(content, kind = "") {
  restoreFocus = document.activeElement;
  $("modal-root").innerHTML =
    `<div class="overlay"><section class="modal ${kind}" role="dialog" aria-modal="true" aria-label="Game panel"><button class="modal-close" aria-label="Close panel">×</button>${content}</section></div>`;
  document.querySelector(".modal-close").onclick = closeModal;
  document.querySelector(".overlay").onclick = (e) => {
    if (e.target.classList.contains("overlay")) closeModal();
  };
  document.querySelector(".modal button, .modal input")?.focus();
}
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
  if (e.key === "Tab" && $("modal-root").children.length) {
    const items = [
      ...document.querySelectorAll(
        '.modal button:not(:disabled),.modal input,.modal select,.modal [tabindex="0"]',
      ),
    ];
    const first = items[0],
      last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
});
export function property(i) {
  const b = state.board[i],
    o = state.room.props[i],
    owner = o && entities().find((e) => e.id === o.o),
    mine = owner?.id === entity(myPlayer()).id;
  modal(
    `<span class="eyebrow">PROPERTY  /  ${String(i).padStart(2, "0")}</span><div class="deed-art" style="--accent:${b.c || "#edbc70"}"><span>${b.t === "air" ? "✈" : b.t === "prop" ? "◆" : b.t === "util" ? "ϟ" : "✦"}</span><small>${esc(b.city || b.t.toUpperCase())}</small></div><h2>${esc(b.n)}</h2><p class="muted">${owner ? "Owned by " + esc(owner.name) : b.p ? "Your next empire starts here." : "A little twist in the night."}</p>${b.p ? `<div class="property-stats"><span>VALUE<b>${money(b.p)}</b></span><span>UPGRADE<b>${money(Math.ceil(b.p / 2))}</b></span><span>STATUS<b>${o?.mortgage ? "Mortgaged" : levels[o?.level || 0]}</b></span></div>${b.t === "prop" ? `<div class="rent-table">${levels.map((n, l) => `<div class="${l === (o?.level || 0) ? "current" : ""}"><span>${n}</span><b>${money(b.rent * [1, 3, 7, 14, 22, 35][l])}</b></div>`).join("")}</div><small class="muted">Bare rent doubles with a full collection. Build and sell evenly.</small>` : `<p>Airport rent: $25 / $50 / $100 / $200.<br>Utilities: 4× dice total; 10× when both are owned.</p>`}${mine ? `<div class="modal-actions">${b.t === "prop" ? '<button class="primary" data-asset="upgrade">Upgrade ↗</button><button class="secondary" data-asset="sell">Sell one level</button>' : ""}<button class="secondary" data-asset="${o.mortgage ? "redeem" : "mortgage"}">${o.mortgage ? "Redeem · " + money(Math.ceil(b.p * 0.55)) : "Mortgage · " + money(Math.floor(b.p / 2))}</button></div>` : ""}` : "<p>Inspect the table’s story for this space’s effect.</p>"}`,
    "property-modal",
  );
  document.querySelectorAll("[data-asset]").forEach(
    (btn) =>
      (btn.onclick = async () => {
        if (await act(btn.dataset.asset, i)) property(i);
      }),
  );
}
export function portfolio() {
  const e = entity(myPlayer());
  modal(
    `<span class="eyebrow">THE EMPIRE</span><h2>${esc(e.name)}’s portfolio</h2><p>${money(e.cash)} in the wallet · ${money(worth(e))} net worth</p><div class="portfolio-list">${
      assets(e)
        .map(
          (i) =>
            `<button class="portfolio-item" data-property="${i}" style="--accent:${state.board[i].c || "#edbc70"}"><span>◆</span><div><b>${esc(state.board[i].n)}</b><small>${state.room.props[i].mortgage ? "MORTGAGED" : levels[state.room.props[i].level || 0]}</small></div><strong>${money(state.board[i].p)}</strong><i>↗</i></button>`,
        )
        .join("") ||
      '<p class="muted">No properties yet. Roll to make your first acquisition.</p>'
    }</div><p class="muted">Select a property to upgrade, sell levels, or manage its mortgage.</p>`,
  );
  document
    .querySelectorAll("[data-property]")
    .forEach((b) => (b.onclick = () => property(Number(b.dataset.property))));
}
export function choice() {
  const r = state.room;
  if (r.players[r.cur]?.id !== state.pid) return;
  const options =
    r.phase === "jet" ? state.board.map((_, i) => i) : r.choice?.options || [];
  modal(
    `<span class="eyebrow">${r.phase === "jet" ? "PRIVATE JET" : "YOUR NEXT MOVE"}</span><h2>${r.phase === "jet" ? "Where to tonight?" : "Choose your property."}</h2><p>The house handles the details. You make the choice.</p><div class="choice-list">${options.map((i) => `<button class="choice-item" data-option="${i}"><span>${String(i).padStart(2, "0")}</span><b>${esc(state.board[i].n)}</b><small>${esc(state.board[i].city || "")}</small><i>↗</i></button>`).join("")}</div>`,
  );
  document.querySelectorAll("[data-option]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (
          await act(
            r.phase === "jet" ? "jet" : "choice",
            Number(b.dataset.option),
          )
        )
          closeModal();
      }),
  );
}
export function card() {
  const c = state.room.card;
  if (!c || c.n <= state.seenCard) return;
  state.seenCard = c.n;
  modal(
    `<div class="physical-card ${c.kind}"><span class="eyebrow">${c.kind === "sur" ? "EXPECT THE UNEXPECTED" : "A LITTLE GOOD FORTUNE"}</span><span class="card-emblem">${c.kind === "sur" ? "?" : "◆"}</span><small>${c.kind === "sur" ? "SURPRISE" : "TREASURE"}</small><h2>${esc(c.t)}</h2><p>${esc(c.x)}</p><div class="card-rule"></div><b>THE AFTER HOURS COLLECTION</b></div><button class="primary card-continue">Continue the night ↗</button>`,
    "card-modal",
  );
  document.querySelector(".card-continue").onclick = () => {
    closeModal();
    if (["jet", "choice"].includes(state.room.phase)) choice();
  };
}
export function trading() {
  const r = state.room,
    e = entity(myPlayer()),
    others = entities().filter((q) => q.id !== e.id && !q.out),
    trades = (r.trades || []).filter(
      (t) => [t.to, t.from].includes(e.id) && t.status === "open",
    );
  modal(
    `<span class="eyebrow">PRIVATE NEGOTIATIONS</span><h2>Everything has a price.</h2><p>Propose a deal. Your offer commits your side; the recipient must accept.</p>${
      trades.length
        ? `<div class="trade-inbox">${trades
            .map((t) => {
              const from = entities().find((e) => e.id === t.from),
                to = entities().find((e) => e.id === t.to);
              return `<article><b>${esc(from?.name)} → ${esc(to?.name)}</b><p>Give: ${money(t.give.cash)} ${t.give.props.map((i) => esc(state.board[i].n)).join(", ")}<br>Receive: ${money(t.want.cash)} ${t.want.props.map((i) => esc(state.board[i].n)).join(", ")}</p>${t.to === e.id ? `<button class="primary" data-accept="${t.id}">Accept deal</button>` : ""}<button class="secondary" data-reject="${t.id}">${t.from === e.id ? "Withdraw" : "Reject"}</button></article>`;
            })
            .join("")}</div>`
        : ""
    }<form id="trade-form"><label>Negotiate with<select id="trade-target">${others.map((q) => `<option value="${q.id}">${esc(q.name)}</option>`).join("")}</select></label><div class="trade-columns"><section><h3>You give</h3><label>Cash<input type="number" id="give-cash" min="0" step="1" value="0" max="${e.cash}"></label><div id="give-assets">${assetChecks(e, "give")}</div></section><section><h3>You receive</h3><label>Cash<input type="number" id="want-cash" min="0" step="1" value="0"></label><div id="want-assets"></div></section></div><button class="primary">Send offer ↗</button></form><small class="muted">Improved collections and mortgaged properties cannot be traded. Both wallets and ownership are checked again on acceptance.</small>`,
    "trade-modal",
  );
  const target = () => entities().find((e) => e.id === $("trade-target").value);
  const update = () => {
    $("want-assets").innerHTML = assetChecks(target(), "want");
    $("want-cash").max = target()?.cash || 0;
  };
  $("trade-target").onchange = update;
  update();
  $("trade-form").onsubmit = async (ev) => {
    ev.preventDefault();
    const ids = (name) =>
      [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((x) =>
        Number(x.value),
      );
    if (
      await act("offer", {
        to: target().id,
        give: { cash: Number($("give-cash").value), props: ids("give") },
        want: { cash: Number($("want-cash").value), props: ids("want") },
      })
    )
      trading();
  };
  document.querySelectorAll("[data-accept],[data-reject]").forEach(
    (b) =>
      (b.onclick = async () => {
        await act(
          b.dataset.accept ? "accept" : "reject",
          b.dataset.accept || b.dataset.reject,
        );
        trading();
      }),
  );
}
function assetChecks(e, name) {
  return (
    assets(e)
      .filter(
        (i) => !state.room.props[i].level && !state.room.props[i].mortgage,
      )
      .map(
        (i) =>
          `<label class="check"><input type="checkbox" name="${name}" value="${i}"><span>${esc(state.board[i].n)}</span></label>`,
      )
      .join("") || '<small class="muted">No eligible properties</small>'
  );
}
export function settings(render) {
  modal(
    `<span class="eyebrow">SET THE MOOD</span><h2>Your night, your way.</h2><label class="check"><input type="checkbox" id="sound-option" ${soundOn() ? "checked" : ""}><span>Synthesized game sounds</span></label><label class="check"><input type="checkbox" id="motion-option" ${localStorage.getItem("motion") === "off" ? "" : "checked"}><span>Dice and movement animations</span></label><p class="muted">Keyboard friendly. Your system’s reduced motion preference is respected.</p><button class="secondary" id="show-rules">How to play ↗</button>${state.room ? '<button class="secondary" id="leave-room">Leave this table</button>' : ""}`,
  );
  $("sound-option").onchange = (e) => {
    setSound(e.target.checked);
    $("sound").classList.toggle("enabled", e.target.checked);
  };
  $("show-rules").onclick = rules;
  $("motion-option").onchange = (e) =>
    localStorage.setItem("motion", e.target.checked ? "on" : "off");
  $("leave-room")?.addEventListener("click", () => {
    modal(
      '<span class="eyebrow">LEAVE THE TABLE</span><h2>Calling it a night?</h2><p>You will leave this room. During a game, your remaining turns will be skipped after the reconnect grace period.</p><button id="confirm-leave" class="primary">Leave room</button>',
    );
    $("confirm-leave").onclick = async () => {
      await emit("leave");
      forget();
      closeModal();
      render();
    };
  });
}

export function rules() {
  modal(
    `<span class="eyebrow">THE HOUSE RULES</span><h2>A little luck. A lot of ambition.</h2><div class="rules-list"><section><b>01 / Take your seat</b><p>2–8 players. Every guest starts with $1,500. Teams share one wallet and own properties together. Pick a crew, mark ready, and the host starts.</p></section><section><b>02 / Own the night</b><p>Roll, land, and buy unowned spaces. Pay opposing owners rent. Teammates never pay one another. Pass SPOTLIGHT for $200; PRIVATE GETAWAY gives $100.</p></section><section><b>03 / Raise the stakes</b><p>Collect every property in a color group. Build evenly up to BitchUp Palace. Manage upgrades and mortgages in your portfolio. Trade cash and eligible properties with another owner.</p></section><section><b>04 / Expect a twist</b><p>Surprise and Treasure bring money, movement and choices. CAUGHT? Roll doubles, pay $100, use a free pass or call your lawyer for $250.</p></section><section><b>05 / Last one standing</b><p>Owe more than you have? Sell upgrades and mortgage to raise cash before bankruptcy. In team mode, bankruptcy eliminates the whole crew. The final financial owner wins.</p></section><section><b>06 / Watch the clock</b><p>The server resolves pending decisions when the timer expires. Reloading reconnects your seat; keep your browser session. On mobile, tap a space for details or zoom the board.</p></section></div>`,
  );
}
