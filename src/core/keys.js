// The keys of the PC controls. Every action has a default key; the player can change them in Settings.
// Movement (WASD / arrows) and Escape stay fixed. A key is a KeyboardEvent.code ('KeyQ', 'Space', 'Digit1').
import { settings, setSetting } from './settings.js';

// action, default key; the order is the order in Settings
export const ACTIONS = [
  ['cast1', 'KeyQ'], ['cast2', 'KeyR'], ['cast3', 'KeyF'], ['cast4', 'KeyV'],
  ['dodge', 'Space'], ['arise', 'KeyE'], ['gate', 'KeyG'], ['map', 'KeyM'],
  ['summon', 'Digit1'], ['behavior', 'Digit2'], ['revive', 'Digit3'],
];
const DEF = Object.fromEntries(ACTIONS);
const FIXED = new Set(['Escape', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'F5', 'F11', 'F12']);

export const keyState = { capturing: false }; // true while Settings waits for a new key

export function keyOf(action) {
  const k = settings.keys && settings.keys[action];
  return typeof k === 'string' && k ? k : DEF[action];
}

export function actionOf(code) {
  for (const [a] of ACTIONS) if (keyOf(a) === code) return a;
  return '';
}

// 'KeyQ' -> 'Q', 'Digit1' -> '1', 'Space' -> 'Space' ...
export function keyLabel(code) {
  if (!code) return '';
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return 'Num' + code.slice(6);
  const M = { Space: 'Space', ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt', Enter: 'Enter', Backspace: 'Back', Minus: '-', Equal: '=', Comma: ',', Period: '.', Slash: '/', Semicolon: ';', Quote: "'", BracketLeft: '[', BracketRight: ']', Backslash: '\\', Backquote: '`' };
  return M[code] || code;
}

export function canBind(code) {
  return !!code && !FIXED.has(code);
}

// Gives an action a key. When another action had it, the two swap keys. Returns false for a key that cannot be used.
export function setKey(action, code) {
  if (!DEF[action] || !canBind(code)) return false;
  const keys = {};
  for (const [a] of ACTIONS) keys[a] = keyOf(a);
  const other = ACTIONS.map((e) => e[0]).find((a) => a !== action && keys[a] === code);
  if (other) keys[other] = keys[action];
  keys[action] = code;
  setSetting('keys', keys);
  return true;
}

export function resetKeys() {
  setSetting('keys', {});
}
