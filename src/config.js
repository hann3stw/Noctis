// ---------------------------------------------------------------------------
// NOCTIS – all balancing values live in this file.
// Distances are world units (the player is ~2 units tall), times are seconds.
// ---------------------------------------------------------------------------

export const CONFIG = {
  world: {
    campRadius: 20, // safe zone around the world centre
    chunkSize: 32, // decoration is streamed in square chunks of this size
    decorLoadRadius: 64, // decoration chunks are kept loaded within this distance
    voidWidth: 70, // dark ground beyond the last zone
    groundTile: 120, // the ground is drawn in square tiles of this size
    groundCell: 8, // colour resolution of the ground
    // Ring shaped zones from the camp outwards. Every zone is a big step up:
    //   level      item level of drops (and the level you should have there)
    //   gateLevel  recommended level for the gate boss
    //   hp, dmg, xp  multipliers for every enemy of the zone: x10 per rank, so
    //              enemies two ranks above you kill you with one hit, and
    //              they give 10x the XP
    //   power      health and damage of shadows raised there
    //   packs, champions, chests  how many of each the zone gets
    //   decor      average decoration pieces per chunk
    //   light      sky, ground and sun colour while the player is in the zone
    zones: [
      {
        id: 'meadow', rank: 'E', level: 1, gateLevel: 7, inner: 20, outer: 280,
        hp: 1, dmg: 1, xp: 1, power: 1, packs: 80, champions: 6, chests: 22,
        groundColors: [0x3c7a3a, 0x4a8c42, 0x58963c],
        decor: { grass: 34, flower: 9, bush: 3, rock: 1.6, tree: 2.2 },
        enemyTypes: ['gloomfang', 'thornspitter', 'tuskboar'],
        boss: 'thornmaw', gateColor: 0x8a4dff,
        light: { sky: 0xb9c4ff, ground: 0x2a2238, sun: 0xfff0d8, sky_i: 1.5 },
      },
      {
        id: 'forest', rank: 'D', level: 9, gateLevel: 15, inner: 280, outer: 520,
        hp: 10, dmg: 10, xp: 10, power: 10, packs: 170, champions: 10, chests: 36,
        groundColors: [0x2c5e2e, 0x356a32, 0x2a5428],
        decor: { grass: 16, fern: 9, mushroom: 2, bush: 3, rock: 1.2, tree: 3, pine: 6 },
        enemyTypes: ['mossback', 'hollowArcher', 'antlerstag'],
        boss: 'barkhide', gateColor: 0x40e080,
        light: { sky: 0xa8d0b0, ground: 0x1e2a1e, sun: 0xf0f0c8, sky_i: 1.35 },
      },
      {
        id: 'swamp', rank: 'C', level: 17, gateLevel: 23, inner: 520, outer: 760,
        hp: 100, dmg: 100, xp: 100, power: 100, packs: 240, champions: 13, chests: 48,
        groundColors: [0x3e4a2c, 0x46512e, 0x35402a, 0x4a4630],
        decor: { reed: 16, puddle: 3, deadTree: 2.5, glowShroom: 3, bush: 1.5, rock: 0.8 },
        enemyTypes: ['bogshambler', 'sporemother', 'mirecrawler'],
        boss: 'mireMatriarch', gateColor: 0x9ad040,
        light: { sky: 0xa0b890, ground: 0x24281a, sun: 0xd8e0b0, sky_i: 1.25 },
      },
      {
        id: 'ruins', rank: 'B', level: 25, gateLevel: 31, inner: 760, outer: 1000,
        hp: 1000, dmg: 1000, xp: 1000, power: 1000, packs: 300, champions: 15, chests: 56,
        groundColors: [0x8a7d62, 0x7c7058, 0x948468],
        decor: { dryGrass: 18, rubble: 5, pillar: 1.6, wall: 1.1, rock: 1.2, deadTree: 0.8 },
        enemyTypes: ['sentinel', 'acolyte', 'ruinhound'],
        boss: 'hollowKing', gateColor: 0xffc030,
        light: { sky: 0xffd8b0, ground: 0x3a2a24, sun: 0xffc890, sky_i: 1.4 },
      },
      {
        id: 'ice', rank: 'A', level: 33, gateLevel: 39, inner: 1000, outer: 1240,
        hp: 10000, dmg: 10000, xp: 10000, power: 10000, packs: 350, champions: 17, chests: 64,
        groundColors: [0xd8e4ee, 0xc4d6e6, 0xe6eef6],
        decor: { snowMound: 6, snowPine: 4, crystal: 2, iceRock: 1.6 },
        enemyTypes: ['frostTroll', 'iceWisp', 'snowram'],
        boss: 'rimeclaw', gateColor: 0x30d0ff,
        light: { sky: 0xc8e0ff, ground: 0x506070, sun: 0xffffff, sky_i: 1.1 },
      },
      {
        id: 'volcano', rank: 'S', level: 41, gateLevel: 47, inner: 1240, outer: 1480,
        hp: 100000, dmg: 100000, xp: 100000, power: 100000, packs: 400, champions: 19, chests: 70,
        groundColors: [0x463634, 0x523c34, 0x3c302e, 0x5c4034],
        decor: { ash: 8, basalt: 2.2, lavaPool: 1.6, charredTree: 1.8, emberCrystal: 1.2 },
        enemyTypes: ['magmaBrute', 'emberImp', 'cinderhound'],
        boss: 'pyrelord', gateColor: 0xff4050,
        light: { sky: 0xffa880, ground: 0x402018, sun: 0xffb890, sky_i: 1.6 },
      },
    ],
  },

  // Safe outposts: 4 per zone (north, east, south, west), half way through the
  // ring. Like the camp: no enemies, healing, equipment can be changed. The last
  // one visited is where you come back after dying; you can travel between
  // the ones you have found.
  // Outposts start in enemy hands: a guard pack (one elite + guards) holds
  // each one. Stand in the circle with no enemy inside for captureTime
  // seconds to take it; then its chest opens.
  outposts: {
    radius: 10,
    captureTime: 12,
    guards: 5, // enemies guarding an outpost (the first one is an elite)
    chestItems: 3,
    chestMinRarity: 1, // at least rare
  },

  camera: {
    fov: 38,
    height: 24,
    back: 17,
    followSpeed: 9, // higher = camera sticks closer to the player
  },

  player: {
    radius: 0.6,
    baseHp: 100,
    baseSpeed: 7.5,
    baseMana: 100,
    manaRegen: 3, // mana per second, everywhere
    campManaRegenPerSec: 25, // extra mana per second inside the camp
    campRegen: 0.15, // share of max health per second inside the camp or an outpost
    respawnDelay: 2.5,
    hurtInvuln: 0.0, // extra invulnerability after being hit
    startWeapon: 'sword',
    charges: {
      max: 3, // the reload time per charge comes from the weapon
    },
    startSkills: ['shadowWave'], // skills known at the start (slot 1, slot 2)
    startUltimate: 'nightfall',
    dodge: {
      distance: 6.5,
      duration: 0.2,
      invuln: 0.38,
      cooldown: 2.5,
    },
    autoAimExtraRange: 3, // quick tap targets enemies up to weapon range + this
  },

  combat: {
    damageVariance: 0.12, // +-12 %
    knockback: 0.9, // units an enemy is pushed per hit
  },

  // ---- levels and stat points ---------------------------------------------
  progression: {
    // Every level makes the hunter x levelGrowth stronger (health and damage):
    // 8 levels per zone = x10, the same step as the enemies of the next rank.
    levelGrowth: 1.334,
    // XP for the next level = xpBase * xpGrowth ^ (level - 1). Enemies one rank
    // higher give 10x the XP, so fighting above your rank levels you fast.
    xpBase: 120,
    xpGrowth: 1.334,
    maxLevel: 60,
    pointsPerLevel: 3,
    rankPoints: [0, 10, 12, 15, 18, 20], // stat points for reaching rank D, C, B, A, S
    // What one stat point does. The stats decide the play style:
    //   Strength      hard hitting hunter
    //   Agility       fast, quick reloads and dodges
    //   Vitality      tough, regenerates health
    //   Intelligence  big army, lots of mana, better chance to raise shadows
    //   Perception    critical hits and loot
    stats: {
      str: { damage: 0.04 }, // x1.04 damage per point (multiplies: 20 points = x2.2)
      agi: { speed: 0.008, reload: 0.015, dodge: 0.01 }, // +0.8 % speed, 1.5 % faster reload, 1 % shorter dodge cooldown
      vit: { hp: 0.04, regen: 0.0005 }, // x1.04 health per point (multiplies), regenerates 0.05 % of max health per second
      int: { mana: 8, manaRegen: 0.2, slots: 0.5, arise: 0.004 }, // +1 army slot per 2 points, +0.4 % arise chance
      per: { crit: 0.008, critDamage: 0.015, drop: 0.02 }, // +0.8 % crit, +1.5 % crit damage, +2 % drops
    },
    baseCrit: 0.05,
    critDamage: 1.8,
    defenseK: 90, // damage taken = K / (K + defence); K grows with the zone level like armour does
    ultCharge: { perHit: 3, max: 100 }, // every enemy hit charges the ultimate
    dismissXpShare: 0.5, // share of a dismissed shadow's XP that goes to the player
  },

  // cooldown = minimum time between two attacks, reload = seconds per charge
  weapons: {
    daggers: { shape: 'arc', damage: 10, range: 3.2, arcDeg: 80, cooldown: 0.12, reload: 0.6 },
    sword: { shape: 'arc', damage: 22, range: 4.6, arcDeg: 110, cooldown: 0.3, reload: 1.3 },
    bow: { shape: 'line', damage: 34, range: 17, width: 0.7, speed: 40, cooldown: 0.35, reload: 1.5 },
    scythe: { shape: 'circle', damage: 19, range: 4.4, cooldown: 0.4, reload: 1.5 },
    staff: { shape: 'blast', damage: 26, range: 11, radius: 3, delay: 0.35, cooldown: 0.4, reload: 1.7 },
  },

  // ---- items ----------------------------------------------------------------
  items: {
    rarityWeights: [62, 27, 9, 2], // common, rare, epic, legendary
    // Rarity counts much more than the item level: a rarer item is nearly
    // always better than a more common one from the next zone.
    rarityStat: [1, 2, 4, 8], // stat factor per rarity
    levelGrowth: 1.03, // damage and defence x1.03 per item level (x1.27 per zone)
    upgradeBonus: 0.1, // +10 % stats per upgrade
    maxUpgrade: 5,
    upgradeCost: [2, 4, 8, 16], // essence per rarity, times (upgrade + 1)
    dismantle: [1, 3, 8, 20], // essence per rarity
    inventorySize: 60,
    armor: { helmet: { defense: 5 }, chest: { defense: 9 }, gloves: { defense: 4 }, boots: { defense: 4 } },
    // one bonus per armour piece, value times the rarity factor
    bonuses: { hp: 0.05, speed: 0.025, mana: 0.06, crit: 0.02, reload: 0.04 }, // all as shares (0.05 = +5 %)
    sets: {
      stalker: { 2: { crit: 0.08 }, 4: { damage: 0.2 } },
      bulwark: { 2: { hp: 0.15 }, 4: { damageTaken: -0.15 } },
      gravecaller: { 2: { armyDamage: 0.15 }, 4: { armyHp: 0.25, armySlots: 2 } },
    },
  },

  loot: {
    dropChance: [0.05, 1, 1, 1], // normal enemy, elite, champion, boss
    weights: { weapon: 30, armor: 50, skill: 20 },
    pickupRange: 1.8,
    chest: { items: [1, 2], respawn: 180, openRange: 2.4 }, // count per zone: see zones
  },

  // ---- skills ---------------------------------------------------------------
  // power = damage as a multiple of the weapon damage. aim: arc | line | point | self
  skills: {
    shadowStep: { mana: 15, cooldown: 5, aim: 'point', range: 10, radius: 3, power: 1.2 },
    shadowWave: { mana: 20, cooldown: 6, aim: 'arc', range: 9, arcDeg: 70, power: 2.4 },
    rulersGrasp: { mana: 25, cooldown: 10, aim: 'point', range: 11, radius: 6, power: 0.8, stun: 1.4 },
    umbralShield: { mana: 20, cooldown: 14, aim: 'self', radius: 2, shield: 0.4, duration: 6 },
    daggerRain: { mana: 25, cooldown: 9, aim: 'point', range: 11, radius: 4, power: 0.7, ticks: 5, interval: 0.3 },
    warCry: { mana: 30, cooldown: 20, aim: 'self', radius: 12, armyDamage: 0.4, duration: 8 },
    lifeLeech: { mana: 20, cooldown: 8, aim: 'arc', range: 6, arcDeg: 120, power: 1.5, heal: 0.5 },
    nightLance: { mana: 18, cooldown: 5, aim: 'line', range: 18, width: 1.4, power: 3 },
  },

  ultimates: {
    nightfall: { aim: 'self', radius: 10, power: 7, stun: 2 },
    legionsCall: { aim: 'self', radius: 12, armyDamage: 0.6, duration: 12 }, // also revives every fallen shadow
    eclipse: { aim: 'self', radius: 3, duration: 8, damage: 1 }, // +100 % damage, attacks cost no charges
  },

  // behavior: melee (bites up close), ranged (keeps distance and shoots),
  // charger (telegraphs, then rams in a straight line). shadowRole decides what
  // the enemy becomes when it rises as a shadow. Stats are for the meadow and
  // are multiplied by the zone values (hp, dmg, xp) and the tier values.
  enemies: {
    packSize: [3, 6],
    packSpacing: 22, // minimum distance between two pack centres
    roamRadius: 5,
    leash: 38, // enemies give up when this far from their pack centre
    targetRange: 16, // enemies look for shadows to attack within this distance
    eliteChance: 0.14, // chance that a pack is led by an elite
    // normal, elite, champion, boss
    tiers: [
      { hp: 1, dmg: 1, scale: 1, xp: 1 },
      { hp: 4, dmg: 1.5, scale: 1.3, xp: 5 },
      { hp: 10, dmg: 2, scale: 1.6, xp: 14 },
      { hp: 1, dmg: 1, scale: 1, xp: 1 }, // bosses: their own base stats
    ],
    types: {
      // ---- meadow
      gloomfang: { behavior: 'melee', shadowRole: 'melee', xp: 10, hp: 46, damage: 6, speed: 5.4, radius: 0.75, scale: 1, aggroRange: 11, attackRange: 1.9, attackWindup: 0.45, attackCooldown: 1.3 },
      thornspitter: { behavior: 'ranged', shadowRole: 'ranged', xp: 10, hp: 32, damage: 5, speed: 3.4, radius: 0.7, scale: 1, aggroRange: 13, attackRange: 10, attackWindup: 0.6, attackCooldown: 2.2, shotSpeed: 14, shotColor: 0x9ad040 },
      tuskboar: { behavior: 'charger', shadowRole: 'melee', xp: 12, hp: 60, damage: 9, speed: 4.2, radius: 0.85, scale: 1, aggroRange: 12, attackRange: 1.9, attackWindup: 0.75, attackCooldown: 3.2, chargeRange: 12, chargeSpeed: 20, chargeTime: 0.65 },
      // ---- forest
      mossback: { behavior: 'melee', shadowRole: 'tank', xp: 12, hp: 70, damage: 8, speed: 4.4, radius: 0.95, scale: 1.1, aggroRange: 11, attackRange: 2.1, attackWindup: 0.55, attackCooldown: 1.6 },
      hollowArcher: { behavior: 'ranged', shadowRole: 'ranged', xp: 11, hp: 36, damage: 7, speed: 4, radius: 0.6, scale: 1, aggroRange: 15, attackRange: 13, attackWindup: 0.55, attackCooldown: 2, shotSpeed: 20, shotColor: 0xd8f0a0 },
      antlerstag: { behavior: 'charger', shadowRole: 'melee', xp: 12, hp: 52, damage: 10, speed: 5, radius: 0.85, scale: 1.05, aggroRange: 13, attackRange: 2, attackWindup: 0.7, attackCooldown: 3, chargeRange: 13, chargeSpeed: 22, chargeTime: 0.6 },
      // ---- swamp
      bogshambler: { behavior: 'melee', shadowRole: 'tank', xp: 12, hp: 80, damage: 8, speed: 3.6, radius: 0.95, scale: 1.1, aggroRange: 10, attackRange: 2.1, attackWindup: 0.6, attackCooldown: 1.7 },
      sporemother: { behavior: 'ranged', shadowRole: 'healer', xp: 12, hp: 40, damage: 6, speed: 3, radius: 0.8, scale: 1, aggroRange: 13, attackRange: 11, attackWindup: 0.7, attackCooldown: 2.4, shotSpeed: 12, shotColor: 0xd070ff },
      mirecrawler: { behavior: 'charger', shadowRole: 'melee', xp: 12, hp: 50, damage: 9, speed: 4.6, radius: 0.8, scale: 1, aggroRange: 12, attackRange: 1.9, attackWindup: 0.65, attackCooldown: 2.8, chargeRange: 11, chargeSpeed: 21, chargeTime: 0.6 },
      // ---- ruins
      sentinel: { behavior: 'melee', shadowRole: 'tank', xp: 13, hp: 85, damage: 9, speed: 3.8, radius: 0.9, scale: 1.1, aggroRange: 10, attackRange: 2.2, attackWindup: 0.6, attackCooldown: 1.7 },
      acolyte: { behavior: 'ranged', shadowRole: 'healer', xp: 12, hp: 38, damage: 7, speed: 4, radius: 0.6, scale: 1, aggroRange: 14, attackRange: 12, attackWindup: 0.6, attackCooldown: 2.1, shotSpeed: 15, shotColor: 0xffc030 },
      ruinhound: { behavior: 'charger', shadowRole: 'melee', xp: 12, hp: 50, damage: 10, speed: 5.4, radius: 0.8, scale: 1, aggroRange: 13, attackRange: 1.9, attackWindup: 0.6, attackCooldown: 2.8, chargeRange: 13, chargeSpeed: 24, chargeTime: 0.55 },
      // ---- ice
      frostTroll: { behavior: 'melee', shadowRole: 'tank', xp: 14, hp: 90, damage: 10, speed: 3.8, radius: 1, scale: 1.15, aggroRange: 10, attackRange: 2.3, attackWindup: 0.65, attackCooldown: 1.8 },
      iceWisp: { behavior: 'ranged', shadowRole: 'ranged', xp: 12, hp: 34, damage: 8, speed: 4.6, radius: 0.6, scale: 1, aggroRange: 15, attackRange: 13, attackWindup: 0.5, attackCooldown: 1.9, shotSpeed: 18, shotColor: 0x80e0ff },
      snowram: { behavior: 'charger', shadowRole: 'melee', xp: 13, hp: 58, damage: 11, speed: 4.8, radius: 0.85, scale: 1.05, aggroRange: 13, attackRange: 2, attackWindup: 0.7, attackCooldown: 3, chargeRange: 13, chargeSpeed: 23, chargeTime: 0.6 },
      // ---- volcano
      magmaBrute: { behavior: 'melee', shadowRole: 'tank', xp: 15, hp: 95, damage: 11, speed: 3.9, radius: 1, scale: 1.15, aggroRange: 10, attackRange: 2.3, attackWindup: 0.6, attackCooldown: 1.7 },
      emberImp: { behavior: 'ranged', shadowRole: 'ranged', xp: 13, hp: 36, damage: 8, speed: 5, radius: 0.55, scale: 1, aggroRange: 15, attackRange: 12, attackWindup: 0.45, attackCooldown: 1.7, shotSpeed: 19, shotColor: 0xff7020 },
      cinderhound: { behavior: 'charger', shadowRole: 'melee', xp: 13, hp: 52, damage: 12, speed: 5.6, radius: 0.8, scale: 1, aggroRange: 14, attackRange: 1.9, attackWindup: 0.55, attackCooldown: 2.6, chargeRange: 14, chargeSpeed: 25, chargeTime: 0.55 },

      // ---- gate bosses (meadow values, multiplied by their zone like everything else)
      // patterns: see bossPatterns. shadowBase = stats of the boss as a shadow.
      thornmaw: { boss: true, behavior: 'boss', shadowRole: 'melee', xp: 200, hp: 900, damage: 12, speed: 4.6, radius: 1.8, scale: 2.4, aggroRange: 40, attackRange: 3.4, attackWindup: 0.6, attackCooldown: 1.4, patterns: ['slam', 'charge', 'summon'], adds: 'gloomfang', shadowBase: { hp: 90, damage: 11 } },
      barkhide: { boss: true, behavior: 'boss', shadowRole: 'tank', xp: 200, hp: 1000, damage: 12, speed: 3.6, radius: 2, scale: 2.2, aggroRange: 40, attackRange: 3.6, attackWindup: 0.7, attackCooldown: 1.6, patterns: ['slam', 'eruption', 'summon'], adds: 'mossback', shadowBase: { hp: 130, damage: 13 } },
      mireMatriarch: { boss: true, behavior: 'boss', shadowRole: 'healer', xp: 200, hp: 950, damage: 11, speed: 3, radius: 2, scale: 2.4, aggroRange: 40, attackRange: 3.4, attackWindup: 0.7, attackCooldown: 1.6, patterns: ['nova', 'eruption', 'summon'], adds: 'mirecrawler', shadowBase: { hp: 110, damage: 10 } },
      hollowKing: { boss: true, behavior: 'boss', shadowRole: 'melee', xp: 200, hp: 1000, damage: 13, speed: 4.2, radius: 1.8, scale: 2.3, aggroRange: 40, attackRange: 3.6, attackWindup: 0.6, attackCooldown: 1.4, patterns: ['charge', 'slam', 'volley'], adds: 'sentinel', shadowBase: { hp: 140, damage: 16 } },
      rimeclaw: { boss: true, behavior: 'boss', shadowRole: 'tank', xp: 200, hp: 1100, damage: 13, speed: 4, radius: 2, scale: 2.4, aggroRange: 40, attackRange: 3.8, attackWindup: 0.65, attackCooldown: 1.5, patterns: ['nova', 'slam', 'charge'], adds: 'snowram', shadowBase: { hp: 170, damage: 15 } },
      pyrelord: { boss: true, behavior: 'boss', shadowRole: 'ranged', xp: 200, hp: 1200, damage: 14, speed: 3.8, radius: 1.9, scale: 2.5, aggroRange: 40, attackRange: 3.6, attackWindup: 0.6, attackCooldown: 1.4, patterns: ['eruption', 'nova', 'volley', 'summon'], adds: 'emberImp', shadowBase: { hp: 150, damage: 20 } },
    },
  },

  // Boss attacks. damage = multiple of the boss damage.
  bossPatterns: {
    slam: { windup: 1, radius: 5.5, damage: 1.6 },
    charge: { windup: 0.8, speed: 26, time: 0.7, damage: 1.4 },
    nova: { windup: 0.8, shots: 16, speed: 12, damage: 0.8 },
    volley: { windup: 0.6, shots: 5, spreadDeg: 40, speed: 18, damage: 0.9 },
    eruption: { windup: 1.1, count: 5, radius: 3, spread: 9, damage: 1.3 },
    summon: { count: 3, maxAdds: 6 },
  },
  boss: {
    pause: 1.4, // seconds between two attacks
    enrageAt: 0.5, // below this share of health the boss gets faster
    enrageSpeed: 1.35,
    shotRadius: 0.5,
  },

  gates: {
    enterRange: 4, // the Enter button appears within this distance
    arenaRadius: 26,
    rewardItems: 3, // loot of a gate boss
    rewardMinRarity: 2, // at least epic
    exitRange: 3,
  },

  minimap: {
    localRadius: 110, // world units shown around the player (tap to see the whole world)
    refresh: 0.1, // seconds between two redraws
  },

  // ---- shadow army --------------------------------------------------------
  souls: {
    duration: 9, // seconds a soul stays after an enemy dies (elites and bosses: longer)
    tierDuration: 6, // extra seconds per tier
    ariseRange: 6.5, // the Arise button appears within this distance
  },

  arise: {
    cost: [10, 25, 45, 80], // mana per try: normal, elite, champion, boss
    // Chance that a try works. Every soul allows a few tries, then it fades.
    // enemy level = zone level + tierLevel. Enemies below your level always
    // rise. Otherwise: chance[tier] * levelFalloff ^ (enemy level - your level),
    // so the level difference matters most (one rank = 8 levels above you).
    chance: [0.9, 0.8, 0.7, 0.6], // at the same level: normal, elite, champion, boss
    tierLevel: [0, 2, 4, 6],
    levelFalloff: 0.72, // per level above you (8 levels: x0.07)
    minChance: 0.01,
    tries: 3,
  },

  shadows: {
    baseSlots: 5, // army slots without Intelligence (each point adds progression.stats.int.slots)
    maxSlots: 40,
    summonCooldown: 2, // seconds between summoning and recalling the army
    tierFactor: [1, 1.8, 2.6, 4], // stat factor: normal, elite, champion, boss

    hpFactor: 1.4, // shadow stats relative to the enemy it was raised from
    damageFactor: 1.5,
    scale: 0.95,
    followSpeed: 10.5,
    combatSpeedFactor: 1.25, // relative to the enemy's own speed
    teleportDist: 30, // shadows this far from the player are pulled back

    attackRange: 24, // "Attack": hunts enemies this far around the player
    guardRange: 9, // "Protect": only fights enemies this close to the player

    riseTime: 0.8,
    campRegen: 0.25, // share of max health per second inside the camp
    formation: { firstRadius: 2.8, ringGap: 1.8, firstCount: 6, countStep: 4 },

    xpShare: 0.3, // share of the kill XP for shadows that did not land the kill
    // XP for the next level = xpBase * power of its zone * xpGrowth ^ (level - 1)
    xpBase: 40,
    xpGrowth: 1.12,
    maxLevel: 40,
    levelGrowth: 1.06, // health and damage per shadow level (x10 at level 40)
    evolveLevels: [5, 12, 22], // shadows evolve at these levels
    evolveScale: 0.18, // size gain per evolution
    evolveBonus: 0.25, // stat gain per evolution

    revive: { cooldown: 12, cooldownPerLevel: 1, cost: 6, costPerLevel: 2 },

    // Elite, champion and boss shadows get an ability of their role.
    // power grows with the tier: x (1 + tierPower * (tier - 1)).
    tierPower: 0.5,
    abilities: {
      tank: { name: 'taunt', cooldown: 9, radius: 9, duration: 3, reduction: 0.5 },
      melee: { name: 'cleave', cooldown: 6, radius: 3.5, power: 2.5 },
      ranged: { name: 'volley', cooldown: 7, shots: 5, power: 1.2 },
      healer: { name: 'mend', cooldown: 10, radius: 10, heal: 0.25 },
    },

    roles: {
      tank: { hp: 2.2, damage: 0.7, range: 1.9, windup: 0.35, cooldown: 1.4, threat: 2.5 },
      melee: { hp: 1.0, damage: 1.0, range: 1.9, windup: 0.3, cooldown: 1.1, threat: 1 },
      ranged: { hp: 0.7, damage: 0.9, range: 11, windup: 0.35, cooldown: 1.5, threat: 0.8, projectileSpeed: 22 },
      // healers do not attack; heal = health restored per cast
      healer: { hp: 0.8, damage: 0, range: 9, windup: 0, cooldown: 2.5, threat: 0.6, heal: 0.1 }, // heal = share of the target's max health
    },
  },

  sim: {
    maxEnemies: 9000,
    maxPacks: 1800,
    activeRadius: 55, // enemies further away are not simulated
    respawnTime: 40,
    respawnMinPlayerDist: 45, // packs only respawn when the player is away
  },

  input: {
    moveDeadzone: 0.14,
    aimDeadzone: 0.28, // attack stick must be dragged this far to aim
  },

  // pixelRatio = upper limit of the render resolution, particles = share of
  // effect particles, decorRadius = view distance of plants and rocks,
  // renderRadius = enemies and shadows further away are not drawn
  graphics: {
    presets: {
      low: { pixelRatio: 1, particles: 0.4, decorRadius: 44, renderRadius: 30 },
      medium: { pixelRatio: 1.25, particles: 0.7, decorRadius: 56, renderRadius: 34 },
      high: { pixelRatio: 1.75, particles: 1, decorRadius: 64, renderRadius: 38 },
    },
  },

  save: {
    autosaveInterval: 60, // seconds of play between two autosaves
    nameMaxLength: 18,
  },

  // Fixed colour palettes of the skin editor (tap to pick).
  palettes: {
    skin: [0xf6d5b8, 0xe2b48c, 0xc99668, 0xa8744a, 0x7c5232, 0x553620, 0xd8c6e8, 0x9fb8c8],
    hair: [0x1b1b26, 0x4a3020, 0x8a5a2b, 0xd8b058, 0xe8e0d0, 0xb03030, 0x3a5ad8, 0x7a3ad8, 0x2aa878, 0xe070b0],
    eyes: [0x9f6bff, 0x4aa3ff, 0x30e8ff, 0x50ff90, 0xffd24a, 0xff5050, 0xff60d0, 0xffffff],
    clothes: [0x23233a, 0x101014, 0x3a2a5a, 0x1e3a5a, 0x1e4a3a, 0x5a2020, 0x6a5a40, 0x8a8a9a, 0xd8d8e0, 0x4a1e4a],
    cape: [0x34205c, 0x101014, 0x5a1020, 0x1e2e6a, 0x1e5a3a, 0xa87a20, 0xe0e0e8, 0x6a2a8a, 0x2a5a8a, 0x8a2a5a],
    aura: [0x8a4dff, 0x4a7bff, 0x30d0ff, 0x40e080, 0xffc030, 0xff4050, 0xff50c0, 0xe8e8ff],
  },
  hairStyles: 6,

  defaultAppearance: {
    skin: 0xe2b48c,
    hair: 0x1b1b26,
    hairStyle: 0,
    eyes: 0x9f6bff,
    clothes: 0x23233a,
    cape: true,
    capeColor: 0x34205c,
    aura: 0x8a4dff,
  },
};
