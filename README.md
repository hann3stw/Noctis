# Noctis

3D open-world action game for tablets and phones (landscape, touch). Hunt
monsters and raise them as your shadow army. Built with Three.js and Vite.

## Run it

```bash
npm install
npm run dev
```

Open the address Vite prints. To test on a tablet or phone in the same Wi-Fi,
open the "Network" address (e.g. `http://192.168.x.x:5173`) on the device.

Production build: `npm run build` (also draws the app icons), then
`npm run preview`.

## Play it online / install it

The game is a PWA: once opened it works offline and can be installed like an
app (fullscreen, landscape, own icon).

Live version: **https://hann3stw.github.io/Noctis/**

### Install on an Android tablet or phone (Chrome)

1. Open the link above in Chrome.
2. Wait a moment, then tap the menu (three dots) -> **Install app** (on some
   devices: **Add to Home screen** -> Install).
3. Start Noctis from the home screen icon. It runs fullscreen in landscape and
   also works without internet.

### Install on an iPhone or iPad (Safari)

1. Open the link in **Safari** (other browsers on iOS cannot install apps).
2. Tap the **Share** button -> **Add to Home Screen** -> Add.
3. Start Noctis from the home screen. Turn the device sideways.

Saves live in the browser storage of the installed app. Uninstalling the app
or clearing the site data deletes them.

### Updates

The installed app updates itself: after a new version is online, it is
loaded in the background and used the next time the app is started.

## Hosting on GitHub Pages (free)

Already set up for this repository: `.github/workflows/deploy.yml` builds the
game and publishes `dist/` on every push to `main` (and the working branch).

To set it up for a fork or a new repository:

1. Push the project to GitHub.
2. Repository -> **Settings** -> **Pages** -> Source: **GitHub Actions**.
3. Push a commit (or run the workflow by hand under **Actions** -> Deploy to
   GitHub Pages -> Run workflow).
4. After a minute the game is online at
   `https://<user>.github.io/<repository>/`. The build uses relative paths,
   so any repository name works.

Any other static host works as well (Netlify, Cloudflare Pages, itch.io as
HTML game): upload the contents of `dist/` after `npm run build`. PWAs need
HTTPS (or localhost) for offline mode and installing.

## Graphics and performance

- Settings -> Graphics: **Auto** (default) measures the frame rate while
  playing and switches between Low, Medium and High by itself; it never goes
  back up to a level that was too slow. Or pick a level by hand.
- Presets (in `src/config.js` -> `graphics`): render resolution limit, view
  distance of plants and rocks, draw distance of enemies and shadows, effect
  particles, soft shadows under characters.
- Measured in the worst case (volcano, 32 shadows, 54 enemies fighting) on a
  desktop GPU: game logic 0.5 ms and drawing 1.9 ms per frame at tablet
  resolution (2240 x 1400, High), 82 draw calls, about 60 000 triangles.
  Enemies far away are not simulated, everything repeated is drawn with
  instancing and nothing is allocated per frame.
- The hunter is built from many small parts; the rigid parts of every body group
  are merged into one mesh when the model is made (`src/render/models/batch.js`):
  38 meshes become 13. The hunter is drawn three times a frame (the scene, the
  see-through outline and the sun's shadow), so this saves about 70 draw calls a
  frame (measured: 240-280 down to 165-200 on High). Parts that move on their own
  (flames, orbs, halo) and glowing parts stay separate.

## Controls

| | Touch | PC (testing) |
|---|---|---|
| Move | Left half of the screen (joystick appears under the finger) | WASD / arrow keys |
| Attack | Drag the attack button to aim, release to strike. Quick tap = auto-aim | Hold left mouse button to aim, release to strike |
| Dodge | Dodge button | Space / right mouse button |
| Arise | Arise button (appears next to a fallen enemy's soul) | E |
| Summon / recall the army | Summon / Recall button (bottom centre) | 1 |
| Army behaviour | Tap the Army chip: Attack <-> Protect | 2 |
| Revive fallen shadows | Green button above the army chip | 3 |
| Skills | Drag a skill button to aim, release to cast. Quick tap = auto-aim | Q / R (towards the mouse) |
| Ultimate | Ultimate button (charges by landing hits) | F |
| Menu | Menu button (top right): Gear, Stats, Skills, Army, Look. Equipment, skills and your look can only be changed in the camp or a captured outpost; the army anywhere | click it |
| Pause | Pause button (top right corner) | Esc |
| Enter / leave a gate | Enter button (appears next to a gate); Leave button once the boss is beaten | G |
| Minimap | Tap it: close view <-> whole world | M |

## World

- Ten big ring shaped zones around the camp: Whispering Meadow (E), Gloomwood
  (D), Rotmire Swamp (C), Sunken Ruins (B), Frostfang Peaks (A), Ashen Caldera
  (S), Shattered Expanse (SS), Stormspire Highlands (SSS), Titans' Graveyard
  (L) and Throne of the Void (M). Every rank multiplies enemy health, damage
  and XP by 10: enemies two ranks above you kill you with one hit, but they
  also give 10x the XP. New zones are only added at the outside, so saved
  worlds keep their outposts, gates and chests.
- The rank comes from the level: E = level 1-9, D = 10-24, C = 25-49,
  B = 50-99, A = 100-199, S = 200-299, SS = 300-449, SSS = 450-649,
  L = 650-849, M = 850-1000. Every zone covers the levels of its rank;
  enemies get higher levels (up to about x6 stronger) towards the outer edge
  of their zone. Every new rank gives many stat points (10, 12, 15, 18, 20,
  22, 25, 28, 30); levels give 3 points in E, 2 in D, 1 in C and B, one every
  second level in A and S and one every third level from SS on.
- Normal enemies get extra health in later ranks (`levels.enemyHpRank`):
  with good gear an enemy of your level takes about 2-3 hits from rank A on,
  about one with perfect gear; early ranks stay quick. Kills give a bit more
  XP and shadows deal a bit more damage to make up for it. Bosses keep their
  health.
- The hunter grows x6 per rank from levels alone. The rest of the step to the
  next zone must come from better gear, stat points and the army. All level
  values sit in `src/config.js` -> `levels`. Old saves are moved to the new
  levels automatically.
- Four difficulties, chosen when a world is made; they cannot be changed
  later (the settings only show it): Easy (enemies 70 % health, 60 % damage),
  Normal (x1 / x1.1), Hard (x1.5 / x1.75, slightly better loot) and Extreme
  (x2.4 / x2.8, better loot; in rank E x1.6 / x1.8). Worlds from before keep Hard.
  Values: `src/config.js` -> `difficulty`.
- Kills of your shadows give you half the XP.
- Every zone has three enemy types (melee, ranged, charger). Elites (gold
  ring) and champions (red ring, with two escorts) are much stronger and always
  drop loot. Their shadows get an ability: tanks taunt, melee shadows cleave,
  ranged shadows fire a volley, healers heal everyone.
- Four outposts per zone (north, east, south, west) start in enemy hands: beat
  the guards, then stay in the circle for 6 seconds. A captured outpost is
  safe like the camp (healing, gear, army, look), opens its chest (3 items), is
  your respawn point after dying, and you can travel between all captured
  outposts.
- The zone you are in has three gates open: Normal, Hard and Deadly (boss level
  at 20 %, 50 % and 85 % of the zone's levels; Hard and Deadly bosses also have
  more health and damage, elite helpers and better loot: 3 / 4 / 5 items).
  A gate leads into an arena with the zone's boss (own attack patterns,
  telegraphed with red circles). It closes once you enter, win or lose, and
  opens again 2.5-5 minutes later at another spot of the zone. Gates of other
  zones are not there (and not on the minimap) until you walk into that zone.
  After the boss falls you stay in the arena as long as you like (raise the
  boss, collect the loot) and leave with the Leave button; loot still lying
  around comes out with you. Gates are for loot and strong shadows: souls
  inside a gate are easier to raise (+20 %). The minimap outlines gates in
  their difficulty colour (white, orange, red).
- Bosses have 8x the health of their level: a boss of your level takes about
  1.5-2 minutes alone with ordinary gear and still 10-30 seconds with the best
  legendary gear, in every rank.

## Endgame (level 1000)

- **Mastery**: XP after level 1000 fills mastery levels (the XP bar turns
  cyan). Every mastery level gives a point for the Stats tab: +1 % damage,
  health, shadow damage, shadow health or loot, or +0.5 % crit. No limit.
- **The Abyss**: the red portal in the camp, open from level 1000. Endless
  floors with two waves of enemies from all zones, a zone boss every 5th
  floor; every floor is 10 % stronger. After a floor: Next floor or Leave
  (the loot comes along). Every cleared boss floor becomes a start point for
  later runs; the best floor is saved. Abyss items have item level 1000 +
  5 per floor and keep getting a little stronger.
- **Modifiers** (up to 3, from rank A on): chosen in the Abyss panel or with
  the Mods button in front of any gate, and kept until changed. Volatile (enemies explode),
  No Mercy (no healing), Against the Clock (150 s per gate, 90 s per Abyss
  floor), Swift, Lonely Hunter (shadows deal half damage), Elite Horde,
  Hardened (+50 % enemy health), Mana Curse (skills cost double). Every
  modifier gives +25 % loot luck and +25 % XP.
- **Unique items** (rarity 8, x6.5, rainbow frame) drop only in the Abyss:
  one chance per cleared floor, 0.2 % on a normal floor and 1 % on a boss
  floor, a bit more on deep floors and with modifiers. A drop shows a big card with rays and its own sound. Each
  has one special effect: Echo of the Fallen (every 5th attack a shadow
  wave), Stormbinder (hits zap 2 enemies), Soulreaper (kills heal and give a
  charge back), Last Rites (+80 % damage below 30 % health), Crown of Insight
  (+50 % crit damage), Bastion of Night (a shield when hit), Frenzy Grips
  (faster reload with every hit), Voidstep Treads (dodging leaves an
  explosion). Values: `src/config.js` -> `mastery`, `abyss`, `modifiers`,
  `uniques`.

## Classes and the Awakening

Everyone starts as a neutral hunter. The class grows from the way you play,
measured as nine **affinities** (0–100, `src/core/affinities.js`): Might,
Precision, Agility, Arcana, Resilience, Dominion, Instinct, Discovery and
Control. Only actions that really happened count (a hit that landed, a skill
that went off, damage a shield really took …), each kind at most a few times per
second. A long-term profile and a recent one (the last ~5 hours of active play
in 30 slices of 10 minutes) are mixed 65 / 35. Pauses and menus do not count.
With less than 10 minutes of play the values stay low. The affinities are in
the Hero → Stats page; the class part (progression A–M, evolutions, history) is
folded into the **Path** tab.

| Rank (level) | Step | What happens |
|---|---|---|
| D (10) | First Awakening | Fighter, Ranged, Mage or Necromancer; all four can be picked, the one that fits the affinities is marked |
| C (25) | Specialization | stay, the plain sibling (Warrior ↔ Rogue, Mage ↔ Cleric) or a hybrid that is unlocked (see below); a hybrid is shown only when it can really be taken |
| B (50) | Class Evolution | Warrior → Berserker, Mage → Stormcaller, Ranger → Beastmaster, Cleric or Paladin → Sentinel, when the affinities fit; staying is always possible and you are asked again at the next rank |
| A (100) | Advanced Mastery | an improvement of the class mechanic + a pick of a skill modifier |
| S (200) | Class Mastery | a pick between two ways to grow the core mechanic + an ultimate improvement |
| SS (300) | Unique Evolution | a unique variant that needs certain affinities; once open it stays |
| SSS (450) | Transcendence | an extension of the core mechanic |
| L (650) | Legendary Evolution | a pick between two legendary branches |
| M (850) | Mythic Evolution | the Mythic Class Trait and the last step of the ultimate or core |

**Hybrids at rank C.** A hybrid class is shown only when it is unlocked and can be
picked: it is ready (`ready: true` in `CONFIG.classes.list`) and its affinity needs
are met. Locked hybrids are hidden completely: no card, no lock symbol, no preview
with missing requirements. A hybrid that was unlocked once stays available through
the class history, even if the affinities drop later. `ready: false` locks a class
for good (it is never offered, whatever the affinities say), and the same check
(`specAllowed`) guards the offers, the class panel and the class change itself.
The same goes for evolutions that are not playable yet: the class path shows only
what can be taken now. The classes stay defined in `CONFIG.classes.list` for later.

**One choice per rank-up.** At D, C and B the class choice (when one comes) is
the choice; the Path pick of that rank is then taken for you (the card that fits
your play best; a Respec Token can change it). At A, S and L every Path card
also carries one of the two options of the class step of that rank, so one pick
decides both. SS, SSS and M steps need no choice. A class step that no pick
carries (older worlds, or a class taken later) waits in the Path tab.

Steps A–M exist for all playable classes: Berserker, Stormcaller, Beastmaster,
Sentinel, Warrior, Mage, Rogue, Ranger, Cleric and Necromancer. The hybrids
(Spellblade, Paladin, Arcane Archer, Skirmisher, Death Knight, Bone Archer,
Warlock, Commander) use the tree of their base class. Every step changes real
numbers of the game (mechanics, skills, ultimates, bonuses); the tree shows them,
made from the same data. Picks are for good and saved. Data:
`src/core/classProgression.js`.

**Families**: Vanguard, Predator, Arcanist, Warden, Dominion, Abyssal (the last
one is prepared only). **Prepared, not playable yet** (never offered, their
skills never drop): Assassin, Phantom Duelist, Elementalist, Huntmaster,
Riftwalker, Void Reaver, Gravity Weaver.

### The four evolution classes

| Class | Mechanic (on top of the base class) | Skills | Ultimate |
|---|---|---|---|
| Berserker (Warrior) | Momentum: from 50 Rage melee hits build up to 3 stacks; the next melee skill spends them for more damage | Frenzy Cleave, Reckless Charge | Bloodstorm |
| Stormcaller (Mage, Spell Forge) | Storm Overload: lightning cast with 3 / 5 Arcane Charges leaps to 1 / 2 more enemies | Thunder Lance, Stormfield | Tempest Ascension |
| Beastmaster (Ranger) | Companion Bond: grows with the companion's hits and kills, Pack Assault spends it | Prey Mark, Pack Assault | Primal Apex |
| Sentinel (Cleric / Paladin) | Aegis: damage the Sentinel's own shields and guards prevent | Aegis Oath, Radiant Sweep | Last Bastion |

The first skill and the ultimate come with the class. The second skill is
guaranteed: by the class quest (mastery level 2 of the first skill) or at the
latest at rank A; loot can bring it earlier. Locked skills say in the Skills page
why and how they open (rank, class quest or loot).

### Changing class

- Learned skills are never lost: the ones the new class cannot use are put away
  and come back with a class that can use them (mastery and runes stay).
- **Shadow army**: only classes with army access lead it. With another class the
  shadows stay saved with everything they are, but they do not fight, learn, get
  hit or appear. Back to such a class, they rise around you as they were.
- **Companion** (Ranger line): its own creature with its own identity, level, XP,
  health and upgrades, saved apart from the army (`companion` in the save). It
  is never a shadow, never takes an army place and gets only companion bonuses.
  With a class of another line it rests; it comes back as it was.

## The Path

Every rank from D to M gives a Path pick (a "class" of the Path, built from a core).
The Path tab shows the way from D to M (picks and class steps), the offer, what is
in force and the class part.

- **Thirteen cores.** From the start: Blade, Commander, Mage, Tank, Slayer, Delver
  (as far as the class has them). Later: Predator, Blood, Elemental (rank C), Flow,
  Sanctum, Fortune (rank B), Void (rank S). Each class has 7–10 cores that fit it.
  Every core has bonuses, a class skill in three levels (the skill of the core of
  the last pick is the one in force) and nine names.
- **Offers with roles.** Deepen (the core of the last pick), Branch out (the core
  picked least, or a core that just opened: "Newly found") and Wildcard (another
  core). Two offers in a row are never the same three cores. The cards can be
  rolled anew once per rank for essence (the first card stays).
- **Special cards** on the Wildcard (each once, never the same kind twice in a
  row): pacts (a strong bonus with a real cost), class cards (change the core
  mechanic of the class line) and synergies (grow with the picks of another core).
- **Keystones** at the 2nd, 4th, 6th and 8th pick of a core: something the core
  does not give otherwise (an attack charge, healing per hit, army slots …).
- **Combos**: two picks or more of two matching cores give a bonus on top (for
  example Blade + Slayer: Executioner).
- **Respec**: one Respec Token takes the last pick back; all picks cost two.
  Class steps that came with a pick stay.
- Values: `src/config.js` → `paths` (cores, keystones, combos, specials, reroll,
  respecAll).

## Shadow army

- Raise defeated enemies with Arise. Enemies below your level always rise;
  above it the chance falls fast (one rank above you: about 7 %). Elites,
  champions and bosses are a bit harder. Every soul allows 3 tries, each costs
  mana. The chance and every result show as a small note above the army.
- Summon the whole army or send it back into the shadows to fight alone.
  Summoned, it either attacks on its own or protects you.
- Army size comes from Intelligence (5 slots + 1 per 2 points, plus the
  Gravecaller set). On "Attack" the army hunts enemies 14 units around you,
  +0.25 per Perception point (up to 26). Shadows grow with their own levels and evolve.
- Shadows spread over the enemies (every shadow already on an enemy makes it
  less attractive), melee shadows that cannot get through strike from the
  second row, and healers shoot weak bolts while nobody needs healing.
  Values: src/config.js -> shadows.crowd, blockedTime, blockedReach.
- Shadow ranks (army tab), as health and damage: Normal x1 (every new
  shadow), Knight x1.35 (10x, shadow level 8), Elite Knight x1.7 (5x,
  level 16, about the strength shadows had before ranks), General x2.2 (3x,
  level 24), Commander x2.7 (2x, 30), Marshal x3.4 (1x, 36) and Grand Marshal
  x4.2 (1x, 40). A rank can be taken away again (back to Normal). Elite
  Knights get a faint glowing outline in their rank colour, officers a
  bright pulsing one; ranks below have none. Officers
  (General and above) get a name, have no level cap and level up like the
  hunter: their strength then comes from their own level on the hunter's
  scale. Values: `src/config.js` -> `shadows.ranks`.
- The army tab sorts by power, level or rank and filters by rank group
  (officers, knights, normal) and role; the right side shows the selected
  shadow with promote, titles, name and dismiss, or the title overview.
- The army can be managed anywhere. When it is full and you press Arise, the
  army list opens so you can dismiss a weaker shadow and raise the strong one
  (the game is paused meanwhile, so the soul does not fade).

## Items and stats

- Seven rarities: Common x1, Uncommon x1.2, Rare x1.5, Epic x2, Legendary x2.7,
  Mythic x3.6, Exotic x4.8 (turquoise, shimmering); the item level adds x1.27
  per rank. Which rarities drop depends on the rank: rank E gives at most
  Epic, Legendary starts in D, Mythic in B, Exotic in SSS, and the better ones
  get more common in every later rank.
  Elites, chests, Perception and gates (Deadly: at least Epic) raise the luck.
- Eight weapons, all about equally strong but played differently: Daggers
  (very fast, short), Sword (wide arc), Spear (long thrust through a row of
  enemies), Hammer (slow slam that stuns), Scythe (full circle), Bow (long
  line), Staff (delayed blast at a point), Grimoire (bolt that jumps between
  enemies).
- Six armour sets with their own look and emblem (shown on every item tile):
  Stalker (crit, damage), Bulwark (health, less damage taken), Gravecaller
  (stronger and bigger army), Stormrunner (reload, speed, a fourth attack
  charge), Voidweaver (mana, skill damage, shorter cooldowns), Bloodreaver
  (heal on kill and on hit). 2 and 4 pieces give the set bonuses.
- 14 skills and 6 ultimates. Skill damage comes from the weapon's item level
  and rarity, not from its type (`skillBase`), so every weapon suits every
  skill. The ultimate does not charge while an ultimate is running (Eclipse,
  Void Storm, Umbral Aegis).
- Weapons are compared by DPS (damage per second on one enemy = damage per
  hit / reload time); the item shows DPS, damage per hit and what it hits.
  The Stats tab shows your real DPS with reload speed and crits.
- Every weapon type and every armour piece of every set has its own coloured
  icon (src/ui/gearIcons.js); accents take the rarity colour.
- Inventory (80 slots): best items first. Quick buttons filter by slot; the
  funnel button opens filter and sort: sort by rarity, item level, DPS /
  defence, best upgrade or newest; filter by minimum rarity, only upgrades,
  weapon type, set and bonus. "Dismantle…" turns all items of
  one rarity into essence at once (it keeps upgraded items and the best item
  of each slot if it beats what you wear). Auto-dismantle turns weak drops
  (up to Common, Uncommon or Rare) into essence as soon as you pick them up.

| Stat | Effect |
|---|---|
| Strength | +3 % damage per point |
| Agility | speed, faster reload, shorter dodge cooldown |
| Vitality | +4 % health per point, health regeneration |
| Intelligence | +1 army slot per 2 points, mana, a little arise chance |
| Perception | crit chance (up to 60 %), crit damage, loot, army hunt range |

## Saving

- Save version 5. Older worlds are brought up to date when they are loaded
  (version 4: the dynamic class system; version 5: the Ranger companion leaves
  the army and gets its own data). Nothing is lost on the way.
- 3 save slots, stored in the browser twice (IndexedDB and a copy in
  localStorage; the newer one is loaded). The game asks the browser to keep
  the storage. Updates of the game never delete saves: old saves are brought
  up to date when they are loaded.
- Clearing the browser data of the site or removing the app still deletes
  them. Against that, Load Game has "Save as file" for every world (a small
  .json file) and "Load from a file" for empty slots; that also moves a world
  to another device.
- Autosave every 60 seconds, when entering the camp, when the pause menu
  opens, when the app is closed or sent to the background, and when going
  back to the main menu. "Save Now" is in the pause menu.
- Every world has its own random seed: chests and decoration differ.
- Deleting or overwriting a world always asks first.
- New World has a Tutorial switch (on by default as long as there is no
  world yet): 17 short steps in the real world explain moving, attacking,
  dodging, skills, the ultimate, Arise, the army, loot, the menu, zones,
  outposts and gates. It can be skipped at any time; the step is saved.
- In the skin editor the character can be turned by dragging and is drawn at
  the full resolution of the screen.

## Main menu

- Continue (the world played last), Worlds, and a row with Leaderboard,
  Online and Settings.
- Worlds: one card per slot with the hunter in 3D on top (drawn into the game
  canvas, see `src/ui/worldStages.js`), below it the world, rank, level,
  difficulty, best Abyss floor, shadows, kills and play time, then Continue,
  a backup file and Delete. Empty slots start a new world or load a file or
  a cloud copy.
- Online: hunter name, cloud save, transfer code (also reachable from the
  settings).

## Online (Supabase)

- Every device signs in anonymously in the background (no e-mail, no
  password). Without internet everything still works offline.
- Abyss leaderboard: tab "Leaderboard" in the Abyss panel. The deepest floor
  of every hunter (top 50 and the own place), with level, rank, mastery and
  difficulty. A new record is sent at once; offline it waits and is sent
  later. The hunter name is chosen there or in the settings (2 to 20
  characters, everyone sees it).
- Cloud save (settings, on by default): every save slot is uploaded, at most
  every 90 seconds while playing and at once when the game is left or sent
  to the background. The local save always stays the main copy. Load Game
  shows "Load cloud copy" when the cloud copy is newer and "Restore from
  cloud" for an empty slot; nothing is replaced without asking.
- Connected devices (Online page): one device shows a 5-character code
  (letters and digits, valid 10 minutes, usable once), the other types it in.
  From then on both use one shared account: worlds, hunter name and
  leaderboard entry, until a device disconnects. The worlds of the joining
  device move into free slots (the server refuses when there are not
  enough, so no world is pushed out). Whenever a device opens the main menu
  or comes back to the foreground, the newer copy of every world wins; a
  world deleted on one device goes on the others too. Disconnecting keeps
  the worlds on the device, they are just no longer shared. Wrong codes are
  limited (5 per device and 300 in total per 10 minutes).
- Database rules (row level security): everyone reads the leaderboard, only
  the owner reads and writes their saves. A record cannot go down, cannot
  jump more than 200 floors at once and cannot be sent more often than every
  5 seconds. The schema is in `supabase/schema.sql`; the client is
  `src/net/online.js` (plain fetch, no extra library).

## Where to change things

- `src/config.js` – all balancing values (health, damage, speeds, cooldowns,
  world size, graphics presets, autosave interval, colour palettes …)
- `src/strings.js` – all in-game text (add another language block here)

URL options: `?seed=123` starts a test world straight away (never saved; add
`&tutorial=1` for the tutorial),
`?debug` shows the frame rate, exposes the game as `window.__noctis` and checks
the class configuration at start.

Tests of the game logic: `npm test` (node's own test runner, no browser needed).

## Status

All six milestones are done:

1. World with camp and first zone, movement, aiming, one enemy type
2. Shadow army: Arise, behaviours, shadow levels and evolution, revive
3. Player levels and stat points, 8 weapons, armour with rarities and 6 sets,
   14 skills, 6 ultimates, chests and loot, inventory, upgrading, menu
4. Title screen, 3 save slots, New World with skin editor and tutorial,
   Load Game with file backup, autosave, pause menu, settings, sound effects
5. Ten big zones (x10 per rank, up to level 1000), 30 enemy types, elites
   and champions, 30 gates (three difficulties per zone) with 10 arena bosses,
   40 outposts to capture, minimap
6. PWA (offline, installable, fullscreen landscape, icons drawn in code),
   automatic graphics preset, performance check, hosting and install guide
