// Uploads save slots to the cloud: at most every 90 seconds per slot while
// playing, at once when the game is left or put in the background. The
// local save always stays the main copy; a failed upload is tried again.
import { cloudPut, isLinked } from './online.js';
import { settings } from '../core/settings.js';

const EVERY = 90000;
const RETRY = 120000;

// short info shown on the load screen before the save is downloaded
export function saveSummary(d) {
  return {
    name: String(d.name || '').slice(0, 40),
    level: (d.player && d.player.level) || 1,
    rankIndex: d.rankIndex || 0,
    playTime: d.playTime || 0,
    difficulty: d.difficulty || '',
    seed: d.seed,
  };
}

export class CloudSync {
  constructor() {
    this.last = {};
    this.pending = {};
    this.timers = {};
  }

  queue(slot, data, now = false) {
    // paired devices always share their worlds
    if ((!settings.cloudSave && !isLinked()) || slot < 0 || !data) return;
    this.pending[slot] = data;
    const wait = now ? 0 : Math.max(0, (this.last[slot] || 0) + EVERY - Date.now());
    clearTimeout(this.timers[slot]);
    this.timers[slot] = setTimeout(() => this.send(slot), wait);
  }

  // uploads at once and waits for it (throws when it fails)
  async sendNow(slot, data) {
    clearTimeout(this.timers[slot]);
    this.pending[slot] = null;
    this.last[slot] = Date.now();
    await cloudPut(slot, data, saveSummary(data));
  }

  async send(slot) {
    const d = this.pending[slot];
    if (!d) return;
    this.pending[slot] = null;
    this.last[slot] = Date.now();
    try {
      await cloudPut(slot, d, saveSummary(d));
    } catch (_) {
      if (!this.pending[slot]) this.pending[slot] = d;
      clearTimeout(this.timers[slot]);
      this.timers[slot] = setTimeout(() => this.send(slot), RETRY);
    }
  }
}
