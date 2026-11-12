// Shared input state. Touch and keyboard/mouse both write into this object,
// the game only reads from it.
export const input = {
  swap: false, // true = movement on the right, attack on the left

  // movement (-1..1), touch and keyboard are kept apart and combined on read
  touchX: 0,
  touchZ: 0,
  keyX: 0,
  keyZ: 0,

  // attack stick
  aiming: false,
  aimX: 0,
  aimZ: 1,

  // one-shot events, consumed by the game
  fire: false, // an attack was released
  fireAuto: false, // quick tap -> auto aim
  fireX: 0,
  fireZ: 1,
  dodge: false,

  // mouse (PC testing): the game converts screen position to an aim direction
  mouseDown: false,
  mouseReleased: false,
  mouseX: 0,
  mouseY: 0,
};

export function resetInput() {
  input.touchX = input.touchZ = input.keyX = input.keyZ = 0;
  input.aiming = input.fire = input.fireAuto = input.dodge = false;
  input.mouseDown = input.mouseReleased = false;
}
