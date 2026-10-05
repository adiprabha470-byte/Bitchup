import { state, money } from "./state.js";
import { positionTokens, dice } from "./board.js";
import { play } from "./sound.js";
export const reduced = () =>
  matchMedia("(prefers-reduced-motion: reduce)").matches ||
  localStorage.getItem("motion") === "off";
const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export async function animateUpdate(old, next) {
  if (!old?.started || !next.started) return;
  if (reduced()) return;
  const newRoll = next.rollN !== old.rollN;
  if (newRoll) {
    play("roll");
    const el = document.getElementById("dice");
    el?.classList.add("rolling");
    await pause(650);
    if (el) {
      el.innerHTML = next.dice.map(dice).join("");
      el.classList.remove("rolling");
      el.classList.add("landed");
    }
    play("land");
    await pause(200);
  }
  const positions = Object.fromEntries(old.players.map((p) => [p.id, p.pos]));
  const paths = (next.motion || []).filter((m) => m.n > (old.mn || 0));
  for (const m of paths) {
    for (const i of m.path) {
      positions[m.pid] = i;
      positionTokens(positions);
      play("step");
      await pause(m.path.length > 20 ? 55 : 110);
    }
    const token = document.querySelector(`[data-token="${m.pid}"]`);
    token?.classList.add("landing");
    await pause(120);
    token?.classList.remove("landing");
  }
}
export function moneyFeedback(old, next) {
  if (!old?.started || !next.started) return;
  const before = old.tm ? Object.values(old.tm) : old.players,
    after = next.tm ? Object.values(next.tm) : next.players;
  for (const e of after) {
    const prev = before.find((q) => q.id === e.id);
    if (!prev || e.cash === prev.cash) continue;
    const wallet = document.querySelector(`[data-wallet="${e.id}"]`);
    if (!wallet) continue;
    const amount = e.cash - prev.cash;
    wallet.classList.add("pulse");
    const label = wallet.querySelector("[data-cash]");
    if (label && !reduced()) {
      const started = performance.now();
      const count = (now) => {
        if (!label.isConnected) return;
        const progress = Math.min(1, (now - started) / 450);
        label.textContent = money(
          prev.cash + (e.cash - prev.cash) * (1 - Math.pow(1 - progress, 3)),
        );
        if (progress < 1) requestAnimationFrame(count);
      };
      requestAnimationFrame(count);
    }
    const float = document.createElement("span");
    float.className = "money-float " + (amount > 0 ? "gain" : "loss");
    float.textContent = (amount > 0 ? "+" : "−") + money(Math.abs(amount));
    wallet.append(float);
    setTimeout(() => float.remove(), 1600);
    play(amount > 0 ? "money" : "rent");
  }
  for (const [i, o] of Object.entries(next.props))
    if ((o.level || 0) > (old.props[i]?.level || 0)) play("upgrade");
  const newProps = Object.keys(next.props).filter(
    (i) => !old.props[i] || old.props[i].o !== next.props[i].o,
  );
  for (const i of newProps) {
    document.querySelector(`[data-tile="${i}"]`)?.classList.add("acquired");
    play("purchase");
  }
  if (after.some((e) => e.out && !before.find((q) => q.id === e.id)?.out))
    play("bankrupt");
  if (next.phase === "over" && old.phase !== "over") play("victory");
}
