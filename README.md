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
| Squad behaviour | Tap squad chip A / B / C: Attack -> Guard -> Hold | 1 / 2 / 3 |
| Revive squad | Green button above the squad chip | Shift + 1 / 2 / 3 |
| Skills | Drag a skill button to aim, release to cast. Quick tap = auto-aim | Q / R (towards the mouse) |
| Ultimate | Ultimate button (charges by landing hits) | F |
| Menu | Menu button (top right): Gear, Stats, Skills, Army, Look. Equipment, skills, the army and your look can only be changed in the camp | click it |
| Pause | Pause button (top right corner) | Esc |

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

Milestone 4 of 6. Done so far:

1. World with camp and first zone, movement, aiming, one enemy type
2. Shadow army: Arise, squads A/B/C (Attack / Guard / Hold), shadow levels and
   evolution, revive, army management
3. Player levels and stat points, 5 weapons, armour with rarities and 3 sets,
   8 skills, 3 ultimates, chests and loot, inventory with comparison, upgrading
   and dismantling, menu
4. Title screen, 3 save slots, New World with skin editor (6 hairstyles,
   colour palettes, aura colour tints the army), Load Game, autosave, pause
   menu, settings (graphics, volume, button size, swap sides), sound effects

Still to come: all zones, elites, gates and bosses, minimap (5), PWA setup,
automatic graphics preset and performance check (6). Hosting and install
instructions follow with milestone 6.
