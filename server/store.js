"use strict";
// Optional single-instance snapshots. Credentials stay on disk with owner-only access.
const fs = require("node:fs");
const path = require("node:path");
class RoomStore {
  constructor(file, rooms) {
    this.file = file ? path.resolve(file) : null;
    this.rooms = rooms;
    this.pending = null;
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    if (!fs.existsSync(this.file)) return;
    const data = JSON.parse(fs.readFileSync(this.file, "utf8"));
    if (
      data.version !== 1 ||
      !Array.isArray(data.rooms) ||
      data.rooms.length > 1000
    )
      throw new Error(
        "Unsupported or corrupt room snapshot. Preserve the file and restore a valid backup.",
      );
    const now = Date.now();
    for (const r of data.rooms) {
      if (
        !r ||
        !/^[A-F0-9]{6}$/.test(r.code) ||
        !Array.isArray(r.players) ||
        r.players.length > 8
      )
        throw new Error("Invalid room snapshot.");
      for (const p of r.players) {
        p.on = false;
        p.awayAt = now;
        delete p.socketId;
      }
      r.emptyAt = now;
      r.deadline =
        r.started && r.phase !== "over" && r.timer ? now + 120000 : null;
      this.rooms.set(r.code, r);
    }
  }
  async flush() {
    if (!this.file) return;
    const previous = this.pending || Promise.resolve();
    const content = JSON.stringify(
      { version: 1, at: Date.now(), rooms: [...this.rooms.values()] },
      (key, value) => (key === "socketId" ? undefined : value),
    );
    const write = async () => {
      const tmp = this.file + ".tmp";
      await fs.promises.writeFile(tmp, content, { mode: 0o600 });
      await fs.promises.chmod(tmp, 0o600);
      await fs.promises.rename(tmp, this.file);
    };
    const promise = previous.catch(() => {}).then(write);
    this.pending = promise;
    try {
      await promise;
      this.lastError = null;
    } catch (err) {
      this.lastError = err;
      throw err;
    } finally {
      if (this.pending === promise) this.pending = null;
    }
  }
}
module.exports = { RoomStore };
