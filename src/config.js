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
    zones: [
      {
        id: 'meadow',
        rank: 'E',
        level: 1,
        inner: 20,
        outer: 150,
        groundColors: [0x3c7a3a, 0x4a8c42, 0x58963c],
        // average decoration pieces per chunk
        decor: { grass: 34, flower: 9, bush: 3, rock: 1.6, tree: 2.2 },
        packs: 26, // enemy packs in this zone
        enemyTypes: ['gloomfang'],
      },
    ],
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
    campRegenPerSec: 30, // health per second while inside the camp
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
    xpBase: 40, // XP for the next level = xpBase * level ^ xpGrowth
    xpGrowth: 1.5,
    maxLevel: 60,
    pointsPerLevel: 3,
    hpPerLevel: 6,
    stats: {
      str: { damage: 0.04 }, // +4 % damage per point
      agi: { speed: 0.008, reload: 0.015 }, // +0.8 % speed, 1.5 % faster reload
      vit: { hp: 12 },
      int: { mana: 8, manaRegen: 0.2 },
      per: { crit: 0.008, drop: 0.02 }, // +0.8 % crit, +2 % drop chance
    },
    baseCrit: 0.05,
    critDamage: 1.8,
    defenseK: 60, // damage taken = K / (K + defence)
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
    rarityStat: [1, 1.25, 1.6, 2.1], // stat factor per rarity
    levelScale: 0.12, // +12 % stats per item level (= level of the zone it dropped in)
    upgradeBonus: 0.1, // +10 % stats per upgrade
    maxUpgrade: 5,
    upgradeCost: [2, 4, 8, 16], // essence per rarity, times (upgrade + 1)
    dismantle: [1, 3, 8, 20], // essence per rarity
    inventorySize: 60,
    armor: { helmet: { defense: 5 }, chest: { defense: 9 }, gloves: { defense: 4 }, boots: { defense: 4 } },
    // one bonus per armour piece, value times the rarity factor
    bonuses: { hp: 14, speed: 0.025, mana: 12, crit: 0.02, reload: 0.04 },
    sets: {
      stalker: { 2: { crit: 0.08 }, 4: { damage: 0.2 } },
      bulwark: { 2: { hp: 60 }, 4: { damageTaken: -0.15 } },
      gravecaller: { 2: { armyDamage: 0.15 }, 4: { armyHp: 0.25, armySlots: 2 } },
    },
  },

  loot: {
    dropChance: [0.05, 1, 1, 1], // normal enemy, elite, champion, boss
    weights: { weapon: 30, armor: 50, skill: 20 },
    pickupRange: 1.8,
    chest: { perZone: 12, items: [1, 2], respawn: 180, openRange: 2.4 },
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

  enemies: {
    packSize: [3, 6],
    packSpacing: 22, // minimum distance between two pack centres
    roamRadius: 5,
    leash: 38, // enemies give up when this far from their pack centre
    targetRange: 16, // enemies look for shadows to attack within this distance
    types: {
      gloomfang: {
        behavior: 'melee',
        shadowRole: 'melee', // tank | melee | ranged | healer
        xp: 10,
        hp: 46,
        damage: 6,
        speed: 5.4,
        radius: 0.75,
        scale: 1,
        aggroRange: 11,
        attackRange: 1.9,
        attackWindup: 0.45, // telegraph before the hit lands
        attackCooldown: 1.3,
      },
    },
  },

  // ---- shadow army --------------------------------------------------------
  souls: {
    duration: 9, // seconds a soul stays after an enemy dies
    ariseRange: 6.5, // the Arise button appears within this distance
  },

  arise: {
    cost: [10, 30, 60, 120], // mana: normal, elite, champion, boss
  },

  shadows: {
    baseSlots: 6, // army slots at rank E
    slotsPerRank: 2,
    reserveMax: 40,
    defaultBehaviors: ['attack', 'guard', 'guard'], // squads A, B, C
    tierFactor: [1, 1.8, 2.6, 4], // stat factor: normal, elite, champion, boss

    hpFactor: 1.4, // shadow stats relative to the enemy it was raised from
    damageFactor: 1.5,
    scale: 0.95,
    followSpeed: 10.5,
    combatSpeedFactor: 1.25, // relative to the enemy's own speed
    teleportDist: 30, // shadows this far from the player are pulled back

    attackRange: 24, // "Attack": hunts enemies this far around the player
    guardRange: 9, // "Guard": only fights enemies this close to the player
    holdRange: 13, // "Hold": fights enemies this close to the held position

    riseTime: 0.8,
    campRegen: 0.25, // fraction of max health per second inside the camp
    formation: { firstRadius: 2.8, ringGap: 1.8, firstCount: 6, countStep: 4 },

    xpShare: 0.3, // share of the kill XP for shadows that did not land the kill
    xpBase: 30, // XP for the next level = xpBase * level ^ xpGrowth
    xpGrowth: 1.35,
    maxLevel: 40,
    hpPerLevel: 0.1,
    damagePerLevel: 0.08,
    evolveLevels: [5, 12, 22], // shadows evolve at these levels
    evolveScale: 0.18, // size gain per evolution
    evolveBonus: 0.25, // stat gain per evolution

    revive: { cooldown: 12, cooldownPerLevel: 1, cost: 6, costPerLevel: 2 },

    roles: {
      tank: { hp: 2.2, damage: 0.7, range: 1.9, windup: 0.35, cooldown: 1.4, threat: 2.5 },
      melee: { hp: 1.0, damage: 1.0, range: 1.9, windup: 0.3, cooldown: 1.1, threat: 1 },
      ranged: { hp: 0.7, damage: 0.9, range: 11, windup: 0.35, cooldown: 1.5, threat: 0.8, projectileSpeed: 22 },
      // healers do not attack; heal = health restored per cast
      healer: { hp: 0.8, damage: 0, range: 9, windup: 0, cooldown: 2.5, threat: 0.6, heal: 14, healPerLevel: 0.08 },
    },
  },

  sim: {
    maxEnemies: 1024,
    activeRadius: 55, // enemies further away are not simulated
    renderRadius: 36, // enemies further away are not drawn
    respawnTime: 40,
    respawnMinPlayerDist: 45, // packs only respawn when the player is away
  },

  input: {
    moveDeadzone: 0.14,
    aimDeadzone: 0.28, // attack stick must be dragged this far to aim
  },

  graphics: {
    maxPixelRatio: 1.5,
  },

  // Default look until the skin editor exists (milestone 4).
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
