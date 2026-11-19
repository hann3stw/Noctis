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
    daggers: { shape: 'arc', damage: 10, range: 3.2, arcDeg: 80, cooldown: 0.12, reload: 0.6 },
    sword: { shape: 'arc', damage: 22, range: 4.6, arcDeg: 110, cooldown: 0.3, reload: 1.3 },
    spear: { shape: 'thrust', damage: 23, range: 7.5, width: 1.5, cooldown: 0.3, reload: 1.25 },
    hammer: { shape: 'slam', damage: 38, range: 3, radius: 3.3, stun: 0.5, cooldown: 0.55, reload: 2.2 },
    scythe: { shape: 'circle', damage: 19, range: 4.4, cooldown: 0.4, reload: 1.5 },
    bow: { shape: 'line', damage: 31, range: 17, width: 0.7, speed: 40, cooldown: 0.35, reload: 1.5 },
    staff: { shape: 'blast', damage: 26, range: 11, radius: 3, delay: 0.35, cooldown: 0.4, reload: 1.7 },
    // jumps: how often the bolt jumps on, each time with jumpDamage of the hit before
    grimoire: { shape: 'chain', damage: 19, range: 12, coneDeg: 50, jumps: 3, jumpRange: 6.5, jumpDamage: 0.7, cooldown: 0.35, reload: 1.3 },
  },

  // ---- items ----------------------------------------------------------------
  items: {
    // Seven rarities: common, uncommon, rare, epic, legendary, mythic, exotic.
    // Which ones drop depends on the rank of the item level: early ranks give
    // mostly common and uncommon items, legendary items start in rank D,
    // mythic ones in rank B, exotic ones in rank SSS. A 0 means: not in this rank.
    rarityWeights: [
      [60, 30, 9, 1, 0, 0, 0], // E
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
    luckStep: 0.6,
    // Rarity counts more than the item level: a rarer item is nearly always
    // better than a more common one from the next zone.
    // index 7 = unique: never rolled by chance, only from the Abyss (see abyss.unique)
    rarityStat: [1, 1.2, 1.5, 2, 2.7, 3.6, 4.8, 6.5], // stat factor per rarity
    upgradeBonus: 0.1, // +10 % stats per upgrade
    maxUpgrade: 5,
    upgradeCost: [2, 3, 5, 8, 14, 24, 40, 70], // essence per rarity, times (upgrade + 1)
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
    floorPower: 1.1,
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
      timeLimit: { gate: 150, floor: 90 }, // seconds for a gate / for an Abyss floor
      swift: { speed: 1.3 }, // faster enemies
      weakArmy: { damage: 0.5 }, // your shadows deal half damage
      elites: { chance: 0.45 }, // many more elites (gate helpers are all elites)
      tough: { hp: 1.5 }, // enemies have more health
      manaCurse: { cost: 2 }, // skills cost twice the mana
    },
  },

  // Unique items: one fixed special effect each. A weapon gets one of the
  // weapon effects, a piece of armour the effect of its slot.
  uniques: {
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
    dropChance: [0.05, 1, 1, 1], // normal enemy, elite, champion, boss
    weights: { weapon: 30, armor: 50, skill: 20 },
    pickupRange: 1.8,
    chest: { items: [1, 2], respawn: 180, openRange: 2.4 }, // count per zone: see zones
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
    darkMend: { mana: 30, cooldown: 16, aim: 'self', radius: 12, healSelf: 0.22, healArmy: 0.35 },
    // buffs
    warCry: { mana: 30, cooldown: 20, aim: 'self', radius: 12, armyDamage: 0.4, duration: 8 },
    bloodRage: { mana: 25, cooldown: 18, aim: 'self', radius: 3, damage: 0.3, speed: 0.15, duration: 7 },
  },

  // The ultimate charges with every enemy hit. While an ultimate with a
  // duration is active, hits do not charge the next one.
  ultimates: {
    nightfall: { aim: 'self', radius: 10, power: 9, stun: 2 },
    legionsCall: { aim: 'self', radius: 12, armyDamage: 0.6, duration: 12 }, // also revives every fallen shadow
    eclipse: { aim: 'self', radius: 3, duration: 5, damage: 0.2 }, // +20 % damage, attacks cost no charges
    voidStorm: { aim: 'point', range: 10, radius: 6.5, power: 1, ticks: 12, interval: 0.5 },
    umbralAegis: { aim: 'self', radius: 6, healSelf: 0.4, shield: 0.8, duration: 10, stun: 1.5 },
    oblivionRay: { aim: 'line', range: 24, width: 3, power: 16 },
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
      // ---- shattered expanse (SS)
      shardGolem: { behavior: 'melee', shadowRole: 'tank', xp: 15, hp: 100, damage: 11, speed: 3.8, radius: 1, scale: 1.15, aggroRange: 10, attackRange: 2.3, attackWindup: 0.6, attackCooldown: 1.7 },
      prismWisp: { behavior: 'ranged', shadowRole: 'ranged', xp: 14, hp: 38, damage: 9, speed: 4.6, radius: 0.6, scale: 1, aggroRange: 15, attackRange: 13, attackWindup: 0.5, attackCooldown: 1.8, shotSpeed: 20, shotColor: 0xd080ff },
      glassStalker: { behavior: 'charger', shadowRole: 'melee', xp: 14, hp: 55, damage: 12, speed: 5.6, radius: 0.8, scale: 1.05, aggroRange: 14, attackRange: 1.9, attackWindup: 0.55, attackCooldown: 2.6, chargeRange: 14, chargeSpeed: 26, chargeTime: 0.55 },
      // ---- stormspire highlands (SSS)
      stormBrute: { behavior: 'melee', shadowRole: 'tank', xp: 15, hp: 105, damage: 12, speed: 3.9, radius: 1, scale: 1.2, aggroRange: 10, attackRange: 2.4, attackWindup: 0.6, attackCooldown: 1.7 },
      voltWisp: { behavior: 'ranged', shadowRole: 'ranged', xp: 14, hp: 36, damage: 10, speed: 5, radius: 0.6, scale: 1, aggroRange: 16, attackRange: 13, attackWindup: 0.45, attackCooldown: 1.6, shotSpeed: 24, shotColor: 0x60d0ff },
      thunderhorn: { behavior: 'charger', shadowRole: 'melee', xp: 15, hp: 60, damage: 13, speed: 5.4, radius: 0.85, scale: 1.1, aggroRange: 14, attackRange: 2, attackWindup: 0.6, attackCooldown: 2.6, chargeRange: 15, chargeSpeed: 27, chargeTime: 0.55 },
      // ---- titans' graveyard (L)
      boneColossus: { behavior: 'melee', shadowRole: 'tank', xp: 16, hp: 115, damage: 12, speed: 3.6, radius: 1.05, scale: 1.25, aggroRange: 10, attackRange: 2.5, attackWindup: 0.65, attackCooldown: 1.8 },
      gravePriest: { behavior: 'ranged', shadowRole: 'healer', xp: 15, hp: 42, damage: 10, speed: 4, radius: 0.6, scale: 1, aggroRange: 14, attackRange: 12, attackWindup: 0.6, attackCooldown: 2, shotSpeed: 16, shotColor: 0x80ff90 },
      ribHound: { behavior: 'charger', shadowRole: 'melee', xp: 15, hp: 56, damage: 13, speed: 5.8, radius: 0.8, scale: 1, aggroRange: 14, attackRange: 1.9, attackWindup: 0.55, attackCooldown: 2.5, chargeRange: 14, chargeSpeed: 26, chargeTime: 0.55 },
      // ---- throne of the void (M)
      voidKnight: { behavior: 'melee', shadowRole: 'melee', xp: 17, hp: 95, damage: 14, speed: 4.4, radius: 0.9, scale: 1.15, aggroRange: 12, attackRange: 2.4, attackWindup: 0.5, attackCooldown: 1.4 },
      voidEye: { behavior: 'ranged', shadowRole: 'ranged', xp: 16, hp: 40, damage: 11, speed: 4.8, radius: 0.65, scale: 1, aggroRange: 16, attackRange: 14, attackWindup: 0.45, attackCooldown: 1.6, shotSpeed: 22, shotColor: 0xb070ff },
      nightmare: { behavior: 'charger', shadowRole: 'melee', xp: 16, hp: 60, damage: 14, speed: 6, radius: 0.85, scale: 1.1, aggroRange: 15, attackRange: 2, attackWindup: 0.5, attackCooldown: 2.4, chargeRange: 15, chargeSpeed: 28, chargeTime: 0.55 },

      // ---- gate bosses (meadow values, multiplied by their zone like everything else)
      // patterns: see bossPatterns. shadowBase = stats of the boss as a shadow.
      thornmaw: { boss: true, behavior: 'boss', shadowRole: 'melee', xp: 200, hp: 900, damage: 12, speed: 4.6, radius: 1.8, scale: 2.4, aggroRange: 40, attackRange: 3.4, attackWindup: 0.6, attackCooldown: 1.4, patterns: ['slam', 'charge', 'summon'], adds: 'gloomfang', shadowBase: { hp: 90, damage: 11 } },
      barkhide: { boss: true, behavior: 'boss', shadowRole: 'tank', xp: 200, hp: 1000, damage: 12, speed: 3.6, radius: 2, scale: 2.2, aggroRange: 40, attackRange: 3.6, attackWindup: 0.7, attackCooldown: 1.6, patterns: ['slam', 'eruption', 'summon'], adds: 'mossback', shadowBase: { hp: 130, damage: 13 } },
      mireMatriarch: { boss: true, behavior: 'boss', shadowRole: 'healer', xp: 200, hp: 950, damage: 11, speed: 3, radius: 2, scale: 2.4, aggroRange: 40, attackRange: 3.4, attackWindup: 0.7, attackCooldown: 1.6, patterns: ['nova', 'eruption', 'summon'], adds: 'mirecrawler', shadowBase: { hp: 110, damage: 10 } },
      hollowKing: { boss: true, behavior: 'boss', shadowRole: 'melee', xp: 200, hp: 1000, damage: 13, speed: 4.2, radius: 1.8, scale: 2.3, aggroRange: 40, attackRange: 3.6, attackWindup: 0.6, attackCooldown: 1.4, patterns: ['charge', 'slam', 'volley'], adds: 'sentinel', shadowBase: { hp: 140, damage: 16 } },
      rimeclaw: { boss: true, behavior: 'boss', shadowRole: 'tank', xp: 200, hp: 1100, damage: 13, speed: 4, radius: 2, scale: 2.4, aggroRange: 40, attackRange: 3.8, attackWindup: 0.65, attackCooldown: 1.5, patterns: ['nova', 'slam', 'charge'], adds: 'snowram', shadowBase: { hp: 170, damage: 15 } },
      pyrelord: { boss: true, behavior: 'boss', shadowRole: 'ranged', xp: 200, hp: 1200, damage: 14, speed: 3.8, radius: 1.9, scale: 2.5, aggroRange: 40, attackRange: 3.6, attackWindup: 0.6, attackCooldown: 1.4, patterns: ['eruption', 'nova', 'volley', 'summon'], adds: 'emberImp', shadowBase: { hp: 150, damage: 20 } },
      crystalTyrant: { boss: true, behavior: 'boss', shadowRole: 'tank', xp: 200, hp: 1300, damage: 15, speed: 3.8, radius: 2, scale: 2.4, aggroRange: 40, attackRange: 3.8, attackWindup: 0.65, attackCooldown: 1.5, patterns: ['nova', 'slam', 'volley', 'summon'], adds: 'shardGolem', shadowBase: { hp: 180, damage: 17 } },
      stormcaller: { boss: true, behavior: 'boss', shadowRole: 'ranged', xp: 200, hp: 1300, damage: 16, speed: 4.2, radius: 1.9, scale: 2.4, aggroRange: 40, attackRange: 3.6, attackWindup: 0.6, attackCooldown: 1.4, patterns: ['volley', 'charge', 'nova', 'summon'], adds: 'voltWisp', shadowBase: { hp: 160, damage: 22 } },
      titanLich: { boss: true, behavior: 'boss', shadowRole: 'healer', xp: 200, hp: 1450, damage: 16, speed: 3.4, radius: 2.1, scale: 2.6, aggroRange: 40, attackRange: 3.8, attackWindup: 0.7, attackCooldown: 1.5, patterns: ['eruption', 'slam', 'summon', 'nova'], adds: 'boneColossus', shadowBase: { hp: 190, damage: 15 } },
      voidSovereign: { boss: true, behavior: 'boss', shadowRole: 'melee', xp: 200, hp: 1600, damage: 18, speed: 4.4, radius: 2, scale: 2.6, aggroRange: 40, attackRange: 3.8, attackWindup: 0.55, attackCooldown: 1.3, patterns: ['eruption', 'nova', 'volley', 'charge', 'summon'], adds: 'voidKnight', shadowBase: { hp: 200, damage: 24 } },
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
    // Gate bosses have hp x boss.hp x their gate's difficulty. With good gear
    // a boss of your level takes about 1-1.5 min alone with ordinary gear,
    // 10-30 s with the best legendary gear; the army helps.
    hp: 8,
    pause: 1.4, // seconds between two attacks
    enrageAt: 0.5, // below this share of health the boss gets faster
    enrageSpeed: 1.35,
    stunResist: 0.5, // bosses are stunned for this share of the time
    shotRadius: 0.5,
  },

  // Gates are about loot and strong shadows. Only the zone you are in has
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
      { id: 'normal', level: 0.2, hp: 1, damage: 1, items: 3, minRarity: 2, luck: 1, eliteAdds: false, color: 0xffffff },
      { id: 'hard', level: 0.5, hp: 1.6, damage: 1.25, items: 4, minRarity: 2, luck: 1.8, eliteAdds: true, color: 0xffb040 },
      { id: 'deadly', level: 0.85, hp: 2.6, damage: 1.5, items: 5, minRarity: 3, luck: 3, eliteAdds: true, color: 0xff3050 },
    ],
    ariseBonus: 0.2, // souls inside a gate are easier to raise (+20 %)
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
    levelGrowth: 1.06, // health and damage per shadow level (x10 at level 40)
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
    auto: { measure: 3, lowFps: 50, highFps: 58, upAfter: 5 },
    bloom: 0.7, // strength of the glow on "ultra"
    presets: {
      // lights = flashes of real light at once; shadowMap / shadowRange = size
      // and area of the sun's shadow map; bloom = glowing effects shine
      low: { pixelRatio: 1, particles: 0.4, decorRadius: 44, renderRadius: 30, shadows: false, lights: 1 },
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
