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
| Menu | Menu button (top right): Gear, Stats, Skills, Army. Equipment, skills and the army can only be changed in the camp | click it |

## Where to change things

- `src/config.js` – all balancing values (health, damage, speeds, cooldowns, world size …)
- `src/strings.js` – all in-game text (add another language block here)

URL options: `?fps` shows the frame rate, `?seed=123` loads a fixed world.

## Status

Milestone 3 of 6. Done so far:

1. World with camp and first zone, movement, aiming, one enemy type
2. Shadow army: Arise, squads A/B/C (Attack / Guard / Hold), shadow levels and
   evolution, revive, army management
3. Player levels and stat points, 5 weapons, armour with rarities and 3 sets,
   8 skills, 3 ultimates, chests and loot, inventory with comparison, upgrading
   and dismantling, menu

Still to come: main menu and save slots (4), all zones, elites, gates and
bosses, minimap (5), PWA setup and graphics presets (6). Hosting and install
instructions follow with milestone 6.
