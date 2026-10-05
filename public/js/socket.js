import { state, toast } from "./state.js";
export const socket = io();
export function emit(event, data = {}) {
  return new Promise((resolve) =>
    socket.timeout(7000).emit(event, data, (timeout, result) => {
      if (timeout) {
        toast("Connection interrupted. Please reconnect.");
        return resolve(false);
      }
      const err = typeof result === "string" ? result : result?.err;
      if (err) toast(err);
      resolve(err ? false : (result ?? true));
    }),
  );
}
let renderBarrier = Promise.resolve();
export function setRenderBarrier(promise) {
  renderBarrier = promise;
}
export async function act(a, d) {
  const result = await emit("act", { a, d });
  await renderBarrier;
  return result;
}
export function saveSession(r) {
  if (!r || !r.ok) return;
  state.pid = r.pid;
  sessionStorage.setItem("pid", r.pid);
  sessionStorage.setItem("secret", r.secret);
  sessionStorage.setItem("room", r.code);
}
export function forget() {
  ["pid", "secret", "room"].forEach((k) => sessionStorage.removeItem(k));
  state.room = null;
  state.pid = null;
  state.chat = [];
  state.chatDraft = "";
  state.chatScope = "room";
  state.seenCard = 0;
}
