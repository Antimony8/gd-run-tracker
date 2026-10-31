# GD Run Tracker

Track your Geometry Dash progress on levels. Add levels, log start-position runs (with optional videos), and the app works out the fewest runs that chain together from 0 to 100%.

Everything is stored in your browser. There are no accounts and no server.

## Features

- **Level library** with Next Up, In Progress and Completed sections, search, and sorting (including by demon list rank).
- **Next Up queue**: line up the levels you'll play next and reorder them.
- **Goals**: give a level a goal ("Get it in 3 runs") and a target date with a countdown.
- **Add levels by ID**: details auto-fill from [GDBrowser](https://gdbrowser.com), falling back to GDBrowser search, [GDHistory](https://history.geometrydash.eu), and the demon lists if a service is down. You can always enter them by hand.
- **Demon list ranks** from [Pointercrate](https://pointercrate.com) and the [AREDL](https://aredl.net), refreshable per level or all at once in Settings.
- **Card thumbnails**: a color or your own image on each level card.
- **Themes**: pick the app's background color, and give any level its own. Colors fade between pages like a GD color trigger.
- **Run calculator**: finds the fewest runs that chain from 0 to 100, shows them on a GD-style bar with one lane per run, and highlights the missing gap if there is one.
- **Log runs** with decimals (e.g. `47.25`), a date, a note, and an optional video.
  - Quick add: type `25-75` in the Runs box and press Enter.
- **Videos**: upload a clip (stored in your browser) or paste a YouTube/Medal link.
- **Mark levels beaten** with a completion date and video.
- **Undo** after deleting a run.
- **Keyboard shortcuts**: `N` new run, `/` search, `A` add level, `?` for the list.
- **Backup and restore**: one .zip file with all your data and videos, plus a reminder if you haven't backed up in a week.
- **Installable (PWA)**: add it to your desktop or home screen and it works offline.

### How runs connect

A run connects to the previous one if it starts at or before the previous one ended. So `0–50` and `50–100` count as connected. You decide what's legit when you log a run; the app just does the math.

## Setup

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open the address it prints (usually http://localhost:5173).

### Other commands

| Command           | What it does                         |
| ----------------- | ------------------------------------ |
| `npm test`        | Runs the tests                       |
| `npm run build`   | Builds the site into `dist/`         |
| `npm run preview` | Serves the built site locally        |

## Deploying to GitHub Pages

1. Push this project to a GitHub repository, on the `main` branch.
2. In the repo, go to **Settings → Pages** and set **Source** to **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) tests, builds and deploys on every push to `main`.
4. Your site will be at `https://<your-username>.github.io/<repo-name>/`.

The app uses hash URLs (`#/level/...`) and relative asset paths, so it works under any repo name with no extra config.

## Your data

- Data lives in your browser's IndexedDB, tied to the site address you use. `localhost:5173` and your GitHub Pages URL each have **separate** data.
- The app asks the browser for persistent storage so it won't be cleared automatically. You can check this in **Settings**.
- Clearing site data, using a private window, or switching browsers means starting fresh. **Download backups regularly**, especially if you upload videos.
- Restore offers **Merge** (add to what you have) or **Replace** (wipe and restore exactly).

## Project structure

```
src/
  lib/
    runCalc.ts        Run calculator (pure function) + runCalc.test.ts
    backup.ts         Zip export/import
    data.ts           Saving/deleting levels, runs and videos; Next Up queue
    levelInfo.ts      Level lookup by ID and demon list ranks (+ tests)
    format.ts         Number/date formatting and validation (+ tests)
    settings.ts       App settings stored in IndexedDB
    theme.ts          Background color themes
    shortcuts.ts      Keyboard shortcuts
    toast.ts          Toast messages (used for Undo)
    pwa.ts            Service worker registration and install prompt
    storage.ts        Persistent storage and usage estimate
    video.ts          YouTube/Medal link helpers
  components/         Modals, progress bars, video picker/player, difficulty badges
  pages/              Library, LevelPage, Settings
  db.ts               Dexie (IndexedDB) schema
  types.ts            Level, Run and video types
  router.ts           Tiny hash router
  index.css           All styling
public/               Icons and the web app manifest
sw-template.js        Offline service worker; vite.config.ts fills in the file list at build time
```

Runs store a `createdAt` timestamp, which leaves room for future features like a progress-over-time graph, a death heatmap, or a stats page.

Geometry Dash is a game by RobTop Games. This is a fan-made tool and isn't affiliated with RobTop. All art in the app is original.
