// In-game HUD (HTML overlay). Values are only written to the DOM when they
// change, so the HUD costs almost nothing per frame.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';

const ICON_SWORD =
  '<svg viewBox="0 0 48 48"><path d="M36 6l6 0 0 6-20 20-6-6z" fill="currentColor"/><path d="M12 26l10 10-4 4-4-4-6 6-4-4 6-6-4-4z" fill="currentColor" opacity=".8"/></svg>';
const ICON_DASH =
  '<svg viewBox="0 0 48 48"><path d="M20 10l18 14-18 14 5-14z" fill="currentColor"/><path d="M8 16h10M4 24h12M8 32h10" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".7"/></svg>';

export class Hud {
  constructor(root, game) {
    this.game = game;
    root.innerHTML = `
      <div id="touch-layer"></div>
      <div id="fx-layer"></div>
      <div id="vignette"></div>
      <div id="overhead"><div class="oh-hp"><i></i></div><div class="oh-ammo"><i></i><i></i><i></i></div></div>
      <div id="hud">
        <div class="panel-player">
          <div class="bar hp"><i></i><span></span></div>
        </div>
        <div class="zone"><b></b><small></small></div>
        <div class="fps"></div>
        <div id="joy"><div class="knob"></div></div>
        <div class="actions">
          <div id="btn-dodge" class="btn round" aria-label="${t('hud.dodge')}">${ICON_DASH}<div class="cd"></div></div>
          <div id="btn-attack" class="btn round" aria-label="${t('hud.attack')}">
            <div class="knob">${ICON_SWORD}</div>
            <div class="ammo"><i></i><i></i><i></i></div>
          </div>
        </div>
        <div class="death"><b>${t('hud.died')}</b><small>${t('hud.respawning')}</small></div>
      </div>
      <div id="rotate"><div class="phone"></div><b>${t('rotate.title')}</b><small>${t('rotate.body')}</small></div>
    `;
    const $ = (s) => root.querySelector(s);
    this.els = {
      layer: $('#touch-layer'),
      fx: $('#fx-layer'),
      joyBase: $('#joy'),
      joyKnob: $('#joy .knob'),
      btnAttack: $('#btn-attack'),
      attackKnob: $('#btn-attack .knob'),
      btnDodge: $('#btn-dodge'),
    };
    this.hud = $('#hud');
    this.hpFill = $('.bar.hp i');
    this.hpText = $('.bar.hp span');
    this.zoneName = $('.zone b');
    this.zoneSub = $('.zone small');
    this.fpsEl = $('.fps');
    this.dodgeCd = $('#btn-dodge .cd');
    this.ammo = root.querySelectorAll('#btn-attack .ammo i');
    this.ohAmmo = root.querySelectorAll('#overhead .oh-ammo i');
    this.overhead = $('#overhead');
    this.ohHp = $('#overhead .oh-hp i');
    this.vignette = $('#vignette');
    this.death = $('.death');
    this.rotate = $('#rotate');

    // cached values
    this.vHp = -1;
    this.vMaxHp = -1;
    this.vZone = null;
    this.vDodge = -1;
    this.vAmmo = [-1, -1, -1];
    this.vDead = null;
    this.vVig = -1;
    this.vNoAmmo = false;
    this.fpsT = 0;
    this.fpsN = 0;
    this.showFps = false;
  }

  setSwap(swap) {
    this.hud.classList.toggle('swap', swap);
  }

  update(dt) {
    const game = this.game, P = game.player;

    // health
    const hp = Math.ceil(P.hp);
    if (hp !== this.vHp || P.maxHp !== this.vMaxHp) {
      this.vHp = hp;
      this.vMaxHp = P.maxHp;
      const f = Math.max(0, P.hp / P.maxHp);
      this.hpFill.style.transform = 'scaleX(' + f.toFixed(3) + ')';
      this.ohHp.style.transform = 'scaleX(' + f.toFixed(3) + ')';
      this.hpText.textContent = hp + ' / ' + P.maxHp;
    }

    // attack charges (each pip fills while it reloads)
    for (let i = 0; i < 3; i++) {
      let v = i < P.charges ? 100 : i === P.charges ? Math.floor(P.reloadT * 20) * 5 : 0;
      if (i >= P.maxCharges) v = 0;
      if (v !== this.vAmmo[i]) {
        this.vAmmo[i] = v;
        const s = 'scaleX(' + v / 100 + ')';
        this.ammo[i].style.transform = s;
        this.ohAmmo[i].style.transform = s;
        this.ammo[i].classList.toggle('full', v === 100);
        this.ohAmmo[i].classList.toggle('full', v === 100);
      }
    }
    const noAmmo = P.noAmmoFlash > 0;
    if (noAmmo !== this.vNoAmmo) {
      this.vNoAmmo = noAmmo;
      this.els.btnAttack.classList.toggle('empty', noAmmo);
    }

    // dodge cooldown
    const dc = Math.max(0, Math.ceil((P.dodgeCd / CONFIG.player.dodge.cooldown) * 40));
    if (dc !== this.vDodge) {
      this.vDodge = dc;
      this.dodgeCd.style.setProperty('--p', (dc / 40) * 100 + '%');
      this.els.btnDodge.classList.toggle('cooling', dc > 0);
    }

    // zone label
    const zone = P.inCamp ? 'camp' : game.zoneId;
    if (zone !== this.vZone) {
      this.vZone = zone;
      if (zone === 'camp') {
        this.zoneName.textContent = t('zone.camp');
        this.zoneSub.textContent = t('zone.camp.sub');
      } else {
        this.zoneName.textContent = t('zone.' + zone);
        this.zoneSub.textContent = game.zoneRank ? t('zone.sub', { rank: game.zoneRank }) : '';
      }
      this.hud.classList.toggle('safe', zone === 'camp');
    }

    // hurt vignette and death overlay
    const vig = P.dead ? 10 : Math.max(0, Math.round(P.hurtFlash * 10));
    if (vig !== this.vVig) {
      this.vVig = vig;
      this.vignette.style.opacity = (vig / 10) * 0.7;
    }
    if (P.dead !== this.vDead) {
      this.vDead = P.dead;
      this.death.classList.toggle('on', P.dead);
      this.overhead.style.visibility = P.dead ? 'hidden' : '';
    }

    // small bar above the player
    const v = game.effects.project(P.x, 3.0, P.z);
    this.overhead.style.transform = 'translate3d(' + v.x.toFixed(1) + 'px,' + v.y.toFixed(1) + 'px,0) translate(-50%,-100%)';

    if (this.showFps) {
      this.fpsT += dt;
      this.fpsN++;
      if (this.fpsT >= 0.5) {
        this.fpsEl.textContent = t('hud.fps', { fps: Math.round(this.fpsN / this.fpsT) });
        this.fpsT = 0;
        this.fpsN = 0;
      }
    }
  }
}
