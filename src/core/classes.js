// Main classes (CONFIG.classes): which skills a class can use. A skill or ultimate
// with a `for` list (in CONFIG.skills / CONFIG.ultimates) belongs to those classes
// only; one without it is for everybody (also for a hunter without a class yet).
import { CONFIG } from '../config.js';

export function skillOk(id, cls) {
  const def = CONFIG.skills[id] || CONFIG.ultimates[id];
  return !!def && (!def.for || def.for.includes(cls));
}
