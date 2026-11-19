// Hunter vs army damage of real cloud saves (Nov 2026), with the game's own
// formulas: how much of the fighting the hunter still does himself.
//   node tools/real-saves.mjs
import { CONFIG } from '../src/config.js';
import { playerPower, enemyPower } from '../src/core/levels.js';
import { weaponDamage, skillDamage, armorBonus } from '../src/core/items.js';

const G = CONFIG.progression, S = G.stats, Sh = CONFIG.shadows;
const SKILLS = ['shadowWave', 'phantomStrike'];

// compact save data: units "type:tier:stage:rank:level:plv:olv", equip "slot:type:set:bonus:rarity:level:up"
export const SAVES = [
  { lvl: 55, s: { agi: 16, int: 57, per: 16, str: 12, vit: 0 }, ms: {}, e: 'boots:boots:gravecaller:hp:3:75:0 chest:chest:gravecaller:mana:5:75:0 gloves:gloves:stalker:crit:4:37:0 helmet:helmet:bulwark:reload:3:9:0 weapon:bow:-:-:3:40:0',
    u: 'acolyte:0:1:0:9:59:0 acolyte:0:1:0:9:59:0 acolyte:0:1:0:9:59:0 acolyte:0:1:0:9:59:0 acolyte:0:1:0:9:59:0 ruinhound:1:1:0:8:75:0 hollowKing:3:1:0:11:60:0 thornmaw:3:3:0:40:6:0 bogshambler:0:2:0:18:47:0 bogshambler:0:2:0:18:47:0 bogshambler:0:2:0:18:47:0 sporemother:0:2:0:21:40:0 sporemother:0:2:0:21:40:0 sporemother:1:3:0:22:40:0 sporemother:0:2:0:21:40:0 sporemother:0:2:0:21:40:0 ruinhound:1:1:0:7:72:0 ruinhound:0:1:0:6:72:0 ruinhound:0:1:0:6:72:0 ruinhound:0:1:0:6:72:0 ruinhound:0:1:0:6:67:0 ruinhound:2:1:0:7:67:0 ruinhound:0:1:0:6:67:0 ruinhound:1:1:0:6:75:0 ruinhound:0:0:0:4:75:0' },
  { lvl: 79, s: { agi: 26, int: 26, per: 27, str: 43, vit: 26 }, ms: {}, e: 'boots:boots:bloodreaver:hp:5:72:2 chest:chest:bloodreaver:speed:4:57:5 gloves:gloves:bulwark:crit:4:75:5 helmet:helmet:stalker:mana:4:75:5 weapon:sword:-:-:5:60:5',
    u: 'acolyte:1:1:0:11:76:0 barkhide:3:3:0:40:23:0 acolyte:1:1:0:11:75:0 hollowKing:3:2:0:17:60:0 mireMatriarch:3:3:0:36:30:0 mireMatriarch:3:3:0:31:38:0 mirecrawler:1:3:0:22:46:0 barkhide:3:3:0:40:23:0 acolyte:0:2:0:13:61:0 acolyte:0:2:0:13:61:0 acolyte:0:2:0:14:61:0 acolyte:0:2:0:13:61:0 acolyte:0:2:0:14:61:0 acolyte:0:2:0:13:61:0 acolyte:2:1:0:11:56:0 hollowKing:3:1:0:11:60:0 mireMatriarch:3:0:0:1:38:0' },
  { lvl: 143, s: { agi: 38, int: 12, per: 24, str: 112, vit: 22 }, ms: {}, e: 'boots:boots:arcanist:mana:4:260:0 chest:chest:tempest:ultCharge:5:250:5 gloves:gloves:bloodreaver:skillDamage:5:75:0 helmet:helmet:stalker:skillDamage:4:150:0 weapon:spear:-:-:5:160:5',
    u: 'barkhide:3:2:0:13:13:0 thornmaw:3:3:0:30:3:0 mireMatriarch:3:1:0:11:46:0 frostTroll:0:0:0:1:141:0 frostTroll:0:0:0:1:122:0 frostTroll:0:0:0:1:122:0' },
  { lvl: 846, s: { agi: 120, int: 114, per: 100, str: 121, vit: 109 }, ms: {}, e: 'boots:boots:gravecaller:ultCharge:6:795:5 chest:chest:arcanist:ultCharge:6:758:5 gloves:gloves:bulwark:speed:6:940:5 helmet:helmet:bulwark:ultCharge:6:925:5 weapon:bow:-:-:6:770:5',
    u: 'magmaBrute:1:3:2:40:237:0 magmaBrute:2:3:1:40:231:231 voidKnight:1:3:1:32:925:0 voidKnight:1:3:0:31:925:0 pyrelord:3:3:5:40:251:846 frostTroll:2:3:1:40:147:0 magmaBrute:0:3:1:40:214:0 magmaBrute:0:3:0:40:214:0 voidSovereign:3:3:0:34:880:0 magmaBrute:0:3:0:40:214:0 emberImp:0:3:0:40:233:0 gravePriest:1:3:2:40:750:0 magmaBrute:0:3:1:40:260:260 emberImp:0:3:0:40:244:0 pyrelord:3:3:6:40:220:855 emberImp:0:3:0:40:233:0 magmaBrute:0:3:1:40:263:0 rimeclaw:3:3:2:40:120:0 magmaBrute:1:3:1:40:263:263 magmaBrute:0:3:2:40:263:0 magmaBrute:0:3:2:40:266:0 rimeclaw:3:3:1:40:150:150 emberImp:1:3:0:40:233:0 thunderhorn:1:3:0:40:550:0 magmaBrute:0:3:1:40:266:0 magmaBrute:0:3:1:40:266:0 cinderhound:0:3:0:40:234:0 cinderhound:0:3:0:40:234:0 emberImp:0:3:0:40:241:0 emberImp:1:3:0:40:233:0 cinderhound:0:3:0:40:206:0 cinderhound:1:3:0:40:206:0 gravePriest:1:3:0:40:775:0 voltWisp:0:3:0:40:593:0 voltWisp:0:3:0:40:593:0 voltWisp:0:3:0:40:593:0 stormBrute:1:3:0:40:550:0 boneColossus:2:3:0:40:750:0 titanLich:3:3:0:40:750:0 stormcaller:3:3:0:40:550:0' },
  { lvl: 882, s: { agi: 119, int: 119, per: 119, str: 130, vit: 119 }, ms: {}, e: 'boots:boots:bloodreaver:crit:6:862:5 chest:chest:bulwark:mana:6:959:5 gloves:gloves:gravecaller:hp:6:750:5 helmet:helmet:stalker:skillDamage:6:925:5 weapon:bow:-:-:6:940:5',
    u: 'boneColossus:1:3:0:40:772:0 nightmare:1:2:0:21:881:0 nightmare:0:3:0:28:869:0 voidSovereign:3:0:0:4:926:0 voidEye:2:3:0:26:915:0 voidKnight:0:1:0:11:935:0 titanLich:3:3:0:40:750:0 voidKnight:2:1:0:7:945:0 nightmare:0:3:0:27:869:0 voidKnight:0:3:0:25:895:0 boneColossus:0:3:0:40:751:0 voidSovereign:3:0:0:3:978:0 voidKnight:1:2:0:17:908:0 nightmare:1:1:0:11:944:0 voidKnight:1:0:0:1:988:0 nightmare:0:3:0:28:869:0 nightmare:2:1:0:8:904:0 voidSovereign:3:2:0:12:880:0 nightmare:0:3:0:29:869:0 nightmare:1:3:0:24:925:0 nightmare:1:2:0:21:944:0 nightmare:0:3:0:24:876:0 nightmare:0:3:0:24:876:0 voidKnight:0:3:0:24:895:0 voidKnight:0:3:0:24:895:0 nightmare:0:2:0:21:933:0 nightmare:1:1:0:10:881:0 nightmare:0:2:0:21:933:0 boneColossus:2:3:0:40:773:0 titanLich:3:3:0:38:820:0 nightmare:0:3:0:22:933:0 nightmare:0:3:0:22:933:0 nightmare:0:3:0:24:876:0 voidKnight:1:3:0:23:908:0 voidKnight:0:3:0:25:895:0 voidKnight:0:3:0:24:895:0 nightmare:2:3:0:24:893:0 nightmare:2:2:0:20:904:0 nightmare:1:3:0:24:877:0 ribHound:2:3:0:40:710:0' },
  { lvl: 921, s: { agi: 133, int: 154, per: 144, str: 142, vit: 45 }, ms: {}, e: 'boots:boots:gravecaller:hp:5:750:5 chest:chest:gravecaller:ultCharge:6:770:5 gloves:gloves:gravecaller:ultCharge:6:770:5 helmet:helmet:gravecaller:skillDamage:6:941:0 weapon:bow:-:-:6:941:0',
    u: 'voidKnight:1:3:3:29:926:949 boneColossus:1:3:0:40:750:0 nightmare:0:3:0:40:865:0 voidKnight:1:3:0:34:978:0 voidKnight:1:3:0:34:978:0 voidKnight:1:3:0:40:926:0 voidEye:1:3:0:40:888:0 voidEye:0:3:0:40:888:0 voidEye:0:3:0:40:888:0 voidEye:0:3:0:40:888:0 voidEye:0:3:0:40:878:0 voidSovereign:3:3:2:35:978:0 nightmare:0:3:0:40:900:0 nightmare:0:3:0:40:900:0 voidEye:0:3:0:39:925:0 voidEye:0:3:0:39:925:0 voidEye:0:3:0:39:925:0 nightmare:2:3:0:40:894:0 stormcaller:3:3:5:38:490:914 stormcaller:3:3:3:25:550:896 boneColossus:0:3:1:40:692:0 boneColossus:0:3:1:40:692:0 boneColossus:0:3:0:40:689:0 boneColossus:0:3:0:40:745:0 titanLich:3:3:0:40:750:0 boneColossus:1:3:0:40:750:0 titanLich:3:3:0:40:690:0 voidKnight:2:3:4:32:920:945 voidKnight:1:3:3:28:926:948 voidKnight:1:3:0:40:926:0 voidKnight:1:3:0:40:926:0 voidSovereign:3:3:2:40:926:0 voidKnight:1:3:0:32:978:0 voidKnight:1:3:0:32:978:0 voidKnight:1:3:0:33:978:0 voidSovereign:3:3:0:34:978:0 voidSovereign:3:3:0:38:926:0 voidKnight:1:3:0:38:926:0 voidSovereign:3:3:0:31:926:0' },
  { lvl: 1000, s: { agi: 100, int: 130, per: 100, str: 195, vit: 120 }, ms: { hp: 120, crit: 100, loot: 55, armyHp: 150, damage: 203, armyDamage: 230 }, e: 'boots:boots:stalker:crit:6:1315:5 chest:chest:stalker:hp:6:1305:5 gloves:gloves:stalker:speed:6:1305:5 helmet:helmet:stalker:mana:6:1305:5 weapon:bow:-:-:6:1255:5',
    u: 'voidSovereign:3:3:1:40:926:0 voidSovereign:3:3:6:40:1000:1000 voidSovereign:3:3:3:40:978:1000 voidSovereign:3:3:0:40:880:0 titanLich:3:3:0:40:690:1000 barkhide:3:3:1:40:1000:0 mireMatriarch:3:3:0:40:1000:0 voidSovereign:3:3:5:40:1000:1000 voidSovereign:3:3:1:40:926:0 rimeclaw:3:3:3:40:1000:1000 stormcaller:3:3:1:40:1000:0 crystalTyrant:3:3:4:40:1000:1000 voidSovereign:3:3:2:40:978:1000 voidSovereign:3:3:2:40:978:1000 shardGolem:0:3:0:40:1000:0 voidSovereign:3:3:1:40:926:0 voidEye:2:3:0:40:988:0 voidSovereign:3:3:1:40:926:927 voidSovereign:3:3:2:40:978:1000 voidSovereign:3:3:1:40:926:0 voidSovereign:3:3:2:40:978:0 nightmare:2:3:0:40:926:926 voidSovereign:3:3:2:40:978:0 nightmare:2:3:0:40:874:1000 thornmaw:3:3:1:40:1000:0 boneColossus:1:3:0:40:1000:0 voidEye:2:3:0:40:964:0 voidSovereign:3:3:0:40:926:0 voidSovereign:3:3:0:40:880:881 rimeclaw:3:3:3:40:1000:1000 voidSovereign:3:3:1:40:978:0 voidSovereign:3:3:0:40:880:1000 crystalTyrant:3:3:4:40:1000:1000 voidSovereign:3:3:0:40:880:0 voidSovereign:3:3:0:40:926:0 voidSovereign:3:3:0:40:880:1000 nightmare:2:3:0:40:926:0 rimeclaw:3:3:0:40:1000:0 titanLich:3:3:0:40:820:1000 voidSovereign:3:3:1:40:978:0' },
];

export function parse(save) {
  const equip = {};
  for (const p of save.e.split(' ')) {
    const [slot, type, set, bonus, rarity, level, up] = p.split(':');
    equip[slot] = slot === 'weapon'
      ? { kind: 'weapon', type, rarity: +rarity, level: +level, up: +up }
      : { kind: 'armor', type, set, bonus, rarity: +rarity, level: +level, up: +up };
  }
  const units = save.u.split(' ').map((p) => {
    const [type, tier, stage, rank, level, plv, olv] = p.split(':');
    return { type, tier: +tier, stage: +stage, rank: +rank, level: +level, plv: +plv, olv: +olv };
  });
  return { ...save, equip, units };
}

// the hunter's single target damage per second (same maths as Player.recalc)
export function hunterOf(sv, cfg = CONFIG) {
  const b = { hp: 0, damage: 0, crit: 0, reload: 0, skillDamage: 0, armyDamage: 0, armyHp: 0 };
  const sets = {};
  for (const slot of ['helmet', 'chest', 'gloves', 'boots']) {
    const it = sv.equip[slot];
    if (!it) continue;
    b[it.bonus] = (b[it.bonus] || 0) + armorBonus(it);
    sets[it.set] = (sets[it.set] || 0) + 1;
  }
  for (const set in sets) for (const need in cfg.items.sets[set]) if (sets[set] >= +need) for (const k in cfg.items.sets[set][need]) b[k] = (b[k] || 0) + cfg.items.sets[set][need][k];
  const M = cfg.mastery.perPoint, ms = sv.ms || {};
  const st = sv.s, w = sv.equip.weapon;
  const damageMult = playerPower(sv.lvl) * (1 + S.str.damage * st.str) * (1 + b.damage) * (1 + M.damage * (ms.damage || 0));
  const crit = Math.min(G.critMax, G.baseCrit + st.per * S.per.crit + b.crit + M.crit * (ms.crit || 0));
  const critAvg = 1 + crit * (G.critDamage + st.per * S.per.critDamage - 1);
  const reload = cfg.weapons[w.type].reload / (1 + st.agi * S.agi.reload + b.reload);
  const basic = (weaponDamage(w) * damageMult * critAvg) / reload;
  let pps = 0, mps = 0;
  for (const id of SKILLS) { const s = cfg.skills[id]; pps += s.power / s.cooldown; mps += s.mana / s.cooldown; }
  const regen = cfg.player.manaRegen + st.int * S.int.manaRegen;
  const skill = skillDamage(w) * damageMult * (1 + b.skillDamage) * critAvg * pps * Math.min(1, regen / mps);
  const armyDamage = b.armyDamage + M.armyDamage * (ms.armyDamage || 0);
  return { dps: basic + skill, basic, skill, armyDamage, damageMult, monarch: skillDamage(w) * damageMult };
}

// one shadow's damage per hit (same maths as Army.recalc); monarch = the
// hunter's monarchPower(), hunterLevel = his level
export function shadowDmg(u, monarch, hunterLevel, cfg = CONFIG) {
  const def = cfg.enemies.types[u.type];
  const role = cfg.shadows.roles[def.shadowRole];
  const rk = cfg.shadows.ranks[u.rank];
  const tier = cfg.shadows.tierFactor[u.tier] * (1 + u.stage * cfg.shadows.evolveBonus) * rk.mult;
  const plv = rk.officer ? Math.max(u.plv, u.olv || 0) : u.plv;
  const Mo = cfg.shadows.monarch;
  const fresh = Math.min(Mo.freshMax, Math.max(Mo.freshMin, Math.pow(enemyPower(plv) / enemyPower(hunterLevel), Mo.freshPower)));
  return { dmg: monarch * Mo.share * role.damage * tier * (1 + Mo.levelBonus * (u.level - 1)) * fresh, role: def.shadowRole };
}

export function armyDpsOf(sv, h, cfg = CONFIG) {
  let dps = 0;
  for (const u of sv.units) {
    const { dmg, role } = shadowDmg(u, h.monarch, sv.lvl, cfg);
    const R = cfg.shadows.roles[role];
    const share = role === 'healer' ? 0.5 : 1; // healers shoot only when nobody needs healing
    dps += (dmg * share) / (R.cooldown + R.windup);
  }
  return dps * (1 + h.armyDamage);
}

if ((process.argv[1] || '').replace(/\\/g, '/').endsWith('tools/real-saves.mjs')) {
  console.log('level | hunter dps  army dps  hunter share | shadows');
  for (const raw of SAVES) {
    const sv = parse(raw);
    const h = hunterOf(sv);
    const a = armyDpsOf(sv, h);
    console.log(`${String(sv.lvl).padStart(5)} | ${h.dps.toExponential(2)}  ${a.toExponential(2)}  ${Math.round((h.dps / (h.dps + a)) * 100)} % | ${sv.units.length}`);
  }
}
