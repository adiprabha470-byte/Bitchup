# BITCHUP v0.2 · Implementation and QA report

## Completed

- Kept Node.js, Express, Socket.IO and Vanilla JS; preserved the original 40 spaces and fixed eight teams.
- Full team lobby: claim/join/leave, captain/member labels, ready states, flexible and exact team distributions. Every team stays visible.
- Shared team economy across wallets, ownership, rent, asset management, net worth, debt, bankruptcy, trades and winner display. Individual finances remain separate in individual mode.
- Five upgrades per property, collection/even-building rules, discounted upgrade card, selling levels, mortgages and redemption.
- Debt phase with cash raising before bankruptcy; team-wide elimination and solvent creditor transfer. Third failed CAUGHT escape correctly resumes movement after its fine is settled.
- Validated two-sided cash/property trades, explicit sender commitment and recipient acceptance, stale-offer checks and duplicate-acceptance prevention.
- All 30 Surprise and 20 Treasure card effects; validated property choice and destination UI.
- Authoritative OFF/30/60/90/120-second clocks, automatic timeout intents, private team and room chat, reconnect grace and server-issued reconnect credentials.
- Optional atomic one-second room snapshots and tested restart recovery. Production configurations enable a persistent volume; secrets are not broadcast.
- Original luxury nightlife design, modular interface, physical-style dice/cards, metallic tokens, tile-by-tile server-path movement, ownership/upgrades, wallet count-up/floating feedback, optional synthesized audio, reduced motion, mobile board fit/zoom and separate turn controls.
- Health endpoint, security headers/CSP, origin/payload/message restrictions, production installation, Dockerfile, Render Blueprint, environment example and deployment instructions.

## Test results

- Baseline before changes: **21 passed, 0 failed**.
- Final Node suite: **48 passed, 0 failed, 0 skipped**. Includes original 300 individual and 100 team random game simulations; engine/card/economy tests; real WebSocket identity, team race, privacy, capacity, host permission and reconnect tests; durable snapshot/restart tests.
- Chromium browser QA: **passed**, **zero JavaScript/console errors**. Landing, lobby and game checked at **360 / 390 / 430 / 768 / 1024 / 1440px**; no document horizontal overflow; all eight lobby teams and all forty board spaces retained.
- Two independent browser sessions: room creation/join, team claim, readiness/start, eight genuine server dice rolls, purchases/movement, escaped chat and reload reconnect. Rare upgrade/sell/mortgage/redeem, accepted cash trade and card property choice flows use deterministic **server-side test fixtures**, not browser-written game state.
- Isolated `npm ci --omit=dev`: production HTTP health/landing, WebSocket handshake and room creation **passed**.
- `npm audit --omit=dev`: **0 known vulnerabilities** reported.
- Screenshots and raw results are included in `qa/`. The random simulation harness has a 4,000-action cap: it checks consistency but does not prove mathematical termination or balance.

## Important fixes

- A public player ID alone can no longer take over a seat; reconnect requires its secret. Replaced/kicked sockets lose room authority.
- Bankruptcy no longer happens immediately when cash is insufficient.
- Team wallets and ownership no longer disappear from the frontend.
- Incomplete upgrade and property-choice effects now have server validation and UI.
- Invalid/prototype team IDs are rejected without crashing.
- Strict destinations prevent permissive numeric parsing.
- Chat renders literal text instead of executing markup; private-channel drafts survive game updates.
- Asset/trade panels wait for the accepted server update before refreshing.
- Disconnect grace preserves seats/teams rather than immediately destroying them.
- Narrow screens have a complete board overview with zoom and independent actions instead of a clipped desktop center.

## Deployment

**Not deployed. No live URL is claimed.** The available built-in hosting uses a Workers-compatible runtime; this project requires its retained Node.js process and Socket.IO server. No compatible hosting account/repository credentials were supplied.

To publish: connect a Git repository containing this project to a Node/WebSocket host, authorize the account, and provision the included configuration. `render.yaml` uses a **free** single instance with memory-only rooms. Restarts lose rooms; a paid instance with persistent disk is needed for durable recovery. Docker is an alternative. After deployment, verify HTTPS, actual WebSocket transport, two-device joining, teams, gameplay and reconnect. The Dockerfile was prepared but not built in this environment, which has no Docker CLI.

## Remaining / known limitations

- Single authoritative process; horizontal scaling requires a shared store, distributed coordination and suitable Socket.IO adapter/session strategy.
- Disk recovery needs a persistent writable volume and secure backups. An abrupt crash can lose the last snapshot interval; no disk configuration means rooms remain memory-only.
- Chromium responsive emulation is not a substitute for Safari/Firefox, physical devices, assistive technology, audio listening, sustained high-load testing or usability research.
- No verified age identity, account system, public matchmaking, spectator mode or abuse moderation system is included. The 18+ gate is self-declaration.
- Chat has no replay after reconnect. Disconnected players retain ownership and their turns are skipped after grace; abandonment is not automatic financial bankruptcy.
- Synthesized cues are implemented, not a recorded soundtrack. Dice are animated 2D physical-style components, not a WebGL simulation.
- Cash trades can raise funds before debt; trading is disallowed while a compulsory debt is outstanding. Improved or mortgaged assets cannot be traded.
- Property prices, rent multipliers, tax rules and card distribution still need human playtesting for public-release balance. This is a tested release candidate, not a claim of a finished commercial launch.
