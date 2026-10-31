# GD Run Tracker

Track your Geometry Dash progress on levels. Add levels, log start-position runs (with optional videos), and the app works out the fewest runs that chain together from 0 to 100%.

Everything is stored in your browser. There are no accounts and no server.

## Features

- **Level library** with In Progress, Completed and a collapsible Next Up section, search, and sorting (including by demon list rank). Completed levels have their own sort (hardest/easiest by AREDL, recently beaten, attempts, name or random). Your hardest completion gets a shiny gold frame, and cards show your attempt count when you've logged one.
- **Next Up queue**: line up the levels you'll play next and reorder them.
- **Goals**: give a level a goal ("Get it in 3 runs") and a target date with a countdown.
- **Add levels by ID**: details auto-fill from [GDBrowser](https://gdbrowser.com), falling back to GDBrowser search, [GDHistory](https://history.geometrydash.eu), and the demon lists if a service is down. You can always enter them by hand.
- **Grandpa Demon tiers**: extreme demons in the AREDL top 500 get the tiers and demon faces from the [Grandpa Demon](https://github.com/ItzKiba/GrandpaDemon) mod (Supreme, Ultimate, Legendary, Mythical, Infinite, Grandpa).
- **Demon list ranks** from [Pointercrate](https://pointercrate.com) and the [AREDL](https://aredl.net), refreshable per level or all at once in Settings.
- **Card thumbnails**: levels with an in-game ID automatically use their community thumbnail from the [Level Thumbnails](https://geode-sdk.org/mods/cdc.level_thumbnails) mod. You can switch to a color, your own image, or none.
- **Themes**: pick the app's background color, and give any level its own. Colors fade between pages like a GD color trigger.
- **Run calculator**: finds the fewest runs that chain from 0 to 100, shows them on a GD-style bar with one lane per run, and highlights the missing gap if there is one.
- **Runs from 0** show as just the percent you reached (`0–31` shows as `31%`), like a normal-mode attempt.
- **Log runs** with decimals (e.g. `47.25`), a date, a note, and an optional video.
  - Quick add: type `25-75` in the Runs box and press Enter.
- **Videos**: upload a clip (stored in your browser) or paste a YouTube, X/Twitter or Medal link. YouTube and X videos play right in the app.
- **Mark levels beaten** with a completion date and video.
- **Undo** after deleting a run.
- **Keyboard shortcuts**: `N` new run, `/` search, `A` add level, `?` for the list.
- **Import a spreadsheet** (.xlsx or .csv) in Settings. It reads columns by their headers (Level, AREDL Rank, Status, Best from 0, Best Runs, Attempts, Notes…), understands section headings like "Next Up" or "Plan to Play", and shows a preview before saving. It can also look up level IDs and current ranks on the AREDL by name.
- **Death Tracker import**: pick the [Death Tracker](https://github.com/abb2k/death-tracker) mod's `levels` folder (`%LOCALAPPDATA%\GeometryDash\geode\mods\elohmrow.death_tracker\levels`) in Settings to bring in attempts, playtime, your best from 0, recorded start-pos runs, and a "Where You Die" chart of deaths at each percent. Re-import any time; nothing is duplicated.
- **Backup and restore**: one .zip file with all your data and videos, plus a reminder if you haven't backed up in a week.
- **Sync between devices** (optional) with [Dexie Cloud](https://dexie.org/cloud/): sign in with an email code and your levels and runs sync between your phone and computer.
- **Videos on every device** (optional): uploads can be compressed to 720p in the browser and saved to a "Run Tracker videos" folder in your own Google Drive, so they play on all your devices. Without this, uploaded videos stay on the device they were added on.
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

## Setting up sync

Sync uses Dexie Cloud's free tier. It's off until a database URL is set.

1. On your computer, in this project folder, run `npx dexie-cloud create` and confirm the code sent to your email. It prints your database URL and saves `dexie-cloud.json` and `dexie-cloud.key` (keep these private; they're in `.gitignore`).
2. Allow your site to connect: `npx dexie-cloud whitelist https://<your-username>.github.io` (add `http://localhost:5173` too for local development).
3. Put the URL in `src/syncConfig.ts` and deploy.
4. In the app, open **Settings → Sync → Sign in to sync** on each device with the same email. Sign in on the device that has your data first; data already on a device is uploaded when it first signs in.

### Saving videos to Google Drive

1. In [Google Cloud Console](https://console.cloud.google.com/), create a project and enable the **Google Drive API**.
2. Set up the OAuth consent screen (Google Auth Platform): app name, your email, audience **External**, and add your Google account under **Test users**. Add the scope `.../auth/drive.file`.
3. Create an OAuth client of type **Web application** with authorized JavaScript origin `https://<your-username>.github.io` (and `http://localhost:5173` for development).
4. Put the client ID in `GOOGLE_CLIENT_ID` in `src/syncConfig.ts` and deploy.

The app only gets access to files it creates. Deleting a run removes the video from the device but leaves the file in your Drive.

Signing out clears that device's local copy (synced data stays in your account), so download a backup first if you have uploaded videos there.

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
    sheetReader.ts    Reads .xlsx and .csv files into rows
    spreadsheetImport.ts  Turns spreadsheet rows into levels and runs (+ tests)
    demonTier.ts      Grandpa Demon tiers from AREDL position (+ tests)
    levelThumbnail.ts Community level thumbnails (levelthumbs.prevter.me)
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

Geometry Dash is a game by RobTop Games. This is a fan-made tool and isn't affiliated with RobTop. The demon faces in `src/assets/demons/` are from Geometry Dash (Easy to Extreme Demon, by RobTop Games) and the [Grandpa Demon](https://github.com/ItzKiba/GrandpaDemon) mod by ItzKiba (the tier faces; Grandpa Demon sprite by tcoffa). The logo lettering (`src/assets/logo.svg`) is set in Oxygene 1 by Jakob Fischer (pizzadude.dk) and saved as an image; the font file itself isn't included. The display font is Pusab by Ryoichi Tsunekawa (Flat-it), the font Geometry Dash uses; it is freeware. All other art in the app is original.
