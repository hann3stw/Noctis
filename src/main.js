import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cinzel/latin-900.css';
import '@fontsource/exo-2/latin-500.css';
import '@fontsource/exo-2/latin-700.css';
import '@fontsource/exo-2/latin-800.css';
import './styles/base.css';
import './styles/hud.css';
import './styles/army.css';
import './styles/menu.css';
import './styles/screens.css';
import './styles/world.css';
import './styles/premium.css';
import { App } from './app.js';
import { t } from './strings.js';
import { blockZoom } from './core/nozoom.js';

blockZoom();

const params = new URLSearchParams(location.search);
const debug = import.meta.env.DEV || params.has('debug');

// "Please rotate your device" (shown by CSS on touch devices held upright)
const rotate = document.getElementById('rotate');
rotate.innerHTML = `<div class="phone"></div><b>${t('rotate.title')}</b><small>${t('rotate.body')}</small>`;

const app = new App(debug);
app.init(params);
if (debug) window.__app = app;
