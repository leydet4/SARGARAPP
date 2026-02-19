# Chesapeake Marine Team (v25)

Mobile-friendly static site (HTML/CSS/JS). Ready for **GitHub → Netlify** auto-deploys.

## Quick start

```bash
# in an empty folder
git init
git add -A
git commit -m "Initial deploy (v25 navy theme)"
git branch -M main
git remote add origin https://github.com/YOUR_USER/chesapeake-marine-team.git
git push -u origin main
```

Then in **Netlify** → **Add new site** → **Import from Git** → choose this repo.

- Build command: **(leave blank)**
- Publish directory: **/**

### PWA
- `manifest.webmanifest` + `sw.js` added so users can **Add to Home Screen** on iOS/Android.
- Service worker caches `index.html`, `app.css`, `helpers.js` for faster loads.

### Structure
- `/index.html` — home (hero + large tiles)
- `/pages/*.html` — dashboard, tides pages, training & operations
- `/assets/pdfs/*` — task books & NSBC modules (replace Module PDFs when you have final versions)
- `/assets/img/chesapeake-fire-badge.png` — patch

### Updating
- Modify files locally → `git add/commit/push` → Netlify auto-deploys.
- Roll back from Netlify **Deploys** tab if needed.

*(Generated 2025-09-01T19:10:03.886297Z)*
