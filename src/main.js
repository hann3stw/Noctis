import '@fontsource/cinzel/latin-700.css';
import '@fontsource/cinzel/latin-900.css';
import '@fontsource/exo-2/latin-500.css';
import '@fontsource/exo-2/latin-700.css';
import '@fontsource/exo-2/latin-800.css';
import '@fontsource/lilita-one/latin-400.css';
import './styles/base.css';
import './styles/hud.css';
import './styles/army.css';
import './styles/menu.css';
import './styles/screens.css';
import './styles/world.css';
import './styles/premium.css';
import './styles/theme.css';
import './styles/theme2.css';
import './styles/theme3.css';
import './styles/theme4.css';
import { App } from './app.js';
import { t } from './strings.js';
import { blockZoom } from './core/nozoom.js';
import { initFeel } from './core/feel.js';
import { initUsage } from './core/usage.js';

blockZoom();
initFeel();
initUsage();

const params = new URLSearchParams(location.search);
const debug = import.meta.env.DEV || params.has('debug');

// "Please rotate your device" (shown by CSS on touch devices held upright)
const rotate = document.getElementById('rotate');
rotate.innerHTML = `<div class="phone"></div><b>${t('rotate.title')}</b><small>${t('rotate.body')}</small>`;

const app = new App(debug);
app.init(params);
if (debug) window.__app = app;

// the boot screen of index.html fades out once the title screen is there
const boot = document.getElementById('boot');
if (boot) {
  requestAnimationFrame(() => boot.classList.add('out'));
  setTimeout(() => boot.remove(), 600);
}
