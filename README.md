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

## Where to change things

- `src/config.js` – all balancing values (health, damage, speeds, cooldowns, world size …)
- `src/strings.js` – all in-game text (add another language block here)

URL options: `?fps` shows the frame rate, `?seed=123` loads a fixed world.

## Status

Milestone 1 of 6: world with camp and first zone, movement, aiming, sword,
one enemy type. Hosting and install instructions follow with milestone 6.
