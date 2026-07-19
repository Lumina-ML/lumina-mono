import { buildApp } from "./bootstrap.js";

const app = await buildApp();
const { port, host } = app.config;

try {
  await app.listen({ port, host });
  app.log.info(`Lumina server listening on http://${host}:${port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
