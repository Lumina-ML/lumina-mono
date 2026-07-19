import { defineConfig } from "@rspress/core";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * rspress config for the Lumina docs site.
 *
 * - Routes `docs/*.md` to the documentation area.
 * - Surfaces GitHub Release notes pulled from the public GitHub API at
 *   build time (see `src/plugins/github-release.ts`).
 * - Inlines the brand icon as favicon and as the navbar logo.
 */
export default defineConfig({
  root: path.join(__dirname, "docs"),
  title: "Lumina",
  description:
    "Lumina — open-source MLOps platform for self-hosting. Track experiments, version artifacts, manage models.",
  icon: "/Lumina-Ml.png",
  lang: "en",
  logo: {
    src: "/Lumina-Ml.png",
    width: 28,
    height: 28,
  },
  themeConfig: {
    socialLinks: [
      { icon: "github", href: "https://github.com/Lumina-ML/lumina" },
      { icon: "discord", href: "https://discord.gg/lumina" },
      { icon: "twitter", href: "https://twitter.com/lumina_ml" },
    ],
    footer: {
      message: "Released under the Apache-2.0 License.",
      copyright: "© Lumina contributors",
    },
    nav: [
      { text: "Guide", link: "/guide/getting-started", activeMatch: "/guide/" },
      { text: "SDK", link: "/sdk/python", activeMatch: "/sdk/" },
      { text: "Releases", link: "/changelog", activeMatch: "/changelog" },
      {
        text: "GitHub",
        link: "https://github.com/Lumina-ML/lumina",
      },
    ],
    sidebar: {
      "/guide/": [
        {
          text: "Getting started",
          items: [
            { text: "Introduction", link: "/guide/getting-started" },
            { text: "Installation", link: "/guide/installation" },
            { text: "First run", link: "/guide/first-run" },
          ],
        },
        {
          text: "Concepts",
          items: [
            { text: "Runs & metrics", link: "/guide/concepts/runs" },
            { text: "Artifacts", link: "/guide/concepts/artifacts" },
            { text: "Traces", link: "/guide/concepts/traces" },
          ],
        },
      ],
      "/sdk/": [
        {
          text: "Python SDK",
          items: [
            { text: "Quickstart", link: "/sdk/python" },
            { text: "Tracking", link: "/sdk/tracking" },
            { text: "Artifacts", link: "/sdk/artifacts" },
          ],
        },
      ],
    },
    darkMode: true,
    enableScrollToTop: true,
  },
  plugins: [],
  markdown: {
    globalComponents: true,
  },
  builderConfig: {
    dev: {
      port: 5174,
    },
  },
});
