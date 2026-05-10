# Deploy to GitHub Pages

Target URL: **https://w0915306357-ux.github.io/kimi-stock-calculator/**

---

## One-time Setup (GitHub repo settings)

1. Go to your GitHub repo → **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Save — no branch selection needed

---

## Step-by-step: First deployment

### 1. Create your GitHub repo

```bash
git init
git remote add origin https://github.com/w0915306357-ux/kimi-stock-calculator.git
```

### 2. Copy files into the repo root

Extract the ZIP — the structure should be:

```
kimi-stock-calculator/          ← your GitHub repo root
├── .github/
│   └── workflows/
│       └── deploy.yml          ← GitHub Actions workflow
├── src/
│   └── pages/
│       └── Calculator.tsx
├── public/
│   └── 404.html
├── index.html
├── package.json
├── vite.gh-pages.config.ts     ← GitHub Pages build config
└── ...
```

> The `.github/workflows/deploy.yml` file must be at the **repo root**, not inside a subfolder.

### 3. Remove pnpm catalog references (standalone repo only)

Since this repo won't have a pnpm workspace, replace `catalog:` versions in `package.json` with explicit versions:

Run this to auto-resolve them:
```bash
npx npm-check-updates -u
pnpm install
```

Or manually pin each `"catalog:"` entry to a version (e.g. `"vite": "^7.0.0"`).

### 4. Push to GitHub

```bash
git add .
git commit -m "Initial commit"
git push -u origin main
```

### 5. Watch the deployment

Go to **Actions** tab in your GitHub repo. The workflow runs automatically on every push to `main`. Deployment takes about 1–2 minutes.

---

## Local build test (before pushing)

```bash
pnpm install
pnpm build:gh-pages
# Output is in ./dist/
```

---

## How it works

| File | Purpose |
|---|---|
| `vite.gh-pages.config.ts` | Sets `base: "/kimi-stock-calculator/"`, no Replit plugins |
| `.github/workflows/deploy.yml` | CI/CD: installs, builds, deploys to GitHub Pages on every push |
| `public/404.html` | SPA fallback — redirects 404s back to the app |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank page after deploy | Check that `base` in `vite.gh-pages.config.ts` matches your repo name exactly |
| Build fails on `catalog:` | Replace `"catalog:"` with real version numbers in `package.json` |
| Workflow not triggering | Confirm Pages source is set to **GitHub Actions** in repo settings |
