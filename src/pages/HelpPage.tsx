import { useEffect, type ReactNode } from 'react'
import { href } from '../router'
import { SHORTCUTS } from '../lib/shortcuts'
import { DEMON_TIERS, tierRange } from '../lib/demonTier'
import { driveEnabled } from '../lib/googleDrive'
import { DEXIE_CLOUD_URL } from '../syncConfig'

const DT_PATH = '%LOCALAPPDATA%\\GeometryDash\\geode\\mods\\elohmrow.death_tracker\\levels'

const SECTIONS: { id: string; title: string }[] = [
  { id: 'basics', title: 'The basics' },
  { id: 'install', title: 'Install the app' },
  { id: 'sync', title: 'Sync your phone and computer' },
  { id: 'videos', title: 'Videos and Google Drive' },
  { id: 'death-tracker', title: 'Death Tracker mod' },
  { id: 'thumbnails', title: 'Level Thumbnails mod' },
  { id: 'grandpa-demon', title: 'Grandpa Demon tiers' },
  { id: 'spreadsheet', title: 'Import a spreadsheet' },
  { id: 'backups', title: 'Backups' },
  { id: 'shortcuts', title: 'Keyboard shortcuts' },
]

/** The "How to Use" guide: how the app works and how to set up each connection. */
export function HelpPage({ section }: { section?: string }) {
  // Jump to a section when the link points at one (#/help/death-tracker).
  useEffect(() => {
    if (section) document.getElementById(`help-${section}`)?.scrollIntoView({ block: 'start' })
  }, [section])

  return (
    <div className="page narrow help-page">
      <a className="back-link outlined" href={href.library}>
        ‹ Levels
      </a>
      <h1 className="page-title outlined">How to Use</h1>

      <nav className="panel help-toc" aria-label="Contents">
        <ol>
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a className="text-link" href={href.helpSection(s.id)}>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <Section id="basics" title="The basics">
        <p>
          Run Tracker works out the fewest start-pos runs that chain together from 0 to 100%, so you know how many runs you have
          a level in.
        </p>
        <Steps>
          <li>
            <strong>Add a level</strong> with <em>+ Add Level</em>. Type its in-game ID and press <em>Look up</em> to fill in the
            name, creator, difficulty and demon list rank, or type them yourself.
          </li>
          <li>
            <strong>Log runs</strong> on the level's page with <em>+ Log Run</em>, or type a run like <code>25-75</code> in the
            quick-add box and press Enter. Decimals like <code>47.25</code> work too. A run from 0 shows as just its end, e.g.{' '}
            <code>31%</code>.
          </li>
          <li>
            <strong>Read your chain.</strong> A run connects to the previous one if it starts at or before where that one
            ended, so 0–50 and 50–100 connect. The big number is how many runs you have it in; a red striped section shows
            what's still missing.
          </li>
          <li>
            <strong>Connected, other and obsolete runs.</strong> Under <em>Runs</em>, your chain is listed first. Runs your
            chain fully covers (like 50–100 when you have 40–100) go in <em>Obsolete runs</em>, folded away. Anything else is
            under <em>Other runs</em>.
          </li>
          <li>
            <strong>Beat it?</strong> Press <em>★ Mark Beaten</em> to add a completion date and video. The level gets a 100%
            run, so it's beaten in 1 run, and the chain you had before is kept under <em>Before you beat it</em>. Your hardest
            completion gets a gold frame.
          </li>
        </Steps>
        <p>
          Plan ahead with <em>+ Next Up</em> on a level's page (the queue is at the bottom of the levels page), and use{' '}
          <em>Edit</em> to add a goal, target date, attempt count, notes, a card thumbnail or a background color.
        </p>
      </Section>

      <Section id="install" title="Install the app">
        <p>Run Tracker can live on your home screen like a normal app, and works offline.</p>
        <ul>
          <li>
            <strong>iPhone / iPad:</strong> open the site in Safari, tap <em>Share</em>, then <em>Add to Home Screen</em>. Open
            it from the new icon afterwards; on iPhone it keeps its own data, separate from Safari.
          </li>
          <li>
            <strong>Android:</strong> in Chrome, tap <em>⋮</em> then <em>Install app</em>.
          </li>
          <li>
            <strong>Computer:</strong> in Chrome or Edge, use the install icon in the address bar, or <em>Settings → App →
            Install App</em>.
          </li>
        </ul>
        <p className="hint">After an update, close and reopen the app (sometimes twice) to get the newest version.</p>
      </Section>

      <Section id="sync" title="Sync your phone and computer">
        {DEXIE_CLOUD_URL ? (
          <>
            <Steps>
              <li>
                On the device that already has your levels, open <em>Settings → Sync</em> and press <em>Sign in to sync</em>.
                Enter your email, then the code you're emailed. Your levels and runs upload.
              </li>
              <li>On your other device (inside the installed app on iPhone), sign in with the same email. Your data downloads.</li>
              <li>From then on, changes show up on both, straight away when online or the next time the app opens.</li>
            </Steps>
            <ul>
              <li>Levels, runs, attempts, Death Tracker stats and video links sync. Videos uploaded without Google Drive don't.</li>
              <li>
                Don't import the same spreadsheet on two devices before signing in, or you'll get duplicates. Sign in on one
                device first.
              </li>
              <li>
                Signing out removes the data from that device (it stays in your account). Download a backup first if you have
                uploaded videos there.
              </li>
            </ul>
          </>
        ) : (
          <p className="muted">Sync isn't set up on this copy of the app, so everything stays on this device.</p>
        )}
      </Section>

      <Section id="videos" title="Videos and Google Drive">
        <p>Every run and completion can have a video:</p>
        <ul>
          <li>
            <strong>Links:</strong> YouTube and X/Twitter videos play right in the app. Medal and other links open in a new
            tab. Links sync everywhere.
          </li>
          <li>
            <strong>Uploads:</strong> pick a file. Leave <em>Compress to 720p</em> ticked to make it much smaller.
          </li>
        </ul>
        {driveEnabled ? (
          <>
            <p>
              To watch uploads on all your devices, tick <em>Save to my Google Drive</em> when adding the video:
            </p>
            <Steps>
              <li>
                Press <em>Save</em>. Google's sign-in appears (about once per visit). Choose your account and allow access. If
                Google says it hasn't verified the app, press <em>Continue</em>.
              </li>
              <li>
                The video is compressed and uploaded to a <strong>Run Tracker videos</strong> folder in your Drive. The app can
                only see files it made, nothing else in your Drive.
              </li>
              <li>
                On another device, tap the run's <em>▶ Video</em>, then <em>Load from Google Drive</em>. It's kept on that device
                afterwards.
              </li>
            </Steps>
            <p className="hint">
              Google Drive saving is in testing, so it only works for Google accounts the site owner has added as testers.
              "Access blocked" means your account isn't on that list. Deleting a run leaves its video in your Drive.
            </p>
          </>
        ) : (
          <p className="hint">Without Google Drive, uploaded videos stay on the device you added them on.</p>
        )}
      </Section>

      <Section id="death-tracker" title="Death Tracker mod">
        <p>
          The <ExtLink href="https://github.com/abb2k/death-tracker">Death Tracker</ExtLink> Geode mod records every death while
          you play. Run Tracker can read it to fill in attempts, playtime, your best from 0, start-pos runs, and a{' '}
          <em>Where You Die</em> chart on each level's page.
        </p>
        <Steps>
          <li>
            Install <ExtLink href="https://geode-sdk.org">Geode</ExtLink> and the Death Tracker mod, then play as usual. The mod
            saves when you leave a level.
          </li>
          <li>
            On your PC, open Run Tracker and go to <em>Settings → Death Tracker → Choose the Death Tracker folder</em>.
          </li>
          <li>
            Paste this into the folder picker's address bar, press Enter, and pick the <strong>levels</strong> folder:
            <code className="path">{DT_PATH}</code>
            If you changed the mod's <em>Save Path</em> setting, pick that folder instead.
          </li>
          <li>
            Check the preview. It's split into <em>Levels on the servers</em> and <em>Editor levels</em>, each with{' '}
            <em>Unselect all</em> and <em>Select matches</em>. Each level has a menu for where its data goes; ★ marks the
            suggested match.
          </li>
          <li>Press <em>Import</em>.</li>
        </Steps>
        <ul>
          <li>
            <strong>Editor copies:</strong> if you grind on a copy, it's matched by name. Words like "start pos", "copy", "sp"
            and trailing numbers are ignored, so "bloodbath start pos" links to Bloodbath. Several copies can add to the same
            level, and the totals combine.
          </li>
          <li>
            <strong>Re-import any time.</strong> Each source's numbers are replaced, not added twice, and your links are
            remembered. Your own attempt count is never lowered.
          </li>
          <li>Importing works on a computer (where the mod's files are). With sync on, the stats then show on your phone too.</li>
        </ul>
      </Section>

      <Section id="thumbnails" title="Level Thumbnails mod">
        <p>
          Levels with an in-game ID show their community thumbnail from the{' '}
          <ExtLink href="https://geode-sdk.org/mods/cdc.level_thumbnails">Level Thumbnails</ExtLink> mod automatically, on their
          card and page. You don't need the mod installed to see them.
        </p>
        <ul>
          <li>No thumbnail? The level may not have one yet. Players add them through the mod in-game.</li>
          <li>
            To use your own, open the level's <em>Edit</em> and pick <em>Color</em> or <em>Image</em> under Card thumbnail (or{' '}
            <em>None</em> to turn it off).
          </li>
        </ul>
      </Section>

      <Section id="grandpa-demon" title="Grandpa Demon tiers">
        <p>
          Extreme demons in the top 500 of the <ExtLink href="https://aredl.net">AREDL</ExtLink> get a tier and face from the{' '}
          <ExtLink href="https://github.com/ItzKiba/GrandpaDemon">Grandpa Demon</ExtLink> mod:
        </p>
        <ul className="tier-list">
          {DEMON_TIERS.map((t) => (
            <li key={t.id}>
              <strong>{t.name}</strong> <span className="muted">{tierRange(t)}</span>
            </li>
          ))}
        </ul>
        <p>
          Tiers need the level's AREDL rank: it's found when you look a level up by ID, or press <em>Check list rank</em> on its
          page (<em>Settings → Refresh all ranks</em> updates every level).
        </p>
      </Section>

      <Section id="spreadsheet" title="Import a spreadsheet">
        <p>
          Already tracking in Excel or Google Sheets? Save it as <code>.xlsx</code> or <code>.csv</code> and use{' '}
          <em>Settings → Import Spreadsheet</em>.
        </p>
        <ul>
          <li>
            It needs a header row with a <strong>Level</strong> (or Name) column. It also reads columns like ID, Creator,
            Difficulty, AREDL Rank, Status, Attempts, Best from 0, Best Runs (e.g. <code>21-77, 53-100</code>), Date Beaten
            and Notes. Other columns are kept as notes.
          </li>
          <li>
            A sheet named "Completions" marks its levels beaten, and headings like "Next Up" or "Plan to Play" set the
            status of the rows under them.
          </li>
          <li>You'll see a preview to adjust before anything is saved. Levels already in your tracker are filled in, not duplicated.</li>
        </ul>
      </Section>

      <Section id="backups" title="Backups">
        <p>
          Your data is saved in your browser. <em>Settings → Download Backup</em> saves everything, uploaded videos included,
          as one <code>.zip</code>; <em>Restore</em> brings it back (Merge adds to what you have, Replace starts over). The app
          reminds you if you haven't backed up in a week.
        </p>
      </Section>

      <Section id="shortcuts" title="Keyboard shortcuts">
        <ul className="shortcut-list">
          {SHORTCUTS.map((s) => (
            <li key={s.keys}>
              <kbd>{s.keys}</kbd>
              <span>{s.what}</span>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section className="panel help-section" id={`help-${id}`}>
      <h2 className="outlined">{title}</h2>
      {children}
    </section>
  )
}

const Steps = ({ children }: { children: ReactNode }) => <ol className="help-steps">{children}</ol>

const ExtLink = ({ href: url, children }: { href: string; children: ReactNode }) => (
  <a className="text-link" href={url} target="_blank" rel="noreferrer">
    {children}
  </a>
)
