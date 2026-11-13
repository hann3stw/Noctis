# Noctis

3D open-world action game for tablets and phones (landscape, touch). Hunt
monsters and raise them as your shadow army. Built with Three.js and Vite.

## Run it

```bash
npm install
npm run dev
```

Open the address Vite prints. To test on a tablet or phone in the same Wi-Fi,
open the "Network" address (e.g. `http://192.168.x.x:5173`) on the device.

Production build: `npm run build` (also draws the app icons), then
`npm run preview`.

## Play it online / install it

The game is a PWA: once opened it works offline and can be installed like an
app (fullscreen, landscape, own icon).

Live version: **https://hann3stw.github.io/Noctis/**

### Install on an Android tablet or phone (Chrome)

1. Open the link above in Chrome.
2. Wait a moment, then tap the menu (three dots) -> **Install app** (on some
   devices: **Add to Home screen** -> Install).
3. Start Noctis from the home screen icon. It runs fullscreen in landscape and
   also works without internet.

### Install on an iPhone or iPad (Safari)

1. Open the link in **Safari** (other browsers on iOS cannot install apps).
2. Tap the **Share** button -> **Add to Home Screen** -> Add.
3. Start Noctis from the home screen. Turn the device sideways.

Saves live in the browser storage of the installed app. Uninstalling the app
or clearing the site data deletes them.

### Updates

The installed app updates itself: after a new version is online, it is
loaded in the background and used the next time the app is started.

## Hosting on GitHub Pages (free)

Already set up for this repository: `.github/workflows/deploy.yml` builds the
game and publishes `dist/` on every push to `main` (and the working branch).

To set it up for a fork or a new repository:

1. Push the project to GitHub.
2. Repository -> **Settings** -> **Pages** -> Source: **GitHub Actions**.
3. Push a commit (or run the workflow by hand under **Actions** -> Deploy to
   GitHub Pages -> Run workflow).
4. After a minute the game is online at
   `https://<user>.github.io/<repository>/`. The build uses relative paths,
   so any repository name works.

Any other static host works as well (Netlify, Cloudflare Pages, itch.io as
HTML game): upload the contents of `dist/` after `npm run build`. PWAs need
HTTPS (or localhost) for offline mode and installing.

## Graphics and performance

- Settings -> Graphics: **Auto** (default) measures the frame rate while
  playing and switches between Low, Medium and High by itself; it never goes
  back up to a level that was too slow. Or pick a level by hand.
- Presets (in `src/config.js` -> `graphics`): render resolution limit, view
  distance of plants and rocks, draw distance of enemies and shadows, effect
  particles, soft shadows under characters.
- Measured in the worst case (volcano, 32 shadows, 54 enemies fighting) on a
  desktop GPU: game logic 0.5 ms and drawing 1.9 ms per frame at tablet
  resolution (2240 x 1400, High), 82 draw calls, about 60 000 triangles.
  Enemies far away are not simulated, everything repeated is drawn with
  instancing and nothing is allocated per frame.

## Controls

| | Touch | PC (testing) |
|---|---|---|
| Move | Left half of the screen (joystick appears under the finger) | WASD / arrow keys |
| Attack | Drag the attack button to aim, release to strike. Quick tap = auto-aim | Hold left mouse button to aim, release to strike |
| Dodge | Dodge button | Space / right mouse button |
| Arise | Arise button (appears next to a fallen enemy's soul) | E |
| Summon / recall the army | Summon / Recall button (bottom centre) | 1 |
| Army behaviour | Tap the Army chip: Attack <-> Protect | 2 |
| Revive fallen shadows | Green button above the army chip | 3 |
| Skills | Drag a skill button to aim, release to cast. Quick tap = auto-aim | Q / R (towards the mouse) |
| Ultimate | Ultimate button (charges by landing hits) | F |
| Menu | Menu button (top right): Gear, Stats, Skills, Army, Look. Equipment, skills and your look can only be changed in the camp or a captured outpost; the army anywhere | click it |
| Pause | Pause button (top right corner) | Esc |
| Enter a gate | Enter button (appears next to a gate) | G |
| Minimap | Tap it: close view <-> whole world | M |

## World

- Six big ring shaped zones around the camp: Whispering Meadow (E), Gloomwood
  (D), Rotmire Swamp (C), Sunken Ruins (B), Frostfang Peaks (A), Ashen Caldera
  (S). Every rank multiplies enemy health, damage and XP by 10: enemies two
  ranks above you kill you with one hit, but they also give 10x the XP.
- The rank comes from the level: E = level 1-9, D = 10-24, C = 25-49,
  B = 50-99, A = 100-199, S = 200-300. Every zone covers the levels of its
  rank; enemies get higher levels (up to about x3 stronger) towards the outer
  edge of their zone. Every new rank gives many stat points (10, 12, 15, 18,
  20); levels give 3 points in E, 2 in D, 1 in C and B, and one every second
  level in A and S.
- The hunter grows x6 per rank from levels alone. The rest of the step to the
  next zone must come from better gear, stat points and the army. A global
  difficulty setting (enemy health x1.5, damage x1.75) sits in
  `src/config.js` -> `difficulty`; all level values in `levels`.
  Old saves are moved to the new levels automatically.
- Kills of your shadows give you half the XP.
- Every zone has three enemy types (melee, ranged, charger). Elites (gold
  ring) and champions (red ring, with two escorts) are much stronger and always
  drop loot. Their shadows get an ability: tanks taunt, melee shadows cleave,
  ranged shadows fire a volley, healers heal everyone.
- Four outposts per zone (north, east, south, west) start in enemy hands: beat
  the guards, then stay in the circle for 12 seconds. A captured outpost is
  safe like the camp (healing, gear, army, look), opens its chest (3 items), is
  your respawn point after dying, and you can travel between all captured
  outposts.
- One gate per zone leads into an arena with a boss (own attack patterns,
  telegraphed with red circles). Gates are for loot and strong shadows: 4
  items (at least epic, often legendary) plus essence, elite helpers, and
  souls inside a gate are easier to raise (+20 %). Gates can be repeated.

## Shadow army

- Raise defeated enemies with Arise. Enemies below your level always rise;
  above it the chance falls fast (one rank above you: about 7 %). Elites,
  champions and bosses are a bit harder. Every soul allows 3 tries, each costs
  mana. The chance and every result show as a small note above the army.
- Summon the whole army or send it back into the shadows to fight alone.
  Summoned, it either attacks on its own or protects you.
- Army size comes from Intelligence (5 slots + 1 per 2 points, plus the
  Gravecaller set). On "Attack" the army hunts enemies 14 units around you,
  +0.25 per Perception point (up to 26). Shadows grow with their own levels and evolve.
- The army can be managed anywhere. When it is full and you press Arise, the
  army list opens so you can dismiss a weaker shadow and raise the strong one
  (the game is paused meanwhile, so the soul does not fade).

## Items and stats

- Rarity counts much more than the item level: Common x1, Rare x2, Epic x4,
  Legendary x8; the level adds only 3 % per level.

| Stat | Effect |
|---|---|
| Strength | x1.04 damage per point (multiplies) |
| Agility | speed, faster reload, shorter dodge cooldown |
| Vitality | x1.04 health per point (multiplies), health regeneration |
| Intelligence | +1 army slot per 2 points, mana, a little arise chance |
| Perception | crit chance, crit damage, loot |

## Saving

- 3 save slots, stored in the browser (IndexedDB, localStorage as fallback).
  Clearing the browser data of the site deletes the saves.
- Autosave every 60 seconds, when entering the camp, when the pause menu
  opens, when the app is closed or sent to the background, and when going
  back to the main menu. "Save Now" is in the pause menu.
- Every world has its own random seed: chests and decoration differ.
- Deleting or overwriting a world always asks first.

## Where to change things

- `src/config.js` – all balancing values (health, damage, speeds, cooldowns,
  world size, graphics presets, autosave interval, colour palettes …)
- `src/strings.js` – all in-game text (add another language block here)

URL options: `?seed=123` starts a test world straight away (never saved),
`?debug` shows the frame rate and exposes the game as `window.__noctis`.

## Status

All six milestones are done:

1. World with camp and first zone, movement, aiming, one enemy type
2. Shadow army: Arise, behaviours, shadow levels and evolution, revive
3. Player levels and stat points, 5 weapons, armour with rarities and 3 sets,
   8 skills, 3 ultimates, chests and loot, inventory, upgrading, menu
4. Title screen, 3 save slots, New World with skin editor, Load Game,
   autosave, pause menu, settings, sound effects
5. Six big zones (x10 per rank), 18 enemy types, elites and champions, six
   gates with arena bosses and rank ups, 24 outposts to capture, minimap
6. PWA (offline, installable, fullscreen landscape, icons drawn in code),
   automatic graphics preset, performance check, hosting and install guide
