# BITCHUP · The After Hours Edition

Original nightlife-themed multiplayer property game. Node.js + Express + Socket.IO + modular Vanilla JS. All characters are fictional; no explicit images or external art is used. The original 40-space board and eight fixed team definitions are preserved.

## Run locally

Requires Node.js 22 or later.

```sh
npm ci
npm test
npm start
```

Open http://localhost:3000 in separate browser profiles/devices. Create a room, share its six-character code, join, pick teams if desired, mark ready, and start. Multiple tabs that share sessionStorage represent the same seat; use independent tabs/profiles for different players. Local network users can open http://YOUR_LAN_IP:3000 with the firewall permitting TCP 3000.

## Gameplay

- Individual and shared-wallet Teams modes; 2–8 players total. Starting cash is fixed at $1,500 per player; team wallet is $1,500 × member count.
- All eight teams always appear; no locks/reservations. Claim/join moves a player atomically. Captains transfer when members leave. Lobby changes reset readiness.
- Flexible composition, 2v2, 3v3, 4v4, 5v3, 2+2+2, 3+3+2 and 2+2+2+2; exact distributions validated before starting.
- Server controls all rolls, moves, purchases, card effects, assets, trades, timers and winners. Browsers send intentions only.
- Full collections can build evenly: Bare → Glow → VIP → Luxury → Premium → BitchUp Palace. Upgrade price is half the property price rounded up; rent multipliers are 1/3/7/14/22/35. Bare collection rent doubles. A Luxury Upgrade card halves the next upgrade cost.
- Sell levels evenly for half their standard upgrade cost. Mortgage unbuilt assets for 50% of price; redeem for 55%. Mortgaged assets collect no rent. Sell all collection upgrades before mortgaging.
- Insufficient compulsory payments create a debt phase. Sell/mortgage to raise cash, settle, or explicitly declare bankruptcy. No discretionary purchases/upgrades/trades during debt. Bankruptcy eliminates the whole entity (team or player), transfers cash and properties to a solvent creditor, removes upgrades, and retains mortgages; bank debt returns properties to the bank.
- Trades include cash and eligible properties in both directions. Sending an offer is the sender’s explicit acceptance; the recipient must accept. Any living teammate may manage shared assets or accept a team offer. Revalidate cash/ownership at acceptance; no simultaneous double acceptance. Improved collections and mortgaged assets are ineligible. Max 8 open offers.
- 30 Surprise and 20 Treasure cards, including validated property choices and destinations. “Every other player” collection effects charge each opposing financial entity once in team mode; teammates are exempt.
- CAUGHT: $100 fine, $250 lawyer, free pass, or doubles; third failed escape requires the fine. PRIVATE GETAWAY gives $100. SPOTLIGHT passing gives $200.
- Turn clocks: OFF/30/60/90/120 seconds. At expiration the server resolves one safe intent: roll, decline purchase, choose first eligible property, fly to SPOTLIGHT, settle if funded or declare bankruptcy. Subsequent pending decisions have an 8-second grace; debt opens a fresh full turn duration. Offline players get 120 seconds to reconnect before their turns are skipped.
- Room and private team chat; 240 characters, 5 messages per 10 seconds. Team messages go only to connected members. Chat is ephemeral and not replayed on reconnect.

## Interface

Original champagne, velvet, violet and rose design. Physical-style dice and cards, metal tokens, server-path tile movement, ownership lighting, upgrade markers, money feedback, accessible modals, reduced-motion support, optional synthesized sound and independent mobile turn controls. On narrow screens the full board fits the screen by default, zoom enables a detailed scroll view, and turn controls remain accessible below it. No remote fonts/flags/assets are needed.

## Security and reliability

Server-issued UUID seats and 256-bit reconnect secrets; client-provided IDs cannot create identities or impersonate a seat. Reconnect replaces the previous socket and revokes its authority. Secrets and socket identities are stripped from all state broadcasts. Host-only lobby settings/start/kick, capacity enforcement, same-host origin checks, CSP, frame denial, payload limits, socket rate limiting and bounded room/chat/trade memory. Disconnected lobby seats retain teams during the 120-second reconnect grace. Empty rooms expire after 10 minutes.

This is a single-process release candidate. Set `ROOM_STORE_PATH` to enable atomic one-second disk snapshots; without it, restarting loses rooms. Docker enables it on a persistent volume. The free Render configuration uses memory-only rooms. Restored rooms give a two-minute reconnect grace. A crash can lose up to the last snapshot interval; graceful shutdown flushes a final snapshot. The snapshot contains reconnect credentials with owner-only file permissions; back it up securely. Unsupported/corrupt snapshots fail startup rather than silently discarding games. Do not run multiple replicas without a shared persistent room store and distributed authoritative coordination. Reconnect secrets are bearer credentials stored in sessionStorage; production requires HTTPS. An 18+ acknowledgement is a self-declaration, not verified age identity.

## Tests

```sh
npm test
```

Original 21 tests retained (simulation drivers extended for new choice/debt phases), plus economy/card/security/WebSocket tests. The 400 original random game simulations verify bounded invariants, but their 4,000-action cap does not prove every possible game terminates.

Optional browser checks require Playwright and Chromium:

```sh
npm install --no-save playwright
npx playwright install chromium
node test/browser.cjs
```

The script launches its own server, checks 360/390/430/768/1024/1440px layouts, exercises two real browser players and records screenshots/results under `qa/`. See `QA_REPORT.md` for this build’s actual results.

## Deployment

No public deployment is included or claimed. Use a Node host with persistent WebSockets, HTTPS, one always-on process, environment variables, and no request timeout that kills WebSockets. This is not a static hosting application.

`render.yaml` is a ready-to-import single-instance free Render configuration. Rooms are memory-only and are lost on service restart; durable recovery requires a paid instance and persistent disk. Create a Git repository containing this folder, connect it to your hosting account, and create the Blueprint. Review the host’s billing/plan and disk costs before provisioning. The service uses `npm ci --omit=dev`, `npm start`, and `/health`.

Alternatively build the included Dockerfile and deploy its image on a suitable server:

```sh
docker build -t bitchup .
docker run --restart unless-stopped -v bitchup-data:/data -p 3000:3000 -e PORT=3000 -e NODE_ENV=production bitchup
```

Place behind an HTTPS reverse proxy that forwards WebSocket Upgrade/Connection headers and uses a generous idle timeout. If setting `ALLOWED_ORIGINS`, provide comma-separated exact HTTPS origins with no trailing slash. Node reads process environment; `.env.example` documents it but is not automatically loaded. Logs are JSON for startup/errors; SIGINT/SIGTERM closes sockets gracefully.

Before publishing: run tests, check `/health` over HTTPS, join a room from two separate devices, confirm transport upgrades to WebSocket, claim/join teams, start, roll/buy/end, chat privately, and reload to verify reconnect. Public release still requires large-scale load QA, real-device/Safari/Firefox QA, abuse moderation and final gameplay balancing. Horizontal scaling would need a shared store and coordinated authority. To deploy from this workspace, access to your chosen WebSocket-capable hosting account and a connected repository (or permitted server credentials) is required.

Official deployment references: [Render WebSockets](https://render.com/docs/websocket), [Blueprint specification](https://render.com/docs/blueprint-spec), and [Health checks](https://render.com/docs/health-checks). These describe the deployment target; no hosting account is connected here.
