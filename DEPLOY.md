# Deploy to GitHub Pages

**App URL**: https://w0915306357-ux.github.io/kimi-stock-calculator/

---

## Option A — Automatic deploy via GitHub Actions (recommended)

Every push to `main` triggers a build and deploy automatically.

### Step 1 — Enable GitHub Pages (one time only)

Go to your repo → **Settings** → **Pages** → **Source** → select **GitHub Actions** → Save.

### Step 2 — Set up the repo with the correct file structure

**Important**: the files in this ZIP must be at the ROOT of your repo, not inside a subfolder. When you extract the ZIP, use the contents directly:

```
your-repo-root/               ← git init here
├── .github/
│   └── workflows/
│       └── deploy.yml        ← GitHub Actions sees this
├── src/
├── public/
├── dist/                     ← pre-built version (see Option B)
├── index.html
├── package.gh-pages.json
├── vite.gh-pages.config.ts
└── DEPLOY.md
```

### Step 3 — Push

```bash
git init
git remote add origin https://github.com/w0915306357-ux/kimi-stock-calculator.git
git add .
git commit -m "Initial deploy"
git push -u origin main
```

GitHub Actions builds and deploys automatically. Check the **Actions** tab — takes ~2 min.

---

## Option B — Manual deploy (instant, no build step)

This ZIP already contains a pre-built `dist/` folder. You can deploy it directly to GitHub Pages without any build step.

### Using the `gh-pages` npm tool

```bash
# Install once
npm install -g gh-pages

# Deploy the pre-built dist/ folder
gh-pages -d dist
```

This pushes `dist/` to the `gh-pages` branch. Then in GitHub Pages settings, set source to **Deploy from branch → gh-pages → / (root)**.

### Or push manually

```bash
# From your repo root
git subtree push --prefix dist origin gh-pages
```

---

## How the build works

| File | Purpose |
|---|---|
| `vite.gh-pages.config.ts` | Sets `base: "/kimi-stock-calculator/"`, no Replit plugins |
| `package.gh-pages.json` | Real semver versions — no `catalog:` workspace aliases |
| `.github/workflows/deploy.yml` | Copies `package.gh-pages.json` → `package.json`, runs `npm install` + `npm run build:gh-pages`, deploys `dist/` |
| `public/404.html` | SPA 404 fallback |
| `dist/` | Pre-built output (base path already baked in) |

---

## Why the blank page happens

The most common cause: the `.github/` folder is inside a subfolder instead of at the repo root. GitHub Actions only scans `.github/workflows/` at the **repo root**. If the workflow is one level deeper, it is completely ignored and no build ever runs.

Always extract this ZIP's contents directly into your repo root — do not push the whole extracted folder as a subdirectory.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank page, no Actions runs | `.github/workflows/deploy.yml` is not at repo root |
| Actions fails on `catalog:` | Confirm the `cp package.gh-pages.json package.json` step ran |
| Blank page, Actions succeeded | Check `dist/index.html` has `src="/kimi-stock-calculator/assets/..."` |
| Assets 404 | Confirm `base` in `vite.gh-pages.config.ts` matches your repo name exactly |
