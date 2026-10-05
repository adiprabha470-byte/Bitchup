// Runs an isolated production-only installation and exercises its real HTTP/WebSocket server.
const fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { spawn, execFileSync } = require("node:child_process"),
  { io: client } = require("socket.io-client"),
  assert = require("node:assert/strict");
(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bitchup-production-"));
  let proc, socket;
  try {
    for (const file of ["package.json", "package-lock.json"])
      fs.copyFileSync(file, path.join(dir, file));
    for (const folder of ["server", "public"])
      fs.cpSync(folder, path.join(dir, folder), { recursive: true });
    execFileSync("npm", ["ci", "--omit=dev", "--no-audit", "--no-fund"], {
      cwd: dir,
      stdio: "pipe",
    });
    proc = spawn(
      process.execPath,
      [
        "-e",
        "const s=require('./server/index').createServer();s.srv.listen(0,'127.0.0.1',()=>console.log(s.srv.address().port));",
      ],
      { cwd: dir, stdio: ["ignore", "pipe", "pipe"] },
    );
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("Production startup timed out")),
        10000,
      );
      proc.stdout.once("data", (d) => {
        clearTimeout(timer);
        resolve(Number(d.toString().trim()));
      });
      proc.once("error", reject);
    });
    const url = "http://127.0.0.1:" + port;
    const health = await fetch(url + "/health");
    assert.equal(health.status, 200);
    const page = await fetch(url);
    assert.ok((await page.text()).includes("BITCHUP"));
    socket = client(url, { transports: ["websocket"] });
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    const result = await new Promise((resolve, reject) =>
      socket
        .timeout(4000)
        .emit("create", { name: "Production QA" }, (err, r) =>
          err ? reject(err) : resolve(r),
        ),
    );
    assert.equal(result.ok, 1);
    const report = {
      passed: true,
      productionDependenciesOnly: true,
      health: 200,
      landing: 200,
      websocket: true,
      roomCreated: true,
    };
    fs.writeFileSync(
      "qa/production-results.json",
      JSON.stringify(report, null, 2),
    );
    console.log(report);
  } finally {
    socket?.disconnect();
    if (proc) {
      proc.kill("SIGTERM");
      await new Promise((r) => proc.once("exit", r));
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
