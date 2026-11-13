// In-game HUD (HTML overlay). Values are only written to the DOM when they
// change, so the HUD costs almost nothing per frame.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { input } from '../input/input.js';
import { BEHAVIORS } from '../entities/army.js';
import { skillDef } from '../combat/skills.js';

const ICON_SWORD =
  '<svg viewBox="0 0 48 48"><path d="M36 6l6 0 0 6-20 20-6-6z" fill="currentColor"/><path d="M12 26l10 10-4 4-4-4-6 6-4-4 6-6-4-4z" fill="currentColor" opacity=".8"/></svg>';
const ICON_ARISE =
  '<svg viewBox="0 0 48 48"><path d="M24 4c7 6 11 12 11 19 0 5-2 9-5 12l-2 9h-8l-2-9c-3-3-5-7-5-12 0-7 4-13 11-19z" fill="currentColor" opacity=".9"/><circle cx="19" cy="24" r="3" fill="#1a1030"/><circle cx="29" cy="24" r="3" fill="#1a1030"/></svg>';
const ICON_DASH =
  '<svg viewBox="0 0 48 48"><path d="M20 10l18 14-18 14 5-14z" fill="currentColor"/><path d="M8 16h10M4 24h12M8 32h10" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".7"/></svg>';

const skillBtn = (id, cls) => `<div id="${id}" class="btn round skill ${cls}"><div class="knob"><b></b></div><div class="cd"></div><small></small></div>`;

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
          <div class="bar mp"><i></i><span></span></div>
          <div class="xp"><b></b><div class="bar"><i></i></div></div>
        </div>
        <div class="zone"><b></b><small></small></div>
        <div class="fps"></div>
        <div class="toast"></div>
        <div class="top-right">
          <div class="saving">${t('hud.saving')}</div>
          <div id="btn-menu" class="btn pill">${t('hud.menu')}<i></i></div>
          <div id="btn-pause" class="btn pill" aria-label="${t('hud.pause')}"><svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg></div>
        </div>
        <div class="squads">${[0, 1, 2].map((k) => `<div class="squad" data-k="${k}"><div class="sq-revive btn"></div><div class="sq-chip btn"><b>${t('squad.' + k)}</b><span></span><small></small></div></div>`).join('')}</div>
        <div id="joy"><div class="knob"></div></div>
        <div class="actions">
          <div id="btn-arise" class="btn round" aria-label="${t('hud.arise')}">${ICON_ARISE}<small></small></div>
          <div id="btn-dodge" class="btn round" aria-label="${t('hud.dodge')}">${ICON_DASH}<div class="cd"></div></div>
          ${skillBtn('btn-skill0', '')}
          ${skillBtn('btn-skill1', '')}
          ${skillBtn('btn-ult', 'ult')}
          <div id="btn-attack" class="btn round" aria-label="${t('hud.attack')}">
            <div class="knob">${ICON_SWORD}</div>
            <div class="ammo"><i></i><i></i><i></i></div>
          </div>
        </div>
        <div class="death"><b>${t('hud.died')}</b><small>${t('hud.respawning')}</small></div>
      </div>
    `;
    const $ = (s) => root.querySelector(s);
    this.skillEls = ['#btn-skill0', '#btn-skill1', '#btn-ult'].map((sel) => {
      const btn = $(sel);
      return {
        btn, knob: btn.querySelector('.knob'), label: btn.querySelector('b'),
        cd: btn.querySelector('.cd'), cost: btn.querySelector('small'),
        vP: -1, vLow: null,
      };
    });
    this.els = {
      layer: $('#touch-layer'),
      fx: $('#fx-layer'),
      joyBase: $('#joy'),
      joyKnob: $('#joy .knob'),
      btnAttack: $('#btn-attack'),
      btnDodge: $('#btn-dodge'),
      sticks: [
        { btn: $('#btn-attack'), knob: $('#btn-attack .knob') },
        ...this.skillEls.map((s) => ({ btn: s.btn, knob: s.knob })),
      ],
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
    this.savingEl = $('.saving');
    this.savingT = 0;
    this.mpFill = $('.bar.mp i');
    this.mpText = $('.bar.mp span');
    this.xpFill = $('.xp .bar i');
    this.xpLabel = $('.xp b');
    this.menuBadge = $('#btn-menu i');
    this.toastEl = $('.toast');
    this.toastT = 0;
    this.btnArise = $('#btn-arise');
    this.ariseCost = $('#btn-arise small');
    this.squads = [];
    root.querySelectorAll('.squad').forEach((el, k) => {
      const chip = el.querySelector('.sq-chip'), revive = el.querySelector('.sq-revive');
      this.squads.push({
        el, chip, revive,
        count: chip.querySelector('span'), beh: chip.querySelector('small'),
        vCount: -1, vBeh: -1, vRev: -2, vCan: null,
      });
      chip.addEventListener('pointerdown', (e) => { e.stopPropagation(); input.squadCycle = k; });
      revive.addEventListener('pointerdown', (e) => { e.stopPropagation(); input.reviveSquad = k; });
    });
    this.btnArise.addEventListener('pointerdown', (e) => { e.stopPropagation(); input.arise = true; });
    $('#btn-menu').addEventListener('pointerdown', (e) => { e.stopPropagation(); game.menu.open(); });
    $('#btn-pause').addEventListener('pointerdown', (e) => { e.stopPropagation(); game.app.openPause(); });
    this.hud.classList.toggle('swap', input.swap);

    // cached values
    this.vHp = -1;
    this.vMaxHp = -1;
    this.vShield = null;
    this.vZone = null;
    this.vDodge = -1;
    this.vAmmo = [-1, -1, -1];
    this.vDead = null;
    this.vVig = -1;
    this.vNoAmmo = false;
    this.vMp = -1;
    this.vMaxMp = -1;
    this.vXp = -1;
    this.vLevel = -1;
    this.vPoints = -1;
    this.vArise = -2;
    this.vAriseCant = null;
    this.vEclipse = null;
    this.fpsT = 0;
    this.fpsN = 0;
    this.showFps = false;
  }

  setFps(on) {
    this.showFps = !!on;
    this.fpsEl.style.display = on ? '' : 'none';
  }

  // small "Saving…" label in the corner
  showSaving() {
    this.savingEl.classList.add('on');
    this.savingT = 1.4;
  }

  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('on');
    this.toastT = 2.2;
  }

  // labels and costs of the skill buttons; call after the slots changed
  syncSkills() {
    const P = this.game.player;
    for (let k = 0; k < 3; k++) {
      const s = this.skillEls[k], id = P.slots[k];
      s.btn.classList.toggle('none', !id);
      s.label.textContent = id ? t('skill.' + id) : '';
      s.cost.textContent = id && k < 2 ? skillDef(id).mana : '';
      s.vP = -1;
      s.vLow = null;
    }
  }

  // short shake when a skill cannot be cast
  deny(slot) {
    const s = this.skillEls[slot];
    s.btn.classList.remove('deny');
    void s.btn.offsetWidth;
    s.btn.classList.add('deny');
  }

  updateSkills() {
    const P = this.game.player;
    const max = CONFIG.progression.ultCharge.max;
    for (let k = 0; k < 3; k++) {
      const s = this.skillEls[k], id = P.slots[k];
      if (!id) continue;
      let p, low;
      if (k === 2) {
        p = Math.floor((1 - P.ult / max) * 50); // 0 = fully charged
        low = false;
      } else {
        const def = skillDef(id);
        p = Math.ceil((Math.max(0, P.cds[k]) / def.cooldown) * 50);
        low = P.mana < def.mana;
      }
      if (p !== s.vP) {
        s.vP = p;
        s.cd.style.setProperty('--p', p * 2 + '%');
        s.btn.classList.toggle('cooling', p > 0);
        s.btn.classList.toggle('ready', p === 0);
      }
      if (low !== s.vLow) {
        s.vLow = low;
        s.btn.classList.toggle('low', low);
      }
    }
  }

  updateArmy(dt) {
    const game = this.game, P = game.player, army = game.army;

    // mana
    const mp = Math.floor(P.mana);
    if (mp !== this.vMp || P.maxMana !== this.vMaxMp) {
      this.vMp = mp;
      this.vMaxMp = P.maxMana;
      this.mpFill.style.transform = 'scaleX(' + (P.mana / P.maxMana).toFixed(3) + ')';
      this.mpText.textContent = mp + ' / ' + P.maxMana;
    }

    // Arise button: only while a soul is in reach
    const cost = game.soulNear >= 0 ? game.ariseCost : -1;
    if (cost !== this.vArise) {
      this.vArise = cost;
      this.btnArise.classList.toggle('on', cost >= 0);
      if (cost >= 0) this.ariseCost.textContent = cost;
    }
    const cant = cost >= 0 && P.mana < cost;
    if (cant !== this.vAriseCant) {
      this.vAriseCant = cant;
      this.btnArise.classList.toggle('cant', cant);
    }

    // squads
    for (let k = 0; k < 3; k++) {
      const sq = army.squads[k], h = this.squads[k];
      const count = sq.total * 100 + sq.alive;
      if (count !== h.vCount) {
        h.vCount = count;
        h.count.textContent = sq.alive + '/' + sq.total;
        h.el.classList.toggle('empty', sq.total === 0);
        h.el.classList.toggle('hurt', sq.alive < sq.total);
      }
      if (sq.behavior !== h.vBeh) {
        h.vBeh = sq.behavior;
        h.beh.textContent = t('behavior.' + BEHAVIORS[sq.behavior]);
        h.chip.dataset.b = BEHAVIORS[sq.behavior];
      }
      // revive button: cost when shadows are ready, countdown while they are not
      const rev = sq.ready > 0 ? sq.ready * 10000 + sq.readyCost : sq.total > sq.alive ? -Math.ceil(sq.nextReady) - 10 : -1;
      if (rev !== h.vRev) {
        h.vRev = rev;
        h.revive.classList.toggle('on', rev !== -1);
        h.revive.classList.toggle('wait', rev < -1);
        if (sq.ready > 0) h.revive.textContent = t('hud.revive', { n: sq.ready }) + ' · ' + sq.readyCost;
        else if (rev < -1) h.revive.textContent = Math.ceil(sq.nextReady) + 's';
      }
      const can = sq.ready > 0 && P.mana >= sq.readyCost;
      if (can !== h.vCan) {
        h.vCan = can;
        h.revive.classList.toggle('can', can);
      }
    }

    if (this.toastT > 0) {
      this.toastT -= dt;
      if (this.toastT <= 0) this.toastEl.classList.remove('on');
    }
    if (this.savingT > 0) {
      this.savingT -= dt;
      if (this.savingT <= 0) this.savingEl.classList.remove('on');
    }
  }

  update(dt) {
    const game = this.game, P = game.player;
    this.updateArmy(dt);
    this.updateSkills();

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
    const shield = P.shield > 0;
    if (shield !== this.vShield) {
      this.vShield = shield;
      this.hud.classList.toggle('shield', shield);
      this.overhead.classList.toggle('shield', shield);
    }
    const eclipse = P.eclipseT > 0;
    if (eclipse !== this.vEclipse) {
      this.vEclipse = eclipse;
      this.els.btnAttack.classList.toggle('eclipse', eclipse);
    }

    // level and experience
    const xp = Math.floor((P.xp / P.xpNeed()) * 100);
    if (xp !== this.vXp) {
      this.vXp = xp;
      this.xpFill.style.transform = 'scaleX(' + xp / 100 + ')';
    }
    if (P.level !== this.vLevel) {
      this.vLevel = P.level;
      this.xpLabel.textContent = t('hud.level', { level: P.level });
    }
    if (P.points !== this.vPoints) {
      this.vPoints = P.points;
      this.menuBadge.textContent = P.points > 0 ? P.points : '';
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
