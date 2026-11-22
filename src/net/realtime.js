// A small client for Supabase Realtime "broadcast" (the Phoenix socket protocol, no library): every message
// that one player sends to a channel reaches the others. Used by the co-op gates (net/coop.js). The channel is
// public; its name is the co-op code, which only the players know. Fails quietly: no internet = no co-op.
import { ensureSession } from './online.js';

const HOST = 'ywecqnxbqivjnyjleyip.supabase.co';
const KEY = 'sb_publishable_p1JsJ_l07Lhd3m9FtRPJTA_j3TEUpZL';

export class Channel {
  // name: the channel; onMessage(payload): a message of another player; onState('open' | 'closed')
  constructor(name, onMessage, onState) {
    this.name = name;
    this.onMessage = onMessage;
    this.onState = onState || (() => {});
    this.ws = null;
    this.ref = 0;
    this.open = false;
    this.beat = 0;
    this.closing = false;
  }

  nextRef() {
    return String(++this.ref);
  }

  async join() {
    let token = '';
    try { const s = await ensureSession(); token = s && s.access ? s.access : ''; } catch (e) { /* the key alone may do */ }
    return new Promise((resolve) => {
      let done = false;
      const finish = (ok) => { if (!done) { done = true; resolve(ok); } };
      let ws;
      try { ws = new WebSocket(`wss://${HOST}/realtime/v1/websocket?apikey=${KEY}&vsn=1.0.0`); } catch (e) { finish(false); return; }
      this.ws = ws;
      ws.onopen = () => {
        this.send('realtime:' + this.name, 'phx_join', {
          config: { broadcast: { self: false, ack: false }, presence: { key: '' }, postgres_changes: [], private: false },
          access_token: token || undefined,
        }, 'join');
        this.beat = setInterval(() => this.send('phoenix', 'heartbeat', {}), 20000);
      };
      ws.onmessage = (ev) => {
        let m;
        try { m = JSON.parse(ev.data); } catch (e) { return; }
        if (m.event === 'phx_reply' && m.ref === 'join') {
          const ok = m.payload && m.payload.status === 'ok';
          this.open = ok;
          this.onState(ok ? 'open' : 'closed');
          finish(ok);
        } else if (m.event === 'broadcast' && m.payload && m.payload.payload) {
          this.onMessage(m.payload.payload);
        } else if (m.event === 'phx_close' || m.event === 'phx_error') {
          this.drop();
        }
      };
      ws.onclose = () => { this.drop(); finish(false); };
      ws.onerror = () => { this.drop(); finish(false); };
      setTimeout(() => finish(false), 8000);
    });
  }

  send(topic, event, payload, ref) {
    if (!this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify({ topic, event, payload, ref: ref || this.nextRef() }));
  }

  // to the other players of the channel
  say(payload) {
    if (!this.open) return;
    this.send('realtime:' + this.name, 'broadcast', { type: 'broadcast', event: 'm', payload });
  }

  drop() {
    clearInterval(this.beat);
    if (this.open) { this.open = false; if (!this.closing) this.onState('closed'); }
  }

  close() {
    this.closing = true;
    clearInterval(this.beat);
    this.open = false;
    try { if (this.ws) this.ws.close(); } catch (e) { /* closed */ }
    this.ws = null;
  }
}
