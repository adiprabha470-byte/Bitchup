import { state, esc, token, teamColor, myPlayer, money } from "./state.js";
import { emit } from "./socket.js";
export function lobby() {
  const r = state.room,
    host = r.host === state.pid;
  const team = Object.values(r.teams).find((t) =>
    t.memberIds.includes(state.pid),
  );
  const configs = [
    "any",
    "4v4",
    "3v3",
    "2v2",
    "3+3+2",
    "2+2+2",
    "2+2+2+2",
    "5v3",
  ].filter(
    (c) =>
      c === "any" ||
      c.split(/[v+]/).reduce((a, b) => a + Number(b), 0) === r.players.length,
  );
  return `<div class="lobby page"><div class="page-heading"><div><span class="eyebrow">THE GUEST LIST</span><h1>Your night. Your people.</h1><p>Choose your crew. Raise the stakes. Make an entrance.</p></div><div class="room-code"><small>PRIVATE ROOM</small><button data-copy="${r.code}">${r.code} <span>⧉</span></button></div></div><div class="lobby-layout"><section class="panel guest-panel"><div class="section-title"><h2>At the table</h2><span class="badge">${r.players.length} / 8</span></div><div class="guest-list">${r.players
    .map((p) => {
      const t = Object.values(r.teams).find((t) => t.memberIds.includes(p.id));
      return `<div class="guest">${token(p)}<div><b>${esc(p.name)}${p.id === state.pid ? " <small>YOU</small>" : ""}</b><small>${t ? esc(t.name) + (t.captainId === p.id ? " · Captain" : "") : p.id === r.host ? "Host of the night" : "Independent player"}</small></div><span class="ready ${p.ready ? "yes" : ""}">${!p.on ? "Away" : p.ready ? "Ready" : "Waiting"}</span>${host && p.id !== state.pid ? `<button class="remove" data-kick="${p.id}" aria-label="Remove ${esc(p.name)}">×</button>` : ""}</div>`;
    })
    .join(
      "",
    )}${Array.from({ length: 8 - r.players.length }, () => '<div class="empty-seat"><span>+</span> An invitation waiting to happen</div>').join("")}</div><div class="lobby-actions"><button class="secondary" data-ready>${myPlayer().ready ? "Unready" : "I’m ready"}</button>${host ? '<button class="primary" data-start>Start the night <span>↗</span></button>' : "<small>The host starts when everyone is ready.</small>"}</div></section><section class="crew-panel"><div class="panel lobby-settings"><div><span class="eyebrow">HOUSE RULES</span><p>$1,500 per player · ${r.timer ? r.timer + "s turns" : "Timer off"}</p></div><div class="fields"><label>Mode<select id="mode" ${host ? "" : "disabled"}><option value="individual" ${r.mode === "individual" ? "selected" : ""}>Individual</option><option value="team" ${r.mode === "team" ? "selected" : ""}>Teams</option></select></label><label>Turn clock<select id="timer" ${host ? "" : "disabled"}>${[0, 30, 60, 90, 120].map((n) => `<option value="${n}" ${r.timer === n ? "selected" : ""}>${n ? n + " seconds" : "Off"}</option>`).join("")}</select></label>${r.mode === "team" ? `<label>Configuration<select id="cfg" ${host ? "" : "disabled"}>${[...new Set([...configs, r.cfg])].map((c) => `<option value="${c}" ${r.cfg === c ? "selected" : ""}>${c === "any" ? "Flexible" : c}</option>`).join("")}</select></label>` : ""}</div></div>${
    r.mode === "team"
      ? `<div class="section-title"><div><span class="eyebrow">PICK YOUR ALLEGIANCE</span><h2>Eight crews. No velvet ropes.</h2></div>${team ? '<button class="text-button" data-team="leave">Leave team</button>' : ""}</div><div class="teams">${Object.values(
          r.teams,
        )
          .map(
            (t, i) =>
              `<article class="team-card ${t.id === team?.id ? "selected" : ""}" style="--accent:${teamColor(t.id)}"><div class="team-top"><span class="team-symbol">${["♠", "◆", "♥", "♜", "◈", "✦", "♣", "✧"][i]}</span><small>CREW 0${i + 1}</small></div><h3>${t.icon} ${t.name}</h3><p>${t.captainId ? "Captain · " + esc(r.players.find((p) => p.id === t.captainId)?.name) : "Unclaimed. Make it yours."}</p><div class="members">${t.memberIds.map((id) => esc(r.players.find((p) => p.id === id)?.name)).join(" · ") || "Open to everyone"}</div><button class="team-button" data-team="${t.id === team?.id ? "" : t.captainId ? "join" : "claim"}" data-id="${t.id}" ${t.id === team?.id ? "disabled" : ""}>${t.id === team?.id ? "✓ Your team" : t.captainId ? "Join team ↗" : "Claim team ↗"}</button></article>`,
          )
          .join("")}</div>`
      : `<div class="individual-banner"><span class="orbit-symbol">♠</span><span class="eyebrow">EVERY PLAYER FOR THEMSELVES</span><h2>Good friends.<br>Questionable alliances.</h2><p>Build your empire across 22 exclusive properties.<br>Own the collection. Upgrade the experience.<br>Be the last one standing.</p><div class="mini-metrics"><span>40<small>BOARD SPACES</small></span><span>8<small>GUESTS MAX</small></span><span>1<small>CHAMPION</small></span></div></div>`
  }</section></div></div>`;
}
export function bindLobby(render) {
  document
    .querySelector("[data-ready]")
    ?.addEventListener("click", () => emit("ready"));
  document
    .querySelector("[data-start]")
    ?.addEventListener("click", () => emit("start"));
  document
    .querySelectorAll("[data-kick]")
    .forEach((b) => (b.onclick = () => emit("kick", b.dataset.kick)));
  document
    .querySelectorAll("[data-team]")
    .forEach(
      (b) =>
        (b.onclick = () =>
          b.dataset.team &&
          emit("team:" + b.dataset.team, { team: b.dataset.id })),
    );
  ["mode", "cfg", "timer"].forEach((id) =>
    document
      .getElementById(id)
      ?.addEventListener("change", (e) =>
        emit("settings", {
          [id]: id === "timer" ? Number(e.target.value) : e.target.value,
        }),
      ),
  );
  document
    .querySelector("[data-copy]")
    ?.addEventListener("click", () =>
      navigator.clipboard.writeText(state.room.code),
    );
}
