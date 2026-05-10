# Deploy to GitHub Pages

Target URL: **https://w0915306357-ux.github.io/kimi-stock-calculator/**

---

## Why the blank page happens (root cause)

The main `package.json` uses `catalog:` version aliases from a pnpm monorepo.
Outside that workspace those aliases can't resolve, so `npm install` / `pnpm install`
fails silently and no JavaScript gets built → blank page.

**Fix**: the workflow automatically copies `package.gh-pages.json` (real version
numbers, no aliases, no workspace deps) over `package.json` before installing.

---

## One-time repo setup (do this once)

1. Go to your GitHub repo → **Settings** → **Pages**
2. Under **Source** select **GitHub Actions** → Save

---

## File structure in your GitHub repo

```
kimi-stock-calculator/        ← repo root
├── .github/
│   └── workflows/
│       └── deploy.yml        ← auto-deploy on push to main
├── src/
│   └── pages/Calculator.tsx
├── public/
│   └── 404.html
├── index.html
├── package.gh-pages.json     ← standalone deps (real versions, no catalog:)
├── vite.gh-pages.config.ts   ← sets base: "/kimi-stock-calculator/"
└── ...
```

> `.github/workflows/deploy.yml` must be at the **repo root** (not in a subfolder).

---

## How to deploy

```bash
# 1. Create and link your repo
git init
git remote add origin https://github.com/w0915306357-ux/kimi-stock-calculator.git

# 2. Push — GitHub Actions handles everything else
git add .
git commit -m "Initial deploy"
git push -u origin main
```

Watch the **Actions** tab in GitHub — deployment takes ~2 minutes.

---

## Local build test (optional, verify before pushing)

```bash
cp package.gh-pages.json package.json
npm install
npm run build:gh-pages
# Output is in ./dist/ — open dist/index.html to verify
```

---

## How it works

| File | Purpose |
|---|---|
| `vite.gh-pages.config.ts` | Sets `base: "/kimi-stock-calculator/"`, no Replit plugins |
| `package.gh-pages.json` | Standalone deps with real semver versions (no `catalog:`) |
| `.github/workflows/deploy.yml` | Swaps in the standalone package.json, builds with Node 22 + npm, deploys |
| `public/404.html` | SPA fallback for direct URL access |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank page | Check Actions tab — look for build errors in the logs |
| `catalog:` error | Confirm the workflow copied `package.gh-pages.json` → `package.json` |
| Assets 404 | Confirm `base` in `vite.gh-pages.config.ts` exactly matches your repo name |
| Workflow not running | Confirm Pages source is set to **GitHub Actions** in repo settings |
