import { buildApp } from "./bootstrap.js";

const app = await buildApp();
const { port, host, dashboardUrl } = app.config;

try {
  await app.listen({ port, host });
  const url = `http://${host}:${port}`;
  // Dashboard URL is operator-configurable for self-hosted installs
  // where the dashboard sits behind a reverse proxy or on a different
  // port. Fall back to swapping the API port for the conventional Vite
  // port (3000) when nothing is set, so the banner remains useful for
  // local dev.
  const dashboard =
    dashboardUrl ?? url.replace(/:\d+$/, ":3000");
  // Friendly startup banner so a fresh self-hosted install doesn't look
  // dead. Closes §13 in `docs/User-Lifecycle-Flow-Audit.md`.
  const banner = [
    "",
    "┌──────────────────────────────────────────────────────────────┐",
    "│ Lumina server ready                                          │",
    "│                                                              │",
    `│ API:        ${url.padEnd(48)}│`,
    `│ Health:     ${(url + "/healthz").padEnd(48)}│`,
    `│ Dashboard:  ${dashboard.padEnd(48)}│`,
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
