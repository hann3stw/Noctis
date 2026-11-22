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
    // Ring shaped zones from the camp outwards, one per rank (E, D, C, B, A, S,
    // SS, SSS, L, M). New zones are only ever added at the outside, so the
    // places of old ones (and the outposts and gates of saved worlds) stay.
    // Their levels come from levels.rankLevels (see below).
    //   packs, champions, chests  how many of each the zone gets
    //   decor      average decoration pieces per chunk
    //   light      sky, ground and sun colour while the player is in the zone
    zones: [
      {
        id: 'meadow', rank: 'E', inner: 20, outer: 280,
        packs: 80, champions: 6, chests: 22,
        groundColors: [0x3c7a3a, 0x4a8c42, 0x58963c],
        decor: { grass: 34, flower: 9, bush: 3, rock: 1.6, tree: 2.2 },
        enemyTypes: ['gloomfang', 'thornspitter', 'tuskboar'],
        boss: 'thornmaw', gateColor: 0x8a4dff,
        light: { sky: 0xb9c4ff, ground: 0x2a2238, sun: 0xfff0d8, sky_i: 1.5 },
      },
      {
        id: 'forest', rank: 'D', inner: 280, outer: 520,
        packs: 170, champions: 10, chests: 36,
        groundColors: [0x2c5e2e, 0x356a32, 0x2a5428],
        decor: { grass: 16, fern: 9, mushroom: 2, bush: 3, rock: 1.2, tree: 3, pine: 6 },
        enemyTypes: ['mossback', 'hollowArcher', 'antlerstag'],
        boss: 'barkhide', gateColor: 0x40e080,
        light: { sky: 0xa8d0b0, ground: 0x1e2a1e, sun: 0xf0f0c8, sky_i: 1.35 },
      },
      {
        id: 'swamp', rank: 'C', inner: 520, outer: 760,
        packs: 240, champions: 13, chests: 48,
        groundColors: [0x3e4a2c, 0x46512e, 0x35402a, 0x4a4630],
        decor: { reed: 16, puddle: 3, deadTree: 2.5, glowShroom: 3, bush: 1.5, rock: 0.8 },
        enemyTypes: ['bogshambler', 'sporemother', 'mirecrawler'],
        boss: 'mireMatriarch', gateColor: 0x9ad040,
        light: { sky: 0xa0b890, ground: 0x24281a, sun: 0xd8e0b0, sky_i: 1.25 },
      },
      {
        id: 'ruins', rank: 'B', inner: 760, outer: 1000,
        packs: 300, champions: 15, chests: 56,
        groundColors: [0x8a7d62, 0x7c7058, 0x948468],
        decor: { dryGrass: 18, rubble: 5, pillar: 1.6, wall: 1.1, rock: 1.2, deadTree: 0.8 },
        enemyTypes: ['sentinel', 'acolyte', 'ruinhound'],
        boss: 'hollowKing', gateColor: 0xffc030,
        light: { sky: 0xffd8b0, ground: 0x3a2a24, sun: 0xffc890, sky_i: 1.4 },
      },
      {
        id: 'ice', rank: 'A', inner: 1000, outer: 1240,
        packs: 350, champions: 17, chests: 64,
        groundColors: [0xd8e4ee, 0xc4d6e6, 0xe6eef6],
        decor: { snowMound: 6, snowPine: 4, crystal: 2, iceRock: 1.6 },
        enemyTypes: ['frostTroll', 'iceWisp', 'snowram'],
        boss: 'rimeclaw', gateColor: 0x30d0ff,
        light: { sky: 0xc8e0ff, ground: 0x506070, sun: 0xffffff, sky_i: 1.1 },
      },
      {
        id: 'volcano', rank: 'S', inner: 1240, outer: 1480,
        packs: 400, champions: 19, chests: 70,
        groundColors: [0x463634, 0x523c34, 0x3c302e, 0x5c4034],
        decor: { ash: 8, basalt: 2.2, lavaPool: 1.6, charredTree: 1.8, emberCrystal: 1.2 },
        enemyTypes: ['magmaBrute', 'emberImp', 'cinderhound'],
        boss: 'pyrelord', gateColor: 0xff4050,
        light: { sky: 0xffa880, ground: 0x402018, sun: 0xffb890, sky_i: 1.6 },
      },
      {
        id: 'shardwaste', rank: 'SS', inner: 1480, outer: 1720,
        packs: 420, champions: 20, chests: 72,
        groundColors: [0x6a5a7c, 0x5e5070, 0x786888],
        decor: { crystalTuft: 10, shardCrystal: 2, rock: 1, rubble: 3 },
        enemyTypes: ['shardGolem', 'prismWisp', 'glassStalker'],
        boss: 'crystalTyrant', gateColor: 0xd080ff,
        light: { sky: 0xe0c8ff, ground: 0x3a2a48, sun: 0xffe8ff, sky_i: 1.4 },
      },
      {
        id: 'stormspire', rank: 'SSS', inner: 1720, outer: 1960,
        packs: 440, champions: 21, chests: 74,
        groundColors: [0x4a5464, 0x424c5a, 0x56606e],
        decor: { dryGrass: 8, stormRock: 1.5, pylon: 0.7, rubble: 2.5, deadTree: 0.8 },
        enemyTypes: ['stormBrute', 'voltWisp', 'thunderhorn'],
        boss: 'stormcaller', gateColor: 0x50d0ff,
        light: { sky: 0xa8c0e8, ground: 0x1e2430, sun: 0xd8e8ff, sky_i: 1.25 },
      },
      {
        id: 'bonefield', rank: 'L', inner: 1960, outer: 2200,
        packs: 460, champions: 22, chests: 76,
        groundColors: [0x5a5e4e, 0x52564a, 0x64685a],
        decor: { boneShard: 6, ribs: 0.6, skull: 0.5, deadTree: 1.4, ash: 5 },
        enemyTypes: ['boneColossus', 'gravePriest', 'ribHound'],
        boss: 'titanLich', gateColor: 0x80ff90,
        light: { sky: 0xc8d8c0, ground: 0x2a2e24, sun: 0xe8f0d8, sky_i: 1.2 },
      },
      {
        id: 'voidthrone', rank: 'M', inner: 2200, outer: 2440,
        packs: 480, champions: 23, chests: 78,
        groundColors: [0x3a3048, 0x42364e, 0x342a40],
        decor: { ash: 6, voidCrystal: 2, voidSpire: 1, basalt: 0.8 },
        enemyTypes: ['voidKnight', 'voidEye', 'nightmare'],
        boss: 'voidSovereign', gateColor: 0xb070ff,
        light: { sky: 0xb8a0ff, ground: 0x1a1028, sun: 0xe0d0ff, sky_i: 1.5 },
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
    captureTime: 6,
    guards: 5, // enemies guarding an outpost (the first one is an elite)
    chestItems: 3,
    chestMinRarity: 2, // at least rare
  },

  // Difficulty of a world: chosen when it is made, can be changed in the
  // settings while playing. Every enemy (bosses too) gets this much health and
  // damage; luck = a little better loot on the harder ones.
  difficulty: {
    levels: {
      easy: { enemyHp: 0.7, enemyDamage: 0.6, luck: 0 },
      normal: { enemyHp: 1, enemyDamage: 1.1, luck: 0 },
      hard: { enemyHp: 1.5, enemyDamage: 1.75, luck: 0.15 },
      extreme: { enemyHp: 2.4, enemyDamage: 2.8, luck: 0.4 },
    },
    default: 'normal', // new worlds
    oldSaves: 'hard', // worlds made before there was a choice
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
    // Shadow Step: out of combat the dodge button also starts a sprint, for
    // walking across the world. A hit, an attack or a skill ends it.
    shadowStep: {
      calm: 3, // seconds without a hit, attack or skill before it can start
      speed: 1.5, // x the normal speed ...
      perAgi: 0.004, // ... + this per Agility point (100 points: x1.9)
      maxBonus: 1, // the Agility part stops at +1 (x2.5 in all)
      maxSpeed: 42, // units per second at most
      idle: 1.5, // ends after standing still this long
    },
    autoAimExtraRange: 3, // quick tap targets enemies up to weapon range + this
  },

  combat: {
    damageVariance: 0.12, // +-12 %
    knockback: 0.9, // units an enemy is pushed per hit
  },

  // ---- levels, ranks and power ---------------------------------------------
  // The rank comes from the level and every rank is one zone:
  //   E = level 1-9, D = 10-24, C = 25-49, B = 50-99, A = 100-199, S = 200-300.
  // Inside a zone the enemy level rises from the inner to the outer edge.
  levels: {
    rankLevels: [1, 10, 25, 50, 100, 200, 300, 450, 650, 850], // first level of rank E, D, C, B, A, S, SS, SSS, L, M
    rankNames: ['E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', 'L', 'M'],
    maxLevel: 1000,
    enemyRank: 10, // enemies (health, damage, XP) and their shadows: x10 per rank
    zoneSpread: 0.8, // inside a zone enemies grow up to x10^0.8 (about x6) towards the outer edge
    // Extra health of normal enemies per rank (bosses keep theirs). Gear,
    // stat points and rarity grow faster than x6 per rank, so without this
    // everything died to one hit later on. With it a normal enemy of your
    // level takes about 2-3 hits with good gear from rank A on, about one with
    // perfect gear; early ranks stay quick. Kills give sqrt(this) more XP and
    // shadows deal sqrt(this) more damage, so they keep up.
    enemyHpRank: [1, 1.3, 1.8, 2.6, 3.6, 4.6, 4.4, 5, 4.8, 4.4],
    // XP for a level x this, per rank E ... M: the early ranks take longer, so the class, the Path and the
    // first gear have time to matter (the last ranks keep their pace).
    xpRank: [1, 2, 2, 1.8, 1.5, 1.3, 1.1, 1, 1, 1],
    // The hunter from levels alone: damage x6 and health x8 per rank. Enemies
    // grow x10, so gear, stat points and the army must close the gap.
    playerRank: 6,
    playerHpRank: 8,
    itemRank: 1.27, // damage / defence of items: x1.27 per rank of the item level
    levelsPerRankAbove: 150, // Abyss items above the last level: one more rank per this many levels
    tierLevel: [0, 0.1, 0.2, 0.4], // extra levels of elites, champions, bosses (share of the zone's levels)
  },

  // ---- experience and stat points -------------------------------------------
  progression: {
    // XP for the next level = xpBase * enemy power at your level * (1 + xpPerLevel * (level - 1)):
    // about 14 kills of enemies at your level early on, about 28 at level 200.
    // Enemies above your level give more, a higher rank gives 10x.
    xpBase: 150,
    xpPerLevel: 0.005,
    pointsPerLevel: [3, 2, 1, 1, 0.5, 0.5, 1 / 3, 1 / 3, 1 / 3, 1 / 3], // stat points per level in rank E ... M (0.5 = one every second level)
    rankPoints: [0, 10, 12, 15, 18, 20, 22, 25, 28, 30], // stat points for reaching rank D, C, B, A, S, SS, SSS, L, M
    armyKillXp: 0.5, // share of the XP you get when one of your shadows lands the kill
    // What one stat point does. The stats decide the play style:
    //   Strength      hard hitting hunter
    //   Agility       fast, quick reloads and dodges
    //   Vitality      tough, regenerates health
    //   Intelligence  big army, lots of mana, better chance to raise shadows
    //   Perception    critical hits and loot
    stats: {
      str: { damage: 0.03 }, // +3 % damage per point (adds up: 100 points = x4)
      agi: { speed: 0.008, reload: 0.015, dodge: 0.01 }, // +0.8 % speed, 1.5 % faster reload, 1 % shorter dodge cooldown
      vit: { hp: 0.04, regen: 0.0005 }, // +4 % health per point (adds up), regenerates 0.05 % of max health per second
      int: { mana: 8, manaRegen: 0.2, slots: 0.5, arise: 0.004 }, // +1 army slot per 2 points, +0.4 % arise chance
      per: { crit: 0.008, critDamage: 0.015, drop: 0.02, armyRange: 0.25 }, // +0.8 % crit, +1.5 % crit damage, +2 % drops, +0.25 army hunt range
    },
    baseCrit: 0.05,
    critMax: 0.6, // crit chance never goes above 60 %
    critDamage: 1.8,
    // Perception's luck (better rarities) counts only up to this; its extra
    // drop chance keeps growing
    perLuckCap: 1,
    // Enemies above your level give more XP, but less than their power: one
    // rank above (x10 power) gives x10^xpAbove = about x4 XP.
    xpAbove: 0.6,
    defenseK: 90, // damage taken = K / (K + defence); K grows with the zone level like armour does
    ultCharge: { perHit: 3, max: 100 }, // every enemy hit charges the ultimate
    dismissXpShare: 0.5, // share of a dismissed shadow's XP that goes to the player
  },

  // cooldown = minimum time between two attacks, reload = seconds per charge.
  // Every weapon deals about the same damage per second on one enemy
  // (damage / reload = 16-21); what differs is how you fight with it:
  //   daggers   very fast: most hits, so the ultimate charges quickest
  //   sword     wide slash, the all-rounder
  //   spear     long thrust through every enemy in a line
  //   hammer    slow, heavy slam in front of you that stuns
  //   scythe    full circle: weakest on one enemy, best in a crowd
  //   bow       longest range, highest single hit, only the first enemy
  //   staff     ranged area blast after a short delay
  //   grimoire  bolt that finds its target and jumps to enemies nearby
  weapons: {
    // group: melee / ranged / magic: the main class gets mostly the weapons of its group (items.js)
    daggers: { group: 'melee', shape: 'arc', damage: 10, range: 3.2, arcDeg: 80, cooldown: 0.12, reload: 0.6 },
    sword: { group: 'melee', shape: 'arc', damage: 22, range: 4.6, arcDeg: 110, cooldown: 0.3, reload: 1.3 },
    spear: { group: 'melee', shape: 'thrust', damage: 23, range: 7.5, width: 1.5, cooldown: 0.3, reload: 1.25 },
    hammer: { group: 'melee', shape: 'slam', damage: 38, range: 3, radius: 3.3, stun: 0.5, cooldown: 0.55, reload: 2.2 },
    scythe: { group: 'melee', shape: 'circle', damage: 19, range: 4.4, cooldown: 0.4, reload: 1.5 },
    bow: { group: 'ranged', shape: 'line', damage: 31, range: 17, width: 0.7, speed: 40, cooldown: 0.35, reload: 1.5 },
    // crossbow: the hardest and slowest shot, the longest range; javelin: thrown, short range, quick
    crossbow: { group: 'ranged', shape: 'line', damage: 46, range: 19, width: 0.6, speed: 46, cooldown: 0.5, reload: 2.2 },
    javelin: { group: 'ranged', shape: 'line', damage: 24, range: 12, width: 1.1, speed: 30, cooldown: 0.3, reload: 1.15 },
    staff: { group: 'magic', shape: 'blast', damage: 26, range: 11, radius: 3, delay: 0.35, cooldown: 0.4, reload: 1.7 },
    // jumps: how often the bolt jumps on, each time with jumpDamage of the hit before
    // wand: quick bolts; orb: a pulse of power around you
    wand: { group: 'magic', shape: 'line', damage: 12, range: 13, width: 0.6, speed: 50, cooldown: 0.18, reload: 0.7 },
    orb: { group: 'magic', shape: 'circle', damage: 18, range: 5, cooldown: 0.35, reload: 1.2 },
    grimoire: { group: 'magic', shape: 'chain', damage: 19, range: 12, coneDeg: 50, jumps: 3, jumpRange: 6.5, jumpDamage: 0.7, cooldown: 0.35, reload: 1.3 },
  },

  // ---- items ----------------------------------------------------------------
  items: {
    // Seven rarities: common, uncommon, rare, epic, legendary, mythic, exotic.
    // Which ones drop depends on the rank of the item level: early ranks give
    // mostly common and uncommon items, legendary items start in rank D,
    // mythic ones in rank B, exotic ones in rank SSS. A 0 means: not in this rank.
    rarityWeights: [
      [62, 30, 8, 0, 0, 0, 0], // E (rare is the best: epic starts in D)
      [42, 34, 17, 6, 1, 0, 0], // D
      [30, 32, 23, 11, 4, 0, 0], // C
      [20, 27, 26, 17, 8, 2, 0], // B
      [12, 21, 27, 22, 13, 5, 0], // A
      [7, 15, 24, 27, 18, 9, 0], // S
      [5, 12, 22, 28, 21, 12, 0], // SS
      [4, 10, 20, 28, 23, 13, 2], // SSS
      [3, 8, 18, 27, 25, 15, 4], // L
      [2, 6, 15, 26, 27, 18, 6], // M
    ],
    // luck (elites, chests, gates, Perception) multiplies the weight of
    // rarity r by (1 + luck) ^ (r * luckStep)
    luckStep: 0.4,
    // The best rarity a rank can drop is rarer than its weight says, except
    // from gate bosses: you work towards it over the whole rank.
    topChance: 0.1,
    bossTopChance: 0.7,
    // Rarity counts more than the item level: a rarer item is nearly always
    // better than a more common one from the next zone.
    // index 7 = unique: never rolled by chance, only from the Abyss (see abyss.unique)
    rarityStat: [1, 1.2, 1.5, 2, 2.7, 3.6, 4.8, 6.5], // stat factor per rarity
    upgradeBonus: 0.1, // +10 % stats per upgrade
    maxUpgrade: 5,
    upgradeCost: [2, 3, 5, 8, 14, 24, 40, 70], // essence per rarity, times (upgrade + 1) ...
    upgradeLevel: 60, upgradeExp: 1.3, // ... times (1 + (item level / upgradeLevel) ^ upgradeExp): late items cost a lot
    dismantle: [1, 2, 4, 8, 18, 40, 90, 250], // essence per rarity
    inventorySize: 80,
    armor: { helmet: { defense: 5 }, chest: { defense: 9 }, gloves: { defense: 4 }, boots: { defense: 4 } },
    // one bonus per armour piece: value x (1 + bonusRarity x rarity), so a
    // legendary piece has x2.6, a mythic one x3
    bonuses: { hp: 0.05, speed: 0.025, mana: 0.06, crit: 0.02, reload: 0.04, skillDamage: 0.04, ultCharge: 0.05 }, // all as shares (0.05 = +5 %)
    bonusRarity: 0.4,
    // Six sets, one per way to play. 2 and 4 pieces of a set give its bonuses.
    //   stalker      crits and raw damage
    //   bulwark      health and less damage taken
    //   gravecaller  a bigger, stronger army
    //   tempest      faster reload, speed and a fourth attack charge
    //   arcanist     mana, stronger skills, shorter cooldowns
    //   bloodreaver  kills and hits heal you
    // hitHeal / killHeal are shares of max health per hit / per kill.
    sets: {
      stalker: { 2: { crit: 0.08 }, 4: { damage: 0.2 } },
      bulwark: { 2: { hp: 0.15 }, 4: { damageTaken: -0.15 } },
      gravecaller: { 2: { armyDamage: 0.15 }, 4: { armyHp: 0.25, armySlots: 2 } },
      tempest: { 2: { reload: 0.12 }, 4: { speed: 0.08, charges: 1 } },
      arcanist: { 2: { mana: 0.3 }, 4: { skillDamage: 0.3, cooldown: 0.2 } },
      bloodreaver: { 2: { killHeal: 0.04 }, 4: { damage: 0.1, hitHeal: 0.004 } },
    },
  },

  // ---- after the last level --------------------------------------------------
  // XP beyond level 1000 fills mastery levels; each gives a mastery point.
  // XP for the next mastery level = XP of the last level x (1 + growth x mastery level).
  mastery: {
    growth: 0.04,
    // what one point gives (no limit; crit stays under progression.critMax)
    perPoint: { damage: 0.01, hp: 0.01, armyDamage: 0.01, armyHp: 0.01, loot: 0.01, crit: 0.005 },
  },

  // The Abyss: an endless gate in the camp, open from the last level on.
  // Every floor has waves of enemies from all zones, every bossEvery-th
  // floor a boss of a zone. Floor 1 = enemies of the last level; every floor
  // makes them floorPower times stronger. Clearing a boss floor makes the
  // next floor a start point for later runs.
  abyss: {
    unlockLevel: 1000,
    pos: { x: 11.5, z: 11.5 }, // the portal in the camp
    pool: 24, // enemy slots kept for the Abyss (waves and boss helpers)
    floorPower: 1.07,
    bossEvery: 5,
    waves: 2,
    waveSize: [8, 18], // enemies per wave on floor 1; +1 every third floor up to the second number
    eliteChance: 0.15,
    bossHp: 0.6, // abyss bosses: boss.hp x this (they come often)
    dropChance: 0.12, // per normal enemy (elites x3)
    clearItems: 1, // items for every cleared floor
    bossItems: 3, // items of a boss
    itemLevelPerFloor: 5, // abyss items have level 1000 + floor x this
    luckPerFloor: 0.03,
    essencePerFloor: 30,
    // Unique items drop only here: one chance per cleared floor (chance on a
    // normal floor, bossChance on a boss floor), a little more on deep floors
    // and with modifiers, never above max / bossMax.
    unique: { chance: 0.002, bossChance: 0.01, perFloor: 0.04, perModifier: 0.25, max: 0.03, bossMax: 0.06 },
  },

  // Gate modifiers: up to max at a time, chosen before entering a gate or the
  // Abyss. Every modifier gives luck (better loot) and more XP.
  modifiers: {
    minRank: 4, // only from rank A on (normal gates; the Abyss is later anyway)
    max: 3,
    luck: 0.25,
    xp: 0.25,
    list: {
      explode: { radius: 3, delay: 0.7, damage: 1.2 }, // enemies explode when they die
      noHeal: {}, // no healing at all
      timeLimit: { gate: 150, perStage: 50, floor: 90 }, // seconds for a gate (+ per stage) / for an Abyss floor
      swift: { speed: 1.3 }, // faster enemies
      weakArmy: { damage: 0.5 }, // your shadows deal half damage
      elites: { chance: 0.45 }, // many more elites (gate helpers are all elites)
      tough: { hp: 1.5 }, // enemies have more health
      manaCurse: { cost: 2 }, // skills cost twice the mana
    },
  },

  // Gate Contracts (unlocked by the Delver core): gate modifiers from the first rank on, extra
  // modifiers at a time (gates only, not the Abyss), a loot bonus of luck times what a modifier
  // gives, and seals Soul Seals per modifier when a gate is cleared (rounded down).
  contracts: { extra: 2, luck: 1.5, seals: 0.5 },

  // Unique items: one fixed special effect each. A weapon gets one of the
  // weapon effects, a piece of armour the effect of its slot.
  uniques: {
    // Attune (in the camp): a unique item is raised to the item level of the
    // deepest Abyss floor cleared. Essence: this x the sum of the floors gained
    // (from floor 40 to 45: 3 x (41 + ... + 45) = 645). Upgrades are kept.
    attune: 3,
    weapon: {
      echo: { every: 5, power: 1.5, range: 9, arcDeg: 80 }, // every 5th attack also sends a shadow wave (x skill damage)
      storm: { chance: 0.25, jumps: 2, damage: 0.4, range: 6 }, // a hit may zap 2 enemies nearby for 40 %
      reaper: { heal: 0.03 }, // kills heal 3 % and give an attack charge back
      execute: { below: 0.3, damage: 0.8 }, // +80 % damage on enemies below 30 % health
    },
    armor: {
      helmet: { insight: { critDamage: 0.5 } }, // +50 % crit damage
      chest: { bastion: { shield: 0.15, time: 4, cooldown: 8 } }, // when hit: a shield of 15 % max health
      gloves: { frenzy: { perHit: 0.03, max: 0.3, time: 4 } }, // every hit: 3 % faster reload for 4 s (up to 30 %)
      boots: { voidstep: { power: 3, radius: 3.5, delay: 0.4 } }, // dodging leaves an explosion behind (x skill damage)
    },
  },

  loot: {
    dropChance: [0.035, 0.6, 1, 1], // normal enemy, elite, champion, boss
    weights: { weapon: 30, armor: 50, skill: 10 },
    // how many skills (with the ultimates) a hunter can have found by the end of each rank E ... M: from then on
    // the drops are gear only until the next rank, so the skills come over the whole game, not in the first hour
    skillCap: [4, 6, 8, 10, 12, 14, 16, 18, 99, 99],
    pickupRange: 1.8,
    chest: { items: [1, 2], respawn: 240, openRange: 2.4 }, // count per zone: see zones
  },

  // ---- skills ---------------------------------------------------------------
  // power = damage as a multiple of the skill base. The skill base is the
  // damage of a weapon with skillBase damage and the level, rarity and
  // upgrades of the equipped weapon, so skills are equally strong with every
  // weapon type. aim: arc | line | point | self
  skillBase: 22,
  skills: {
    // damage
    shadowWave: { mana: 20, cooldown: 6, aim: 'arc', range: 9, arcDeg: 70, power: 2.4 },
    nightLance: { mana: 18, cooldown: 6, aim: 'line', range: 18, width: 1.4, power: 2.6 },
    daggerRain: { mana: 25, cooldown: 9, aim: 'point', range: 11, radius: 4, power: 0.7, ticks: 5, interval: 0.3 },
    bladeDance: { mana: 20, cooldown: 8, aim: 'self', radius: 4.5, power: 0.8, ticks: 4, interval: 0.25 },
    // one enemy only: jumps to the enemy nearest to the target point
    phantomStrike: { mana: 22, cooldown: 7, aim: 'point', range: 10, radius: 4, power: 4 },
    // movement and control
    shadowStep: { mana: 15, cooldown: 5, aim: 'point', range: 10, radius: 3, power: 1.2 },
    rulersGrasp: { mana: 25, cooldown: 10, aim: 'point', range: 11, radius: 6, power: 0.8, stun: 1.4 },
    blackFrost: { mana: 25, cooldown: 12, aim: 'self', radius: 7, power: 1, stun: 2.2 },
    // marked enemies take more damage from you and your shadows
    huntersMark: { mana: 20, cooldown: 16, aim: 'point', range: 12, radius: 5, vuln: 0.25, duration: 8 },
    // survival
    umbralShield: { mana: 20, cooldown: 14, aim: 'self', radius: 2, shield: 0.4, duration: 6 },
    lifeLeech: { mana: 20, cooldown: 8, aim: 'arc', range: 6, arcDeg: 120, power: 1.5, heal: 0.5 },
    darkMend: { for: ['necromancer'], mana: 30, cooldown: 16, aim: 'self', radius: 12, healSelf: 0.22, healArmy: 0.35 },
    // buffs
    warCry: { for: ['necromancer'], mana: 30, cooldown: 20, aim: 'self', radius: 12, armyDamage: 0.4, duration: 8 },
    bloodRage: { mana: 25, cooldown: 18, aim: 'self', radius: 3, damage: 0.3, speed: 0.15, duration: 7 },
    // Warrior (for = the classes that can use it; rage = Rage it gives; guard = damage taken less while duration runs)
    shieldBash: { for: ['warrior'], mana: 14, cooldown: 6, aim: 'arc', range: 5, arcDeg: 100, power: 1.8, stun: 1.2, rage: 12 },
    cleave: { for: ['warrior'], mana: 18, cooldown: 5, aim: 'arc', range: 6.5, arcDeg: 170, power: 2.3 },
    groundSlam: { for: ['warrior'], mana: 22, cooldown: 9, aim: 'self', radius: 5.5, power: 2, stun: 1.6 },
    shieldRush: { for: ['warrior'], mana: 20, cooldown: 8, aim: 'point', range: 11, radius: 2.5, width: 2.4, power: 2.2 },
    challengingRoar: { for: ['warrior'], mana: 25, cooldown: 14, aim: 'self', radius: 9, power: 0.6, guard: 0.3, duration: 6, rage: 25 },
    ironWill: { for: ['warrior'], mana: 22, cooldown: 16, aim: 'self', radius: 2, shield: 0.3, guard: 0.35, healSelf: 0.15, duration: 6 },
    // Mage (arcane = Arcane Charges it gives; jumps / jumpRange = a bolt that leaps from enemy to enemy)
    arcaneBolt: { for: ['mage'], mana: 10, cooldown: 3, aim: 'line', range: 16, width: 1.2, power: 2 },
    fireball: { for: ['mage'], mana: 22, cooldown: 7, aim: 'point', range: 12, radius: 4, power: 3.4 },
    frostNova: { for: ['mage'], mana: 20, cooldown: 11, aim: 'self', radius: 6.5, power: 1.2, stun: 1.8 },
    chainLightning: { for: ['mage'], mana: 24, cooldown: 8, aim: 'point', range: 11, radius: 4, power: 1.6, jumps: 5, jumpRange: 6 },
    meteor: { for: ['mage'], mana: 35, cooldown: 14, aim: 'point', range: 12, radius: 5, power: 6, stun: 0.8 },
    arcaneSurge: { for: ['mage'], mana: 0, cooldown: 24, aim: 'self', radius: 3, duration: 6, arcane: 3 }, // for duration your skills cost no mana
    // Cleric (faith = Faith it gives; healSelf = share of your health healed; a skill with ticks and healSelf heals over duration)
    smite: { for: ['cleric'], mana: 12, cooldown: 3.5, aim: 'point', range: 11, radius: 3, power: 2.6, healSelf: 0.02 },
    holyNova: { for: ['cleric'], mana: 22, cooldown: 9, aim: 'self', radius: 6, power: 1.8, healSelf: 0.06 },
    consecration: { for: ['cleric'], mana: 26, cooldown: 12, aim: 'self', radius: 5, power: 0.7, ticks: 6, interval: 0.8, healSelf: 0.1, duration: 5, faith: 10 },
    mend: { for: ['cleric'], mana: 25, cooldown: 12, aim: 'self', radius: 3, healSelf: 0.2, faith: 12 },
    divineShield: { for: ['cleric'], mana: 24, cooldown: 15, aim: 'self', radius: 2, shield: 0.4, guard: 0.2, duration: 6 },
    judgement: { for: ['cleric'], mana: 30, cooldown: 11, aim: 'point', range: 11, radius: 3.5, power: 4.2, stun: 0.8 },
    // Rogue (combo = Combo Points it gives; finisher = spends all Combo Points for more damage)
    backstab: { for: ['rogue'], mana: 12, cooldown: 4, aim: 'arc', range: 3.5, arcDeg: 80, power: 2.8, combo: 2 },
    fanOfKnives: { for: ['rogue'], mana: 18, cooldown: 7, aim: 'self', radius: 7, power: 1.6, combo: 1 },
    eviscerate: { for: ['rogue'], mana: 20, cooldown: 6, aim: 'point', range: 7, radius: 3.5, power: 3.5, finisher: true },
    rupture: { for: ['rogue'], mana: 24, cooldown: 10, aim: 'point', range: 8, radius: 4, power: 0.9, ticks: 5, interval: 0.4, finisher: true },
    smokeBomb: { for: ['rogue'], mana: 22, cooldown: 14, aim: 'self', radius: 5, stun: 1.6, duration: 4 }, // duration = how long your next hit is an Ambush
    evasion: { for: ['rogue'], mana: 18, cooldown: 16, aim: 'self', radius: 2, duration: 2.5 }, // untouchable for duration, then an Ambush
    // Ranger (trap = it is laid on the ground and goes off when an enemy comes near; the army skills work on the companion)
    piercingShot: { for: ['ranger'], mana: 10, cooldown: 3, aim: 'line', range: 20, width: 1, power: 2.4 },
    multiShot: { for: ['ranger'], mana: 18, cooldown: 6, aim: 'arc', range: 11, arcDeg: 70, power: 2 },
    bearTrap: { for: ['ranger'], mana: 16, cooldown: 8, aim: 'point', range: 9, radius: 2.5, power: 2.6, stun: 2.5, trap: true },
    explosiveTrap: { for: ['ranger'], mana: 22, cooldown: 12, aim: 'point', range: 9, radius: 4.5, power: 5, trap: true },
    huntersFocus: { for: ['ranger'], mana: 20, cooldown: 18, aim: 'self', radius: 2, damage: 0.25, duration: 8 },
    beastCommand: { for: ['ranger'], mana: 25, cooldown: 20, aim: 'self', radius: 10, armyDamage: 0.6, healArmy: 0.4, duration: 8 }, // for your companion
  },

  // The ultimate charges with every enemy hit. While an ultimate with a
  // duration is active, hits do not charge the next one.
  ultimates: {
    nightfall: { aim: 'self', radius: 10, power: 9, stun: 2 },
    legionsCall: { for: ['necromancer'], aim: 'self', radius: 12, armyDamage: 0.6, duration: 12 }, // also revives every fallen shadow
    eclipse: { aim: 'self', radius: 3, duration: 5, damage: 0.2 }, // +20 % damage, attacks cost no charges
    voidStorm: { aim: 'point', range: 10, radius: 6.5, power: 1, ticks: 12, interval: 0.5 },
    umbralAegis: { aim: 'self', radius: 6, healSelf: 0.4, shield: 0.8, duration: 10, stun: 1.5 },
    oblivionRay: { aim: 'line', range: 24, width: 3, power: 16 },
    earthshatter: { for: ['warrior'], aim: 'self', radius: 12, power: 10, stun: 2.5 },
    unbreakable: { for: ['warrior'], aim: 'self', radius: 5, duration: 10, guard: 0.5, damage: 0.3, healSelf: 0.3 }, // damage = the bonus of Blood Rage
    cataclysm: { for: ['mage'], aim: 'point', range: 12, radius: 8, power: 14, stun: 2 },
    timeStop: { for: ['mage'], aim: 'self', radius: 14, stun: 4.5, duration: 5 }, // everything close is frozen; your skills cost no mana meanwhile
    divineIntervention: { for: ['cleric'], aim: 'self', radius: 8, power: 6, healSelf: 0.6, shield: 0.5, duration: 8, stun: 1.5, faith: 40 },
    sunburst: { for: ['cleric'], aim: 'line', range: 22, width: 4, power: 14, healSelf: 0.25 },
    deathBlossom: { for: ['rogue'], aim: 'self', radius: 9, power: 1.5, ticks: 10, interval: 0.2 },
    assassinate: { for: ['rogue'], aim: 'point', range: 10, radius: 4, power: 20, finisher: true },
    arrowStorm: { for: ['ranger'], aim: 'point', range: 12, radius: 7, power: 1.1, ticks: 14, interval: 0.4 },
    primalFury: { for: ['ranger'], aim: 'self', radius: 12, armyDamage: 1, damage: 0.3, duration: 12 }, // you and your companion
  },

  // behavior: melee (bites up close), ranged (keeps distance and shoots),
  // charger (telegraphs, then rams in a straight line). trait: an extra
  // behaviour on top (see traits), one new one in every zone after the first. shadowRole decides what
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
      mossback: { trait: 'shield', behavior: 'melee', shadowRole: 'tank', xp: 12, hp: 70, damage: 8, speed: 4.4, radius: 0.95, scale: 1.1, aggroRange: 11, attackRange: 2.1, attackWindup: 0.55, attackCooldown: 1.6 },
      hollowArcher: { behavior: 'ranged', shadowRole: 'ranged', xp: 11, hp: 36, damage: 7, speed: 4, radius: 0.6, scale: 1, aggroRange: 15, attackRange: 13, attackWindup: 0.55, attackCooldown: 2, shotSpeed: 20, shotColor: 0xd8f0a0 },
      antlerstag: { behavior: 'charger', shadowRole: 'melee', xp: 12, hp: 52, damage: 10, speed: 5, radius: 0.85, scale: 1.05, aggroRange: 13, attackRange: 2, attackWindup: 0.7, attackCooldown: 3, chargeRange: 13, chargeSpeed: 22, chargeTime: 0.6 },
      // ---- swamp
      bogshambler: { behavior: 'melee', shadowRole: 'tank', xp: 12, hp: 80, damage: 8, speed: 3.6, radius: 0.95, scale: 1.1, aggroRange: 10, attackRange: 2.1, attackWindup: 0.6, attackCooldown: 1.7 },
      sporemother: { trait: 'healer', behavior: 'ranged', shadowRole: 'healer', xp: 12, hp: 40, damage: 6, speed: 3, radius: 0.8, scale: 1, aggroRange: 13, attackRange: 11, attackWindup: 0.7, attackCooldown: 2.4, shotSpeed: 12, shotColor: 0xd070ff },
      mirecrawler: { behavior: 'charger', shadowRole: 'melee', xp: 12, hp: 50, damage: 9, speed: 4.6, radius: 0.8, scale: 1, aggroRange: 12, attackRange: 1.9, attackWindup: 0.65, attackCooldown: 2.8, chargeRange: 11, chargeSpeed: 21, chargeTime: 0.6 },
      // ---- ruins
      sentinel: { behavior: 'melee', shadowRole: 'tank', xp: 13, hp: 85, damage: 9, speed: 3.8, radius: 0.9, scale: 1.1, aggroRange: 10, attackRange: 2.2, attackWindup: 0.6, attackCooldown: 1.7 },
      acolyte: { trait: 'rally', behavior: 'ranged', shadowRole: 'healer', xp: 12, hp: 38, damage: 7, speed: 4, radius: 0.6, scale: 1, aggroRange: 14, attackRange: 12, attackWindup: 0.6, attackCooldown: 2.1, shotSpeed: 15, shotColor: 0xffc030 },
      ruinhound: { behavior: 'charger', shadowRole: 'melee', xp: 12, hp: 50, damage: 10, speed: 5.4, radius: 0.8, scale: 1, aggroRange: 13, attackRange: 1.9, attackWindup: 0.6, attackCooldown: 2.8, chargeRange: 13, chargeSpeed: 24, chargeTime: 0.55 },
      // ---- ice
      frostTroll: { behavior: 'melee', shadowRole: 'tank', xp: 14, hp: 90, damage: 10, speed: 3.8, radius: 1, scale: 1.15, aggroRange: 10, attackRange: 2.3, attackWindup: 0.65, attackCooldown: 1.8 },
      iceWisp: { trait: 'chill', behavior: 'ranged', shadowRole: 'ranged', xp: 12, hp: 34, damage: 8, speed: 4.6, radius: 0.6, scale: 1, aggroRange: 15, attackRange: 13, attackWindup: 0.5, attackCooldown: 1.9, shotSpeed: 18, shotColor: 0x80e0ff },
      snowram: { behavior: 'charger', shadowRole: 'melee', xp: 13, hp: 58, damage: 11, speed: 4.8, radius: 0.85, scale: 1.05, aggroRange: 13, attackRange: 2, attackWindup: 0.7, attackCooldown: 3, chargeRange: 13, chargeSpeed: 23, chargeTime: 0.6 },
      // ---- volcano
      magmaBrute: { behavior: 'melee', shadowRole: 'tank', xp: 15, hp: 95, damage: 11, speed: 3.9, radius: 1, scale: 1.15, aggroRange: 10, attackRange: 2.3, attackWindup: 0.6, attackCooldown: 1.7 },
      emberImp: { behavior: 'ranged', shadowRole: 'ranged', xp: 13, hp: 36, damage: 8, speed: 5, radius: 0.55, scale: 1, aggroRange: 15, attackRange: 12, attackWindup: 0.45, attackCooldown: 1.7, shotSpeed: 19, shotColor: 0xff7020 },
      cinderhound: { trait: 'volatile', behavior: 'charger', shadowRole: 'melee', xp: 13, hp: 52, damage: 12, speed: 5.6, radius: 0.8, scale: 1, aggroRange: 14, attackRange: 1.9, attackWindup: 0.55, attackCooldown: 2.6, chargeRange: 14, chargeSpeed: 25, chargeTime: 0.55 },
      // ---- shattered expanse (SS)
      shardGolem: { trait: 'split', behavior: 'melee', shadowRole: 'tank', xp: 15, hp: 100, damage: 11, speed: 3.8, radius: 1, scale: 1.15, aggroRange: 10, attackRange: 2.3, attackWindup: 0.6, attackCooldown: 1.7 },
      prismWisp: { behavior: 'ranged', shadowRole: 'ranged', xp: 14, hp: 38, damage: 9, speed: 4.6, radius: 0.6, scale: 1, aggroRange: 15, attackRange: 13, attackWindup: 0.5, attackCooldown: 1.8, shotSpeed: 20, shotColor: 0xd080ff },
      glassStalker: { behavior: 'charger', shadowRole: 'melee', xp: 14, hp: 55, damage: 12, speed: 5.6, radius: 0.8, scale: 1.05, aggroRange: 14, attackRange: 1.9, attackWindup: 0.55, attackCooldown: 2.6, chargeRange: 14, chargeSpeed: 26, chargeTime: 0.55 },
      // ---- stormspire highlands (SSS)
      stormBrute: { behavior: 'melee', shadowRole: 'tank', xp: 15, hp: 105, damage: 12, speed: 3.9, radius: 1, scale: 1.2, aggroRange: 10, attackRange: 2.4, attackWindup: 0.6, attackCooldown: 1.7 },
      voltWisp: { trait: 'artillery', behavior: 'ranged', shadowRole: 'ranged', xp: 14, hp: 36, damage: 10, speed: 5, radius: 0.6, scale: 1, aggroRange: 16, attackRange: 13, attackWindup: 0.45, attackCooldown: 1.6, shotSpeed: 24, shotColor: 0x60d0ff },
      thunderhorn: { behavior: 'charger', shadowRole: 'melee', xp: 15, hp: 60, damage: 13, speed: 5.4, radius: 0.85, scale: 1.1, aggroRange: 14, attackRange: 2, attackWindup: 0.6, attackCooldown: 2.6, chargeRange: 15, chargeSpeed: 27, chargeTime: 0.55 },
      // ---- titans' graveyard (L)
      boneColossus: { behavior: 'melee', shadowRole: 'tank', xp: 16, hp: 115, damage: 12, speed: 3.6, radius: 1.05, scale: 1.25, aggroRange: 10, attackRange: 2.5, attackWindup: 0.65, attackCooldown: 1.8 },
      gravePriest: { trait: 'necro', behavior: 'ranged', shadowRole: 'healer', xp: 15, hp: 42, damage: 10, speed: 4, radius: 0.6, scale: 1, aggroRange: 14, attackRange: 12, attackWindup: 0.6, attackCooldown: 2, shotSpeed: 16, shotColor: 0x80ff90 },
      ribHound: { behavior: 'charger', shadowRole: 'melee', xp: 15, hp: 56, damage: 13, speed: 5.8, radius: 0.8, scale: 1, aggroRange: 14, attackRange: 1.9, attackWindup: 0.55, attackCooldown: 2.5, chargeRange: 14, chargeSpeed: 26, chargeTime: 0.55 },
      // ---- throne of the void (M)
      voidKnight: { trait: 'hunter', behavior: 'melee', shadowRole: 'melee', xp: 17, hp: 95, damage: 14, speed: 4.4, radius: 0.9, scale: 1.15, aggroRange: 12, attackRange: 2.4, attackWindup: 0.5, attackCooldown: 1.4 },
      voidEye: { behavior: 'ranged', shadowRole: 'ranged', xp: 16, hp: 40, damage: 11, speed: 4.8, radius: 0.65, scale: 1, aggroRange: 16, attackRange: 14, attackWindup: 0.45, attackCooldown: 1.6, shotSpeed: 22, shotColor: 0xb070ff },
      nightmare: { trait: 'blink', behavior: 'charger', shadowRole: 'melee', xp: 16, hp: 60, damage: 14, speed: 6, radius: 0.85, scale: 1.1, aggroRange: 15, attackRange: 2, attackWindup: 0.5, attackCooldown: 2.4, chargeRange: 15, chargeSpeed: 28, chargeTime: 0.55 },

      // ---- gate bosses (meadow values, multiplied by their zone like everything else)
      // patterns: see bossPatterns. shadowBase = stats of the boss as a shadow.
      thornmaw: { boss: true, behavior: 'boss', shadowRole: 'melee', xp: 200, hp: 900, damage: 12, speed: 4.6, radius: 1.8, scale: 2.4, aggroRange: 40, attackRange: 3.4, attackWindup: 0.6, attackCooldown: 1.4, patterns: ['slam', 'charge', 'summon'], patterns2: ['fissure'], adds: 'gloomfang', shadowBase: { hp: 90, damage: 11 } },
      barkhide: { boss: true, behavior: 'boss', shadowRole: 'tank', xp: 200, hp: 1000, damage: 12, speed: 3.6, radius: 2, scale: 2.2, aggroRange: 40, attackRange: 3.6, attackWindup: 0.7, attackCooldown: 1.6, patterns: ['slam', 'eruption', 'summon'], patterns2: ['fissure'], adds: 'mossback', shadowBase: { hp: 130, damage: 13 } },
      mireMatriarch: { boss: true, behavior: 'boss', shadowRole: 'healer', xp: 200, hp: 950, damage: 11, speed: 3, radius: 2, scale: 2.4, aggroRange: 40, attackRange: 3.4, attackWindup: 0.7, attackCooldown: 1.6, patterns: ['nova', 'eruption', 'summon'], patterns2: ['meteor'], adds: 'mirecrawler', shadowBase: { hp: 110, damage: 10 } },
      hollowKing: { boss: true, behavior: 'boss', shadowRole: 'melee', xp: 200, hp: 1000, damage: 13, speed: 4.2, radius: 1.8, scale: 2.3, aggroRange: 40, attackRange: 3.6, attackWindup: 0.6, attackCooldown: 1.4, patterns: ['charge', 'slam', 'volley'], patterns2: ['fissure'], adds: 'sentinel', shadowBase: { hp: 140, damage: 16 } },
      rimeclaw: { boss: true, behavior: 'boss', shadowRole: 'tank', xp: 200, hp: 1100, damage: 13, speed: 4, radius: 2, scale: 2.4, aggroRange: 40, attackRange: 3.8, attackWindup: 0.65, attackCooldown: 1.5, patterns: ['nova', 'slam', 'charge'], patterns2: ['meteor'], adds: 'snowram', shadowBase: { hp: 170, damage: 15 } },
      pyrelord: { boss: true, behavior: 'boss', shadowRole: 'ranged', xp: 200, hp: 1200, damage: 14, speed: 3.8, radius: 1.9, scale: 2.5, aggroRange: 40, attackRange: 3.6, attackWindup: 0.6, attackCooldown: 1.4, patterns: ['eruption', 'nova', 'volley', 'summon'], patterns2: ['meteor'], adds: 'emberImp', shadowBase: { hp: 150, damage: 20 } },
      crystalTyrant: { boss: true, behavior: 'boss', shadowRole: 'tank', xp: 200, hp: 1300, damage: 15, speed: 3.8, radius: 2, scale: 2.4, aggroRange: 40, attackRange: 3.8, attackWindup: 0.65, attackCooldown: 1.5, patterns: ['nova', 'slam', 'volley', 'summon'], patterns2: ['fissure'], adds: 'shardGolem', shadowBase: { hp: 180, damage: 17 } },
      stormcaller: { boss: true, behavior: 'boss', shadowRole: 'ranged', xp: 200, hp: 1300, damage: 16, speed: 4.2, radius: 1.9, scale: 2.4, aggroRange: 40, attackRange: 3.6, attackWindup: 0.6, attackCooldown: 1.4, patterns: ['volley', 'charge', 'nova', 'summon'], patterns2: ['meteor'], adds: 'voltWisp', shadowBase: { hp: 160, damage: 22 } },
      titanLich: { boss: true, behavior: 'boss', shadowRole: 'healer', xp: 200, hp: 1450, damage: 16, speed: 3.4, radius: 2.1, scale: 2.6, aggroRange: 40, attackRange: 3.8, attackWindup: 0.7, attackCooldown: 1.5, patterns: ['eruption', 'slam', 'summon', 'nova'], patterns2: ['meteor'], adds: 'boneColossus', shadowBase: { hp: 190, damage: 15 } },
      voidSovereign: { boss: true, behavior: 'boss', shadowRole: 'melee', xp: 200, hp: 1600, damage: 18, speed: 4.4, radius: 2, scale: 2.6, aggroRange: 40, attackRange: 3.8, attackWindup: 0.55, attackCooldown: 1.3, patterns: ['eruption', 'nova', 'volley', 'charge', 'summon'], patterns2: ['fissure', 'meteor'], adds: 'voidKnight', shadowBase: { hp: 200, damage: 24 } },
    },
  },

  // Extra behaviours of enemy types, one new one per zone (see enemies.types):
  //   shield     blocks hits from the front (not while it attacks): takes this share
  //   healer     heals the wounded around it every few seconds
  //   rally      makes the others around it stronger and faster for a while
  //   chill      its shots slow you down
  //   volatile   explodes when it dies (a red circle: step out)
  //   split      breaks into smaller copies when it dies
  //   artillery  every second attack is a strike from above where you stand
  //   necro      raises fallen monsters of its pack again
  //   blink      teleports behind its target, then strikes
  //   hunter     goes for your shadows first and hits them harder
  traits: {
    shield: { front: 0.35, taken: 0.25 },
    healer: { every: 5, radius: 8, heal: 0.18 },
    rally: { every: 7, radius: 8, time: 5, damage: 0.35, speed: 0.3 },
    chill: { time: 1.6, slow: 0.4 },
    volatile: { radius: 3.2, delay: 0.85, damage: 1.5 },
    split: { count: 2, hp: 0.35, scale: 0.62, damage: 0.55, xp: 0.3 },
    artillery: { every: 2, radius: 2.8, delay: 1.1, damage: 1.6 },
    necro: { every: 8, radius: 11, hp: 0.5, max: 2, within: 25 },
    blink: { cooldown: 5, behind: 2.2, minDist: 5 },
    hunter: { damage: 1.6 },
  },

  // Boss attacks. damage = multiple of the boss damage.
  bossPatterns: {
    slam: { windup: 1, radius: 5.5, damage: 1.6 },
    charge: { windup: 0.8, speed: 26, time: 0.7, damage: 1.4 },
    nova: { windup: 0.8, shots: 16, speed: 12, damage: 0.8 },
    volley: { windup: 0.6, shots: 5, spreadDeg: 40, speed: 18, damage: 0.9 },
    eruption: { windup: 1.1, count: 5, radius: 3, spread: 9, damage: 1.3 },
    summon: { count: 3, maxAdds: 6 },
    // phase-2 attacks (see the bosses' patterns2)
    fissure: { windup: 0.7, count: 6, radius: 2.2, step: 2.6, delay: 0.12, damage: 1.4 },
    meteor: { windup: 1.2, count: 10, radius: 2.6, spread: 18, delay: 0.08, damage: 1.3 },
  },
  boss: {
    // Gate bosses have hp x boss.hp x their gate's difficulty. With good gear
    // a boss of your level takes about 1-1.5 min alone with ordinary gear,
    // 10-30 s with the best legendary gear; the army helps.
    hp: 8,
    // Gate bosses get this share (as a power) of the extra health normal
    // enemies have in later ranks (levels.enemyHpRank): x2.1 instead of x4.4
    // in the last ranks, so late bosses stay a real fight. Not in the Abyss.
    rankHp: 0.5,
    pause: 1.4, // seconds between two attacks
    enrageAt: 0.5, // below this share of health the boss gets faster
    enrageSpeed: 1.35,
    stunResist: 0.5, // bosses are stunned for this share of the time
    shotRadius: 0.5,
    // Phases: at these shares of health the boss roars (a shockwave around it:
    // step out), learns its patterns2 and attacks in combos. Deadly gates and
    // the Abyss also have the third phase.
    phases: [0.5, 0.2],
    roar: { time: 1.4, radius: 7, damage: 1 },
    combo: [0, 0.35, 0.7], // chance to chain a second attack, per phase
    // after a charge or a slam the boss is exhausted for a moment and takes
    // more damage
    tired: { time: 1.5, damage: 0.5, patterns: ['charge', 'slam'] },
  },

  // Gates are about loot and strong shadows. A gate has stages before its
  // boss: wave (monsters of the zone), survive (they keep coming for a while,
  // then defeat the rest) and guard (champions with escorts). Every cleared
  // stage drops an item. Only the zone you are in has
  // gates: one of each difficulty. A gate closes once you enter it (win or
  // lose) and opens again later at another spot of the zone, but only while
  // you are in that zone. After the boss you leave with the Leave button.
  gates: {
    enterRange: 4, // the Enter button appears within this distance
    arenaRadius: 26,
    sitesPerZone: 8, // places per zone where a gate can open
    respawn: [150, 300], // seconds of play until a closed gate opens again elsewhere
    //   level        boss level: zone's first level + this share of its levels
    //   hp, damage   extra for the boss and its helpers
    //   items, minRarity, luck   the reward (luck: higher = more legendaries)
    //   eliteAdds    the boss's helpers are elites (elite shadows)
    difficulties: [
      // minRarity: 2 = rare, 3 = epic (never above what the rank can drop)
      { id: 'normal', level: 0.2, hp: 1, damage: 1, items: 3, minRarity: 2, luck: 1, eliteAdds: false, color: 0xffffff, stages: ['wave', 'wave'], wave: 7, elite: 0.08, survive: 20, guards: 1 },
      { id: 'hard', level: 0.5, hp: 1.6, damage: 1.25, items: 4, minRarity: 2, luck: 1.8, eliteAdds: true, color: 0xffb040, stages: ['wave', 'survive', 'guard'], wave: 9, elite: 0.15, survive: 25, guards: 1 },
      { id: 'deadly', level: 0.85, hp: 2.6, damage: 1.5, items: 5, minRarity: 3, luck: 3, eliteAdds: true, color: 0xff3050, stages: ['wave', 'survive', 'wave', 'guard'], wave: 11, elite: 0.25, survive: 30, guards: 2 },
    ],
    pool: 16, // enemy slots for the stages of the gate the player is in
    surviveAlive: 7, // monsters at once while you hold out
    surviveEvery: 0.7, // seconds between two of them
    escorts: 3, // per champion of a guard stage
    stagePause: 2.5, // seconds between two stages
    stageLuck: 0.5, // luck of the item of a stage
    bossAriseFactor: 0.85, // a gate boss is raised with 85 % of the normal chance
  },

  // Gate tiers: clearing the deadly gate of a zone makes the next deadly gate
  // of that zone one tier harder (Deadly +1, +2 ... up to max). Per tier the
  // gate's monsters and boss get hp / damage times stronger, the boss items
  // more luck and a better chance for the rank's top rarity (topChance on top
  // of items.bossTopChance), and the essence grows.
  gateTiers: { max: 10, hp: 1.3, damage: 1.12, luck: 0.3, topChance: 0.03, essence: 0.25 },

  // Warrior: Rage grows with every hit you deal (rageHit) and take (rageHurt + the share of your health
  // times rageHurtScale), and fades after calm seconds without a fight (decay per second). Every point
  // gives damage and less damage taken.
  warrior: { rageMax: 100, rageHit: 2, rageHurt: 3, rageHurtScale: 60, decay: 6, calm: 4, damage: 0.005, reduction: 0.0015 },

  // Mage: every skill you cast gives an Arcane Charge (up to arcaneMax); each adds arcaneDamage
  // to your skill damage. All charges are lost after arcaneTime seconds without a cast.
  mage: { arcaneMax: 5, arcaneTime: 6, arcaneDamage: 0.08 },

  // Cleric: Faith grows with every hit you deal (faithHit) and fades after calm seconds without a
  // fight (decay per second). Every point gives damage, and every hit heals you by hitHeal of your
  // health per point. The Cleric heals itself, so it plays well alone; in a team the same skills will help the others.
  cleric: { faithMax: 100, faithHit: 2, decay: 5, calm: 4, damage: 0.002, hitHeal: 0.00006, healGap: 0.3 },

  // Rogue: every hit you deal gives a Combo Point (up to cpMax, at most one per 0.2 s); they are lost after
  // cpTime seconds without a hit. Each adds critPerPoint crit chance. A finisher skill spends them all
  // for finisher more damage per point. An Ambush (after Smoke Bomb or Evasion) makes your next hit a
  // critical one with ambush more damage.
  rogue: { cpMax: 5, cpTime: 4, critPerPoint: 0.04, finisher: 0.3, ambush: 0.6 },

  // Ranger: damage grows with the distance to the enemy, by rangeBonus at rangeTo and farther (nothing
  // up to rangeFrom). companions = how many companions (one shadow of the army machinery, of companionType
  // and companionTier); traps = how many traps lie on the ground at most, each for trapLife seconds.
  ranger: { rangeBonus: 0.35, rangeFrom: 4, rangeTo: 14, companions: 1, companionType: 'gloomfang', companionTier: 1, traps: 4, trapLife: 25 },

  // Main classes: chosen at the rank-up to rank index choiceRank (D); before that everyone
  // is a neutral hunter. role = what the class does in a team (for the co-op gates later);
  // army = the class has the shadow army (Arise, the Army tab); ready = it can be chosen (the
  // others are shown as coming soon); cores = the Path cores its classes get.
  classes: {
    choiceRank: 1,
    // The first choice (rank D) is one of four groups; the group brings its first class and mostly the weapons of
    // its kind. At rank specRank the class can turn into its sibling (spec). Later: by the way you play (core/style.js).
    groups: {
      fighter: { class: 'warrior' },
      ranged: { class: 'ranger' },
      mage: { class: 'mage' },
      necromancer: { class: 'necromancer' },
    },
    specRank: 2,
    spec: { warrior: ['warrior', 'rogue'], mage: ['mage', 'cleric'] },
    weaponPick: 0.7, // chance that a weapon drop is of the weapons of the class group
    list: {
      necromancer: { group: 'necromancer', weapons: '', role: 'summoner', ready: true, army: true, bonus: { damage: 0.15, armyDamage: 0.2, armySlots: 2, armyHp: 0.15 }, cores: ['blade', 'commander', 'mage', 'tank', 'slayer', 'delver'] },
      warrior: { group: 'fighter', weapons: 'melee', role: 'tank', ready: true, army: false, startSkills: ['shieldBash'], startUltimate: 'earthshatter', bonus: { damage: 0.25, hp: 0.15 }, cores: ['tank', 'blade', 'slayer', 'delver'] },
      mage: { group: 'mage', weapons: 'magic', role: 'ranged', ready: true, army: false, startSkills: ['arcaneBolt'], startUltimate: 'cataclysm', bonus: { mana: 0.3, skillDamage: 0.5, cooldown: 0.15 }, cores: ['mage', 'slayer', 'delver', 'tank'] },
      rogue: { group: 'fighter', weapons: 'melee', role: 'melee', ready: true, army: false, startSkills: ['backstab'], startUltimate: 'deathBlossom', bonus: { crit: 0.1, speed: 0.08, damage: 0.1 }, cores: ['blade', 'slayer', 'delver', 'mage'] },
      ranger: { group: 'ranged', weapons: 'ranged', role: 'ranged', ready: true, army: false, startSkills: ['piercingShot'], startUltimate: 'arrowStorm', bonus: { speed: 0.1, crit: 0.06, damage: 0.18 }, cores: ['slayer', 'delver', 'blade', 'tank'] },
      cleric: { group: 'mage', weapons: 'magic', role: 'support', ready: true, army: false, startSkills: ['smite'], startUltimate: 'divineIntervention', bonus: { hp: 0.12, skillDamage: 0.1 }, cores: ['mage', 'tank', 'delver', 'slayer'] },
    },
  },

  // Paths (the class tree of the Necromancer): at every rank from D to M the
  // System offers three classes, made from the way you play (core/paths.js).
  // A class = a core (the style it comes from), maybe a second core (the mod:
  // it gives modShare of that package) and a rarity. Its bonuses grow with the
  // stage and the rarity. Every class is an upgrade (no drawbacks), the packages
  // of all earlier picks stay, and every pick adds pickBonus. A core has
  //   bonus    one package per stage (the same names as item bonuses)
  //   rule     rules per stage, summed (armyKillXp = more XP from kills by your shadows,
  //            killMana = share of your mana per kill, slotCapPlus = more army slots at most,
  //            selfXp, reviveCostMult, hpRegenMult, manaRegenMult)
  //   like     how it fits a style: -1 .. 1 per measure (army, hunter, caster, dodger, deaths,
  //            lossy, elite, gates, sprint, officers, critty, tank)
  //   skill    the class skill of the last pick; value / time / cooldown per level (I-III)
  //   unlocks  mechanics a class of this core brings from that stage on
  // live = the unlocks that exist in the game so far.
  paths: {
    stages: [1, 2, 3, 4, 5, 6, 7, 8, 9], // rank indexes (0 = E) at which a pick is due: D C B A S SS SSS L M
    stageScale: 0.06, // a later stage is stronger: 1 + stageScale x (stage - 1)
    rarityMult: [1, 1.15, 1.3, 1.5, 1.8], // Common .. Legendary
    modShare: 0.5,
    pickBonus: { damage: 0.02, hp: 0.02 }, // on top of every pick
    sockets: [3, 6], // picks needed for the 2nd and the 3rd rune socket
    skillStep: 3, // the class skill levels up (I-III) every this many picks of its core
    live: ['thirdSlot', 'barracks', 'expeditions', 'duelArena', 'runeWorkshop', 'fortify', 'huntBoard', 'contracts'],
    cores: {
      blade: {
        bonus: { damage: 0.1, crit: 0.012, reload: 0.02, killHeal: 0.003 },
        rule: { selfXp: 0.05 },
        like: { hunter: 0.5, critty: 0.25, dodger: 0.25 },
        skill: { id: 'afterimage', value: [0.25, 0.5, 0.8], time: 4 }, // value = extra crit damage; time = seconds after a dodge
        unlocks: [{ id: 'duelArena', stage: 3 }],
      },
      commander: {
        bonus: { armySlots: 1.1, armyHp: 0.08, armyDamage: 0.04 },
        rule: { slotCapPlus: 1.5, armyKillXp: 0.15, reviveCostMult: -0.03 },
        like: { army: 0.6, hunter: -0.25, officers: 0.15 },
        skill: { id: 'rally', value: [0.15, 0.25, 0.4], time: [5, 7, 9], cooldown: 8 }, // value = army damage after an elite or boss kill
        unlocks: [{ id: 'barracks', stage: 3 }, { id: 'expeditions', stage: 5 }],
      },
      mage: {
        bonus: { mana: 0.1, skillDamage: 0.09, cooldown: 0.02, ultCharge: 0.04 },
        rule: { killMana: 0.01 },
        like: { caster: 1 },
        skill: { id: 'overflow', value: [0.15, 0.25, 0.4] }, // value = share of the mana of a skill that comes back
        unlocks: [{ id: 'thirdSlot', stage: 3 }, { id: 'runeWorkshop', stage: 5 }],
      },
      tank: {
        bonus: { hp: 0.08, damageTaken: -0.015, damage: 0.03 },
        rule: { hpRegenMult: 0.04 },
        like: { tank: 0.7, deaths: -0.3 },
        skill: { id: 'bulwark', value: [0.06, 0.1, 0.15], time: 4, cooldown: 12 }, // value = shield, share of max health
        unlocks: [{ id: 'fortify', stage: 3 }],
      },
      slayer: {
        bonus: { damage: 0.07, ultCharge: 0.04, skillDamage: 0.03 },
        rule: {},
        like: { elite: 1 },
        skill: { id: 'execute', value: [0.12, 0.22, 0.35] }, // value = extra damage on elites and bosses
        unlocks: [{ id: 'huntBoard', stage: 3 }],
      },
      delver: {
        bonus: { damage: 0.05, hp: 0.05, speed: 0.01, reload: 0.01 },
        rule: { manaRegenMult: 0.03 },
        like: { gates: 1 },
        skill: { id: 'resolve', value: [0.15, 0.25, 0.4] }, // value = share of max health healed per gate stage cleared
        unlocks: [{ id: 'contracts', stage: 3 }],
      },
    },
  },

  // The Barracks (unlocked by the Commander core): stationed shadows train with real
  // time; a level costs essence. Expeditions (a later Commander class) send stationed
  // shadows away for time seconds. essence is times (zone + 1).
  barracks: {
    maxLevel: 10,
    baseSlots: 3, slotsPerLevel: 2, // shadows that can be stationed
    upgradeCost: 400, upgradeGrowth: 1.7, // essence for level n + 1 = upgradeCost x upgradeGrowth ^ (n - 1)
    trainRate: 0.3, trainPerLevel: 0.05, // levels of XP per hour of a stationed shadow
    trainCap: 12, // hours that count at most between two visits
    expeditions: {
      scout: { time: 1800, party: 2, essence: 40, items: 0, seals: 0, injury: 0.05 },
      raid: { time: 7200, party: 4, essence: 160, items: 1, rarity: 2, seals: 1, injury: 0.12 },
      siege: { time: 21600, party: 6, essence: 520, items: 2, rarity: 3, seals: 3, injury: 0.2 },
    },
  },

  // The Duel Arena (unlocked by the Blade core): the deadly gate of your zone, fought
  // without your army. cost = essence x (zone + 1); tier = tiers harder; items = more
  // items; essence = more essence (a share); seals = Soul Seals for a win.
  duel: { cost: 150, tier: 2, items: 2, essence: 0.5, seals: 2 },

  // The Rune Workshop (unlocked by the Mage core): essence makes runes stronger (a rune
  // level adds levelBonus of its effect, up to max) or crafts a rune that was not found.
  // Costs are times (rank + 1): infuse per level, craft for a rune.
  runeWorkshop: { max: 3, levelBonus: 0.15, infuse: [300, 900, 2700], craft: 1500 },

  // Fortified Outposts (unlocked by the Tank core): cost = essence per level, times
  // (zone of the outpost + 1). regen = share of max health and mana per second inside;
  // reduction = damage taken less for time seconds after leaving.
  fortify: { max: 3, cost: [500, 1500, 4500], regen: [0.03, 0.05, 0.08], reduction: [0.1, 0.2, 0.3], time: 180 },

  // The Hunt Board (unlocked by the Slayer core): call a hunted monster at once, with a
  // contract (cost = call x factor x (zone + 1) essence; hp / damage = how much tougher; items,
  // rarity = more and better loot; essence = factor; seals = Soul Seals). Every kind of monster
  // hunted down leaves a trophy: each kind gives the bonuses of trophy.
  huntBoard: {
    call: 100,
    contracts: [
      { id: 'normal', cost: 1, hp: 1, damage: 1, items: 0, rarity: 0, essence: 1, seals: 0 },
      { id: 'fierce', cost: 2.5, hp: 1.6, damage: 1.3, items: 1, rarity: 0, essence: 1.6, seals: 1 },
      { id: 'mythic', cost: 6, hp: 2.6, damage: 1.7, items: 2, rarity: 1, essence: 3, seals: 3 },
    ],
    trophy: { damage: 0.004, hp: 0.004 },
  },

  // Rank trial: the last level of a rank is the gate to the next one. Its XP
  // fills up but the level stays until the trial is passed: a golden gate in
  // the camp with the boss of the next zone (at the last level of your rank)
  // and two stages before it. Passing it gives the level, the new rank and its
  // stat points. Dying costs nothing; you can try again. Same fields as a gate
  // difficulty (see gates.difficulties).
  trial: {
    id: 'trial', pos: { x: -11.5, z: 11.5 },
    hp: 2.6, damage: 1.5, items: 3, minRarity: 3, luck: 2.5, eliteAdds: true, color: 0xffd24a,
    stages: ['wave', 'guard'], wave: 10, elite: 0.2, survive: 25, guards: 2,
    essence: 60, // times (rank + 1)
  },

  // Hunted monsters: now and then a named champion shows up in the zone you
  // are in, marked on the map (and with a beam) until it is slain or it
  // leaves after ttl seconds. It is much tougher and drops good items.
  hunts: {
    first: 240, // seconds of play in the open before the first one
    every: [420, 720], // seconds until the next one
    ttl: 600, // it leaves after this long
    dist: [60, 150], // how far from the hunter it shows up
    hp: 5, damage: 1.25, xp: 6, // on top of a champion
    items: 2, minRarity: 3, luck: 1.5, essence: 30, // essence times (zone + 1)
  },

  minimap: {
    localRadius: 110, // world units shown around the player (tap for the big map)
    refresh: 0.1, // seconds between two redraws
    fogCell: 24, // the map is uncovered in squares of this size ...
    fogReveal: 48, // ... within this distance of the hunter
  },

  // Daily quests: three a day (easy, medium, hard), new ones at midnight. They
  // are about the zone of your rank. n = how many, per difficulty.
  //   essence   per difficulty, times (zone + 1)
  //   rarity    the least rarity of the item, per difficulty
  //   bonus     the least rarity of the extra item when all three are done
  quests: {
    essence: [20, 45, 90],
    rarity: [1, 2, 3],
    bonus: 3,
    // Every claimed quest gives Soul Seals and a choice of one of three rewards:
    // essence, an item, Soul Seals, or a Soul Stone (raises a shadow of a monster
    // kind you pick: tier 0 = normal, 1 = elite, 2 = champion). Per difficulty.
    seals: [1, 2, 3], // always, per quest
    sealBonus: [4, 8, 14], // the Soul Seals option
    stoneTier: [0, 1, 2],
    bonusSeals: 5, // for all three
    // Day streak (a day with a claimed quest; one missed day is forgiven):
    // the reward comes the day the streak reaches the number
    streak: [
      { days: 3, seals: 6 },
      { days: 7, seals: 15, item: 3, xp: 1 },
      { days: 14, seals: 30, stone: 2, key: 1, respec: 1 },
      { days: 30, seals: 60, item: 5, stone: 2, key: 1, xp: 2 },
    ],
    // Double XP Token: for xpBoost.time seconds of play the hunter gets xpBoost.mult times the XP
    // from kills. A Gate Key opens the deadly gate of your zone at keyGate.tier tiers harder
    // than it is now, with keyGate.items more items. At most `max` of each are kept.
    xpBoost: { time: 1800, mult: 2, max: 5 },
    keyGate: { tier: 2, items: 2, max: 5 },
    respec: { max: 5 }, // Respec Tokens: take every Path pick back, no essence needed
    // The Soul Seal shop: seals cost, max per day (0 = unlimited)
    shop: [
      { id: 'stone1', cost: 8, max: 2, tier: 1 },
      { id: 'stone2', cost: 20, max: 1, tier: 2 },
      { id: 'essence', cost: 5, max: 3 }, // essence = 100 x (zone + 1)
      { id: 'revive', cost: 3, max: 0 }, // every fallen shadow stands up
      { id: 'xp', cost: 10, max: 2 }, // a Double XP Token
      { id: 'key', cost: 25, max: 1 }, // a Gate Key
      { id: 'rune', cost: 12, max: 2 }, // a skill rune (one you have not found)
      { id: 'respec', cost: 14, max: 1 }, // a Respec Token
    ],
    kinds: {
      kill: { n: [25, 50, 100] }, // monsters of the zone
      type: { n: [10, 20, 40] }, // one kind of monster of the zone
      elite: { n: [3, 6, 12] }, // elites and champions anywhere
      arise: { n: [3, 6, 12] }, // shadows raised
      chest: { n: [2, 4, 6] }, // chests opened
      stage: { n: [3, 6, 10] }, // gate stages cleared
      gate: { n: [1, 1, 1] }, // a gate of the given difficulty or harder
      outpost: { n: [1, 1, 1] }, // an outpost captured
    },
    pools: [
      ['kill', 'type', 'arise', 'chest'],
      ['type', 'elite', 'stage', 'outpost', 'gate'],
      ['gate', 'elite', 'stage', 'kill'],
    ],
  },

  // Bestiary: every kind of monster gets a page that fills with kills (yours
  // and your army's). steps = kills for name, behaviour, mastered; a mastered
  // kind takes bonus more damage from you and your army.
  bestiary: {
    steps: [1, 25, 100],
    bossSteps: [1, 3, 5],
    bonus: 0.03,
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
    // Enemies below your level always rise. Otherwise:
    // chance[tier] * rankFalloff ^ (ranks the enemy is above you), so one
    // rank above you (e.g. level 10 vs 25) leaves only 7 %.
    chance: [0.9, 0.8, 0.7, 0.6], // at the same level: normal, elite, champion, boss
    rankFalloff: 0.07,
    minChance: 0.01,
    tries: 3,
  },

  shadows: {
    baseSlots: 5, // army slots without Intelligence (each point adds progression.stats.int.slots)
    maxSlots: 40,
    summonCooldown: 2, // seconds between summoning and recalling the army
    tierFactor: [1, 1.8, 2.6, 4], // stat factor: normal, elite, champion, boss

    hpFactor: 0.84, // shadow stats relative to the enemy it was raised from (rank Normal)
    damageFactor: 0.9,
    scale: 0.95,
    followSpeed: 10.5,
    combatSpeedFactor: 1.25, // relative to the enemy's own speed
    teleportDist: 30, // shadows this far from the player are pulled back

    attackRange: 14, // "Attack": hunts enemies this far around the player (+ Perception, see progression.stats.per)
    attackRangeMax: 26,
    guardRange: 9, // "Protect": only fights enemies this close to the player
    // Shadows spread over the enemies: every shadow already on an enemy makes
    // it look this much further away (melee / ranged), so a big army does not
    // pile up on one enemy while others are free.
    crowd: { melee: 1.8, ranged: 0.6 },
    // a melee shadow that cannot get closer (others in the way) strikes from
    // the second row after this many seconds, up to this far past its reach
    blockedTime: 0.3,
    blockedReach: 1.6,

    riseTime: 0.8,
    campRegen: 0.25, // share of max health per second inside the camp
    formation: { firstRadius: 2.8, ringGap: 1.8, firstCount: 6, countStep: 4 },

    xpShare: 0.3, // share of the kill XP for shadows that did not land the kill
    // XP for the next level = xpBase * power of its zone * xpGrowth ^ (level - 1)
    xpBase: 40,
    xpGrowth: 1.12,
    maxLevel: 40,
    levelGrowth: 1.06, // health per shadow level (x10 at level 40)
    // Shadows draw their damage from the hunter (the Shadow Monarch): his
    // weapon, level, Strength and damage bonuses, times share and the
    // shadow's own role, tier, evolution, rank and level. So better gear makes
    // the army stronger too, and a full army deals about as much as the hunter
    // himself. Shadows raised from enemies far below your level get weaker
    // (fresh: (their power / power at your level) ^ freshPower, within
    // freshMin ... freshMax); officers follow your level.
    monarch: { share: 0.055, levelBonus: 0.025, freshPower: 0.25, freshMin: 0.3, freshMax: 1.25 },
    evolveLevels: [5, 12, 22], // shadows evolve at these levels
    evolveScale: 0.18, // size gain per evolution
    evolveBonus: 0.25, // stat gain per evolution

    revive: { cooldown: 12, cooldownPerLevel: 1, cost: 6, costPerLevel: 2 },

    // Ranks of shadows, given in the army tab. mult = health and damage
    // (Elite Knight is about as strong as shadows were before ranks).
    // Every rank above Normal has a limited number (max) and needs a shadow
    // level; a rank can be taken away again. Officers (General and above)
    // carry a name, have no level cap and level up like the hunter: their
    // strength then comes from their own level on the hunter's scale.
    // color = glowing outline on the field (Elite Knight faint, officers bright) and in the army tab.
    ranks: [
      { id: 'normal', mult: 1, color: 0xb8b8c8 },
      { id: 'knight', mult: 1.35, level: 8, max: 10, color: 0x7fb8ff },
      { id: 'eliteKnight', mult: 1.7, level: 16, max: 5, color: 0x5cf0c8 },
      { id: 'general', mult: 2.2, level: 24, max: 3, officer: true, color: 0xffd870 },
      { id: 'commander', mult: 2.7, level: 30, max: 2, officer: true, color: 0xffa040 },
      { id: 'marshal', mult: 3.4, level: 36, max: 1, officer: true, color: 0xff6a8a },
      { id: 'grandMarshal', mult: 4.2, level: 40, max: 1, officer: true, color: 0xe8a0ff },
    ],
    nameMaxLength: 20,

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
      // healers heal first and shoot weak bolts when nobody needs healing
      healer: { hp: 0.8, damage: 0.5, range: 9, windup: 0, cooldown: 2.5, threat: 0.6, heal: 0.1, projectileSpeed: 20 }, // heal = share of the target's max health
    },
  },

  sim: {
    maxEnemies: 20000,
    maxPacks: 4000,
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
  // renderRadius = enemies and shadows further away are not drawn,
  // shadows = soft shadows under characters
  graphics: {
    // "Auto" measures the frame rate while playing and steps down when it
    // stays below lowFps, or up again when it stays above highFps.
    // Before a preset is dropped, the render resolution steps down (scales: share of
    // the preset's resolution); a preset is only dropped once the lowest scale is
    // too slow too. The first 'warm' measurements are shorter, so a new device
    // finds its level quickly.
    auto: { measure: 3, warmMeasure: 1.5, warmRuns: 4, lowFps: 50, highFps: 58, upAfter: 5, scales: [1, 0.85, 0.72, 0.6],
      scaleGain: 1.12, // a step down of the resolution must make it at least this much faster, else the processor is the limit
    },
    bloom: 0.7, // strength of the glow on "ultra"
    presets: {
      // lights = flashes of real light at once; shadowMap / shadowRange = size
      // and area of the sun's shadow map; bloom = glowing effects shine
      low: { pixelRatio: 1, particles: 0.4, decorRadius: 44, renderRadius: 30, shadows: true, lights: 1 },
      medium: { pixelRatio: 1.25, particles: 0.7, decorRadius: 56, renderRadius: 34, shadows: true, lights: 3 },
      high: { pixelRatio: 1.75, particles: 1, decorRadius: 64, renderRadius: 38, shadows: true, realShadows: true, shadowMap: 1536, shadowRange: 26, lights: 4 },
      ultra: { pixelRatio: 3, particles: 1.6, decorRadius: 76, renderRadius: 46, shadows: true, realShadows: true, shadowMap: 3072, shadowRange: 34, lights: 8, bloom: true },
    },
  },

  // Kill streak: kills of the hunter within "window" seconds of each other.
  // From "show" kills on it is shown; every tier gives more XP per kill.
  streak: { window: 2.5, show: 3, tiers: [[10, 0.1], [25, 0.2], [50, 0.35], [100, 0.5]] },

  // Automatic backups of every world (IndexedDB): one a day per slot, the
  // newest "perWorld" of each world are kept, "max" per slot in total.
  backups: { every: 20 * 3600 * 1000, perWorld: 2, max: 5 },

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
    // second colour of the clothes (collar, cuffs, trim, paint)
    accent: [0x16162a, 0x3a2a5a, 0x5a1a2a, 0xc9a24a, 0xb8c0d0, 0x1e5a6a, 0x2a6a3a, 0x8a4dff, 0xd06030, 0xe8e0d0],
    pants: [0x16162a, 0x101014, 0x2a2238, 0x1e2a40, 0x2a3a2a, 0x4a3020, 0x5a5a68, 0xc8c0b0, 0x3a1a2a, 0x6a4a30],
    leather: [0x18161f, 0x2e1e14, 0x4a3020, 0x6a4a2a, 0x2a2a34, 0x5a1a20, 0x1e2a3a, 0xd8d0c0],
  },

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

// Every zone covers the levels of its rank.
CONFIG.world.zones.forEach((z, i) => {
  const L = CONFIG.levels;
  z.level = L.rankLevels[i];
  z.levelTo = (L.rankLevels[i + 1] || L.maxLevel + 1) - 1;
});
