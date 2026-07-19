import { buildApp } from "./bootstrap.js";

const app = await buildApp();
const { port, host } = app.config;

try {
  await app.listen({ port, host });
  const url = `http://${host}:${port}`;
  // Friendly startup banner so a fresh self-hosted install doesn't look
  // dead. Closes §13 in `docs/User-Lifecycle-Flow-Audit.md`.
  const banner = [
    "",
    "┌──────────────────────────────────────────────────────────────┐",
    "│ Lumina server ready                                          │",
    "│                                                              │",
    `│ API:        ${url.padEnd(48)}│`,
    `│ Health:     ${(url + "/healthz").padEnd(48)}│`,
    `│ Dashboard:  ${(url.replace(/:\d+$/, ":3000")).padEnd(48)}│`,
    "│                                                              │",
    "│ Next: open the dashboard to bootstrap your admin account.    │",
    "└──────────────────────────────────────────────────────────────┘",
    "",
  ].join("\n");
  app.log.info(banner);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
