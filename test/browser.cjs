const { chromium } = require("playwright"),
  assert = require("node:assert/strict"),
  { createServer } = require("../server/index");
(async () => {
  const server = createServer();
  await new Promise((r) => server.srv.listen(0, "127.0.0.1", r));
  const url = "http://127.0.0.1:" + server.srv.address().port;
  let browser;
  const errors = [];
  const sizes = [360, 390, 430, 768, 1024, 1440];
  const report = [];
  try {
    browser = await chromium.launch({
      headless: true,
      ...(process.env.CHROMIUM_PATH
        ? { executablePath: process.env.CHROMIUM_PATH }
        : {}),
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--no-zygote"],
    });
    const hostContext = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      }),
      guestContext = await browser.newContext({
        viewport: { width: 1440, height: 1000 },
      });
    const host = await hostContext.newPage(),
      guest = await guestContext.newPage();
    for (const p of [host, guest]) {
      p.on("pageerror", (e) => errors.push(e.message));
      p.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
    }
    await host.goto(url);
    await host.evaluate(async () => {
      const { state } = await import("/js/state.js");
      window.__qaReadState = () => state;
    });
    await host.getByText("Good company.").waitFor();
    await host.screenshot({
      path: "qa/landing-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    for (const width of sizes) {
      await host.setViewportSize({ width, height: 950 });
      await host.screenshot({
        path: `qa/landing-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      const w = await host.evaluate(() => ({
        scroll: document.documentElement.scrollWidth,
        width: innerWidth,
      }));
      assert.ok(
        w.scroll <= width + 1,
        `landing horizontal overflow at ${width}: ${w.scroll}`,
      );
      report.push(`Landing ${width}px: no document overflow`);
    }
    await host.setViewportSize({ width: 1440, height: 1000 });
    await host.locator("#name").fill("Velvet");
    await host.locator("#create-mode").selectOption("team");
    await host.locator("#create-room").click();
    await host.locator("#age-yes").click();
    await host.locator(".lobby").waitFor();
    const code = await host.evaluate(() => sessionStorage.getItem("room"));
    const pid = await host.evaluate(() => sessionStorage.getItem("pid"));
    assert.equal(await host.locator(".team-card").count(), 8);
    await host.locator('[data-team="claim"][data-id="missionary"]').click();
    await host.locator(".team-card.selected").waitFor();
    await guest.goto(url);
    await guest.evaluate(async () => {
      const { state } = await import("/js/state.js");
      window.__qaReadState = () => state;
    });
    await guest.locator("#name").fill("Cherry");
    await guest.locator("#room-code").fill(code);
    await guest.locator("#join-form button").click();
    await guest.locator("#age-yes").click();
    await guest.locator(".lobby").waitFor();
    await guest.locator('[data-team="claim"][data-id="cowgirl"]').click();
    await guest.locator(".team-card.selected").waitFor();
    await host.screenshot({
      path: "qa/lobby-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    for (const width of sizes) {
      await host.setViewportSize({ width, height: 950 });
      assert.equal(await host.locator(".team-card").count(), 8);
      const w = await host.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(w <= width + 1, `lobby overflow ${width}: ${w}`);
      await host.screenshot({
        path: `qa/lobby-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      report.push(`Lobby ${width}px: all 8 teams visible, no overflow`);
    }
    await host.setViewportSize({ width: 1440, height: 1000 });
    await host.locator("#timer").selectOption("0");
    await guest.locator("[data-ready]").click();
    await host.locator("[data-start]").click();
    await host.locator(".board").waitFor();
    await guest.locator(".board").waitFor();
    assert.equal(await host.locator(".tile").count(), 40);
    assert.equal(await host.locator(".wallet").count(), 2);
    assert.equal(
      await host.locator("[data-cash]").first().innerText(),
      "$1,500",
    );
    await host.screenshot({
      path: "qa/board-desktop.png",
      fullPage: true,
      animations: "disabled",
    });
    for (const width of sizes) {
      await host.setViewportSize({ width, height: 950 });
      const w = await host.evaluate(() => document.documentElement.scrollWidth);
      assert.ok(w <= width + 1, `game overflow ${width}: ${w}`);
      await host.screenshot({
        path: `qa/board-${width}.png`,
        fullPage: true,
        animations: "disabled",
      });
      if (width <= 768)
        assert.equal(await host.locator(".mobile-controls").isVisible(), true);
      report.push(
        `Board ${width}px: 40 spaces, viewport scroll, accessible mobile controls`,
      );
    }
    await host.setViewportSize({ width: 1440, height: 1000 });
    // Several genuine turns use authoritative state to select the active browser; no client state mutation.
    for (let i = 0; i < 8; i++) {
      const r = server.rooms.get(code),
        p = r.players[r.cur],
        page = p.id === pid ? host : guest;
      for (const tab of [host, guest])
        if (await tab.locator(".card-continue").count())
          await tab.locator(".card-continue").click();
      const rolled = r.rollN + 1;
      await page.locator('.board-center [data-act="roll"]').click();
      for (const tab of [host, guest])
        await tab.waitForFunction((n) => {
          const state = window.__qaReadState();
          return !state.animating && state.room.rollN === n;
        }, rolled);
      const phase = server.rooms.get(code).phase;
      for (const tab of [host, guest])
        if (await tab.locator(".card-continue").count()) {
          await tab.screenshot({
            path: "qa/card-reveal.png",
            fullPage: true,
            animations: "disabled",
          });
          await tab.locator(".card-continue").click();
        }
      if (phase === "buy") {
        await page.locator('.board-center [data-act="buy"]').click();
        await page.waitForFunction(() => {
          const state = window.__qaReadState();
          return state.room.phase !== "buy" && !state.animating;
        });
      }
      if (phase === "choice" || phase === "jet") {
        if (!(await page.locator("[data-option]").count()))
          await page.locator(".board-center [data-choice]").click();
        await page.locator("[data-option]").first().click();
        await page.waitForFunction(() => {
          const state = window.__qaReadState();
          return (
            !["choice", "jet"].includes(state.room.phase) && !state.animating
          );
        });
      }
      for (const tab of [host, guest])
        await tab.waitForFunction(() => {
          const state = window.__qaReadState();
          return !state.animating;
        });
      for (const tab of [host, guest])
        if (await tab.locator(".card-continue").count())
          await tab.locator(".card-continue").click();
      if (server.rooms.get(code).phase === "end")
        await page.locator('.board-center [data-act="end"]').click();
      await page.waitForTimeout(200);
    }

    // Deterministic server fixtures exercise rare UI flows. No browser-side game state is written.
    const G = require("../server/game"),
      fixture = server.rooms.get(code),
      actor = fixture.players[fixture.cur],
      actorPage = actor.id === pid ? host : guest,
      opponentPage = actor.id === pid ? guest : host;
    const publish = () => server.io.to(code).emit("state", G.view(fixture));
    const synchronize = async (check) => {
      for (const tab of [host, guest]) await tab.waitForFunction(check);
    };
    fixture.phase = "end";
    fixture.debts = [];
    fixture.resume = null;
    fixture.extra = false;
    fixture.deadline = null;
    G._E(fixture, actor).cash = 3000;
    fixture.props[1] = { o: G._E(fixture, actor).id, level: 0, mult: 1 };
    fixture.props[3] = { o: G._E(fixture, actor).id, level: 0, mult: 1 };
    publish();
    await synchronize(() => {
      const state = window.__qaReadState();
      return !state.animating && state.room.phase === "end";
    });
    for (const tab of [host, guest])
      if (await tab.locator(".card-continue").count())
        await tab.locator(".card-continue").click();
    await actorPage.locator('[data-tile="1"]').click();
    await actorPage.locator('[data-asset="upgrade"]').click();
    await actorPage.waitForFunction(() =>
      document.querySelector(".property-stats")?.innerText.includes("Glow"),
    );
    assert.equal(fixture.props[1].level, 1);
    await actorPage.screenshot({
      path: "qa/property-upgrade.png",
      fullPage: true,
      animations: "disabled",
    });
    await actorPage.locator('[data-asset="sell"]').click();
    await actorPage.locator('[data-asset="mortgage"]').click();
    await actorPage.locator('[data-asset="redeem"]').waitFor();
    assert.equal(fixture.props[1].mortgage, true);
    await actorPage.locator('[data-asset="redeem"]').click();
    await actorPage.locator('[data-asset="mortgage"]').waitFor();
    assert.equal(fixture.props[1].mortgage, false);
    await actorPage.locator(".modal-close").click();
    await actorPage.locator("[data-trade]").click();
    await actorPage.locator("#give-cash").fill("100");
    await actorPage.locator("#trade-form .primary").click();
    await actorPage.locator("[data-reject]").waitFor();
    await actorPage.locator(".modal-close").click();
    await opponentPage.locator("[data-trade]").click();
    await opponentPage.locator("[data-accept]").click();
    await opponentPage.waitForFunction(
      () => !document.querySelector("[data-accept]"),
    );
    assert.equal(fixture.trades.at(-1).status, "accepted");
    await opponentPage.locator(".modal-close").click();
    fixture.deck.sur = [18];
    G._draw(fixture, actor, "sur");
    publish();
    await actorPage.locator(".card-continue").waitFor();
    await actorPage.screenshot({
      path: "qa/card-reveal.png",
      fullPage: true,
      animations: "disabled",
    });
    await actorPage.locator(".card-continue").click();
    await actorPage.locator('[data-option="1"]').click();
    assert.equal(fixture.props[1].mult, 2);
    if (await opponentPage.locator(".card-continue").count())
      await opponentPage.locator(".card-continue").click();
    report.push(
      "Seeded server fixtures: upgrade/sell, mortgage/redeem, cash trade accepted in second browser, card property choice",
    );
    // Room updates must preserve a private-channel draft instead of silently switching to room chat.
    await host.locator("#chat-scope").selectOption("team");
    await host.locator("#chat-input").fill("Private draft");
    publish();
    await host.waitForFunction(
      () =>
        document.querySelector("#chat-scope")?.value === "team" &&
        document.querySelector("#chat-input")?.value === "Private draft",
    );
    assert.equal(await host.locator("#chat-scope").inputValue(), "team");
    await host.locator("#chat-scope").selectOption("room");
    await host.locator("#chat-input").fill("");
    await host.locator("[data-portfolio]").first().click();
    await host.locator(".modal").waitFor();
    await host.locator(".modal-close").click();
    await host.locator("[data-trade]").click();
    await host.locator(".trade-modal").waitFor();
    await host.screenshot({
      path: "qa/trading.png",
      fullPage: true,
      animations: "disabled",
    });
    await host.locator(".modal-close").click();
    await host.locator("#chat-input").fill("<img src=x onerror=alert(1)>");
    await host.locator("#chat-form button").click();
    await guest
      .getByText("<img src=x onerror=alert(1)>", { exact: false })
      .waitFor();
    assert.equal(await guest.locator(".messages img").count(), 0);
    await host.reload();
    await host.locator(".board").waitFor();
    assert.equal(await host.evaluate(() => sessionStorage.getItem("pid")), pid);
    await host.screenshot({
      path: "qa/board-played.png",
      fullPage: true,
      animations: "disabled",
    });
    report.push(
      "Two browser multiplayer: teams, 8 rolls, purchases, movement, portfolio, trading, escaped chat, reload reconnect",
    );
    assert.deepEqual(errors, []);
    report.push("Browser JS and console errors: 0");
    require("fs").writeFileSync(
      "qa/browser-results.json",
      JSON.stringify({ passed: true, checks: report, errors }, null, 2),
    );
    console.log(
      JSON.stringify({ passed: true, checks: report, errors }, null, 2),
    );
  } finally {
    if (browser) await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
