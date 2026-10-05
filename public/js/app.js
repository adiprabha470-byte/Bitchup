import { state, $, esc, toast } from "./state.js";
import {
  socket,
  emit,
  act,
  saveSession,
  forget,
  setRenderBarrier,
} from "./socket.js";
import { lobby, bindLobby } from "./lobby.js";
import { board, positionTokens } from "./board.js";
import {
  card,
  choice,
  property,
  portfolio,
  trading,
  settings,
  closeModal,
  modal,
} from "./modals.js";
import { animateUpdate, moneyFeedback } from "./animations.js";
import { play, initSound, setSound, soundOn } from "./sound.js";
function landing() {
  return `<div class="landing page"><div class="hero-copy"><span class="eyebrow"><i class="live-dot"></i> THE INVITATION YOU SHOULDN’T ACCEPT</span><h1>Good company.<br><em>Bad intentions.</em></h1><p>A little luck. A lot of ambition. Buy the night, build your empire, and leave your friends beautifully bankrupt.</p><div class="hero-tags"><span>2–8 PLAYERS</span><i>✦</i><span>INDIVIDUAL & TEAMS</span><i>✦</i><span>18+</span></div><div class="entry-panel panel"><label>Your name<input id="name" maxlength="24" placeholder="Make an entrance" autocomplete="nickname" value="${esc(sessionStorage.getItem("name") || "")}"></label><div class="entry-options"><label>Play style<select id="create-mode"><option value="individual">Individual</option><option value="team">Teams · shared empire</option></select></label><button class="primary" id="create-room">Host the night <span>↗</span></button></div><div class="entry-divider"><span>OR TAKE YOUR SEAT</span></div><form id="join-form"><input id="room-code" maxlength="6" minlength="6" placeholder="ROOM CODE" aria-label="Room code" pattern="[A-Fa-f0-9]{6}" required><button class="secondary">Join a room ↗</button></form></div><small class="adult-note">An adult-themed social board game. Fictional personas. No explicit imagery.</small></div><div class="hero-art" aria-hidden="true"><div class="art-orbit"></div><div class="art-title">THE CITY<br>IS YOURS.</div><div class="hero-deed deed-back"><span>THE AFTER HOURS COLLECTION</span><i>✦</i><b>FORTUNE<br>HAS A TYPE.</b></div><div class="hero-deed deed-front"><div class="deed-line"><span>EXCLUSIVE PROPERTY</span><i>↗</i></div><div class="deed-window"><div class="skyline">${Array.from({ length: 12 }, (_, i) => `<span style="--h:${[45, 70, 100, 65, 130, 160, 105, 145, 85, 120, 60, 40][i]}px;--delay:${i * 0.3}s"></span>`).join("")}</div><span class="moon"></span><span class="window-caption">NEW YORK / AFTER DARK</span></div><small>THE MIDNIGHT COLLECTION</small><h2>Lana Luxe</h2><div class="deed-bottom"><span>$400<small>YOUR NEXT ACQUISITION</small></span><b>◆</b></div></div><div class="hero-chip"><span>◆</span><small>BITCHUP</small></div><div class="hero-die">${[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => `<i class="${[0, 2, 4, 6, 8].includes(i) ? "pip" : ""}"></i>`).join("")}</div><div class="art-note"><span>01 / THE HOUSE RULE</span><b>Play nice.<br>Win dirty.</b></div></div></div><footer class="site-footer"><span>BITCHUP © 2026</span><span>THE AFTER HOURS EDITION</span><span>GOOD LUCK LOOKS GOOD ON YOU.</span></footer>`;
}
export function render() {
  const active = document.activeElement,
    id = active?.id,
    value = active?.value,
    start = active?.selectionStart;
  const r = state.room;
  $("app").innerHTML = r ? (r.started ? board() : lobby()) : landing();
  if (r?.started) {
    bindGame();
    positionTokens();
  } else if (r) bindLobby(render);
  else bindLanding();
  if (id) {
    const el = $(id);
    if (el && el.tagName === "INPUT") {
      el.value = value;
      el.focus();
      try {
        el.setSelectionRange(start, start);
      } catch {}
    }
  }
  updateClock();
}
function bindLanding() {
  const profile = () => {
    const name = $("name").value.trim();
    if (!name) {
      toast("Tell us what to call you.");
      $("name").focus();
      return null;
    }
    sessionStorage.setItem("name", name);
    return name;
  };
  $("create-room").onclick = async () => {
    const name = profile();
    if (!name) return;
    if (!(await ageGate())) return;
    const r = await emit("create", {
      name,
      mode: $("create-mode").value,
      timer: 60,
    });
    saveSession(r);
  };
  $("join-form").onsubmit = async (e) => {
    e.preventDefault();
    const name = profile();
    if (!name) return;
    if (!(await ageGate())) return;
    saveSession(
      await emit("join", { name, code: $("room-code").value.toUpperCase() }),
    );
  };
}
function ageGate() {
  if (sessionStorage.getItem("age")) return Promise.resolve(true);
  return new Promise((resolve) => {
    modal(
      '<span class="eyebrow">THE AFTER HOURS EDITION</span><h2>This table is for adults.</h2><p>BITCHUP includes adult humor and suggestive team names. You must be 18 or older to play.</p><button class="primary" id="age-yes">I’m 18 or older ↗</button><button class="secondary" id="age-no">Leave</button>',
    );
    $("age-yes").onclick = () => {
      sessionStorage.setItem("age", "1");
      closeModal();
      resolve(true);
    };
    $("age-no").onclick = () => {
      closeModal();
      resolve(false);
    };
    document.querySelector(".modal-close").onclick = () => {
      closeModal();
      resolve(false);
    };
  });
}
function bindGame() {
  document.querySelector("[data-zoom]")?.addEventListener("click", (e) => {
    state.boardZoom = !state.boardZoom;
    document
      .querySelector(".board-scroll")
      .classList.toggle("is-zoomed", state.boardZoom);
    e.target.textContent = state.boardZoom ? "Fit board ⊖" : "Zoom board ⊕";
  });
  document
    .querySelectorAll("[data-tile]")
    .forEach((b) => (b.onclick = () => property(Number(b.dataset.tile))));
  document.querySelectorAll("[data-act]").forEach(
    (b) =>
      (b.onclick = async () => {
        if (state.animating) return;
        if (b.dataset.act === "bankrupt") {
          modal(
            '<span class="eyebrow">LAST CALL</span><h2>Declare bankruptcy?</h2><p>Your empire will be eliminated. In team mode, this eliminates your entire crew.</p><button class="primary" id="bankrupt-confirm">Declare bankruptcy</button>',
          );
          $("bankrupt-confirm").onclick = async () => {
            await act("bankrupt");
            closeModal();
          };
          return;
        }
        b.disabled = true;
        if (!(await act(b.dataset.act))) b.disabled = false;
      }),
  );
  document
    .querySelectorAll("[data-portfolio]")
    .forEach((b) => (b.onclick = portfolio));
  document.querySelector("[data-trade]")?.addEventListener("click", trading);
  document
    .querySelectorAll("[data-choice]")
    .forEach((b) => b.addEventListener("click", choice));
  $("chat-scope").onchange = (e) => (state.chatScope = e.target.value);
  $("chat-input").oninput = (e) => (state.chatDraft = e.target.value);
  $("chat-form").onsubmit = async (e) => {
    e.preventDefault();
    const text = $("chat-input").value;
    if (await emit("chat", { text, scope: state.chatScope })) {
      $("chat-input").value = "";
      state.chatDraft = "";
    }
  };
  const log = document.querySelector(".event-log");
  if (log) log.scrollTop = log.scrollHeight;
  $("messages").scrollTop = $("messages").scrollHeight;
}
let queue = Promise.resolve();
socket.on("board", (b) => (state.board = b));
socket.on("state", (next) => {
  queue = queue
    .then(async () => {
      const old = state.room;
      state.animating = true;
      document
        .querySelectorAll("[data-act]")
        .forEach((b) => (b.disabled = true));
      await animateUpdate(old, next);
      state.room = next;
      state.animating = false;
      render();
      moneyFeedback(old, next);
      if (next.card?.n !== old?.card?.n) {
        play("card");
        card();
      }
      if (
        old &&
        !next.started &&
        Object.values(next.teams).some(
          (t) => t.memberIds.join() !== old.teams[t.id].memberIds.join(),
        )
      )
        play("team");
    })
    .catch((err) => {
      console.error(err);
      state.room = next;
      state.animating = false;
      render();
    });
  setRenderBarrier(queue);
});
socket.on("chat", (m) => {
  state.chat.push(m);
  state.chat = state.chat.slice(-100);
  const messages = $("messages");
  if (messages) {
    const p = document.createElement("p"),
      b = document.createElement("b");
    b.textContent = m.name + (m.scope === "team" ? " [TEAM]" : "");
    p.append(b, document.createTextNode(" " + m.text));
    messages.append(p);
    messages.scrollTop = messages.scrollHeight;
  }
});
socket.on("connect", async () => {
  $("connection").textContent = "Connected";
  $("connection").classList.add("online");
  if (sessionStorage.getItem("room") && sessionStorage.getItem("secret")) {
    const r = await emit("join", {
      code: sessionStorage.getItem("room"),
      pid: sessionStorage.getItem("pid"),
      secret: sessionStorage.getItem("secret"),
    });
    if (r) saveSession(r);
    else {
      forget();
      render();
    }
  }
});
socket.on("disconnect", () => {
  $("connection").textContent = "Reconnecting";
  $("connection").classList.remove("online");
});
socket.on("kicked", () => {
  forget();
  closeModal();
  render();
  toast("The host removed you from this room.");
});
socket.on("superseded", () => {
  forget();
  render();
  toast("This seat is now connected in another tab.");
});
$("settings").onclick = () => settings(render);
$("sound").classList.toggle("enabled", soundOn());
$("sound").onclick = () => {
  $("sound").classList.toggle("enabled", setSound(!soundOn()));
  $("sound").setAttribute(
    "aria-label",
    soundOn() ? "Mute sound" : "Enable sound",
  );
};
document.addEventListener("pointerdown", () => {
  initSound();
  play("button");
});
function updateClock() {
  const el = $("clock"),
    r = state.room;
  if (!el || !r) return;
  if (!r.deadline || r.phase === "over") {
    el.textContent = r.phase === "over" ? "FINAL CALL" : "NO CLOCK";
    el.classList.remove("urgent");
    return;
  }
  const remaining = Math.max(0, Math.ceil((r.deadline - Date.now()) / 1000));
  el.textContent =
    String(Math.floor(remaining / 60)).padStart(2, "0") +
    ":" +
    String(remaining % 60).padStart(2, "0");
  el.classList.toggle("urgent", remaining <= 10);
}
setInterval(updateClock, 250);
render();
