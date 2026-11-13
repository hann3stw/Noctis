// Shared input state. Touch and keyboard/mouse both write into this object,
// the game only reads from it.

// One aim stick: 0 = basic attack, 1 and 2 = skills, 3 = ultimate.
function stick() {
  return {
    aiming: false, // currently dragged far enough to aim
    x: 0, z: 1, // aim direction
    power: 0, // 0..1, how far the stick is dragged (distance for area skills)
    fire: false, // one-shot: the stick was released
    auto: false, // quick tap -> auto aim
    fx: 0, fz: 1, fp: 1, // direction and power at release
  };
}

export const input = {
  swap: false, // true = movement on the right, attack on the left

  // movement (-1..1), touch and keyboard are kept apart and combined on read
  touchX: 0,
  touchZ: 0,
  keyX: 0,
  keyZ: 0,

  sticks: [stick(), stick(), stick(), stick()],

  // one-shot events, consumed by the game
  dodge: false,
  arise: false,
  enterGate: false,
  squadCycle: -1, // squad whose behaviour should switch to the next one
  reviveSquad: -1, // squad whose fallen shadows should be revived
  keyCast: -1, // stick 1-3 triggered by the keyboard, aimed with the mouse

  // mouse (PC testing): the game converts screen position to an aim direction
  mouseDown: false,
  mouseReleased: false,
  mouseX: 0,
  mouseY: 0,
};

// clears one-shot events (used while the game is paused)
export function clearEvents() {
  for (const s of input.sticks) s.fire = false;
  input.dodge = input.arise = input.enterGate = input.mouseReleased = false;
  input.squadCycle = input.reviveSquad = input.keyCast = -1;
}

export function resetInput() {
  input.touchX = input.touchZ = input.keyX = input.keyZ = 0;
  for (const s of input.sticks) s.aiming = false;
  input.mouseDown = false;
  clearEvents();
}
