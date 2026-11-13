import './styles/base.css';
import './styles/hud.css';
import './styles/army.css';
import './styles/menu.css';
import { Game } from './game.js';
import { randomSeed } from './core/rng.js';

const params = new URLSearchParams(location.search);
const debug = import.meta.env.DEV || params.has('debug');

const game = new Game(document.getElementById('game'), document.getElementById('ui'), {
  seed: params.has('seed') ? Number(params.get('seed')) >>> 0 : randomSeed(),
  showFps: debug || params.has('fps'),
});
game.start();

if (debug) window.__noctis = game;
