let context;
let enabled = localStorage.getItem("sound") === "on";
const tones = {
  button: [420, 0.04],
  roll: [160, 0.15],
  land: [520, 0.08],
  step: [300, 0.035],
  purchase: [700, 0.2],
  rent: [220, 0.14],
  money: [880, 0.1],
  card: [640, 0.15],
  upgrade: [1040, 0.15],
  bankrupt: [90, 0.5],
  victory: [1200, 0.5],
  team: [760, 0.12],
};
export function initSound() {
  if (enabled && !context)
    context = new (window.AudioContext || window.webkitAudioContext)();
  if (context?.state === "suspended") context.resume();
}
export function setSound(on) {
  enabled = on;
  localStorage.setItem("sound", on ? "on" : "off");
  if (on) {
    initSound();
    play("button");
  }
  return enabled;
}
export const soundOn = () => enabled;
export function play(event) {
  if (!enabled || !context || context.state !== "running") return;
  const [hz, length] = tones[event] || tones.button;
  const osc = context.createOscillator(),
    gain = context.createGain();
  osc.type = event === "roll" ? "triangle" : "sine";
  osc.frequency.setValueAtTime(hz, context.currentTime);
  osc.frequency.exponentialRampToValueAtTime(
    hz * 1.25,
    context.currentTime + length,
  );
  gain.gain.setValueAtTime(0.04, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + length);
  osc.connect(gain).connect(context.destination);
  osc.start();
  osc.stop(context.currentTime + length);
}
