// All in-game text. To add a language, add another block (e.g. `de`) with the
// same keys and call setLanguage('de').

const STRINGS = {
  en: {
    'app.name': 'Noctis',
    'rotate.title': 'Please rotate your device',
    'rotate.body': 'Noctis is played in landscape.',
    'hud.hp': 'HP',
    'hud.attack': 'Attack',
    'hud.dodge': 'Dodge',
    'hud.fps': '{fps} FPS',
    'hud.died': 'You have fallen',
    'hud.respawning': 'Returning to camp…',
    'zone.camp': 'Camp',
    'zone.camp.sub': 'Safe zone',
    'zone.meadow': 'Whispering Meadow',
    'zone.sub': 'Rank {rank} zone',
    'zone.void': 'The Void',
    'enemy.gloomfang': 'Gloomfang',
  },
};

let lang = 'en';

export function setLanguage(code) {
  if (STRINGS[code]) lang = code;
}

export function t(key, vars) {
  let s = STRINGS[lang][key];
  if (s === undefined) s = STRINGS.en[key];
  if (s === undefined) return key;
  if (vars) {
    for (const k in vars) s = s.replace('{' + k + '}', vars[k]);
  }
  return s;
}
