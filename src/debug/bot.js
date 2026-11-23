// A test bot (development only, never part of the game): it plays the running game with simple rules and runs
// the world faster than real time, so a balance question ("how long does a rank take, where does the hunter die,
// how many items drop?") can be answered in seconds. Use it from the console of the dev server:
//   const { runBot } = await import('/src/debug/bot.js');
//   const report = await runBot(window.__noctis, { untilLevel: 25, cls: 'warrior' });
// The hunter fights the monsters of the zone of its rank (the ones close to its own level), rests in the camp when
// weak, spends stat points, wears the best gear, takes the class choices and uses its skills. It enters the gates of
// its zone now and then (opts.gates = false: never) and the rank trial as soon as it is due.
const STATS = {
  warrior: ['str', 'vit', 'agi', 'str'], ranger: ['agi', 'per', 'str', 'agi'], mage: ['int', 'vit', 'int', 'str'],
  necromancer: ['int', 'vit', 'str', 'int'], neutral: ['str', 'vit', 'agi', 'per'],
};

export function createBot(game, opts = {}) {
  const input = game.input, C = game.cfg, P = game.player, E = game.enemies;
  const bot = { gateT: 60, gateIn: -1, t: 0, house: 0, restUntil: 0, angle: Math.random() * 6.28, wander: 0, hpPrev: P.hp, hpT: 0 };
  const log = { gatesEntered: 0, gatesCleared0: game.profile.gatesCleared, gateSeconds: 0, levels: [], ranks: [], deaths: 0, items: [0, 0, 0, 0, 0, 0, 0, 0], itemsTotal: 0, dodges: 0, rests: 0, restTime: 0 };
  let lastLevel = P.level, lastRank = game.rankIndex, lastDeaths = game.profile.deaths;

  // count what is picked up
  const addItem = P.addItem.bind(P);
  P.addItem = (item) => { const ok = addItem(item); if (ok && item) { log.itemsTotal++; log.items[item.rarity] = (log.items[item.rarity] || 0) + 1; } return ok; };

  const camp = { x: 0, z: 0 };
  const dist = (x, z) => Math.hypot(x - P.x, z - P.z);

  function housekeeping() {
    // class choices
    if (game.classDue()) {
      if (game.chooseClass(opts.cls || 'warrior') && game.classPanel && game.classPanel.close) game.classPanel.close();
    } else if (game.specDue && game.specDue()) {
      if (game.changeClass(game.mainClass) && game.classPanel && game.classPanel.close) game.classPanel.close();
    }
    // stat points
    const order = STATS[game.mech] || STATS.neutral;
    let k = 0;
    while (P.points > 0 && k++ < 200) P.spendPoint(order[k % order.length]);
    // gear: wear what is better, throw away the rest of the lower rarities
    P.autoSalvage = opts.salvage === undefined ? 2 : opts.salvage;
    const group = opts.weapons || 'melee'; // the weapon group the hunter plays (a javelin with 3 shots is no match for a sword)
    const wscore = (it) => (1 + it.rarity * 0.6) * (1 + it.level * 0.1) * (C.weapons[it.type].damage / C.weapons[it.type].reload);
    for (const item of [...P.inventory]) {
      if (item.kind === 'weapon') {
        const cur = P.equip.weapon;
        if (C.weapons[item.type].group === group && (!cur || C.weapons[cur.type].group !== group || wscore(item) > wscore(cur) * 1.05)) P.equipItem(item);
      } else if (P.isUpgrade(item)) P.equipItem(item);
    }
    // essence into the worn gear
    for (let pass = 0; pass < 3; pass++) for (const slot in P.equip) if (P.equip[slot]) P.upgradeItem(P.equip[slot]);
    // Path picks
    try { if (game.path.due && game.path.due()) { const o = game.path.options(); if (o && o.length) game.path.pick(o[0].id); } } catch (e) { /* not ready */ }
    // skills: every known skill sits in a free slot (learn does this); fill the rest by hand
    for (const id of P.known) {
      const ult = !!C.ultimates[id], slots = ult ? [2] : [0, 1, 3];
      if (P.slots.includes(id)) continue;
      for (const s of slots) if (!P.slots[s]) { P.setSlot(s, id); break; }
    }
  }

  function pickTarget() {
    let best = -1, bd = 1e9;
    const inGate = game.gates.active >= 0;
    const lv = P.level, maxLv = inGate ? 1e9 : lv * 1.3 + 3;
    for (let k = 0; k < E.activeCount; k++) {
      const i = E.active[k];
      if (!E.alive[i] || (inGate ? !E.arena[i] : E.arena[i])) continue;
      if (E.lvl[i] > maxLv) continue;
      const d = dist(E.x[i], E.z[i]);
      if (!inGate && d > 45) continue;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function steerTo(x, z, stop) {
    const dx = x - P.x, dz = z - P.z, d = Math.hypot(dx, dz);
    if (d <= stop) { input.keyX = input.keyZ = 0; return; }
    input.keyX = dx / d;
    input.keyZ = dz / d;
  }

  function think(dt) {
    bot.t += dt;
    input.keyX = input.keyZ = 0;
    if (P.dead) return;
    if ((bot.house -= dt) <= 0) { bot.house = 1; housekeeping(); }
    const G = game.gates;
    if (game.abyss.on) { input.enterGate = true; return; } // never planned: leave if somehow inside
    if (G.active >= 0 && G.exitOpen) { input.enterGate = true; return; } // the gate is done: leave
    if (game.hasArmy()) { bot.arise = (bot.arise || 0) - dt; if (bot.arise <= 0) { bot.arise = 1.5; input.arise = true; } }

    // the next gate: the rank trial at once, other gates now and then
    if (G.active < 0) {
      bot.gateT -= dt;
      const frac0 = P.hp / P.maxHp;
      let gi = -1;
      if (game.trialDue() && frac0 > 0.9 && G.list[G.trialIndex]) gi = G.trialIndex;
      else if (opts.gates !== false && bot.gateT <= 0 && frac0 > 0.9 && !bot.restUntil) {
        let bd = 1e9;
        G.list.forEach((g, k) => {
          if (!g.open || g.abyss || g.trial || g.zone !== game.curZone || g.level > P.level * 1.25 + 2 || g.diff > (opts.maxGateDiff === undefined ? 0 : opts.maxGateDiff)) return;
          const d = dist(g.x, g.z); if (d < bd) { bd = d; gi = k; }
        });
      }
      if (gi >= 0) {
        const g = G.list[gi];
        steerTo(g.x, g.z, 1.5);
        if (dist(g.x, g.z) < C.gates.enterRange * 0.9) { input.enterGate = true; if (bot.gateIn !== gi) { bot.gateIn = gi; log.gatesEntered++; bot.gateStart = game.playTime; bot.gateDeaths = game.profile.deaths; } }
        return;
      }
      bot.arena = null;
    } else if (!bot.arena) bot.arena = { x: P.x, z: P.z }; // the arena centre: where the hunter appears
    if (G.active >= 0) bot.gateT = opts.gateEvery || 240;

    // resting in the camp when weak
    if (G.active >= 0) log.gateSeconds += dt;
    const frac = P.hp / P.maxHp;
    if (bot.restUntil > 0) {
      log.restTime += dt;
      if (frac >= 0.9 && (!P.inCamp || P.mana > P.maxMana * 0.8)) bot.restUntil = 0;
      else { if (!P.inCamp && G.active < 0) steerTo(camp.x, camp.z, 6); if (G.active < 0) return; }
    } else if (frac < (opts.restBelow || 0.35)) { bot.restUntil = 1; log.rests++; return; }

    // dodge when a big hit just landed
    bot.hpT -= dt;
    if (bot.hpT <= 0) { bot.hpT = 0.25; if (bot.hpPrev - P.hp > P.maxHp * 0.05 && P.dodgeCd <= 0) { input.dodge = true; log.dodges++; } bot.hpPrev = P.hp; }

    // too many enemies on a weak hunter: run away from them and dodge
    if (frac < (opts.kiteBelow || 0.55)) {
      let cx = 0, cz = 0, n = 0;
      for (let k = 0; k < E.activeCount; k++) { const j = E.active[k]; if (!E.alive[j] || (G.active >= 0) !== !!E.arena[j]) continue; if (dist(E.x[j], E.z[j]) < 7) { cx += E.x[j]; cz += E.z[j]; n++; } }
      if (n >= 1) {
        cx /= n; cz /= n;
        const dx = P.x - cx, dz = P.z - cz, d = Math.hypot(dx, dz) || 1;
        input.keyX = dx / d; input.keyZ = dz / d;
        if (P.dodgeCd <= 0 && d < 5) { input.dodge = true; log.dodges++; }
        log.kites = (log.kites || 0) + 1;
        if (P.charges > 0 && P.atkCd <= 0) { const s0 = input.sticks[0]; s0.fire = true; s0.auto = true; }
        return;
      }
    }
    const i = pickTarget();
    if (i < 0 && G.active >= 0) { steerTo(bot.arena.x, bot.arena.z, 3); return; }
    if (i < 0) {
      // chests of the zone first
      const L = game.loot;
      let cb = -1, cd = 90;
      for (let k = 0; k < L.chestCount; k++) { if (L.cT[k] > 0) continue; const d2 = dist(L.cx[k], L.cz[k]); if (d2 < cd) { cd = d2; cb = k; } }
      if (cb >= 0 && opts.chests !== false && game.player.level >= 1 && C.world.zones[Math.min(game.rankIndex, C.world.zones.length - 1)] && Math.hypot(L.cx[cb], L.cz[cb]) > C.world.zones[Math.min(game.rankIndex, C.world.zones.length - 1)].inner - 5 && Math.hypot(L.cx[cb], L.cz[cb]) < C.world.zones[Math.min(game.rankIndex, C.world.zones.length - 1)].outer) { steerTo(L.cx[cb], L.cz[cb], 0.5); log.chestWalk = (log.chestWalk || 0) + 1; return; }
      // walk the ring of the zone of this rank
      const zones = C.world.zones, z = zones[Math.min(game.rankIndex, zones.length - 1)];
      const r = Math.max(z.inner + 15, Math.min(z.outer - 20, z.inner + (z.outer - z.inner) * 0.35)), cur = Math.hypot(P.x, P.z);
      bot.wander -= dt;
      if (Math.abs(cur - r) > 12) steerTo(Math.cos(bot.angle) * r, Math.sin(bot.angle) * r, 2);
      else { if (bot.wander <= 0) { bot.wander = 6; bot.angle += 0.35; } steerTo(Math.cos(bot.angle) * r, Math.sin(bot.angle) * r, 2); }
      return;
    }
    const d = dist(E.x[i], E.z[i]), w = C.weapons[P.weapon], ranged = w.range > 6;
    const want = ranged ? w.range * 0.7 : Math.max(1.6, w.range * 0.8);
    // hit and run: the attack uses charges that come back slowly, so with none left the hunter steps back
    if (P.charges <= 0 && P.eclipseT <= 0 && d < 10 && opts.kite !== false) {
      const dx = P.x - E.x[i], dz = P.z - E.z[i], dd = Math.hypot(dx, dz) || 1;
      input.keyX = dx / dd; input.keyZ = dz / dd;
      log.runs = (log.runs || 0) + 1;
    } else steerTo(E.x[i], E.z[i], want);
    const s0 = input.sticks[0];
    if (d < w.range + 2 && P.charges > 0 && P.atkCd <= 0) { s0.fire = true; s0.auto = true; }
    // skills and the ultimate
    for (let k = 1; k <= 4; k++) {
      const id = P.slots[k - 1];
      if (!id || (k === 4 && game.path.skillSlots() < 3)) continue;
      const def = C.skills[id] || C.ultimates[id];
      if (!def) continue;
      const reach = (def.range || def.radius || 8) + 2;
      if (d > reach) continue;
      const ok = k === 3 ? P.ult >= C.progression.ultCharge.max : P.cds[k - 1] <= 0 && P.mana >= P.manaCost(def);
      if (ok) { const s = input.sticks[k]; s.fire = true; s.auto = true; s.fx = P.dirX; s.fz = P.dirZ; s.fp = 1; }
    }
  }

  function observe() {
    // the boss of a gate: how far did the hunter get
    if (game.gates.active >= 0) {
      for (let k = 0; k < E.activeCount; k++) {
        const i = E.active[k];
        if (!E.alive[i] || !E.arena[i] || E.tier[i] !== 3) continue;
        const fr = E.hp[i] / E.maxHp[i];
        if (!log.boss) log.boss = { hp: Math.round(E.maxHp[i]), dmg: Math.round(E.dmg[i]), lvl: E.lvl[i], minFrac: 1, playerHp: Math.round(P.maxHp), playerDmg: Math.round(P.power()) };
        if (fr < log.boss.minFrac) log.boss.minFrac = Math.round(fr * 1000) / 1000;
      }
    }
    if (P.level !== lastLevel) { log.levels.push({ level: P.level, t: Math.round(game.playTime), kills: game.profile.kills(), deaths: game.profile.deaths }); lastLevel = P.level; }
    if (game.rankIndex !== lastRank) { log.ranks.push({ rank: C.levels.rankNames[game.rankIndex], level: P.level, t: Math.round(game.playTime), kills: game.profile.kills(), deaths: game.profile.deaths, items: log.itemsTotal }); lastRank = game.rankIndex; }
    log.deaths = game.profile.deaths - lastDeaths;
  }

  return { think, observe, log, stop() { P.addItem = addItem; input.keyX = input.keyZ = 0; } };
}

// runs the bot faster than real time: untilLevel / untilRank / maxSeconds (of game time)
export function runBot(game, opts = {}) {
  const bot = createBot(game, opts);
  const dt = 0.05, wall0 = performance.now();
  const maxSec = opts.maxSeconds || 3600 * 3;
  const t0 = game.playTime;
  game.paused = true; // the real frame loop stands still, this loop updates the game
  return new Promise((resolve) => {
    const finish = (why) => {
      bot.stop();
      game.paused = false;
      const P = game.player, pf = game.profile;
      resolve({
        why, level: P.level, rank: game.cfg.levels.rankNames[game.rankIndex], gameMinutes: Math.round((game.playTime - t0) / 6) / 10,
        wallSeconds: Math.round((performance.now() - wall0) / 100) / 10, kills: pf.kills(), hunterKills: pf.hunterKills, armyKills: pf.armyKills,
        deaths: pf.deaths, items: bot.log.itemsTotal, itemsByRarity: bot.log.items, rests: bot.log.rests, restMinutes: Math.round(bot.log.restTime / 6) / 10,
        boss: bot.log.boss, kites: bot.log.runs || 0, chestSteps: bot.log.chestWalk || 0, upgrades: Object.values(game.player.equip).reduce((a, it) => a + (it ? it.up : 0), 0), dodges: bot.log.dodges, gatesEntered: bot.log.gatesEntered, gatesCleared: pf.gatesCleared - bot.log.gatesCleared0, gateMinutes: Math.round(bot.log.gateSeconds / 6) / 10, trialDone: !game.trialDue(), essence: Math.round(P.essence), ranks: bot.log.ranks, levels: bot.log.levels,
      });
    };
    const chunk = () => {
      const end = performance.now() + 120; // ms of work per slice, the page stays responsive
      while (performance.now() < end) {
        bot.think(dt);
        game.update(dt);
        bot.observe();
        if (opts.untilLevel && game.player.level >= opts.untilLevel) return finish('level');
        if (opts.untilRank !== undefined && game.rankIndex >= opts.untilRank) return finish('rank');
        if (game.playTime - t0 >= maxSec) return finish('time');
      }
      setTimeout(chunk, 0);
    };
    chunk();
  });
}
