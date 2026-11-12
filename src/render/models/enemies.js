// Enemy models. All face +Z and stand on y = 0. One merged geometry per type,
// drawn with a single InstancedMesh.
import { box, cone, merge } from '../geo.js';

function gloomfang() {
  const fur = 0x4a4560, dark = 0x2e2a40, eye = 0xff3b4a, claw = 0xd8d2c0;
  return merge([
    box(0.75, 0.62, 1.35, fur, 0, 0.72, 0),
    box(0.6, 0.3, 0.9, dark, 0, 1.08, -0.1), // back ridge
    box(0.52, 0.48, 0.55, fur, 0, 0.92, 0.9), // head
    box(0.3, 0.24, 0.4, dark, 0, 0.8, 1.28), // snout
    cone(0.1, 0.3, 3, dark, 0.18, 1.3, 0.85),
    cone(0.1, 0.3, 3, dark, -0.18, 1.3, 0.85),
    box(0.1, 0.08, 0.05, eye, 0.15, 1.0, 1.18),
    box(0.1, 0.08, 0.05, eye, -0.15, 1.0, 1.18),
    box(0.2, 0.5, 0.22, dark, 0.26, 0.25, 0.48),
    box(0.2, 0.5, 0.22, dark, -0.26, 0.25, 0.48),
    box(0.2, 0.5, 0.22, dark, 0.26, 0.25, -0.48),
    box(0.2, 0.5, 0.22, dark, -0.26, 0.25, -0.48),
    box(0.22, 0.06, 0.12, claw, 0.26, 0.03, 0.6),
    box(0.22, 0.06, 0.12, claw, -0.26, 0.03, 0.6),
    box(0.14, 0.14, 0.6, dark, 0, 0.9, -0.9, 0.6, 0, 0), // tail
  ]);
}

const BUILDERS = { gloomfang };

export function buildEnemyGeometry(typeId) {
  return BUILDERS[typeId]();
}
