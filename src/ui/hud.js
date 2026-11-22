// In-game HUD (HTML overlay). Values are only written to the DOM when they
// change, so the HUD costs almost nothing per frame.
import { CONFIG } from '../config.js';
import { t } from '../strings.js';
import { play } from '../core/sfx.js';
import { itemName } from '../core/items.js';
import { input } from '../input/input.js';
import { BEHAVIORS } from '../entities/army.js';
import { skillDef } from '../combat/skills.js';
import { RANKS } from '../world/gates.js';
import { fmt } from '../core/format.js';
import { SKILL_ICONS, UI_ICONS } from './icons.js';
import { settings } from '../core/settings.js';
import { hints, hintKey } from '../core/hints.js';
import { IDS, SELECTORS, layout } from '../core/hudLayout.js';

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
  // every button is a circle at a place (x, y from the edges, in u) with a diameter; the global
  // button size scales all alike, so buttons that did not overlap still do not
  applyLayout() {
    const L = layout(), k = settings.buttonSize || 1, sw = settings.swap;
    for (const [id, el] of this.layoutEls) {
      if (!el) continue;
      const c = L[id];
      el.style.inset = 'auto';
      el.style.width = el.style.height = `calc(var(--u) * ${c.d * k})`;
      el.style[sw ? 'left' : 'right'] = `calc(var(--${sw ? 'sl' : 'sr'}) + var(--u) * ${(c.x - c.d / 2) * k})`;
      el.style.bottom = `calc(var(--sb) + var(--u) * ${(c.y - c.d / 2) * k})`;
    }
  }

  constructor(root, game) {
    this.game = game;
    root.innerHTML = `
      <div id="touch-layer"></div>
      <div id="fx-layer"></div>
      <div id="vignette"></div>
      <div id="overhead"><div class="oh-hp"><i></i></div><div class="oh-ammo"><i></i><i></i><i></i><i></i></div></div>
      <div id="hud">
        <div class="panel-player">
          <div class="lvl-badge"><b></b><small></small></div>
          <div class="pp-bars">
            <div class="bar hp"><em></em><i></i><span></span></div>
            <div class="bar mp"><i></i><span></span></div>
            <div class="rage" style="display:none"><div class="bar"><i></i></div></div>
            <div class="xp"><div class="bar"><i></i></div></div>
            <div class="rk"><div class="bar"><i></i></div><span></span></div>
          </div>
        </div>
        <div class="qtrack"></div>
        <div class="zone"><b></b><small></small></div>
        <div class="zone-card"><small></small><b></b><i></i></div>
        <div class="boss-bar"><b></b><div class="bar"><i></i><em class="ph"></em><em class="ph"></em><span></span></div></div>
        <div class="capture"><b></b><div class="bar"><i></i></div></div>
        <canvas class="minimap"></canvas>
        <div class="gate-panel"><div class="gp-text"><b></b><small></small></div><div id="btn-gate2" class="btn pill"></div><div id="btn-gate" class="btn pill">${t('gate.enter')}</div></div>
        <div class="abyss-info"><b></b><small></small></div>
        <div class="uq-drop"><div class="uq-rays"></div><div class="uq-card"><small>${t('uq.drop')}</small><b></b><p></p><em>${t('uq.dropSub')}</em></div></div>
        <div class="banner"><b></b><small></small></div>
        <div class="fps"></div>
        <div class="toast"></div>
        <div class="streak"><b></b><span><small>${t('streak.label')}</small><em></em></span><i></i></div>
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
          ${skillBtn('btn-skill2', '')}
          <div id="btn-attack" class="btn round" aria-label="${t('hud.attack')}">
            <div class="knob">${ICON_SWORD}</div>
            <div class="ammo"><i></i><i></i><i></i><i></i></div>
          </div>
        </div>
        <div class="death"><b>${t('hud.died')}</b><small>${t('hud.respawning')}</small></div>
      </div>
    `;
    const $ = (s) => root.querySelector(s);
    this.skillEls = ['#btn-skill0', '#btn-skill1', '#btn-ult', '#btn-skill2'].map((sel) => {
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
    // the daily quests, small on the left; a tap opens them in the menu
    this.qEl = $('.qtrack');
    this.qKey = '';
    this.qT = 0;
    this.qEl.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (!game.menu.isOpen && game.gates.active < 0) { play('ui'); game.menu.open('quests'); }
    });
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
    this.bossMarks = [...this.hud.querySelectorAll('.boss-bar .ph')];
    this.gatePanel = $('.gate-panel');
    this.gateTitle = $('.gate-panel b');
    this.gateInfo = $('.gate-panel small');
    this.gateBtn = $('#btn-gate');
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
    onTap($('#btn-gate2'), () => game.gates.press2());
    this.gateBtn2 = $('#btn-gate2');
    this.abyssInfo = $('.abyss-info');
    this.abyssTitle = $('.abyss-info b');
    this.abyssSub = $('.abyss-info small');
    this.vAbyss = '';
    this.uqEl = $('.uq-drop');
    this.uqT = 0;
    this.vArena = null;
    this.savingEl = $('.saving');
    this.savingT = 0;
    this.mpFill = $('.bar.mp i');
    this.rageEl = $('.rage');
    this.rageFill = $('.rage i');
    this.mpText = $('.bar.mp span');
    this.xpFill = $('.xp .bar i');
    this.xpLabel = $('.lvl-badge b');
    this.rankLabel = $('.lvl-badge small');
    this.rkBox = $('.rk');
    this.rkFill = $('.rk .bar i');
    this.rkText = $('.rk span');
    this.hpTrail = $('.bar.hp em');
    this.zoneCard = $('.zone-card');
    this.zoneCardT = 0;
    this.lastZoneCard = '';
    this.menuBadge = $('#btn-menu i');
    this.toastEl = $('.toast');
    this.streakEl = $('.streak');
    this.vStreak = 0;
    this.toastT = 0;
    this.btnArise = $('#btn-arise');
    this.squadsEl = $('.squads');
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
    // the buttons on the right: where the player put them (Settings > Button layout)
    this.layoutEls = IDS.map((id) => [id, this.hud.querySelector(SELECTORS[id])]);
    this.onLayout = () => this.applyLayout();
    window.addEventListener('noctis-layout', this.onLayout);
    this.applyLayout();

    // cached values
    this.vHp = -1;
    this.vMaxHp = -1;
    this.hpF = 1; // health as a share of the maximum
    this.trail = 0; // where the "just lost" part ends
    this.trailHold = 0;
    this.vTrail = -1;
    this.vShield = null;
    this.vZone = null;
    this.vDodge = -1;
    this.vSprint = '';
    this.vAmmo = [-1, -1, -1, -1];
    this.vMaxCh = -1;
    this.vUltOn = null;
    this.vRage = null;
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
    // -50 = gate cleared, -60 = Abyss floor cleared
    const ab = gates.abyssIndex, P = game.player;
    const near = gates.active < 0 ? gates.near : gates.exitOpen ? (gates.inAbyss ? -60 : -50) : -1;
    const sig = near + ':' + game.modsOpen() + ':' + game.mods.length + ':' + game.abyss.best + ':' + game.abyss.floor + ':' + game.abyss.unlocked + ':' + game.gateTiers.join(',');
    if (sig !== this.vGate) {
      this.vGate = sig;
      this.gatePanel.classList.toggle('on', near !== -1);
      this.gateBtn.textContent = t(near === -50 ? 'gate.leave' : near === -60 ? 'abyss.next' : 'gate.enter');
      this.gateBtn.classList.remove('off');
      this.gateBtn2.style.display = 'none';
      const nm = game.modsOpen() ? game.mods.length : 0;
      if (near === -60) {
        this.gateTitle.textContent = t('abyss.cleared', { n: game.abyss.floor });
        this.gateInfo.textContent = t('abyss.clearedInfo');
        this.gatePanel.dataset.d = 'exit';
        this.gateBtn2.style.display = '';
        this.gateBtn2.textContent = t('gate.leave');
      } else if (near === ab && near >= 0) {
        const A = game.abyss;
        this.gateTitle.textContent = t('abyss.name');
        this.gateInfo.textContent = !A.unlocked ? t('abyss.locked', { level: CONFIG.abyss.unlockLevel })
          : A.best ? t('abyss.best', { n: A.best }) : t('abyss.bestNone');
        this.gatePanel.dataset.d = 'abyss';
        this.gateBtn.classList.toggle('off', !A.unlocked);
      } else if (near === gates.trialIndex && near >= 0) {
        const zs = CONFIG.world.zones, nz = zs[Math.min(zs.length - 1, game.rankIndex + 1)];
        this.gateTitle.textContent = t('trial.name', { rank: RANKS[game.rankIndex + 1] });
        this.gateInfo.textContent = t('trial.info', { boss: t('enemy.' + nz.boss), level: P.level });
        this.gatePanel.dataset.d = 'trial';
      } else if (near === -50) {
        this.gateTitle.textContent = t('gate.cleared');
        this.gateInfo.textContent = t('gate.leaveInfo');
        this.gatePanel.dataset.d = 'exit';
      } else if (near >= 0) {
        const gate = gates.list[near], zone = CONFIG.world.zones[gate.zone];
        const diff = CONFIG.gates.difficulties[gate.diff];
        const tier = diff.id === 'deadly' ? game.gateTier(gate.zone) : 0;
        this.gateTitle.textContent = t('gate.title', { diff: t('gate.diff.' + diff.id) + (tier ? ' +' + tier : ''), rank: zone.rank }) + (gate.keyed ? ' · ' + t('quest.keyTag') : '');
        this.gateInfo.textContent = t('gate.info', { boss: t('enemy.' + zone.boss), level: gate.level, n: diff.stages.length + 1 }) + (nm ? ' · ' + t('mods.active', { n: nm }) : '');
        this.gatePanel.dataset.d = diff.id;
        this.gateBtn2.style.display = game.modsOpen() ? '' : 'none';
        this.gateBtn2.textContent = t('mods.btn') + (nm ? ' (' + nm + ')' : '');
      }
    }
    // boss health
    const b = gates.bossIndex(), hb = game.hunts.barIndex();
    const show = b >= 0 && E.alive[b] ? b : hb;
    if (show !== this.vBoss) {
      this.vBoss = show;
      this.bossBar.classList.toggle('on', show >= 0);
      this.bossBar.classList.toggle('hunt', show >= 0 && show === hb);
      if (show >= 0) {
        this.bossName.textContent = show === hb ? game.hunts.name : t('enemy.' + E.types[E.type[show]].id);
        // where the next phases begin (a hunted monster has none)
        const n = show === hb ? 1 : gates.phaseCount(gates.active);
        this.bossMarks.forEach((m, k) => {
          m.style.display = k < n - 1 ? '' : 'none';
          m.style.left = CONFIG.boss.phases[k] * 100 + '%';
        });
      }
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
    // inside a gate or the Abyss: the zone label makes room
    const arena = gates.active >= 0;
    if (arena !== this.vArena) { this.vArena = arena; this.hud.classList.toggle('arena', arena); }
    this.hud.classList.toggle('bossup', show >= 0);
    // Abyss floor and wave, or the time left of a gate
    const A = game.abyss;
    const left = A.on ? A.timeLeft : gates.timeLeft;
    let info = '';
    if (A.on) info = A.floor + ':' + A.wave + ':' + A.waves + ':' + Math.ceil(left) + ':' + A.cleared;
    else if (arena && !gates.exitOpen && gates.stageI >= 0 && gates.stageKind !== 'boss') {
      info = 'g:' + gates.stageI + ':' + Math.ceil(gates.surviveT) + ':' + gates.poolLeft + ':' + Math.ceil(left) + ':' + (gates.stagePause > 0);
    } else if (arena && left > 0) info = 'g:' + Math.ceil(left);
    if (info !== this.vAbyss) {
      this.vAbyss = info;
      this.abyssInfo.classList.toggle('on', info !== '');
      const clock = left > 0 ? Math.floor(left / 60) + ':' + String(Math.ceil(left) % 60).padStart(2, '0') : '';
      if (A.on) {
        this.abyssTitle.textContent = t('abyss.floor', { n: A.floor });
        const parts = [];
        if (!A.cleared && A.waves) parts.push(t('abyss.wave', { n: A.wave, max: A.waves }));
        if (clock) parts.push('⏱ ' + clock);
        if (gates.runMods.length) parts.push(t('mods.active', { n: gates.runMods.length }));
        this.abyssSub.textContent = parts.join(' · ');
      } else if (gates.stageI >= 0 && !gates.exitOpen && gates.stageKind !== 'boss') {
        // the stage of the gate: what to do and how far along
        const kind = gates.stageKind, parts = [];
        this.abyssTitle.textContent = t('gate.stage', { n: gates.stageI + 1, max: gates.stages.length });
        if (gates.stagePause > 0) parts.push(t('gate.next'));
        else if (kind === 'survive' && gates.surviveT > 0) parts.push(t('gate.hold', { s: Math.ceil(gates.surviveT) }));
        else parts.push(t('gate.left', { n: gates.poolLeft }));
        if (clock) parts.push('⏱ ' + clock);
        if (gates.runMods.length) parts.push(t('mods.active', { n: gates.runMods.length }));
        this.abyssSub.textContent = parts.join(' · ');
      } else {
        this.abyssTitle.textContent = '⏱ ' + clock;
        this.abyssSub.textContent = gates.runMods.length ? t('mods.active', { n: gates.runMods.length }) : '';
      }
    }
    if (this.uqT > 0) {
      this.uqT -= dt;
      if (this.uqT <= 0) this.uqEl.classList.remove('on');
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

  // A unique item dropped: a big card in the middle of the screen.
  uniqueDrop(item, x, z) {
    const game = this.game;
    this.uqEl.querySelector('b').textContent = itemName(item);
    this.uqEl.querySelector('p').textContent = t('uqd.' + item.uq);
    this.uqEl.classList.remove('on');
    void this.uqEl.offsetWidth;
    this.uqEl.classList.add('on');
    this.uqT = 4.5;
    play('unique');
    game.cam.shake(0.35, 0.5);
    game.effects.burst(x, 1.5, z, 80, 0xfff0c0, 12, 0.35, 1.6);
    game.effects.ring(x, z, 0.5, 8, 0xffd870, 0.9);
    game.effects.ring(x, z, 0.5, 5, 0xffffff, 0.7, 0.2);
  }

  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.classList.add('on');
    this.toastT = 2.2;
  }

  // labels and costs of the skill buttons; call after the slots changed
  syncSkills() {
    const P = this.game.player;
    const third = this.game.path.skillSlots() >= 3;
    this.skillEls[3].btn.classList.toggle('off', !third);
    for (let k = 0; k < 4; k++) {
      const s = this.skillEls[k], id = k === 3 && !third ? null : P.slots[k];
      s.btn.classList.toggle('none', !id);
      s.label.innerHTML = id ? SKILL_ICONS[id] || '' : '';
      s.btn.setAttribute('aria-label', id ? t('skill.' + id) : '');
      s.cost.textContent = id && k !== 2 ? skillDef(id).mana : '';
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
    for (let k = 0; k < 4; k++) {
      const s = this.skillEls[k], id = P.slots[k];
      if (!id || (k === 3 && this.skillEls[3].btn.classList.contains('off'))) continue;
      let p, low;
      if (k === 2) {
        p = Math.floor((1 - P.ult / max) * 50); // 0 = fully charged
        low = false;
      } else {
        const def = skillDef(id);
        p = Math.ceil((Math.max(0, P.cds[k]) / (P.cdMax[k] || def.cooldown)) * 50);
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

    // the Warrior's Rage, the Mage's Arcane Charges
    const mc = game.mech, res = mc === 'warrior' ? P.rage / CONFIG.warrior.rageMax : mc === 'mage' ? P.arcane / CONFIG.mage.arcaneMax : mc === 'cleric' ? P.faith / CONFIG.cleric.faithMax : mc === 'rogue' ? P.cp / CONFIG.rogue.cpMax : -1;
    if (mc !== this.vRageOn) { this.vRageOn = mc; this.rageEl.style.display = res >= 0 ? '' : 'none'; this.rageEl.classList.toggle('arcane', mc === 'mage'); this.rageEl.classList.toggle('faith', mc === 'cleric'); this.rageEl.classList.toggle('combo', mc === 'rogue'); }
    if (res >= 0) {
      const r = Math.round(res * 100);
      if (r !== this.vRage) { this.vRage = r; this.rageFill.style.transform = 'scaleX(' + (r / 100).toFixed(2) + ')'; }
    }

    // the army belongs to the Necromancer
    const hasArmy = game.hasArmy();
    if (hasArmy !== this.vHasArmy) { this.vHasArmy = hasArmy; this.squadsEl.style.display = hasArmy ? '' : 'none'; }

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

  // the kill streak: number, XP bonus and the time left until it ends
  updateStreak() {
    const g = this.game, S = CONFIG.streak, n = g.streak > 0 && g.streakT > 0 ? g.streak : 0;
    const on = n >= S.show;
    if (n !== this.vStreak) {
      const el = this.streakEl;
      el.classList.toggle('on', on);
      if (on) {
        el.querySelector('b').textContent = n;
        const pct = Math.round(g.streakBonus() * 100);
        el.querySelector('em').textContent = pct ? t('streak.bonus', { pct }) : '';
        el.classList.toggle('hot', pct > 0);
        el.classList.remove('pop');
        void el.offsetWidth; // restart the pop
        el.classList.add('pop');
      }
      this.vStreak = n;
    }
    if (on) this.streakEl.style.setProperty('--left', String(Math.max(0, g.streakT / S.window)));
  }

  updateQuests(dt) {
    this.qEl.classList.toggle('low', this.streakEl.classList.contains('on'));
    if ((this.qT -= dt) > 0) return;
    this.qT = 0.4;
    const game = this.game, Q = game.quests;
    const hide = game.gates.active >= 0 || !!game.tutorial || !!game.tips.cur || game.player.dead;
    const open = Q.list.filter((q) => !q.claimed);
    let key = hide || !open.length ? '' : open.map((q) => q.kind + q.have + q.done).join();
    if (key === this.qKey) return;
    this.qKey = key;
    this.qEl.classList.toggle('on', !!key);
    if (!key) return;
    this.qEl.innerHTML = `<small>${t('quest.track')}</small>` + open.map((q) =>
      `<div class="d${q.d}${q.done ? ' done' : ''}"><span>${Q.text(q)}</span><b>${q.done ? t('quest.ready') : q.have + '/' + q.n}</b></div>`).join('');
  }

  update(dt) {
    const game = this.game, P = game.player;
    this.updateQuests(dt);
    this.updateStreak();
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
      if (f < this.hpF - 0.001) this.trailHold = 0.45; // just hurt: the lost part stays for a moment
      this.hpF = f;
      this.ohHp.style.transform = 'scaleX(' + f.toFixed(3) + ')';
      this.hpText.textContent = fmt(hp) + ' / ' + fmt(P.maxHp);
    }
    // the part that was just lost drains away after a moment
    if (this.trail <= this.hpF) {
      this.trail = this.hpF;
    } else if (this.trailHold > 0) {
      this.trailHold -= dt;
    } else {
      this.trail = Math.max(this.hpF, this.trail - dt * 0.9);
    }
    const tr = Math.round(this.trail * 500);
    if (tr !== this.vTrail) {
      this.vTrail = tr;
      this.hpTrail.style.transform = 'scaleX(' + (tr / 500).toFixed(3) + ')';
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
    const maxed = P.level >= CONFIG.levels.maxLevel;
    const xp = Math.floor((maxed ? P.mastery.xp / P.masteryNeed() : P.xp / P.xpNeed()) * 100);
    this.xpFill.parentNode.classList.toggle('mastery', maxed);
    if (xp !== this.vXp) {
      this.vXp = xp;
      this.xpFill.style.transform = 'scaleX(' + xp / 100 + ')';
    }
    if (P.level !== this.vLevel || game.rankIndex !== this.vRank) {
      this.vLevel = P.level;
      this.vRank = game.rankIndex;
      this.xpLabel.textContent = P.level;
      this.xpLabel.dataset.n = String(P.level).length; // 4 digits get a smaller font
      this.rankLabel.textContent = t('hud.rankShort', { rank: RANKS[Math.min(RANKS.length - 1, game.rankIndex)] });
    }
    // progress through the rank, up to its trial (or to the Abyss in the last one)
    const RL = CONFIG.levels.rankLevels, ri = game.rankIndex, cap = game.levelCap();
    const due = game.trialDue();
    const rp = maxed ? 1 : Math.min(1, (P.level - RL[ri] + Math.min(1, P.xp / P.xpNeed())) / Math.max(1, cap - RL[ri] + 1));
    const rkSig = Math.floor(rp * 200) + ':' + due + ':' + ri + ':' + maxed;
    if (rkSig !== this.vRk) {
      this.vRk = rkSig;
      this.rkFill.style.transform = 'scaleX(' + rp + ')';
      this.rkBox.classList.toggle('due', due);
      this.rkBox.style.display = maxed ? 'none' : '';
      this.rkText.textContent = due ? t('hud.trialReady')
        : ri + 1 < RANKS.length ? t('hud.nextRank', { rank: RANKS[ri + 1], level: cap + 1 }) : t('hud.toAbyss', { level: CONFIG.levels.maxLevel });
    }
    // the badge on the menu: how many pages have something new (points, items, skills, class, quests ...)
    if ((this.hintT = (this.hintT || 0) - dt) <= 0) {
      this.hintT = 0.5;
      const hs = hints(game), key = hintKey(hs);
      if (key !== this.vPoints) {
        this.vPoints = key;
        this.menuBadge.textContent = hs.length ? String(hs.length) : '';
        this.menuBadge.parentNode.classList.toggle('hint', hs.length > 0);
        this.qEl.classList.toggle('ready', game.quests.ready() > 0);
      }
    }

    // the ultimate glows while it lasts (it cannot charge then)
    const ultOn = P.ultLockT > 0;
    if (ultOn !== this.vUltOn) {
      this.vUltOn = ultOn;
      this.skillEls[2].btn.classList.toggle('active', ultOn);
    }
    const rage = P.rageT > 0;
    if (rage !== this.vRage) {
      this.vRage = rage;
      this.els.btnAttack.classList.toggle('rage', rage);
    }

    // attack charges (each pip fills while it reloads); a fourth with the
    // Stormrunner set
    if (P.maxCharges !== this.vMaxCh) {
      this.vMaxCh = P.maxCharges;
      for (let i = 0; i < 4; i++) {
        this.ammo[i].style.display = this.ohAmmo[i].style.display = i < P.maxCharges ? '' : 'none';
      }
    }
    for (let i = 0; i < 4; i++) {
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

    // Shadow Step: the dodge button glows while it runs, and softly when it can start
    const sprint = P.sprint ? 'on' : P.canSprint() ? 'ready' : '';
    if (sprint !== this.vSprint) {
      this.vSprint = sprint;
      this.els.btnDodge.classList.toggle('sprint', sprint === 'on');
      this.els.btnDodge.classList.toggle('calm', sprint === 'ready');
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
