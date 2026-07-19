# @lumina/docs-site

Lumina's public documentation site, built with **VuePress 2** + the
default theme. Everything in here is plain Markdown + Vue 3 SFCs — no
separate frontend pipeline.

## Structure

```
docs-site/
├── docs/                       # VuePress content root
│   ├── README.md               # Landing page (home: true)
│   ├── .vuepress/
│   │   ├── config.ts           # Site config + theme settings
│   │   ├── components/
│   │   │   └── ReleaseSection.vue   # GitHub Release renderer
│   │   ├── styles/index.scss   # Theme overrides
│   │   └── public/             # Static assets (icon, releases.json)
│   ├── guide/                  # Concepts + getting-started
│   ├── sdk/                    # Python SDK reference
│   └── changelog.md            # Release notes index
└── scripts/
    └── fetch-releases.mjs      # Pulls GitHub Releases → public/releases.json
```

## Scripts

```bash
pnpm --filter @lumina/docs-site dev       # local dev server (http://localhost:5174)
pnpm --filter @lumina/docs-site build     # static build → docs/.vuepress/dist
pnpm --filter @lumina/docs-site preview   # preview the static build
pnpm --filter @lumina/docs-site fetch:releases  # refresh releases.json
```

`dev` and `build` both run `fetch:releases` first so the GitHub Release
cards on the landing page always reflect the latest tags.

## Adding a new page

1. Drop a `.md` file into `docs/`.
2. If it's under `guide/` or `sdk/`, add a sidebar entry in
   `docs/.vuepress/config.ts` (the `sidebar` map).
3. Reference it from the navbar (if relevant) and from the README's
   "What's next?" section.

## Adding a new global component

Drop a `.vue` file under `docs/.vuepress/components/`. VuePress will
auto-register it by PascalCase file name; reference it as
`<MyComponent />` in any Markdown page.

## Release notes

The `<ReleaseSection />` component on the landing page reads
`/releases.json` (emitted into the public dir by
`scripts/fetch-releases.mjs`). To pull a different repo's releases:

```bash
LUMINA_REPO=other-org/lumina LUMINA_RELEASES=20 pnpm --filter @lumina/docs-site fetch:releases
```

To authenticate against the GitHub API (avoids 60-req/hr rate limit):

```bash
GITHUB_TOKEN=ghp_… pnpm --filter @lumina/docs-site fetch:releases
```
