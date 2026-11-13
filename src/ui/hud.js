// In-game HUD (HTML overlay). Values are only written to the DOM when they
// change, so the HUD costs almost nothing per frame.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { input } from '../input/input.js';
import { BEHAVIORS } from '../entities/army.js';
import { skillDef } from '../combat/skills.js';
import { RANKS } from '../world/gates.js';
import { fmt } from '../core/format.js';
import { SKILL_ICONS, UI_ICONS } from './icons.js';

const ICON_SWORD =
  '<svg viewBox="0 0 48 48"><path d="M36 6l6 0 0 6-20 20-6-6z" fill="currentColor"/><path d="M12 26l10 10-4 4-4-4-6 6-4-4 6-6-4-4z" fill="currentColor" opacity=".8"/></svg>';
const ICON_ARISE =
  '<svg viewBox="0 0 48 48"><path d="M24 4c7 6 11 12 11 19 0 5-2 9-5 12l-2 9h-8l-2-9c-3-3-5-7-5-12 0-7 4-13 11-19z" fill="currentColor" opacity=".9"/><circle cx="19" cy="24" r="3" fill="#1a1030"/><circle cx="29" cy="24" r="3" fill="#1a1030"/></svg>';
const ICON_DASH =
  '<svg viewBox="0 0 48 48"><path d="M20 10l18 14-18 14 5-14z" fill="currentColor"/><path d="M8 16h10M4 24h12M8 32h10" stroke="currentColor" stroke-width="4" stroke-linecap="round" opacity=".7"/></svg>';

const skillBtn = (id, cls) => `<div id="${id}" class="btn round skill ${cls}"><div class="knob"><b></b></div><div class="cd"></div><small></small></div>`;

// A tap: pressed and released on the same button.
function onTap(el, fn) {
  let id = -1;
  el.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    id = e.pointerId;
    el.classList.add('pressed');
  });
  el.addEventListener('pointerup', (e) => {
    e.stopPropagation();
    el.classList.remove('pressed');
    if (e.pointerId !== id) return;
    id = -1;
    const r = el.getBoundingClientRect();
    if (e.clientX >= r.left - 8 && e.clientX <= r.right + 8 && e.clientY >= r.top - 8 && e.clientY <= r.bottom + 8) fn();
  });
  el.addEventListener('pointercancel', () => { id = -1; el.classList.remove('pressed'); });
}

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
          <div class="lvl-badge"><b></b><small></small></div>
          <div class="pp-bars">
            <div class="bar hp"><em></em><i></i><span></span></div>
            <div class="bar mp"><i></i><span></span></div>
            <div class="xp"><div class="bar"><i></i></div></div>
          </div>
        </div>
        <div class="zone"><b></b><small></small></div>
        <div class="zone-card"><small></small><b></b><i></i></div>
        <div class="boss-bar"><b></b><div class="bar"><i></i><span></span></div></div>
        <div class="capture"><b></b><div class="bar"><i></i></div></div>
        <canvas class="minimap"></canvas>
        <div class="gate-panel"><div class="gp-text"><b></b><small></small></div><div id="btn-gate" class="btn pill">${t('gate.enter')}</div></div>
        <div class="banner"><b></b><small></small></div>
        <div class="fps"></div>
        <div class="toast"></div>
        <div class="top-right">
          <div class="saving">${t('hud.saving')}</div>
          <div id="btn-travel" class="btn pill">${UI_ICONS.travel}<span>${t('hud.travel')}</span></div>
          <div id="btn-menu" class="btn pill">${UI_ICONS.menu}<span>${t('hud.menu')}</span><i></i></div>
          <div id="btn-pause" class="btn pill" aria-label="${t('hud.pause')}"><svg viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z" fill="currentColor"/></svg></div>
        </div>
        <div class="squads">
          <div class="sq-note"></div>
          <div class="squad"><div class="sq-revive btn"></div>
            <div class="sq-row"><div class="sq-summon btn"><span></span></div><div class="sq-chip btn"><b>${t('hud.army')}</b><span></span><small></small></div></div>
          </div>
        </div>
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
      minimap: $('.minimap'),
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
    this.bossBar = $('.boss-bar');
    this.bossName = $('.boss-bar b');
    this.bossFill = $('.boss-bar i');
    this.bossText = $('.boss-bar span');
    this.gatePanel = $('.gate-panel');
    this.gateTitle = $('.gate-panel b');
    this.gateInfo = $('.gate-panel small');
    this.bannerEl = $('.banner');
    this.captureEl = $('.capture');
    this.captureText = $('.capture b');
    this.captureFill = $('.capture i');
    this.vCap = -2;
    this.bannerT = 0;
    this.vGate = -2;
    this.vBoss = -2;
    this.vBossHp = -1;
    this.vRank = -1;
    onTap($('#btn-gate'), () => { input.enterGate = true; });
    this.savingEl = $('.saving');
    this.savingT = 0;
    this.mpFill = $('.bar.mp i');
    this.mpText = $('.bar.mp span');
    this.xpFill = $('.xp .bar i');
    this.xpLabel = $('.lvl-badge b');
    this.rankLabel = $('.lvl-badge small');
    this.hpTrail = $('.bar.hp em');
    this.zoneCard = $('.zone-card');
    this.zoneCardT = 0;
    this.lastZoneCard = '';
    this.menuBadge = $('#btn-menu i');
    this.toastEl = $('.toast');
    this.toastT = 0;
    this.btnArise = $('#btn-arise');
    this.ariseCost = $('#btn-arise small');
    this.noteEl = $('.sq-note');
    this.noteT = 0; // > 0: a notification is shown above the army
    this.vNote = null;
    {
      const el = $('.squad'), chip = el.querySelector('.sq-chip'), revive = el.querySelector('.sq-revive');
      const summon = el.querySelector('.sq-summon');
      this.armyUi = {
        el, chip, revive, summon,
        count: chip.querySelector('span'), beh: chip.querySelector('small'),
        vCount: -1, vBeh: -1, vRev: -2, vCan: null, vOut: null,
      };
      chip.addEventListener('pointerdown', (e) => { e.stopPropagation(); input.armyBehavior = true; });
      summon.addEventListener('pointerdown', (e) => { e.stopPropagation(); input.armySummon = true; });
      revive.addEventListener('pointerdown', (e) => { e.stopPropagation(); input.armyRevive = true; });
    }
    this.btnArise.addEventListener('pointerdown', (e) => { e.stopPropagation(); input.arise = true; });
    // these open screens: they react when the finger is lifted, otherwise the
    // same touch would also hit the button that appears under it (e.g. Close)
    onTap($('#btn-menu'), () => game.menu.open());
    onTap($('#btn-travel'), () => game.app.openTravel());
    onTap($('#btn-pause'), () => game.app.openPause());
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
    this.vPoints = null;
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

  // big centred message (rank up, gate cleared)
  banner(title, sub) {
    this.bannerEl.querySelector('b').textContent = title;
    this.bannerEl.querySelector('small').textContent = sub || '';
    this.bannerEl.classList.add('on');
    this.bannerT = 3.5;
  }

  updateGates(dt) {
    const game = this.game, gates = game.gates, E = game.enemies;
    // gate panel in the world
    const near = gates.active < 0 ? gates.near : -1;
    if (near !== this.vGate) {
      this.vGate = near;
      this.gatePanel.classList.toggle('on', near >= 0);
      if (near >= 0) {
        const gate = gates.list[near], zone = CONFIG.world.zones[gate.zone];
        const diff = CONFIG.gates.difficulties[gate.diff];
        this.gateTitle.textContent = t('gate.title', { diff: t('gate.diff.' + diff.id), rank: zone.rank });
        this.gateInfo.textContent = t('gate.info', { boss: t('enemy.' + zone.boss), level: gate.level });
        this.gatePanel.dataset.d = diff.id;
      }
    }
    // boss health
    const b = gates.bossIndex();
    const show = b >= 0 && E.alive[b] ? b : -1;
    if (show !== this.vBoss) {
      this.vBoss = show;
      this.bossBar.classList.toggle('on', show >= 0);
      this.hud.classList.toggle('arena', gates.active >= 0);
      if (show >= 0) this.bossName.textContent = t('enemy.' + E.types[E.type[show]].id);
      this.vBossHp = -1;
    }
    if (show >= 0) {
      const hp = Math.ceil(E.hp[show]);
      if (hp !== this.vBossHp) {
        this.vBossHp = hp;
        this.bossFill.style.transform = 'scaleX(' + Math.max(0, E.hp[show] / E.maxHp[show]).toFixed(3) + ')';
        this.bossText.textContent = fmt(Math.max(0, hp)) + ' / ' + fmt(E.maxHp[show]);
      }
    }
    // outpost capture
    const cap = game.capture;
    const cv = cap.si < 0 ? -1 : cap.guards > 0 ? -10 - cap.guards : Math.floor(cap.p * 100);
    if (cv !== this.vCap) {
      this.vCap = cv;
      this.captureEl.classList.toggle('on', cap.si >= 0);
      this.captureEl.classList.toggle('blocked', cap.guards > 0);
      if (cap.si >= 0) {
        this.captureText.textContent = cap.guards > 0 ? t('capture.blocked', { n: cap.guards }) : t('capture.progress', { p: Math.floor(cap.p * 100) });
        this.captureFill.style.transform = 'scaleX(' + cap.p.toFixed(3) + ')';
      }
    }

    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) this.bannerEl.classList.remove('on');
    }
  }

  // small "Saving…" label in the corner
  showSaving() {
    this.savingEl.classList.add('on');
    this.savingT = 1.4;
  }

  // short message above the army (arise results, army full)
  armyNote(text, kind = '') {
    this.noteEl.textContent = text;
    this.noteEl.className = 'sq-note on ' + kind;
    this.noteT = 2.6;
    this.vNote = text;
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
      s.label.innerHTML = id ? SKILL_ICONS[id] || '' : '';
      s.btn.setAttribute('aria-label', id ? t('skill.' + id) : '');
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
    // above the army: a notification, or the chance of the soul in reach
    if (this.noteT > 0) {
      this.noteT -= dt;
      if (this.noteT <= 0) this.vNote = null;
    }
    if (this.noteT <= 0) {
      const text = cost >= 0 ? t('arise.chance', { p: Math.round(game.ariseChance * 100), n: game.ariseTries }) : '';
      if (text !== this.vNote) {
        this.vNote = text;
        this.noteEl.textContent = text;
        this.noteEl.className = 'sq-note' + (text ? ' on info' : '');
      }
    }
    const cant = cost >= 0 && P.mana < cost;
    if (cant !== this.vAriseCant) {
      this.vAriseCant = cant;
      this.btnArise.classList.toggle('cant', cant);
    }

    // army: summon / recall, Attack / Protect, revive
    {
      const sq = army, h = this.armyUi, max = army.maxDeployed();
      const count = sq.total * 10000 + sq.alive * 100 + max;
      if (count !== h.vCount) {
        h.vCount = count;
        h.count.textContent = sq.alive + '/' + max;
        h.el.classList.toggle('empty', sq.total === 0);
        h.el.classList.toggle('hurt', sq.alive < sq.total);
      }
      if (sq.behavior !== h.vBeh) {
        h.vBeh = sq.behavior;
        h.beh.textContent = t('behavior.' + BEHAVIORS[sq.behavior]);
        h.chip.dataset.b = BEHAVIORS[sq.behavior];
      }
      if (army.out !== h.vOut) {
        h.vOut = army.out;
        h.summon.firstChild.textContent = army.out ? t('army.recall') : t('army.summon');
        h.el.classList.toggle('resting', !army.out);
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
    this.updateGates(dt);

    // health
    const hp = Math.ceil(P.hp);
    if (hp !== this.vHp || P.maxHp !== this.vMaxHp) {
      this.vHp = hp;
      this.vMaxHp = P.maxHp;
      const f = Math.max(0, P.hp / P.maxHp);
      this.hpFill.style.transform = 'scaleX(' + f.toFixed(3) + ')';
      this.hpTrail.style.transform = 'scaleX(' + f.toFixed(3) + ')'; // lags behind (CSS transition)
      this.ohHp.style.transform = 'scaleX(' + f.toFixed(3) + ')';
      this.hpText.textContent = fmt(hp) + ' / ' + fmt(P.maxHp);
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
    if (P.level !== this.vLevel || game.rankIndex !== this.vRank) {
      this.vLevel = P.level;
      this.vRank = game.rankIndex;
      this.xpLabel.textContent = P.level;
      this.rankLabel.textContent = t('hud.rankShort', { rank: RANKS[Math.min(RANKS.length - 1, game.rankIndex)] });
    }
    // "!" on the menu when there is something new (points, items, skills)
    const news = P.hasNews();
    if (news !== this.vPoints) {
      this.vPoints = news;
      this.menuBadge.textContent = news ? '!' : '';
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
    const dc = Math.max(0, Math.ceil((P.dodgeCd / P.dodgeCdMax) * 40));
    if (dc !== this.vDodge) {
      this.vDodge = dc;
      this.dodgeCd.style.setProperty('--p', (dc / 40) * 100 + '%');
      this.els.btnDodge.classList.toggle('cooling', dc > 0);
    }

    // zone label
    const zone = P.inCamp ? 'safe' + P.safeIndex : game.zoneId;
    if (zone !== this.vZone) {
      this.vZone = zone;
      if (P.inCamp) {
        const sp = game.world.safes[P.safeIndex];
        if (sp.zone < 0) {
          this.zoneName.textContent = t('zone.camp');
          this.zoneSub.textContent = t('zone.camp.sub');
        } else {
          this.zoneName.textContent = t('outpost.short', { dir: t('dir.' + sp.dir) });
          this.zoneSub.textContent = t('zone.' + CONFIG.world.zones[sp.zone].id) + ' · ' + t('zone.camp.sub');
        }
      } else {
        const zd = CONFIG.world.zones[game.curZone];
        this.zoneName.textContent = t('zone.' + zone);
        // big title card when a new zone is entered
        if (zone !== this.lastZoneCard) {
          if (this.lastZoneCard) {
            this.zoneCard.querySelector('b').textContent = t('zone.' + zone);
            this.zoneCard.querySelector('small').textContent = t('zone.sub', { rank: zd.rank, level: zd.level, to: zd.levelTo });
            this.zoneCard.classList.remove('on');
            void this.zoneCard.offsetWidth;
            this.zoneCard.classList.add('on');
          }
          this.lastZoneCard = zone;
        }
        this.zoneSub.textContent = t('zone.sub', { rank: zd.rank, level: zd.level, to: zd.levelTo });
      }
      this.hud.classList.toggle('safe', P.inCamp);
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
