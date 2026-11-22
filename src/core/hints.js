// What is new for the hunter and which menu page shows it. The menu button in the HUD wears a badge with the
// number of pages that have news; the menu opens on the first of them, and the page tabs wear their own badge.
// order = which page opens first
export function hints(game) {
  const P = game.player;
  const pts = P.points + P.mastery.pts;
  const list = [
    ['stats', pts > 0 ? pts : 0],
    ['gear', P.inventory.some((it) => it.n) ? 1 : 0],
    ['skills', P.newSkills.length || (game.mastery && game.mastery.anyPending()) ? 1 : 0],
    ['path', game.classDue() || game.path.due() ? 1 : 0],
    ['quests', game.quests.ready()],
    ['bestiary', game.bestiary.fresh.size ? 1 : 0],
    ['barracks', game.barracks && game.barracks.report ? 1 : 0],
  ];
  return list.filter((e) => e[1] > 0).map(([page, n]) => ({ page, n }));
}

// a short string that changes when the hints change (the HUD only touches the page then)
export function hintKey(hs) {
  return hs.map((h) => h.page + h.n).join(',');
}
