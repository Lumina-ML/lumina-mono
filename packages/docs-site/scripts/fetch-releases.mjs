#!/usr/bin/env node
/**
 * Fetch the latest GitHub releases for Lumina and write them to
 * `docs/.releases.json` so the docs build is fully reproducible offline
 * once the JSON has been generated.
 *
 * Usage:
 *   node scripts/fetch-releases.mjs                # default 6 releases
 *   LUMINA_REPO=other-org/lumina node scripts/fetch-releases.mjs
 *   LUMINA_RELEASES=20 node scripts/fetch-releases.mjs
 */
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.LUMINA_REPO ?? "Lumina-ML/lumina";
const COUNT = Number.parseInt(process.env.LUMINA_RELEASES ?? "6", 10);
const OUTPUT = path.resolve(__dirname, "../docs/.releases.json");

const FALLBACK = {
  repo: REPO,
  fetchedAt: new Date(0).toISOString(),
  source: "fallback",
  releases: [
    {
      tag: "v0.1.0",
      name: "v0.1.0 — Initial preview",
      publishedAt: "2025-09-01T00:00:00Z",
      url: `https://github.com/${REPO}/releases/tag/v0.1.0`,
      prerelease: false,
      body: [
        "### Added",
        "- First public preview of the Lumina SDK (`pip install lumina`)",
        "- Fastify server with Postgres + ClickHouse + MinIO + Redis backends",
        "- Vue 3 dashboard with JSON-driven widgets",
        "- Artifacts (content-addressed), model registry, traces, sweeps, launch",
      ].join("\n"),
    },
  ],
};

async function fetchReleases() {
  const url = `https://api.github.com/repos/${REPO}/releases?per_page=${COUNT}`;
  try {
    const res = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        "User-Agent": "lumina-docs-site",
        ...(process.env.GITHUB_TOKEN
          ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
          : {}),
      },
    });
    if (!res.ok) {
      console.warn(
        `[releases] GitHub responded ${res.status}; using fallback. Set GITHUB_TOKEN for higher rate limits.`,
      );
      return FALLBACK;
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      console.warn("[releases] empty response; using fallback");
      return FALLBACK;
    }
    return {
      repo: REPO,
      fetchedAt: new Date().toISOString(),
      source: "github",
      releases: data.slice(0, COUNT).map((r) => ({
        tag: r.tag_name,
        name: r.name ?? r.tag_name,
        publishedAt: r.published_at,
        url: r.html_url,
        prerelease: Boolean(r.prerelease),
        body: (r.body ?? "").slice(0, 6000),
      })),
    };
  } catch (err) {
    console.warn(`[releases] fetch failed: ${err.message}; using fallback`);
    return FALLBACK;
  }
}

async function main() {
  const payload = await fetchReleases();
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, JSON.stringify(payload, null, 2) + "\n", "utf-8");
  console.log(
    `[releases] wrote ${payload.releases.length} entries to ${path.relative(process.cwd(), OUTPUT)}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
