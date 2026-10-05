"use strict";
const express = require("express"),
  http = require("http"),
  path = require("path"),
  crypto = require("node:crypto");
const { Server } = require("socket.io");
const { RoomStore } = require("./store");
const G = require("./game"),
  T = require("./teams");
function createServer(options = {}) {
  const app = express(),
    srv = http.createServer(app),
    rooms = new Map(),
    limits = new Map();
  const store = new RoomStore(
    options.storePath ?? process.env.ROOM_STORE_PATH,
    rooms,
  );
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy":
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' ws: wss:; media-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
    });
    next();
  });
  app.get("/health", (_, res) =>
    res
      .status(store.lastError ? 503 : 200)
      .json({
        ok: !store.lastError,
        rooms: rooms.size,
        persistence: !store.file
          ? "disabled"
          : store.lastError
            ? "error"
            : "healthy",
      }),
  );
  app.use(express.static(path.join(__dirname, "../public")));
  const io = new Server(srv, {
    maxHttpBufferSize: 16384,
    allowRequest: (req, cb) => {
      const origin = req.headers.origin;
      const allow = process.env.ALLOWED_ORIGINS?.split(",");
      let ok = !origin;
      try {
        ok ||= allow
          ? allow.includes(origin)
          : new URL(origin).host === req.headers.host;
      } catch {}
      cb(null, ok);
    },
  });
  const clean = (s) =>
    typeof s === "string"
      ? s
          .replace(/[\x00-\x1f]/g, "")
          .trim()
          .slice(0, 24)
      : "";
  const push = (r) => io.to(r.code).emit("state", G.view(r));
  const roomOf = (s) => rooms.get(s.data.code);
  const response = (cb, data) => {
    if (typeof cb === "function") cb(data);
  };
  const attach = (s, r, p) => {
    s.data = { code: r.code, pid: p.id };
    p.on = true;
    p.socketId = s.id;
    p.awayAt = null;
    s.join(r.code);
  };
  const detach = (s) => {
    const r = roomOf(s),
      p = r?.players.find((p) => p.id === s.data.pid);
    if (!p || p.socketId !== s.id) return;
    p.on = false;
    p.awayAt = Date.now();
    delete p.socketId;
    push(r);
  };
  io.on("connection", (s) => {
    s.emit("board", G.B);
    let budget = 0,
      windowAt = Date.now();
    s.use(([event], next) => {
      if (Date.now() - windowAt > 10000) {
        budget = 0;
        windowAt = Date.now();
      }
      if (++budget > 80) return next(new Error("Rate limited"));
      next();
    });
    const handler = (name, fn) =>
      s.on(name, (d, cb) => {
        if (typeof d === "function") {
          cb = d;
          d = {};
        }
        try {
          fn(d ?? {}, cb);
        } catch (err) {
          console.error(
            JSON.stringify({
              event: "handler_error",
              handler: name,
              message: err.message,
            }),
          );
          response(cb, { err: "Invalid request." });
        }
      });
    handler("create", (d, cb) => {
      if (roomOf(s)) return response(cb, { err: "Already in a room." });
      const ip = s.handshake.address,
        q = limits.get(ip) || { n: 0, at: Date.now() };
      if (Date.now() - q.at > 60000) {
        q.n = 0;
        q.at = Date.now();
      }
      limits.set(ip, q);
      if (++q.n > 12 || rooms.size >= 1000)
        return response(cb, {
          err: "Please wait before creating another room.",
        });
      let code;
      do {
        code = crypto.randomBytes(3).toString("hex").toUpperCase();
      } while (rooms.has(code));
      const id = crypto.randomUUID(),
        r = G.mk(code, id, 1500, false);
      r.mode = d.mode === "team" ? "team" : "individual";
      r.timer = [0, 30, 60, 90, 120].includes(d.timer) ? d.timer : 60;
      r.cfg = "any";
      r.chat = [];
      r.createdAt = Date.now();
      const p = {
        id,
        name: clean(d.name) || "Guest",
        ready: false,
        on: true,
        token: 0,
        secret: crypto.randomBytes(32).toString("hex"),
      };
      r.players.push(p);
      rooms.set(code, r);
      attach(s, r, p);
      response(cb, { ok: 1, code, pid: id, secret: p.secret });
      push(r);
    });
    handler("join", (d, cb) => {
      const r = rooms.get(String(d.code || "").toUpperCase());
      if (!r) return response(cb, { err: "Room not found." });
      const existing = r.players.find((p) => p.id === d.pid);
      if (existing) {
        if (typeof d.secret !== "string" || d.secret !== existing.secret)
          return response(cb, { err: "Invalid reconnect credentials." });
        if (roomOf(s) && s.data.code !== r.code)
          return response(cb, { err: "Already in another room." });
        const old = io.sockets.sockets.get(existing.socketId);
        if (old && old !== s) {
          old.leave(r.code);
          old.data = {};
          old.emit("superseded");
        }
        attach(s, r, existing);
        response(cb, {
          ok: 1,
          code: r.code,
          pid: existing.id,
          secret: existing.secret,
        });
        push(r);
        return;
      }
      if (roomOf(s)) return response(cb, { err: "Already in a room." });
      if (r.started) return response(cb, { err: "Game already started." });
      if (r.players.length >= 8)
        return response(cb, { err: "Room is full (max 8)." });
      const p = {
        id: crypto.randomUUID(),
        name: clean(d.name) || "Guest",
        token: [0, 1, 2, 3, 4, 5, 6, 7].find(
          (i) => !r.players.some((p) => p.token === i),
        ),
        secret: crypto.randomBytes(32).toString("hex"),
        ready: false,
      };
      r.players.push(p);
      attach(s, r, p);
      response(cb, { ok: 1, code: r.code, pid: p.id, secret: p.secret });
      push(r);
    });
    handler("ready", (_, cb) => {
      const r = roomOf(s),
        p = r?.players.find((p) => p.id === s.data.pid);
      if (r && !r.started && p) {
        p.ready = !p.ready;
        push(r);
        response(cb, { ok: 1 });
      } else response(cb, { err: "Lobby only." });
    });
    handler("settings", (d, cb) => {
      const r = roomOf(s);
      if (!r || r.started || r.host !== s.data.pid)
        return response(cb, { err: "Host only." });
      if (["individual", "team"].includes(d.mode)) {
        r.mode = d.mode;
        T.reset(r);
      }
      if (T.CFGS.includes(d.cfg)) r.cfg = d.cfg;
      if ([0, 30, 60, 90, 120].includes(d.timer)) r.timer = d.timer;
      r.players.forEach((p) => (p.ready = false));
      push(r);
      response(cb, { ok: 1 });
    });
    ["claim", "join", "leave"].forEach((k) =>
      handler("team:" + k, (d, cb) => {
        const r = roomOf(s),
          err = r ? T[k](r, s.data.pid, d.team) : "NO_ROOM";
        if (r) {
          if (!err) r.players.forEach((p) => (p.ready = false));
          push(r);
        }
        response(cb, err ? { err } : { ok: 1 });
      }),
    );
    handler("start", (_, cb) => {
      const r = roomOf(s);
      let err;
      if (!r || r.started || r.host !== s.data.pid) err = "Host only.";
      else if (r.players.length < 2) err = "Need at least 2 players.";
      else if (r.players.some((p) => !p.on || (!p.ready && p.id !== r.host)))
        err = "Everyone must be connected and ready.";
      else err = T.validateStart(r);
      if (err) return response(cb, err);
      G.start(r);
      push(r);
      response(cb, null);
    });
    handler("act", (d, cb) => {
      const r = roomOf(s);
      if (!r) return response(cb, "Join a room first.");
      const err = G.act(r, s.data.pid, d.a, d.d);
      push(r);
      response(cb, err);
    });
    handler("chat", (d, cb) => {
      const r = roomOf(s),
        p = r?.players.find((p) => p.id === s.data.pid);
      if (!p) return;
      const now = Date.now();
      s.data.chatTimes = (s.data.chatTimes || []).filter(
        (t) => now - t < 10000,
      );
      if (s.data.chatTimes.length >= 5)
        return response(cb, { err: "Slow down — 5 messages per 10 seconds." });
      const message =
        typeof d.text === "string"
          ? d.text
              .replace(/[\x00-\x1f]/g, "")
              .trim()
              .slice(0, 240)
          : "";
      if (!message) return;
      const team = T.teamOf(r, p.id)?.id;
      if (d.scope === "team" && (!team || r.mode !== "team"))
        return response(cb, { err: "Join a team first." });
      s.data.chatTimes.push(now);
      const m = {
        id: crypto.randomUUID(),
        name: p.name,
        pid: p.id,
        text: message,
        at: now,
        scope: d.scope === "team" ? "team" : "room",
      };
      if (m.scope === "team")
        r.players
          .filter((q) => T.teamOf(r, q.id)?.id === team)
          .forEach((q) => {
            if (q.socketId) io.to(q.socketId).emit("chat", m);
          });
      else io.to(r.code).emit("chat", m);
      response(cb, { ok: 1 });
    });
    handler("kick", (id, cb) => {
      const r = roomOf(s);
      if (!r || r.started || s.data.pid !== r.host || id === r.host)
        return response(cb, { err: "Host only, lobby only." });
      const p = r.players.find((p) => p.id === id);
      if (!p) return;
      T.drop(r, id);
      r.players = r.players.filter((q) => q !== p);
      const other = io.sockets.sockets.get(p.socketId);
      if (other) {
        other.leave(r.code);
        other.data = {};
        other.emit("kicked");
      }
      push(r);
      response(cb, { ok: 1 });
    });
    handler("leave", (_, cb) => {
      const r = roomOf(s),
        p = r?.players.find((p) => p.id === s.data.pid);
      if (!p) return;
      detach(s);
      s.leave(r.code);
      if (!r.started) {
        T.drop(r, p.id);
        r.players = r.players.filter((q) => q !== p);
      } else {
        p.secret = crypto.randomBytes(32).toString("hex");
        p.awayAt = Date.now() - 120000;
      }
      s.data = {};
      if (r.host === p.id) r.host = r.players.find((p) => p.on)?.id || r.host;
      push(r);
      response(cb, { ok: 1 });
    });
    s.on("disconnect", () => detach(s));
  });
  const tick = setInterval(() => {
    const now = Date.now();
    for (const r of rooms.values()) {
      let changed = G.timeout(r, now);
      for (const p of [...r.players])
        if (!p.on && p.awayAt && now - p.awayAt > 120000) {
          if (!r.started) {
            T.drop(r, p.id);
            r.players = r.players.filter((q) => q !== p);
            changed = true;
          } else if (
            !p.out &&
            (r.players[r.cur]?.id === p.id || r.debts?.[0]?.pid === p.id)
          ) {
            G.skip(r, p.id);
            changed = true;
          }
          if (r.host === p.id) {
            r.host = r.players.find((q) => q.on)?.id || r.host;
            changed = true;
          }
        }
      if (!r.players.some((p) => p.on)) {
        r.emptyAt ||= now;
        if (now - r.emptyAt > 600000) rooms.delete(r.code);
      } else r.emptyAt = null;
      if (r.trades)
        r.trades = r.trades
          .filter((t) => t.status === "open" || r.turn - t.turn < 3)
          .slice(-32);
      if (changed) push(r);
    }
    for (const [ip, q] of limits) if (now - q.at > 600000) limits.delete(ip);
  }, 250);
  tick.unref();
  const snapshot = setInterval(() => {
    if (!store.pending)
      store
        .flush()
        .catch((err) =>
          console.error(
            JSON.stringify({ event: "snapshot_error", message: err.message }),
          ),
        );
  }, 1000);
  snapshot.unref();
  return {
    app,
    srv,
    io,
    rooms,
    store,
    close: async () => {
      clearInterval(tick);
      clearInterval(snapshot);
      await store.flush();
      io.close();
    },
  };
}
if (require.main === module) {
  const server = createServer();
  const { srv, io } = server;
  const port = process.env.PORT || 3000;
  srv.listen(port, "0.0.0.0", () =>
    console.log(JSON.stringify({ event: "listening", port })),
  );
  const stop = () => {
    server
      .close()
      .then(() => process.exit(0))
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
module.exports = { createServer };
