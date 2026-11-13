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

Production build: `npm run build`, then `npm run preview`.

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
| Menu | Menu button (top right): Gear, Stats, Skills, Army, Look. Equipment, skills, the army and your look can only be changed in the camp | click it |
| Pause | Pause button (top right corner) | Esc |
| Enter a gate | Enter button (appears next to a gate) | G |
| Minimap | Tap it: close view <-> whole world | M |

## World

- Six big ring shaped zones around the camp: Whispering Meadow (E), Gloomwood
  (D), Rotmire Swamp (C), Sunken Ruins (B), Frostfang Peaks (A), Ashen Caldera
  (S). Every rank multiplies enemy health, damage and XP by 10: enemies two
  ranks above you kill you with one hit, but they also give 10x the XP.
- The hunter grows x1.334 per level (health and damage), which is x10 over the
  8 levels of a zone. Near the end of a rank you are far too strong for it.
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
  telegraphed with red circles). The first win per gate raises the rank
  (E -> S) and gives many stat points (10, 12, 15, 18, 20). Gates can be
  repeated for loot (3 items, at least epic, plus essence).

## Shadow army

- Raise defeated enemies with Arise. Enemies below your level always rise;
  above it the chance falls fast with every level (one rank above you: about
  7 %). Elites, champions and bosses are a bit harder. Every soul allows 3
  tries, each costs mana.
- Summon the whole army or send it back into the shadows to fight alone.
  Summoned, it either attacks on its own or protects you.
- Army size comes from Intelligence (5 slots + 1 per 2 points, plus the
  Gravecaller set). Shadows grow with their own levels and evolve.

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

Milestone 5 of 6. Done so far:

1. World with camp and first zone, movement, aiming, one enemy type
2. Shadow army: Arise, squads A/B/C (Attack / Guard / Hold), shadow levels and
   evolution, revive, army management
3. Player levels and stat points, 5 weapons, armour with rarities and 3 sets,
   8 skills, 3 ultimates, chests and loot, inventory with comparison, upgrading
   and dismantling, menu
4. Title screen, 3 save slots, New World with skin editor (6 hairstyles,
   colour palettes, aura colour tints the army), Load Game, autosave, pause
   menu, settings (graphics, volume, button size, swap sides), sound effects
5. Six big zones (x10 per rank), 18 enemy types, elites and champions, six
   gates with arena bosses and rank ups, 24 outposts to capture (respawn,
   fast travel, chest), arise chance by level difference, one army to
   summon or recall, army size from Intelligence, minimap

Still to come: PWA setup,
automatic graphics preset and performance check (6). Hosting and install
instructions follow with milestone 6.
