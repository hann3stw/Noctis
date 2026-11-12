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
    campRegenPerSec: 30, // health per second while inside the camp
    respawnDelay: 2.5,
    hurtInvuln: 0.0, // extra invulnerability after being hit
    startWeapon: 'sword',
    charges: {
      max: 3,
      reload: 1.3, // seconds per charge, one after another
    },
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

  weapons: {
    sword: {
      shape: 'arc', // arc slash in front of the player
      damage: 22,
      range: 4.6,
      arcDeg: 110,
      cooldown: 0.3, // minimum time between two attacks
    },
  },

  enemies: {
    packSize: [3, 6],
    packSpacing: 22, // minimum distance between two pack centres
    roamRadius: 5,
    leash: 38, // enemies give up when this far from their pack centre
    types: {
      gloomfang: {
        behavior: 'melee',
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
