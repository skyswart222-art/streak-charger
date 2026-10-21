/* Pipe Dream app: tracker logic, screens and animations. Saving goes through cloud.js. */
(() => {
"use strict";

/* =========================================================
   Constants
   ========================================================= */
const KEY = "streak-charger.v1";
const DAY = 864e5;
const R = 104, C = 2 * Math.PI * R;
const TIERS = [
  { min: 0,   sym: "🐣", name: "Fresh Meat",  c1: "#c2c9d3", c2: "#7b8594", badge: "plain",  fx: {} },
  { min: 5,   sym: "🧻", name: "Dunny Diver", c1: "#9cf5a6", c2: "#2fbf55", badge: "plain",  fx: { glow: 2 } },
  { min: 10,  sym: "🥴", name: "Hungover Hand", c1: "#ffc48a", c2: "#ff7a2f", badge: "glow",   fx: { glow: 6 } },
  { min: 15,  sym: "🐖", name: "Rig Pig",     c1: "#d4e4ff", c2: "#6d8cff", badge: "glow",   fx: { glow: 10, pulse: 1 } },
  { min: 20,  sym: "🍺", name: "Piss Artist", c1: "#ffd36b", c2: "#ff5a1f", badge: "flame",  fx: { glow: 10, pulse: 1, flames: ["#ffe08a", "#ff4d00"], fl: .6 } },
  { min: 25,  sym: "🔧", name: "Hard Bastard", c1: "#ffe66b", c2: "#ff2d55", badge: "flame",  fx: { glow: 12, pulse: 1, flames: ["#fff0a0", "#ff2d55"], fl: 1, sparkles: "#ffe66b", sc: 8 } },
  { min: 35,  sym: "😤", name: "Cocky Prick", c1: "#e0fdff", c2: "#3ad6ff", badge: "glow",   fx: { glow: 14, pulse: 1, sparkles: "#f0feff", sc: 22 } },
  { min: 50,  sym: "💸", name: "Cashed-Up Bogan", c1: "#a6f0ff", c2: "#5b6cff", badge: "cosmic", fx: { glow: 14, pulse: 1, comet: "#cdf6ff", sparkles: "#cfe8ff", sc: 12 } },
  { min: 65,  sym: "🧨", name: "Absolute Unit", c1: "#ffa06b", c2: "#d4142f", badge: "flame",  fx: { glow: 16, pulse: 1, flames: ["#ffb36b", "#d4142f"], fl: 1.7, sparkles: "#ffb36b", sc: 8 } },
  { min: 80,  sym: "🐐", name: "Filthy Animal", c1: "#fff7b0", c2: "#ffbf00", badge: "glow",   fx: { glow: 18, pulse: 1, sparkles: "#fff3a0", sc: 30, burst: "#ffd84a" } },
  { min: 90,  sym: "🍻", name: "Shout's On Me", c1: "#ffe9a0", c2: "#e3a400", badge: "flame",  fx: { glow: 18, pulse: 1, flames: ["#fff2b0", "#e3a400"], fl: 1.4, sparkles: "#fff3a0", sc: 12 } },
  { min: 100, sym: "👔", name: "Company Bastard", c1: "#fff6c2", c2: "#f5c518", badge: "flame",  fx: { glow: 20, pulse: 1, flames: ["#fff6c2", "#f5a518"], fl: 1.6, halo: ["#f5c518", "#fff6c2", "#b8860b", "#f5c518"] } },
  { min: 125, sym: "🐋", name: "Fat Whale",   c1: "#b4fff3", c2: "#00b3a4", badge: "cosmic", fx: { glow: 20, pulse: 1, lightning: "#c8fff7", halo: ["#00b3a4", "#b4fff3", "#006d66", "#00b3a4"], sparkles: "#b4fff3", sc: 12 } },
  { min: 150, sym: "🤑", name: "Lucky Prick", c1: "#d4b8ff", c2: "#6a3cff", badge: "cosmic", fx: { glow: 22, pulse: 1, halo: ["#6a3cff", "#ff5fd2", "#3ad6ff", "#6a3cff"], orbiters: 8, sparkles: "#ffffff", sc: 22 } },
  { min: 175, sym: "🚁", name: "Last Chopper Out", c1: "#fff1b8", c2: "#ff6a00", badge: "cosmic", fx: { glow: 24, pulse: 1, halo: ["#ff6a00", "#ffd84a", "#ff2d55", "#ff6a00"], burst: "#fff1b8", flames: ["#fff1b8", "#ff6a00"], fl: 1.2, orbiters: 4 } },
  { min: 200, sym: "♾️", name: "Pipe Dream",  c1: "#ffffff", c2: "#b06bff", badge: "cosmic", fx: { glow: 26, pulse: 1, halo: ["#ff5f5f", "#ffd84a", "#39ff88", "#3ad6ff", "#b06bff", "#ff5f5f"], orbiters: 10, comet: "#ffffff", sparkles: "#ffffff", sc: 26, burst: "#ffffff" } },
];
TIERS.forEach((t, i) => t.idx = i);
const GOLD = { c1: "#fff3b0", c2: "#e8a90c" };
const RISKS = [
  { min: 1.10, sym: "⚪", name: "Bit spicy",   c: "#d9dde3", lvl: 1, dur: 2.6 },
  { min: 1.20, sym: "🟡", name: "Risky",       c: "#ffd23f", lvl: 2, dur: 1.9 },
  { min: 1.50, sym: "🟠", name: "Very risky",  c: "#ff9a3c", lvl: 3, dur: 1.3 },
  { min: 1.75, sym: "🔴", name: "Danger",      c: "#ff3b5c", lvl: 4, dur: .85 },
  { min: 2.00, sym: "💀", name: "Super risky", c: "#ff2a6d", lvl: 5, dur: .6 },
  { min: 3.0000001, sym: "🎰", name: "All in", c: "#c86bff", lvl: 6, dur: .4 },
];
const ODDS_BANDS = [{ lo: 1, hi: 1.10, name: "Under 1.10", sym: "🟢" }].concat(RISKS.map((r, i) => ({ lo: r.min, hi: RISKS[i + 1] ? RISKS[i + 1].min : Infinity, name: r.name, sym: r.sym })));
const ACCENTS = ["#3ad6ff", "#39ff88", "#b38cff", "#ff7ad9", "#ffb547", "#ff5f5f", "#f2f4f7"];
const SKINS = [
  { id: "dark", name: "Charcoal", sw: "linear-gradient(135deg,#15171b,#262a31)", need: 0 },
  { id: "light", name: "Light", sw: "linear-gradient(135deg,#f6f8fb,#dfe5ee)", need: 0 },
  { id: "wolf", name: "Rig Pig", sym: "🐖", sw: "linear-gradient(135deg,#0d1118,#33416b 60%,#d4e4ff)", need: 15 },
  { id: "unstoppable", name: "Hard Bastard", sym: "🔧", sw: "linear-gradient(135deg,#160a0c,#a3122f 55%,#ffe66b)", need: 25 },
  { id: "comet", name: "Cashed-Up Bogan", sym: "💸", sw: "linear-gradient(135deg,#0a1024,#2a3a8a 60%,#5ad2ff)", need: 50 },
  { id: "legend", name: "Company Bastard", sym: "👔", sw: "linear-gradient(135deg,#0e0c08,#5a4310 60%,#ffd24a)", need: 100 },
  { id: "immortal", name: "Pipe Dream", sym: "♾️", sw: "linear-gradient(135deg,#0c0716,#6a3cff 45%,#ff5fd2 75%,#3ad6ff)", need: 200 },
];
const SPORTS = [
  ["Cricket", ""], ["Rugby League", "nrl super league state of origin"], ["Rugby Union", "super rugby six nations"],
  ["AFL", "aussie rules australian football"], ["Soccer", "football epl premier league a-league"], ["Basketball", "nba nbl"],
  ["Tennis", "atp wta"], ["Golf", "pga"], ["Horse Racing", "racing gallops thoroughbred"], ["Greyhound Racing", "dogs greyhounds"],
  ["Harness Racing", "trots trotting"], ["American Football", "nfl gridiron"], ["Baseball", "mlb"], ["Ice Hockey", "nhl"],
  ["Boxing", ""], ["MMA", "ufc mixed martial arts"], ["Darts", ""], ["Snooker", ""], ["Pool", "billiards"],
  ["Formula 1", "f1 motor racing"], ["Motor Racing", "supercars indycar v8"], ["MotoGP", "motorbikes"], ["NASCAR", ""],
  ["Speedway", ""], ["Cycling", "tour de france"], ["Esports", "gaming cs lol dota valorant"], ["Table Tennis", "ping pong"],
  ["Badminton", ""], ["Volleyball", ""], ["Beach Volleyball", ""], ["Handball", ""], ["Netball", ""], ["Athletics", "track and field"],
  ["Swimming", ""], ["Surfing", ""], ["Lacrosse", ""], ["Field Hockey", "hockey"], ["Gaelic Football", "gaa"], ["Hurling", "gaa"],
  ["Futsal", ""], ["Water Polo", ""], ["Squash", ""], ["Lawn Bowls", "bowls"], ["Chess", ""], ["Politics", "election"],
  ["Novelty", "entertainment tv awards specials"], ["Skiing", "winter sports"], ["Rowing", ""], ["Sailing", ""], ["Triathlon", ""],
  ["Wrestling", "wwe"], ["Kabaddi", ""], ["Softball", ""], ["Curling", ""], ["Floorball", ""], ["Bandy", ""],
].map(([name, alias]) => ({ name, alias }));
const SPORT_NAMES = new Set(SPORTS.map(s => s.name).concat("Other"));

/* =========================================================
   Storage: the signed-in account (see cloud.js). The old on-device
   save is still read once, to offer importing it.
   ========================================================= */
function uid() { return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4); }
function newTracker(n) {
  return { id: uid(), name: "Tracker " + n, accent: ACCENTS[(n - 1) % ACCENTS.length], start: 100, target: 100000, oddsMode: "auto", fixedOdds: 1.05,
    bets: [], actions: [], targetEdits: [], paused: false, createdAt: Date.now() };
}
function normalise(s) {
  s.trackers.forEach((t, i) => {
    t.actions = t.actions || []; t.targetEdits = t.targetEdits || []; t.paused = !!t.paused;
    t.accent = t.accent || ACCENTS[i % ACCENTS.length];
    t.bets.forEach(b => { b.edits = b.edits || []; });
  });
  if (s.view && !s.page) s.page = s.view === "overview" ? "trackers" : "home";
  delete s.view;
  s.page = PAGES.includes(s.page) ? s.page : "home"; s.recentSports = s.recentSports || []; s.skin = s.skin || "dark";
  s.achievements = s.achievements || {}; s.bestStreak = s.bestStreak || 0;
  if (!s.trackers.some(t => t.id === s.activeId)) s.activeId = s.trackers[0].id;
  return s;
}
const UI_KEY = "streak-charger.ui";
function deviceState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const s = JSON.parse(raw); if (s && Array.isArray(s.trackers) && s.trackers.length) return normalise(s); }
  } catch (e) {}
  return null;
}
function freshState() { const t = newTracker(1); return normalise({ trackers: [t], activeId: t.id }); }
let storageOk = true, localMode = false;
// Every change still calls save(). Signed in, it queues a sync of whatever changed; the page
// and selected tab stay on this device. Without Supabase keys it falls back to the old device save.
function save() {
  if (!state) return;
  try { localStorage.setItem(UI_KEY, JSON.stringify({ page: state.page, activeId: state.activeId, skin: state.skin })); } catch (e) {}
  if (!localMode) return Cloud.queue(state);
  try { localStorage.setItem(KEY, JSON.stringify(state)); storageOk = true; }
  catch (e) { if (storageOk) toast("This browser isn't letting the app save. Changes will be lost when you close it."); storageOk = false; }
}
let state = null;
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) {}

/* =========================================================
   Maths
   ========================================================= */
const active = () => state.trackers.find(t => t.id === state.activeId);
const tierFor = s => { let t = TIERS[0]; for (const x of TIERS) if (s >= x.min) t = x; return t; };
const nextTier = t => TIERS[t.idx + 1] || null;
const riskFor = o => { let r = null; for (const x of RISKS) if (o >= x.min) r = x; return r; };
const geoMean = arr => Math.exp(arr.reduce((a, o) => a + Math.log(o), 0) / arr.length);
const RECENT = 10;
function typicalOdds(bets) {
  const o = bets.slice(-RECENT).map(b => b.odds).sort((a, b) => a - b), m = o.length >> 1;
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
}
// Forecast odds: the median of the last 10 bets, so one rare big-odds bet doesn't swing "wins to go".
function avgOdds(t) { return t.oddsMode === "auto" && t.bets.length ? typicalOdds(t.bets) : t.fixedOdds; }
function winsNeeded(balance, target, odds) {
  if (balance >= target) return 0;
  if (!(odds > 1) || !(balance > 0)) return Infinity;
  return Math.max(1, Math.ceil(Math.log(target / balance) / Math.log(odds) - 1e-9));
}
function fracFor(streak, bal, target, odds) {
  if (bal >= target) return 1;
  const rem = winsNeeded(bal, target, odds), tot = streak + rem;
  return isFinite(tot) && tot > 0 ? streak / tot : 0;
}
function compute(t) {
  const odds = avgOdds(t);
  const ev = t.bets.map(b => ({ k: "bet", at: b.createdAt, b })).concat(t.actions.map(a => ({ k: a.type, at: a.at, a }))).sort((x, y) => x.at - y.at);
  let bal = t.start, streak = 0, banked = 0, deposited = t.start, lost = 0, maxStreak = 0, peak = t.start;
  const newRun = (n, at) => ({ n, startAt: at, bets: [], steps: [], maxStreak: 0, peak: t.start, end: null, points: [{ i: 0, bal: t.start }] });
  let run = newRun(1, t.createdAt);
  const runs = [], rows = {}, acts = {};
  for (const e of ev) {
    if (e.k === "bet") {
      const b = e.b, stake = bal, potential = stake * b.odds;
      const row = { stake, potential, run: run.n, betInRun: run.bets.length + 1 };
      run.bets.push(b);
      if (b.result === "win") {
        bal = potential; streak++; maxStreak = Math.max(maxStreak, streak); run.maxStreak = Math.max(run.maxStreak, streak);
        peak = Math.max(peak, bal); run.peak = Math.max(run.peak, bal);
        run.steps.push({ type: "win", b, bal, streak }); run.points.push({ i: run.bets.length, bal, r: "win" });
      } else if (b.result === "loss") {
        lost += stake; row.endedRun = true;
        run.steps.push({ type: "loss", b, bal: 0, streak: 0 }); run.points.push({ i: run.bets.length, bal: stake, r: "loss" });
        run.end = { reason: "loss", at: b.settledAt || b.createdAt, streak, lostStake: stake };
        runs.push(run); run = newRun(run.n + 1, b.settledAt || b.createdAt); bal = t.start; deposited += t.start; streak = 0;
      }
      row.streakAfter = streak; row.balAfter = bal;
      rows[b.id] = row;
    } else if (e.k === "bank") {
      const amt = Math.max(0, Math.min(e.a.amount, bal));
      bal -= amt; banked += amt; acts[e.a.id] = { amt, run: run.n };
      run.steps.push({ type: "bank", amt, bal, streak }); run.points.push({ i: run.bets.length, bal, r: "bank" });
    } else if (e.k === "end") {
      banked += bal; acts[e.a.id] = { amt: bal, run: run.n, streak };
      run.steps.push({ type: "end", amt: bal, bal: 0, streak });
      run.end = { reason: "ended", at: e.at, streak, cashed: bal };
      runs.push(run); run = newRun(run.n + 1, e.at); bal = t.start; deposited += t.start; streak = 0;
    }
  }
  const last = t.bets[t.bets.length - 1];
  const pendingBet = last && last.result === "pending" ? last : null;
  const remaining = winsNeeded(bal, t.target, odds);
  const total = streak + remaining;
  const reached = bal >= t.target;
  const frac = fracFor(streak, bal, t.target, odds);
  return { balance: bal, streak, banked, deposited, lost, maxStreak, peak, runs, current: run, rows, acts, odds, remaining, total, frac, reached,
    pending: !!pendingBet, pendingBet, risk: pendingBet ? riskFor(pendingBet.odds) : null, tier: tierFor(streak) };
}

/* =========================================================
   Formatting
   ========================================================= */
function money(n) {
  if (!isFinite(n)) return "–";
  const big = Math.abs(n) >= 10000;
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: big ? 0 : 2, maximumFractionDigits: big ? 0 : 2 });
  return (n < 0 ? "−$" : "$") + s;
}
function moneyShort(n) {
  const a = Math.abs(n), sg = n < 0 ? "−" : "";
  if (a >= 1e9) return sg + "$" + (a / 1e9).toLocaleString("en-US", { maximumFractionDigits: 2 }) + "B";
  if (a >= 1e6) return sg + "$" + (a / 1e6).toLocaleString("en-US", { maximumFractionDigits: 2 }) + "M";
  if (a >= 1e4) return sg + "$" + (a / 1e3).toLocaleString("en-US", { maximumFractionDigits: 1 }) + "k";
  return money(n);
}
const odds2 = o => Number(o).toFixed(2);
const pct = (x, d = 0) => isFinite(x) ? (x * 100).toFixed(d) + "%" : "–";
function chance(p) {
  if (!(p > 0)) return "0%";
  if (p >= 0.995) return "99%+";
  if (p >= 0.01) return pct(p, p < 0.1 ? 1 : 0);
  const n = 1 / p;
  return "1 in " + (n >= 1e6 ? (n / 1e6).toLocaleString("en-US", { maximumFractionDigits: 1 }) + " million" : Math.round(n).toLocaleString("en-US"));
}
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function when(ts) { const d = new Date(ts); return d.toLocaleDateString(undefined, { day: "numeric", month: "short" }) + ", " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
function day(ts) { return new Date(ts).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }); }
function dur(ms) {
  if (!isFinite(ms) || ms < 0) return "–";
  const m = Math.round(ms / 6e4);
  if (m < 60) return Math.max(1, m) + "m";
  const h = Math.floor(m / 60);
  if (h < 48) return h + "h " + (m % 60) + "m";
  return Math.round(h / 24) + " days";
}
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
const winsText = n => n === Infinity ? "set odds above 1.00" : plural(n, "win");
// How many times each tier has been reached: one per run (across every tracker, current runs included)
// whose best streak got there. Cached per render because it walks every tracker.
let tcCache = null;
function tierCount(tr) {
  if (!tcCache) {
    tcCache = TIERS.map(() => 0);
    for (const t of state.trackers) { const s = compute(t); for (const r of s.runs.concat([s.current])) TIERS.forEach((x, i) => { if (r.maxStreak >= x.min) tcCache[i]++; }); }
  }
  return tr.min > 0 ? tcCache[tr.idx] || 0 : 0;
}
// The tier emoji with a small counter on its top-right showing how many times that tier has been reached.
const tierSym = (tr, show = true) => { const n = show ? tierCount(tr) : 0; return n ? `<span class="tsym has" title="Reached ${n} time${n === 1 ? "" : "s"}">${tr.sym}<sup class="tcount">${n > 99 ? "99+" : n}</sup></span>` : tr.sym; };
const tierBadge = (tr, label, count = true) => `<span class="tb ${tr.badge}" style="--tc:${tr.c2};--tc2:${tr.c1}">${tierSym(tr, count)} ${label ?? tr.name}</span>`;
function num(v) { const n = parseFloat(String(v).replace(/[$,\s]/g, "")); return isFinite(n) ? n : NaN; }

/* =========================================================
   Ring
   ========================================================= */
let gid = 0;
// Arc reactor ring: a glowing neon tube in a recessed bezel, with energy flowing through the lit part
// and a flare at its head. Win slots sit outside it; ticks light up behind the charge. Inside, a glass
// core and the next-tier ring.
// On the Light theme the pale neon tints wash out against white, so the reactor switches to
// deeper versions of the tier colours and swaps its white highlights for dark ink.
const shade = (hex, k) => "#" + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k)).toString(16).padStart(2, "0")).join("");
const onLight = () => document.documentElement.dataset.skin === "light";
const inkTier = t => onLight() ? { ...t, c1: shade(t.c2, .05), c2: shade(t.c2, .35) } : t;
function ringSVG(o) {
  const id = "g" + (++gid);
  const lt = onLight();
  const col = inkTier(o.reached ? GOLD : o.tier);
  const f = o.from ?? o.frac, off = C * (1 - f);
  const glow = Math.max(4, (o.tier.fx.glow || 4) * .7);
  const slots = [];
  if (isFinite(o.total) && o.total > 1 && o.total <= 72) {
    const won = Math.round(o.frac * o.total);
    for (let i = 0; i < o.total; i++) {
      const a = ((i + .5) / o.total) * 2 * Math.PI - Math.PI / 2, lit = i < won;
      slots.push(`<circle cx="${(120 + Math.cos(a) * 116).toFixed(2)}" cy="${(120 + Math.sin(a) * 116).toFixed(2)}" r="${o.total > 40 ? 1.4 : 2}" fill="${lit ? col.c1 : "var(--track)"}"${lit ? ` style="filter:drop-shadow(0 0 2px ${col.c1})"` : ""}/>`);
    }
  }
  let ticks = "", lit = "";
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * 2 * Math.PI - Math.PI / 2, r1 = i % 5 ? 89 : 92;
    const l = `<line x1="${(120 + Math.cos(a) * 85).toFixed(1)}" y1="${(120 + Math.sin(a) * 85).toFixed(1)}" x2="${(120 + Math.cos(a) * r1).toFixed(1)}" y2="${(120 + Math.sin(a) * r1).toFixed(1)}"/>`;
    if (i / 60 < o.frac) lit += l; else ticks += l;
  }
  return `<svg viewBox="0 0 240 240" aria-hidden="true">
    <defs>
      <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${col.c1}"/><stop offset="1" stop-color="${col.c2}"/></linearGradient>
      <radialGradient id="${id}c" cx=".5" cy=".42" r=".6"><stop offset="0" stop-color="${col.c1}" stop-opacity=".32"/><stop offset=".7" stop-color="${col.c2}" stop-opacity=".1"/><stop offset="1" stop-color="${col.c2}" stop-opacity="0"/></radialGradient>
      <linearGradient id="${id}b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".08"/><stop offset=".5" stop-color="#fff" stop-opacity=".02"/><stop offset="1" stop-color="#fff" stop-opacity=".08"/></linearGradient>
      <filter id="${id}f" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="${glow}"/></filter>
      <mask id="${id}m" maskUnits="userSpaceOnUse" x="0" y="0" width="240" height="240"><circle class="ring-arc" cx="120" cy="120" r="${R}" fill="none" stroke="#fff" stroke-width="9" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 120 120)"/></mask>
    </defs>
    <g class="risk-halo"><circle cx="120" cy="120" r="119" fill="none" stroke="var(--rc, transparent)" stroke-width="3"/></g>
    <circle cx="120" cy="120" r="66" fill="url(#${id}c)" class="re-core"/>
    <circle cx="120" cy="120" r="66" fill="none" stroke="url(#${id}b)" stroke-width="1"/>
    <g class="re-spin"><circle cx="120" cy="120" r="81" fill="none" stroke="${col.c1}" stroke-opacity=".3" stroke-width="1.2" stroke-dasharray="2 7"/></g>
    ${tierRing(o, id)}
    <g stroke="var(--track)" stroke-width="1.3">${ticks}</g>
    <g stroke="${lt ? col.c2 : col.c1}" stroke-width="1.5" stroke-opacity="${lt ? .9 : .75}">${lit}</g>
    ${slots.join("")}
    <circle cx="120" cy="120" r="${R}" fill="none" stroke="var(--track)" stroke-width="14"/>${lt ? `<circle cx="120" cy="120" r="${R}" fill="none" stroke="#1b2333" stroke-opacity=".06" stroke-width="14"/>` : ""}
    <circle cx="120" cy="120" r="${R}" fill="none" stroke="url(#${id}b)" stroke-width="14"/>
    <circle cx="120" cy="120" r="${R - 7.5}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="1"/>
    <circle cx="120" cy="120" r="${R + 7.5}" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="1"/>
    <circle class="shock" cx="120" cy="120" r="${R}" fill="none" stroke="${col.c1}" stroke-width="3"/>
    <circle class="ring-arc ring-glow" cx="120" cy="120" r="${R}" fill="none" stroke="url(#${id})" stroke-width="13" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 120 120)" filter="url(#${id}f)"/>
    <circle class="ring-arc" cx="120" cy="120" r="${R}" fill="none" stroke="url(#${id})" stroke-width="${lt ? 9 : 8}" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 120 120)"/>
    <circle class="ring-arc" cx="120" cy="120" r="${R}" fill="none" stroke="#fff" stroke-opacity="${lt ? .4 : .55}" stroke-width="2" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${off}" transform="rotate(-90 120 120)"/>
    <g mask="url(#${id}m)"><circle class="re-flow" cx="120" cy="120" r="${R}" fill="none" stroke="#fff" stroke-opacity=".7" stroke-width="4" stroke-linecap="round" stroke-dasharray="1.5 19.5" transform="rotate(-90 120 120)"/></g>
    <g class="ring-head" style="transform:rotate(${f * 360}deg);${f > 0 ? "" : "opacity:0"}">
      <circle cx="120" cy="${120 - R}" r="12" fill="${col.c1}" filter="url(#${id}f)"/>
      <g class="re-flare" style="transform-origin:120px ${120 - R}px"><path d="M120 ${120 - R - 13} L121.2 ${120 - R - 1.2} L133 ${120 - R} L121.2 ${120 - R + 1.2} L120 ${120 - R + 13} L118.8 ${120 - R + 1.2} L107 ${120 - R} L118.8 ${120 - R - 1.2} Z" fill="${lt ? col.c2 : "#fff"}" opacity=".9"/></g>
      <circle cx="120" cy="${120 - R}" r="4.5" fill="#fff"${lt ? ` stroke="${col.c2}" stroke-width="2"` : ""}/>
    </g>
  </svg>`;
}
// Inner ring at r=68: progress from the current tier to the next one, in the next tier's colours,
// with that tier's symbol riding the head. Falls back to the old spinning dashes when there is no next tier.
const TR = 73, TC = 2 * Math.PI * TR;
function tierRing(o, id) {
  const nx = nextTier(o.tier), next = nx && inkTier(nx);
  if (o.streak == null || !next || o.reached)
    return `<g class="re-spin rev"><circle cx="120" cy="120" r="${TR}" fill="none" stroke="${(o.reached ? GOLD : o.tier).c2}" stroke-opacity=".45" stroke-width="3" stroke-dasharray="30 14"/></g>`;
  const f = Math.min(1, Math.max(0, (o.streak - o.tier.min) / (next.min - o.tier.min)));
  const a = f * 2 * Math.PI - Math.PI / 2, hx = (120 + Math.cos(a) * TR).toFixed(1), hy = (120 + Math.sin(a) * TR).toFixed(1);
  return `<defs><linearGradient id="${id}t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${next.c1}"/><stop offset="1" stop-color="${next.c2}"/></linearGradient></defs>
    <circle cx="120" cy="120" r="${TR}" fill="none" stroke="var(--track)" stroke-width="3" stroke-dasharray="2 4"/>
    <circle class="tier-arc" cx="120" cy="120" r="${TR}" fill="none" stroke="url(#${id}t)" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${TC}" stroke-dashoffset="${TC * (1 - f)}" transform="rotate(-90 120 120)" style="--tc:${TC}"/>
    <g class="tier-mark"><circle cx="${hx}" cy="${hy}" r="8" fill="var(--bg)" stroke="${next.c1}" stroke-width="1.5" style="filter:drop-shadow(0 0 4px ${next.c2})"/><text x="${hx}" y="${hy}" text-anchor="middle" dominant-baseline="central" font-size="9">${next.sym}</text></g>`;
}
function setRing(root, frac, { duration = .9, delay = 0 } = {}) {
  root.querySelectorAll(".ring-arc").forEach(el => {
    el.style.transitionDuration = duration + "s"; el.style.transitionDelay = delay + "s";
    el.setAttribute("stroke-dashoffset", C * (1 - frac));
  });
  root.querySelectorAll(".ring-head").forEach(el => {
    el.style.transitionDuration = duration + "s"; el.style.transitionDelay = delay + "s";
    el.style.transform = `rotate(${frac * 360}deg)`; el.style.opacity = frac > 0 ? 1 : 0;
  });
}

/* Particle effects drawn around the ring for each tier */
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
let fxLoop = null;
function stopFx() { if (fxLoop) { cancelAnimationFrame(fxLoop.raf); fxLoop = null; } }
function startFx(wrap, tier, gold) {
  stopFx();
  const f = gold ? { sparkles: "#fff3b0", sc: 24, halo: ["#f5c518", "#fff6c2", "#b8860b", "#f5c518"], flames: ["#fff6c2", "#e8a90c"], fl: 1 } : tier.fx;
  if (reduced || !(f.flames || f.sparkles || f.comet || f.orbiters || f.halo || f.burst || f.lightning)) return;
  const cv = document.createElement("canvas"); cv.className = "ring-canvas"; wrap.prepend(cv);
  const ctx = cv.getContext("2d");
  let W = 0, rr = 0;
  const size = () => { const r = cv.getBoundingClientRect(); const d = devicePixelRatio || 1; W = r.width; cv.width = W * d; cv.height = W * d; ctx.setTransform(d, 0, 0, d, 0, 0); rr = W / 1.44 * (R / 240); };
  size();
  const ps = [], orb = Array.from({ length: f.orbiters || 0 }, (_, i) => ({ a: Math.random() * 6.28, sp: (.004 + Math.random() * .012) * (i % 2 ? 1 : -1), d: 1.18 + Math.random() * .3, s: 1 + Math.random() * 2 }));
  let t0 = performance.now(), comet = 0, lastBurst = 0, bolts = [];
  const loop = { raf: 0 };
  fxLoop = loop;
  function frame(now) {
    if (!cv.isConnected) return stopFx();
    const t = (now - t0) / 1000, cx = W / 2, cy = W / 2;
    ctx.clearRect(0, 0, W, W);
    if (f.halo && ctx.createConicGradient) {
      const g = ctx.createConicGradient(t * .6, cx, cy);
      f.halo.forEach((c, i) => g.addColorStop(i / (f.halo.length - 1), c));
      ctx.save(); ctx.globalAlpha = .38 + .12 * Math.sin(t * 2); ctx.strokeStyle = g; ctx.lineWidth = rr * .3; ctx.filter = "blur(10px)";
      ctx.beginPath(); ctx.arc(cx, cy, rr * 1.12, 0, 6.283); ctx.stroke(); ctx.restore();
    }
    if (f.burst && now - lastBurst > 2200) { lastBurst = now; ps.push({ k: "ring", r: rr, life: 1 }); }
    if (f.flames) for (let i = 0; i < 3 * f.fl; i++) {
      const a = Math.random() * 6.283;
      ps.push({ k: "flame", x: cx + Math.cos(a) * rr * 1.08, y: cy + Math.sin(a) * rr * 1.08, vx: Math.cos(a) * .5, vy: Math.sin(a) * .5 - .9 - Math.random() * 1.1 * f.fl, s: (3 + Math.random() * 5) * Math.min(1.6, .7 + f.fl * .4), life: 1 });
    }
    if (f.sparkles && Math.random() < f.sc / 60) {
      const a = Math.random() * 6.283, d = rr * (1.05 + Math.random() * .3);
      ps.push({ k: "spark", x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, s: 2 + Math.random() * 4, life: 1 });
    }
    if (f.lightning && Math.random() < .03) {
      const a = Math.random() * 6.283, b = a + (Math.random() - .5) * 1.4, pts = [];
      for (let i = 0; i <= 8; i++) { const ang = a + (b - a) * i / 8, d = rr * (1.12 + (Math.random() - .5) * .14); pts.push([cx + Math.cos(ang) * d, cy + Math.sin(ang) * d]); }
      bolts.push({ pts, life: 1 });
    }
    ctx.save(); ctx.globalCompositeOperation = "lighter";
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      if (p.k === "flame") {
        p.x += p.vx; p.y += p.vy; p.life -= .03; p.s *= .975;
        const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 2);
        g.addColorStop(0, f.flames[0]); g.addColorStop(.5, f.flames[1]); g.addColorStop(1, "transparent");
        ctx.globalAlpha = Math.max(0, p.life) * .7; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 2, 0, 6.283); ctx.fill();
      } else if (p.k === "spark") {
        p.life -= .02; const s = p.s * Math.sin(Math.max(0, p.life) * Math.PI);
        ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = f.sparkles;
        ctx.beginPath(); ctx.moveTo(p.x, p.y - s * 2); ctx.lineTo(p.x + s * .4, p.y); ctx.lineTo(p.x, p.y + s * 2); ctx.lineTo(p.x - s * .4, p.y); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(p.x - s * 2, p.y); ctx.lineTo(p.x, p.y + s * .4); ctx.lineTo(p.x + s * 2, p.y); ctx.lineTo(p.x, p.y - s * .4); ctx.closePath(); ctx.fill();
      } else if (p.k === "ring") {
        p.r += 1.6; p.life -= .014; ctx.globalAlpha = Math.max(0, p.life) * .8; ctx.strokeStyle = f.burst; ctx.lineWidth = 3 * p.life;
        ctx.beginPath(); ctx.arc(cx, cy, p.r, 0, 6.283); ctx.stroke();
      }
      if (p.life <= 0) ps.splice(i, 1);
    }
    for (let i = bolts.length - 1; i >= 0; i--) {
      const b = bolts[i]; b.life -= .08; ctx.globalAlpha = Math.max(0, b.life); ctx.strokeStyle = f.lightning; ctx.lineWidth = 2; ctx.shadowColor = f.lightning; ctx.shadowBlur = 12;
      ctx.beginPath(); b.pts.forEach((q, j) => j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke(); ctx.shadowBlur = 0;
      if (b.life <= 0) bolts.splice(i, 1);
    }
    for (const o of orb) {
      o.a += o.sp; ctx.globalAlpha = .9; ctx.fillStyle = "#fff"; ctx.shadowColor = tier.c2; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(cx + Math.cos(o.a) * rr * o.d, cy + Math.sin(o.a) * rr * o.d, o.s, 0, 6.283); ctx.fill(); ctx.shadowBlur = 0;
    }
    if (f.comet) {
      comet += .022;
      for (let j = 0; j < 26; j++) {
        const a = comet - j * .035, d = rr * 1.2;
        ctx.globalAlpha = (1 - j / 26) * .85; ctx.fillStyle = f.comet;
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d, Math.max(.5, 5 * (1 - j / 26)), 0, 6.283); ctx.fill();
      }
    }
    ctx.restore();
    loop.raf = requestAnimationFrame(frame);
  }
  loop.raf = requestAnimationFrame(frame);
  addEventListener("resize", size, { once: true });
}

/* =========================================================
   Achievements
   ========================================================= */
const ACH = [
  { id: "first_bet", e: "🎟️", n: "First ticket", d: "Log your first bet" },
  { id: "first_win", e: "✅", n: "First win", d: "Win a bet" },
  { id: "hat_trick", e: "🎩", n: "Hat trick", d: "Reach a 3-win streak" },
  { id: "comeback", e: "🔄", n: "Comeback kid", d: "Win the very next bet after a loss" },
  { id: "night_owl", e: "🦉", n: "Night owl", d: "Log a bet between midnight and 5am" },
  { id: "early_bird", e: "🐦", n: "Early bird", d: "Log a bet between 5am and 7am" },
  { id: "ice_cold", e: "🧊", n: "Ice cold", d: "Win a bet at odds under 1.03" },
  { id: "iron_nerves", e: "💀", n: "Iron nerves", d: "Win a Super risky bet (2.00–3.00)" },
  { id: "big_swing", e: "🎰", n: "Big swing", d: "Win an All in bet (over 3.00)" },
  { id: "frog", e: "🧻", n: "Dunny duty", d: "Reach Dunny Diver (5 wins)" },
  { id: "blazing", e: "🍺", n: "On the piss", d: "Reach Piss Artist (20 wins)" },
  { id: "comet", e: "💸", n: "Cashed up", d: "Reach Cashed-Up Bogan (50 wins)" },
  { id: "thousand", e: "💵", n: "Four figures", d: "Run a balance past $1,000" },
  { id: "tenk", e: "💰", n: "Five figures", d: "Run a balance past $10,000" },
  { id: "target", e: "🏁", n: "Target smashed", d: "Reach a tracker's target" },
  { id: "banker", e: "🏦", n: "Banker", d: "Bank some profit" },
  { id: "cash_out", e: "🧳", n: "Walk away winner", d: "End a run with more than you started" },
  { id: "phoenix", e: "🐦‍🔥", n: "Phoenix", d: "Lose a run of 10+ wins and go again" },
  { id: "patient", e: "⏳", n: "Patience", d: "Win a bet that was pending for 3+ days" },
  { id: "globetrotter", e: "🌍", n: "Globetrotter", d: "Bet on 5 different sports" },
  { id: "juggler", e: "🤹", n: "Juggler", d: "Run 3 trackers at once" },
  { id: "century", e: "💯", n: "Century", d: "Log 100 bets" },
];
function evalAchievements() {
  const got = {};
  const mark = (id, at) => { if (!got[id] || at < got[id]) got[id] = at; };
  let allBets = 0; const sports = new Map();
  if (state.trackers.length >= 3) mark("juggler", state.trackers[2].createdAt);
  let best = 0;
  for (const t of state.trackers) {
    const s = compute(t);
    best = Math.max(best, s.maxStreak);
    let prev = null;
    for (const b of t.bets) {
      const r = s.rows[b.id], st = b.settledAt || b.createdAt, h = new Date(b.createdAt).getHours();
      allBets++; if (allBets === 100) mark("century", b.createdAt);
      if (!sports.has(b.sport)) { sports.set(b.sport, b.createdAt); if (sports.size === 5) mark("globetrotter", b.createdAt); }
      mark("first_bet", b.createdAt);
      if (h < 5) mark("night_owl", b.createdAt);
      if (h >= 5 && h < 7) mark("early_bird", b.createdAt);
      if (b.result === "win") {
        mark("first_win", st);
        if (prev === "loss") mark("comeback", st);
        if (b.odds < 1.03) mark("ice_cold", st);
        if (b.odds >= 2 && b.odds <= 3) mark("iron_nerves", st);
        if (b.odds > 3) mark("big_swing", st);
        if (b.settledAt && b.settledAt - b.createdAt >= 3 * DAY) mark("patient", st);
        if (r.streakAfter >= 3) mark("hat_trick", st);
        if (r.streakAfter >= 5) mark("frog", st);
        if (r.streakAfter >= 20) mark("blazing", st);
        if (r.streakAfter >= 50) mark("comet", st);
        if (r.balAfter >= 1000) mark("thousand", st);
        if (r.balAfter >= 10000) mark("tenk", st);
        if (r.balAfter >= t.target) mark("target", st);
      }
      if (b.result !== "pending") prev = b.result;
    }
    for (const run of s.runs) {
      if (run.end.reason === "loss" && run.end.streak >= 10) mark("phoenix", run.end.at);
      if (run.end.reason === "ended" && run.end.cashed > t.start) mark("cash_out", run.end.at);
    }
    for (const a of t.actions) if (a.type === "bank") mark("banker", a.at);
  }
  state.bestStreak = Math.max(state.bestStreak || 0, best);
  const fresh = [];
  for (const [id, at] of Object.entries(got)) if (!state.achievements[id]) { state.achievements[id] = at; fresh.push(id); }
  return fresh;
}
function announce(fresh) {
  fresh.forEach((id, i) => { const a = ACH.find(x => x.id === id); if (a) setTimeout(() => toast(`${a.e} Unlocked: ${a.n}`, "ach"), 1800 + i * 2200); });
}

/* =========================================================
   Rendering
   ========================================================= */
const $ = s => document.querySelector(s);
const NAV = [
  { id: "home", n: "Home", ic: '<path d="M4 11 12 4l8 7"/><path d="M6 10v9h12v-9"/><path d="M10 19v-5h4v5"/>' },
  { id: "stats", n: "Stats", ic: '<path d="M5 20V12M12 20V5M19 20v-8"/>' },
  { id: "friends", n: "Friends", ic: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c.6-3.4 3-5.2 6-5.2s5.4 1.8 6 5.2"/><circle cx="17" cy="9" r="2.5"/><path d="M16.5 13.9c2.4.2 4 1.8 4.5 4.6"/>' },
  { id: "leaderboard", n: "Leaders", ic: '<path d="M8 20V11h8v9"/><path d="M3 20v-5h5M16 20v-7h5v7"/><path d="M2 20h20"/><path d="m12 3 1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 9l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4z"/>' },
  { id: "chat", n: "Chat", ic: '<path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/>' },
];
const PAGES = ["home", "feed", "trackers", "stats", "planner", "awards", "hints", "friends", "leaderboard", "challenges", "chat", "profile"];
// Which bottom tab lights up for each page.
const navOf = p => ({ trackers: "home", feed: "home", planner: "stats", awards: "stats", hints: "stats", challenges: "leaderboard", profile: "" }[p] ?? p);
const SUBNAV = [["stats", "Stats"], ["planner", "Planner"], ["awards", "Awards"], ["hints", "Hints"]];
const HOMENAV = [["home", "My tracker"], ["feed", "Feed"]];
const LEADNAV = [["leaderboard", "Leaderboard"], ["challenges", "Challenges"]];
let previewSkin = null;
function applySkin() { document.documentElement.dataset.skin = previewSkin || state.skin; }
function setAccent(c) {
  document.documentElement.style.setProperty("--accent", c);
  const lum = parseInt(c.slice(1, 3), 16) * .299 + parseInt(c.slice(3, 5), 16) * .587 + parseInt(c.slice(5, 7), 16) * .114;
  document.documentElement.style.setProperty("--on-accent", lum > 140 ? "#0b0e12" : "#ffffff");
}
function go(page) { state.page = page; save(); render(); scrollTo(0, 0); }
function renderNav() {
  $("#nav").innerHTML = NAV.map(n => `<button data-nav="${n.id}" class="${navOf(state.page) === n.id ? "on" : ""}" aria-label="${n.n}"><svg viewBox="0 0 24 24">${n.ic}</svg>${n.n}</button>`).join("");
}
function renderTabs() {
  const show = state.page === "home" || state.page === "stats" || state.page === "trackers";
  $("#tabs").hidden = !show;
  if (!show) return;
  $("#tabs").innerHTML = state.trackers.map(t => {
    const s = compute(t);
    return `<button class="tab ${t.id === state.activeId ? "active" : ""}" data-tab="${t.id}"><span class="dot" style="background:${t.accent}"></span>${esc(t.name)}${t.shared === false && !localMode ? " 🔒" : ""}${t.paused ? " ⏸" : s.pending ? " ⏳" : ""}</button>`;
  }).join("") + `<button class="tab" data-add aria-label="Add tracker">＋</button><button class="tab ic ${state.page === "trackers" ? "active" : ""}" data-nav="trackers" aria-label="All trackers"><svg viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/></svg></button>`;
  const act = $("#tabs .tab.active"); if (act) act.scrollIntoView({ inline: "nearest", block: "nearest" });
}
function render(anim) {
  stopFx();
  if (!state) return;
  tcCache = null; applySkin(); renderNav(); renderTabs(); renderMe();
  const t = active();
  setAccent(state.page === "home" || state.page === "stats" ? t.accent : ACCENTS[0]);
  $("#fabBar").hidden = state.page !== "home";
  ({ home: renderHome, trackers: renderTrackers, stats: renderStats, planner: renderPlanner, awards: renderAwards, hints: renderHints, profile: renderProfile,
     friends: renderFriends, leaderboard: renderLeaders, chat: renderChat, feed: renderFeed, challenges: renderChallenges })[state.page](anim);
  // Stats, Planner and Awards share the Stats tab, with a switcher on top.
  if (SUBNAV.some(x => x[0] === state.page)) $("#view").insertAdjacentHTML("afterbegin", `<div class="seg subnav">${SUBNAV.map(([id, n]) => `<button data-nav="${id}" class="${state.page === id ? "on" : ""}">${n}</button>`).join("")}</div>`);
  // Home has your tracker and the friends feed, with the same switcher.
  else if (!localMode && HOMENAV.some(x => x[0] === state.page)) $("#view").insertAdjacentHTML("afterbegin", `<div class="seg subnav">${HOMENAV.map(([id, n]) => `<button data-nav="${id}" class="${state.page === id ? "on" : ""} ${id === "feed" ? "has-dot" : ""}" ${id === "feed" ? `data-count="${feedNewLabel()}"` : ""}>${n}</button>`).join("")}</div>`);
}

/* ---------- Home ---------- */
function renderHome(anim) {
  const t = active(), s = compute(t);
  const nt = nextTier(s.tier);
  const pv = previewSkin && SKINS.find(k => k.id === previewSkin);
  const shown = s.tier; // the badge and ring always show the live tier; themes only change colours
  const autoNote = t.oddsMode === "auto" ? (t.bets.length ? `last ${Math.min(RECENT, t.bets.length)} bets` : "until your first bet") : "fixed";
  const targetEdited = t.targetEdits.length > 0;
  $("#view").innerHTML = `
    ${pv ? `<div class="glass pv-bar"><div>👀 <b>Previewing the ${pv.name} theme.</b> Your tier and numbers are real. It unlocks at ${pv.need} wins in a row.</div><button data-stoppreview>Stop</button></div>` : ""}
    <div class="head">
      <div style="min-width:0">
        <div class="eyebrow">Run ${s.current.n} ${tierBadge(shown)}</div>
        <h1>${esc(t.name)}</h1>
      </div>
      <button class="ghost" id="optBtn">Options</button>
    </div>
    <div class="ring-wrap ${s.reached ? "gold" : ""} ${shown.fx.pulse ? "pulse" : ""} ${t.paused ? "paused" : ""}" id="ring"
      ${s.risk && !t.paused ? `data-risk="${s.risk.lvl}" style="--rc:${s.risk.c};--rdur:${s.risk.dur}s"` : ""}>
      ${ringSVG({ ...s, tier: shown, from: anim && anim.from != null ? anim.from : undefined })}
      <div class="ring-center">
        <div class="bal">${money(s.balance)}</div>
        <div class="of">of ${money(t.target)}${targetEdited ? ` <span class="edited">edited</span>` : ""}</div>
        <div class="streak"><span>${tierSym(shown)}</span><span>${plural(s.streak, "win")}</span></div>
        ${t.paused ? `<div class="pause-pill">⏸ Run paused</div>` : `<div class="togo">${s.reached ? "🏆 Target reached" : winsText(s.remaining) + " to go"}</div>`}
      </div>
    </div>
    ${s.risk && !t.paused ? `<div class="glass risk-banner" style="--rc:${s.risk.c}"><span class="big">${s.risk.sym}</span><div style="min-width:0"><b>${s.risk.name}</b><div class="s">${esc(s.pendingBet.text)} @ ${odds2(s.pendingBet.odds)} · ${money(s.balance)} on the line</div></div></div>` : ""}
    <div class="glass stats">
      <div class="stat"><div class="k">Typical odds</div><div class="v">${odds2(s.odds)}</div><div class="s">${autoNote}</div></div>
      <div class="stat"><div class="k">${nt ? "Next tier" : "Top tier"}</div><div class="v">${nt ? nt.sym + " " + (nt.min - s.streak) : "♾️"}</div><div class="s">${nt ? `${plural(nt.min - s.streak, "win")} to ${nt.name}` : "nothing above"}</div></div>
      <div class="stat"><div class="k">Banked</div><div class="v" style="color:var(--gold)">${moneyShort(s.banked)}</div><div class="s">safe from losses</div></div>
    </div>
    <div class="section-h"><h2>History</h2><span>Permanent · tap a bet to settle or edit</span></div>
    <div class="list">${historyHTML(t, s)}</div>`;
  const ring = $("#ring");
  startFx(ring, shown, s.reached);
  startSparks(ring, s.streak > 0 && !t.paused, nt && !s.reached ? Math.max(0, 3 - (nt.min - s.streak)) : 0);
  $("#optBtn").onclick = () => openOptions(t);
  document.querySelectorAll("[data-bet]").forEach(el => el.onclick = () => openBet(t, el.dataset.bet));
  const fab = $("#fab");
  fab.disabled = false;
  if (t.paused) { fab.textContent = "Run paused · resume in Options"; fab.onclick = () => openOptions(t); }
  else if (s.pending) { fab.textContent = "Settle the pending bet"; fab.onclick = () => openBet(t, s.pendingBet.id); }
  else { fab.textContent = `Log a bet · stake ${moneyShort(s.balance)}`; fab.onclick = () => openNewBet(t); }
  if (anim) runAnim(anim, s, ring);
}
function historyHTML(t, s) {
  if (!t.bets.length && !t.actions.length) return `<div class="empty">No bets yet. Tap <b>Log a bet</b> to stake your ${money(t.start)} starting balance on the first leg.</div>`;
  const items = t.bets.map(b => ({ at: b.createdAt, b })).concat(t.actions.map(a => ({ at: a.at, a }))).sort((x, y) => y.at - x.at);
  const now = Date.now();
  return items.map(({ b, a }) => {
    if (a) {
      const x = s.acts[a.id];
      if (a.type === "bank") return `<div class="act">🏦 <span>Banked <b>${money(x ? x.amt : a.amount)}</b> · ${when(a.at)}</span></div>`;
      if (a.type === "end") return `<div class="run-break ok">Run ${x ? x.run : ""} ended · cashed out ${money(x ? x.amt : 0)}</div>`;
      if (a.type === "pause") return `<div class="act">⏸ <span>Run paused · ${when(a.at)}</span></div>`;
      if (a.type === "resume") return `<div class="act">▶️ <span>Run resumed · ${when(a.at)}</span></div>`;
      if (a.type === "target") return `<div class="act">🎯 <span>Target changed ${money(a.from)} → <b>${money(a.to)}</b> · ${when(a.at)} <span class="edited">edited</span></span></div>`;
      return "";
    }
    const r = s.rows[b.id], rk = riskFor(b.odds);
    const icon = b.result === "win" ? "✅" : b.result === "loss" ? "❌" : "⏳";
    const right = b.result === "win" ? `+${moneyShort(r.potential - r.stake)}<small>→ ${moneyShort(r.potential)}</small>`
      : b.result === "loss" ? `−${moneyShort(r.stake)}<small>run reset</small>` : `${moneyShort(r.potential)}<small>to win</small>`;
    const locked = now - b.createdAt > DAY;
    return (r.endedRun ? `<div class="run-break">Run ${r.run} ended</div>` : "") +
      `<button class="glass bet ${b.result}" data-bet="${b.id}">
        <div class="ic">${icon}</div>
        <div class="main"><div class="t">${esc(b.text || b.sport)}</div>
          <div class="m"><span>${esc(b.sport)}</span><span>@ ${odds2(b.odds)}</span>${b.result === "pending" && rk ? `<span class="riskchip" style="--rc:${rk.c}">${rk.sym} ${rk.name}</span>` : ""}<span>· ${when(b.createdAt)}</span>
          ${b.edits.length ? `<span class="edited">edited</span>` : ""}${locked ? `<span title="Details locked">🔒</span>` : ""}${b.link ? `<span>🔗</span>` : ""}${b.slip ? `<span title="Bet slip attached">🧾</span>` : ""}</div></div>
        <div class="r">${right}</div></button>`;
  }).join("");
}

/* ---------- Trackers overview ---------- */
function renderTrackers() {
  $("#view").innerHTML = `
    <div class="head" style="padding-top:18px"><div><div class="eyebrow">${plural(state.trackers.length, "tracker")}</div><h1>All trackers</h1></div></div>
    <div class="ov-grid">
      ${state.trackers.map(t => { const s = compute(t); return `
        <button class="glass ov-card ${t.id === state.activeId ? "active" : ""}" data-open="${t.id}">
          ${ringSVG(s)}
          <div class="n"><span class="dot" style="width:8px;height:8px;border-radius:50%;background:${t.accent};flex:none"></span>${esc(t.name)}</div>
          <div class="b">${moneyShort(s.balance)}</div>
          <div class="st">${tierSym(s.tier)} ${plural(s.streak, "win")}${t.paused ? " · ⏸" : s.pending ? ` · ${s.risk ? s.risk.sym : "⏳"}` : ""}</div>
          <div class="st">${s.reached ? "🏆 target hit" : winsText(s.remaining) + " to go"}</div>
          ${s.banked ? `<div class="st" style="color:var(--gold)">🏦 ${moneyShort(s.banked)} banked</div>` : ""}
        </button>`; }).join("")}
      <button class="glass ov-card add" data-add><span>＋</span>New tracker</button>
    </div>
    <div class="section-h"><h2>${localMode ? "Saved on this device" : "Synced to your account"}</h2></div>
    <div class="glass card">
      <div class="cap" style="margin-bottom:12px">${localMode ? "Everything is saved in this browser. Add your Supabase keys to config.js to sync it to an account." : "Everything you log saves to your account automatically, so it's on every device you log in on. You can still copy a backup any time."}</div>
      <div class="row2"><button class="btn sec" id="bkCopy">Copy backup</button><button class="btn sec" id="bkRestore">Import backup</button></div>
    </div>`;
  document.querySelectorAll("[data-open]").forEach(el => el.onclick = () => { state.activeId = el.dataset.open; go("home"); });
  $("#bkCopy").onclick = copyBackup;
  $("#bkRestore").onclick = openRestore;
}
function copyBackup() {
  const txt = JSON.stringify(state);
  const done = () => toast("Backup copied. Paste it somewhere safe, like your notes.");
  try { navigator.clipboard.writeText(txt).then(done, () => showBackup(txt)); } catch (e) { showBackup(txt); }
}
function showBackup(txt) {
  const sh = openSheet(`<h3>Your backup</h3><div class="sub">Select all of this text and copy it somewhere safe.</div><div class="field"><textarea id="bkText" readonly></textarea></div>`);
  const ta = sh.querySelector("#bkText"); ta.value = txt; ta.focus(); ta.select();
}
function openRestore() {
  const sh = openSheet(`<h3>Import backup</h3><div class="sub">Paste a backup you copied earlier. Its trackers and bets are added to your account. Nothing already logged is removed or changed.</div>
    <div class="field"><textarea id="rsText" placeholder="Paste backup here"></textarea></div><div class="err" id="rsErr"></div><button class="btn" id="rsGo">Import</button>`);
  sh.querySelector("#rsGo").onclick = () => {
    let s;
    try { s = JSON.parse(sh.querySelector("#rsText").value); } catch (e) { return sh.querySelector("#rsErr").textContent = "That doesn't look like a backup. Paste the whole copied text."; }
    if (!s || !Array.isArray(s.trackers) || !s.trackers.length) return sh.querySelector("#rsErr").textContent = "That backup has no trackers in it.";
    closeSheet(); importData(s, "backup");
  };
}

/* ---------- Stats ---------- */
function lineChart({ lines, xmin = 0, xmax, ymin, ymax, log, yTicks, yFmt, xLabel, h = 180 }) {
  const w = 340, l = 46, r = 10, tp = 10, b = 28;
  const X = x => l + (xmax === xmin ? 0 : (x - xmin) / (xmax - xmin)) * (w - l - r);
  const Y = y => { const v = log ? (Math.log(Math.max(y, ymin)) - Math.log(ymin)) / (Math.log(ymax) - Math.log(ymin)) : (y - ymin) / (ymax - ymin); return tp + (1 - v) * (h - tp - b); };
  const xt = []; const step = Math.max(1, Math.ceil((xmax - xmin) / 6));
  for (let x = xmin; x <= xmax; x += step) xt.push(x);
  let out = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img">`;
  yTicks.forEach(y => { out += `<line x1="${l}" x2="${w - r}" y1="${Y(y)}" y2="${Y(y)}" stroke="var(--stroke)"/><text x="${l - 6}" y="${Y(y) + 3}" text-anchor="end">${yFmt(y)}</text>`; });
  xt.forEach(x => { out += `<text x="${X(x)}" y="${h - 12}" text-anchor="middle">${x}</text>`; });
  if (xLabel) out += `<text x="${(l + w - r) / 2}" y="${h - 1}" text-anchor="middle">${xLabel}</text>`;
  for (const ln of lines) {
    const d = ln.pts.map((p, i) => `${i ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ");
    if (ln.area) out += `<path d="${d} L${X(ln.pts[ln.pts.length - 1][0])},${Y(ymin)} L${X(ln.pts[0][0])},${Y(ymin)} Z" fill="${ln.color}" opacity=".12"/>`;
    out += `<path d="${d}" fill="none" stroke="${ln.color}" stroke-width="2.2" ${ln.dash ? 'stroke-dasharray="5 4"' : ""} stroke-linejoin="round"/>`;
    if (ln.dots) ln.pts.forEach(p => { if (p[2]) out += `<circle cx="${X(p[0])}" cy="${Y(p[1])}" r="3.4" fill="${p[2]}" stroke="var(--bg)" stroke-width="1"/>`; });
  }
  return out + `</svg>`;
}
function logTicks(lo, hi) {
  const t = []; for (let p = Math.floor(Math.log10(lo)); p <= Math.ceil(Math.log10(hi)); p++) { const v = Math.pow(10, p); if (v >= lo * .999 && v <= hi * 1.001) t.push(v); }
  if (t.length < 2) { t.length = 0; t.push(lo, hi); }
  return t;
}
const axisMoney = v => v >= 1e6 ? "$" + +(v / 1e6).toFixed(1) + "M" : v >= 1e3 ? "$" + +(v / 1e3).toFixed(1) + "k" : "$" + +v.toFixed(2);
let statsRun = null, statsRunT = null, statsAllRuns = false;
// The Stats page is a list of cards the person picks and orders in "Customise". Each card computes
// from a shared context (built once per render) and returns its inner HTML, or "" to hide when empty.
const median = a => { if (!a.length) return NaN; const o = a.slice().sort((x, y) => x - y), m = o.length >> 1; return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2; };
const signed = (n, f = moneyShort) => (n >= 0 ? "+" : "−") + f(Math.abs(n)).replace(/^[−-]/, "");
const needMore = (n, msg) => `<div class="cap">${msg || `Settle ${plural(n, "more bet")} to see this.`}</div>`;
// One row: label, actual rate as a bar coloured by whether it beats the odds, and the odds-implied rate as a tick.
const cmpBar = (label, w, n, exp, c) => { const act = w / n; return `<div class="barrow"><div class="lbl">${label}</div><div class="bartrack"><div class="barfill" style="width:${act * 100}%;background:${act >= exp ? c.cWin : c.cLoss}"></div><div class="barexp" style="left:calc(${exp * 100}% - 1px)"></div></div><div class="num">${pct(act)}<small>${w}/${n}</small></div></div>`; };
const expOf = bs => bs.reduce((a, b) => a + 1 / b.odds, 0) / bs.length;
const tileH = (k, v, sub, cls = "") => `<div class="tile"><div class="k">${k}</div><div class="v ${cls}">${v}</div><div class="s">${sub}</div></div>`;

const STAT_WIDGETS = [
  { id: "winrate", name: "Win rate", group: "Performance", desc: "How often you win against what the odds said you should.",
    render: c => `<h3>Win rate</h3><div class="cap">${c.settled.length} settled bets</div><div class="tiles">
      ${tileH("Actual", pct(c.actWR, 1), `${c.wins.length} won of ${c.settled.length}`, c.actWR >= c.expWR ? "win" : "loss")}
      ${tileH("Expected", pct(c.expWR, 1), "implied by the odds you took")}</div>
      ${c.settled.length ? `<div class="cap" style="margin:10px 0 0">${c.actWR >= c.expWR ? "You're beating" : "You're behind"} what the odds predicted by ${pct(Math.abs(c.actWR - c.expWR), 1)}.</div>` : ""}` },
  { id: "luck", name: "Luck or skill?", group: "Performance", desc: "Whether your results are normal variance or something more.",
    render: c => {
      if (c.settled.length < 5) return `<h3>Luck or skill?</h3>${needMore(5 - c.settled.length)}`;
      const E = c.settled.reduce((a, b) => a + 1 / b.odds, 0), sd = Math.sqrt(c.settled.reduce((a, b) => a + (1 / b.odds) * (1 - 1 / b.odds), 0)) || 1;
      const d = c.wins.length - E, z = d / sd, pos = Math.max(0, Math.min(100, (z + 3) / 6 * 100));
      const verdict = z <= -2 ? "Well below the odds. That's more than bad luck, so look at how you're picking." : z <= -1 ? "Running cold, but still inside normal swings." : z < 1 ? "Right where the odds say. Nothing unusual yet." : z < 2 ? "Running hot. Could be skill, could be a good patch." : "Well above the odds. Either a real edge or a very hot streak.";
      return `<h3>Luck or skill?</h3><div class="cap">Your wins against the odds' expectation, in standard swings.</div>
        <div class="gauge"><div class="gz"></div><i style="left:${pos}%"></i></div><div class="gauge-l"><span>Cold</span><span>Normal</span><span>Hot</span></div>
        <div class="tiles" style="margin-top:10px">${tileH("Wins vs expected", (d >= 0 ? "+" : "") + d.toFixed(1), `${c.wins.length} won, ${E.toFixed(1)} expected`, d >= 0 ? "win" : "loss")}${tileH("Swing size", z.toFixed(1) + "σ", "how unusual that is")}</div>
        <div class="cap" style="margin:10px 0 0">${verdict}${c.settled.length < 100 ? ` With ${c.settled.length} bets this can still change a lot; around 100+ bets tells you much more.` : ""}</div>`;
    } },
  { id: "form", name: "Recent form", group: "Performance", desc: "Your last 20 results and how the last 10 compare with your overall record.",
    render: c => {
      if (!c.settled.length) return `<h3>Recent form</h3>${needMore(1)}`;
      const last = c.settled.slice(-20), l10 = c.settled.slice(-10), w10 = l10.filter(b => b.result === "win").length;
      const o10 = median(l10.map(b => b.odds)), oAll = median(c.settled.map(b => b.odds));
      return `<h3>Recent form</h3><div class="cap">Oldest on the left, newest on the right.</div>
        <div class="form">${last.map(b => `<span class="${b.result}" title="${esc(b.text)} @ ${odds2(b.odds)}">${b.result === "win" ? "W" : "L"}</span>`).join("")}</div>
        <div class="tiles" style="margin-top:10px">${tileH("Last 10", pct(w10 / l10.length), `vs ${pct(c.actWR)} overall`, w10 / l10.length >= c.actWR ? "win" : "loss")}${tileH("Typical odds, last 10", odds2(o10), `vs ${odds2(oAll)} overall`)}</div>`;
    } },
  { id: "breakeven", name: "Break-even check", group: "Performance", desc: "The win rate you need at your typical odds, and whether you're hitting it.",
    render: c => {
      const need = 1 / c.s.odds, real = need / 1.05;
      return `<h3>Break-even check</h3><div class="cap">At typical odds of ${odds2(c.s.odds)}.</div><div class="tiles">
        ${tileH("You need", pct(need, 1), "to win just to stay level")}${tileH("You win", pct(c.actWR, 1), c.settled.length ? `${c.actWR >= need ? "above" : "below"} the line` : "no bets yet", c.settled.length ? (c.actWR >= need ? "win" : "loss") : "")}</div>
        <div class="cap" style="margin:10px 0 0">Bookmakers build in a margin of around 5%, so the true chance of each bet landing is nearer ${pct(real, 1)} than ${pct(need, 1)}. To profit long term you need to beat the odds, not just match them.</div>`;
    } },
  { id: "bands", name: "By odds range", group: "Performance", desc: "Win rate in each odds band against what those odds implied.",
    render: c => {
      const rows = ODDS_BANDS.map(bd => { const bs = c.settled.filter(b => b.odds >= bd.lo && b.odds < bd.hi); return bs.length ? cmpBar(`${bd.sym} ${bd.name}`, bs.filter(b => b.result === "win").length, bs.length, expOf(bs), c) : ""; }).join("");
      return `<h3>By odds range</h3><div class="cap">Bar is your actual win rate. The white tick is what the odds implied.</div>${rows ? `<div class="bars">${rows}</div>` : needMore(1)}`;
    } },
  { id: "sport", name: "By sport", group: "Performance", desc: "Record, win rate and edge for each sport you bet on.",
    render: c => {
      const sp = new Map();
      for (const b of c.settled) { const x = sp.get(b.sport) || { n: 0, w: 0, o: [], e: 0 }; x.n++; if (b.result === "win") x.w++; x.o.push(b.odds); x.e += 1 / b.odds; sp.set(b.sport, x); }
      const rows = [...sp.entries()].sort((a, b) => b[1].n - a[1].n).map(([n, x]) => { const edge = x.w / x.n - x.e / x.n; return `<tr><td>${esc(n)}</td><td>${x.w}–${x.n - x.w}</td><td>${pct(x.w / x.n)}</td><td>${odds2(geoMean(x.o))}</td><td style="color:${edge >= 0 ? "var(--win)" : "var(--loss)"}">${edge >= 0 ? "+" : "−"}${pct(Math.abs(edge))}</td></tr>`; }).join("");
      return `<h3>By sport</h3><div class="cap">Edge is your win rate minus what the odds implied. Green sports are where you're beating the bookie.</div>
        ${rows ? `<div class="tbl-wrap"><table><thead><tr><th>Sport</th><th>W–L</th><th>Win %</th><th>Odds</th><th>Edge</th></tr></thead><tbody>${rows}</tbody></table></div>` : needMore(1)}`;
    } },
  { id: "weekday", name: "Best days", group: "Patterns", desc: "Win rate by the day of the week you placed the bet.",
    render: c => {
      const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const rows = names.map((n, i) => { const bs = c.settled.filter(b => (new Date(b.createdAt).getDay() + 6) % 7 === i); return bs.length ? cmpBar(n, bs.filter(b => b.result === "win").length, bs.length, expOf(bs), c) : ""; }).join("");
      return `<h3>Best days</h3><div class="cap">Bar is your win rate; the tick is what the odds implied.</div>${rows ? `<div class="bars">${rows}</div>` : needMore(1)}`;
    } },
  { id: "hours", name: "Time of day", group: "Patterns", desc: "Win rate by the time of day you placed the bet.",
    render: c => {
      const B = [["🌙 Night", 0, 6], ["🌅 Morning", 6, 12], ["☀️ Afternoon", 12, 18], ["🌆 Evening", 18, 24]];
      const rows = B.map(([n, a, z]) => { const bs = c.settled.filter(b => { const h = new Date(b.createdAt).getHours(); return h >= a && h < z; }); return bs.length ? cmpBar(n, bs.filter(b => b.result === "win").length, bs.length, expOf(bs), c) : ""; }).join("");
      return `<h3>Time of day</h3><div class="cap">Late-night bets are often the weakest. Check yours.</div>${rows ? `<div class="bars">${rows}</div>` : needMore(1)}`;
    } },
  { id: "creep", name: "Odds creep", group: "Patterns", desc: "Whether you take riskier odds as a run gets bigger.",
    render: c => {
      const G = [["Bets 1–5", 1, 5], ["Bets 6–10", 6, 10], ["Bets 11–15", 11, 15], ["Bets 16+", 16, 1e9]];
      const groups = G.map(([n, a, z]) => ({ n, bs: c.settled.filter(b => { const k = c.s.rows[b.id]?.betInRun; return k >= a && k <= z; }) })).filter(g => g.bs.length);
      if (groups.length < 2) return `<h3>Odds creep</h3>${needMore(0, "Needs bets from deeper into a run to compare.")}`;
      const meds = groups.map(g => median(g.bs.map(b => b.odds))), mx = Math.max(...meds);
      const rise = meds[meds.length - 1] / meds[0] - 1;
      return `<h3>Odds creep</h3><div class="cap">Typical odds you take at each stage of a run.</div><div class="bars">
        ${groups.map((g, i) => `<div class="barrow"><div class="lbl">${g.n}</div><div class="bartrack"><div class="barfill" style="width:${(meds[i] - 1) / (mx - 1 || 1) * 100}%;background:${riskFor(meds[i])?.c || c.cWin}"></div></div><div class="num">${odds2(meds[i])}<small>${g.bs.length} bets</small></div></div>`).join("")}</div>
        <div class="cap" style="margin:10px 0 0">${rise > .05 ? `You take ${pct(rise)} higher odds late in runs, right when there's the most on the line.` : rise < -.05 ? `You get more careful as runs grow, taking ${pct(-rise)} shorter odds late on. That's the safer habit.` : "Your odds stay steady through a run. Good discipline."}</div>`;
    } },
  { id: "tilt", name: "Pace after losses", group: "Patterns", desc: "How quickly you start again after a loss, a common sign of chasing.",
    render: c => {
      const bets = c.t.bets, gaps = [], firstOdds = [];
      bets.forEach((b, i) => { if (b.result === "loss" && bets[i + 1]) { gaps.push(bets[i + 1].createdAt - (b.settledAt || b.createdAt)); firstOdds.push(bets[i + 1].odds); } });
      if (!gaps.length) return `<h3>Pace after losses</h3>${needMore(0, "Shows up after your first loss.")}`;
      const quick = gaps.filter(g => g < 10 * 6e4).length;
      return `<h3>Pace after losses</h3><div class="cap">The gap between a loss and your next bet.</div><div class="tiles">
        ${tileH("Typical restart", dur(median(gaps)), `after ${gaps.length} loss${gaps.length === 1 ? "" : "es"}`)}${tileH("Within 10 min", `${quick} of ${gaps.length}`, "quick restarts", quick / gaps.length > .5 ? "loss" : "")}
        ${tileH("Odds after a loss", odds2(median(firstOdds)), `vs ${odds2(c.s.odds)} typical`, median(firstOdds) > c.s.odds * 1.05 ? "loss" : "")}</div>
        <div class="cap" style="margin:10px 0 0">${quick / gaps.length > .5 ? "Most of your restarts are fast. Taking a break after a loss helps you avoid chasing it." : "You usually take a breather after a loss. That's a good habit."}</div>`;
    } },
  { id: "bust", name: "Where runs end", group: "Runs", desc: "Which bet in a run tends to be the one that loses.",
    render: c => {
      const lossRuns = c.finished.filter(r => r.end.reason === "loss");
      if (!lossRuns.length) return `<h3>Where runs end</h3>${needMore(0, "No runs have ended on a loss yet.")}`;
      const pos = lossRuns.map(r => r.bets.length), M = Math.max(...pos), cnt = Array.from({ length: M }, (_, i) => pos.filter(p => p === i + 1).length), top = Math.max(...cnt);
      const early = pos.filter(p => p <= 3).length / pos.length, worst = cnt.indexOf(top) + 1;
      return `<h3>Where runs end</h3><div class="cap">How many runs died on each bet number.</div>
        <div class="hist">${cnt.map((n, i) => `<div title="Bet ${i + 1}: ${n}"><i style="height:${n / top * 100}%"></i><span>${(i + 1) % (M > 20 ? 5 : 1) === 0 || i === 0 ? i + 1 : ""}</span></div>`).join("")}</div>
        <div class="cap" style="margin:10px 0 0">${pct(early)} of losing runs ended within the first 3 bets. The most common killer is bet ${worst}.</div>`;
    } },
  { id: "survival", name: "Survival", group: "Runs", desc: "Share of your runs that reached each streak length, against the odds.",
    render: c => {
      const M = Math.max(5, c.s.maxStreak + 1), surv = [], expS = [];
      for (let k = 0; k <= M; k++) { surv.push([k, c.allRuns.filter(r => r.maxStreak >= k).length / c.allRuns.length * 100]); expS.push([k, Math.pow(1 / c.s.odds, k) * 100]); }
      return `<h3>Survival</h3><div class="cap">Share of your runs that reached each streak length, against what the average odds predict.</div>
        ${lineChart({ lines: [{ pts: expS, color: c.cMuted, dash: true }, { pts: surv, color: c.t.accent, area: true }], xmax: M, ymin: 0, ymax: 100, yTicks: [0, 25, 50, 75, 100], yFmt: v => v + "%", xLabel: "wins in a row" })}
        <div class="legend"><span><i style="background:${c.t.accent}"></i>Your runs</span><span><i style="background:${c.cMuted}"></i>Expected at ${odds2(c.s.odds)}</span></div>`;
    } },
  { id: "balance", name: "Balance by run", group: "Runs", desc: "Chart of each run's balance, plus replays of finished runs.",
    render: c => {
      const { t, allRuns, cWin, cLoss, cGold } = c, run = allRuns[statsRun];
      const pts = run.points.map(p => [p.i, Math.max(p.bal, .01), p.r === "win" ? cWin : p.r === "loss" ? cLoss : p.r === "bank" ? cGold : null]);
      const vals = pts.map(p => p[1]).concat(t.start), lo = Math.max(.01, Math.min(...vals) * .8), hi = Math.max(...vals, t.start * 1.5) * 1.15;
      const chart = lineChart({ lines: [{ pts: pts.filter((p, i) => !(i === pts.length - 1 && run.end && run.end.reason === "loss")), color: t.accent, dots: true, area: true }], xmax: Math.max(1, run.bets.length), ymin: lo, ymax: hi, log: true, yTicks: logTicks(lo, hi), yFmt: axisMoney, xLabel: "bet in run" });
      // Past 8 runs the chips get unwieldy, so switch to a dropdown.
      const runOpts = allRuns.length > 8
        ? `<select class="run-pick" id="runPick">${allRuns.map((r, i) => `<option value="${i}" ${i === statsRun ? "selected" : ""}>Run ${r.n}${r.end ? ` · ${plural(r.end.streak, "win")}` : " (now)"}</option>`).join("")}</select>`
        : allRuns.map((r, i) => `<button class="chip ${i === statsRun ? "on" : ""}" data-run="${i}">Run ${r.n}${r.end ? "" : " (now)"}</button>`).join("");
      const runList = c.finished.slice().reverse().slice(0, statsAllRuns ? Infinity : 8).map(r => `<div class="runrow"><div><b>Run ${r.n}</b> · ${tierFor(r.end.streak).sym} ${plural(r.end.streak, "win")} · ${r.end.reason === "loss" ? `<span style="color:var(--loss)">lost ${moneyShort(r.end.lostStake)}</span>` : `<span style="color:var(--gold)">cashed ${moneyShort(r.end.cashed)}</span>`}</div><button class="play" data-replay="${r.n - 1}">▶ Replay</button></div>`).join("");
      return `<h3>Balance by run</h3><div class="cap">Log scale, so each win at the same odds climbs the same height.</div>
        <div class="chips" style="margin-bottom:10px">${runOpts}</div>${chart}
        <div class="legend"><span><i style="background:${cWin}"></i>Win</span><span><i style="background:${cLoss}"></i>Loss</span><span><i style="background:${cGold}"></i>Banked</span></div>
        ${runList ? `<h4 class="minih">Finished runs</h4><div class="runs">${runList}</div>${c.finished.length > 8 ? `<button class="ghost" id="runsMore" style="margin-top:8px;width:100%">${statsAllRuns ? "Show fewer" : `Show all ${c.finished.length} runs`}</button>` : ""}` : ""}`;
    } },
  { id: "records", name: "Streak records", group: "Runs", desc: "Your longest, typical and current streaks.",
    render: c => {
      const ends = c.finished.map(r => r.end.streak);
      return `<h3>Streak records</h3><div class="tiles">
        ${tileH("Longest", plural(c.s.maxStreak, "win"), tierFor(c.s.maxStreak).name)}${tileH("Current", plural(c.s.streak, "win"), c.s.tier.name)}
        ${tileH("Typical run", ends.length ? plural(Math.round(median(ends)), "win") : "–", "median of finished runs")}${tileH("Highest balance", moneyShort(c.s.peak), "at any point")}</div>`;
    } },
  { id: "tiers", name: "Tiers reached", group: "Runs", desc: "How many of your runs made it to each tier.",
    render: c => {
      const rows = TIERS.slice(1).filter(tr => tr.min <= Math.max(c.s.maxStreak + 5, 25)).map(tr => { const n = c.allRuns.filter(r => r.maxStreak >= tr.min).length, f = n / c.allRuns.length;
        return `<div class="barrow"><div class="lbl">${tr.sym} ${tr.name}</div><div class="bartrack"><div class="barfill" style="width:${f * 100}%;background:linear-gradient(90deg,${tr.c2},${tr.c1})"></div></div><div class="num">${pct(f)}<small>${n} run${n === 1 ? "" : "s"}</small></div></div>`; }).join("");
      return `<h3>Tiers reached</h3><div class="cap">Share of all your runs that reached each tier.</div><div class="bars">${rows}</div>`;
    } },
  { id: "peaks", name: "Peaks lost", group: "Money", desc: "How high your losing runs got before they reset, and what banking would have saved.",
    render: c => {
      const lr = c.finished.filter(r => r.end.reason === "loss" && r.peak > c.t.start);
      if (!lr.length) return `<h3>Peaks lost</h3>${needMore(0, "No winning run has reset yet.")}`;
      const peaks = lr.map(r => r.peak), half = lr.reduce((a, r) => a + (r.peak - c.t.start) / 2, 0);
      return `<h3>Peaks lost</h3><div class="cap">The highest each losing run reached before it reset.</div><div class="tiles">
        ${tileH("Biggest peak lost", moneyShort(Math.max(...peaks)), "one run")}${tileH("Typical peak lost", moneyShort(median(peaks)), plural(lr.length, "run"))}</div>
        <div class="cap" style="margin:10px 0 0">If you had banked half your profit at each of those peaks, you'd have kept <b style="color:var(--gold)">${moneyShort(half)}</b>. Use Bank in Options to lock some in.</div>`;
    } },
  { id: "biggest", name: "Big moments", group: "Money", desc: "Your biggest win, biggest loss and boldest odds.",
    render: c => {
      if (!c.settled.length) return `<h3>Big moments</h3>${needMore(1)}`;
      const r = b => c.s.rows[b.id], bigW = c.wins.reduce((a, b) => !a || r(b).potential - r(b).stake > r(a).potential - r(a).stake ? b : a, null);
      const ls = c.settled.filter(b => b.result === "loss"), bigL = ls.reduce((a, b) => !a || r(b).stake > r(a).stake ? b : a, null);
      const longW = c.wins.reduce((a, b) => !a || b.odds > a.odds ? b : a, null), shortL = ls.reduce((a, b) => !a || b.odds < a.odds ? b : a, null);
      return `<h3>Big moments</h3><div class="tiles">
        ${tileH("Biggest win", bigW ? "+" + moneyShort(r(bigW).potential - r(bigW).stake) : "–", bigW ? esc(bigW.text) : "none yet", "win")}${tileH("Biggest loss", bigL ? moneyShort(r(bigL).stake) : "–", bigL ? esc(bigL.text) : "none yet", "loss")}
        ${tileH("Longest odds won", longW ? odds2(longW.odds) : "–", longW ? esc(longW.sport) : "none yet")}${tileH("Shortest odds lost", shortL ? odds2(shortL.odds) : "–", shortL ? "the one that hurt" : "none yet")}</div>`;
    } },
  { id: "money", name: "Money overview", group: "Money", desc: "What you've put in, lost, banked and your net position.",
    render: c => {
      const { s, t } = c, net = s.banked - s.deposited, netNow = s.banked + s.balance - s.deposited;
      return `<h3>Money overview</h3><div class="cap">Includes resets and banked amounts.</div><div class="tiles">
        ${tileH("Put in", moneyShort(s.deposited), `${plural(c.allRuns.length, "run")} × ${money(t.start)}`)}${tileH("Lost to resets", moneyShort(s.lost), plural(s.runs.filter(r => r.end.reason === "loss").length, "losing run"), "loss")}
        ${tileH("Banked", moneyShort(s.banked), "profit taken + cash-outs", "gold")}${tileH("On the table", moneyShort(s.balance), "current run")}
        ${tileH("Net (banked only)", signed(net), "banked − put in", net >= 0 ? "win" : "loss")}${tileH("Net if cashed out", signed(netNow), "incl. current balance", netNow >= 0 ? "win" : "loss")}</div>`;
    } },
  { id: "turnover", name: "Turnover", group: "Money", desc: "Total money staked and your return per $100 staked.",
    render: c => {
      const staked = c.settled.reduce((a, b) => a + c.s.rows[b.id].stake, 0), net = c.s.banked + c.s.balance - c.s.deposited;
      return `<h3>Turnover</h3><div class="cap">Every bet re-stakes the whole balance, so far more money passes through than you put in.</div><div class="tiles">
        ${tileH("Total staked", moneyShort(staked), plural(c.settled.length, "bet"))}${tileH("Return per $100", staked ? signed(net / staked * 100, money) : "–", "staked, if cashed out now", net >= 0 ? "win" : "loss")}</div>`;
    } },
  { id: "monthly", name: "Month by month", group: "Money", desc: "Put in, banked and net for each calendar month.",
    render: c => {
      const m = new Map(), key = ts => { const d = new Date(ts); return d.getFullYear() * 12 + d.getMonth(); }, row = k => m.get(k) || (m.set(k, { put: 0, bank: 0 }), m.get(k));
      c.allRuns.forEach(r => row(key(r.startAt)).put += c.t.start);
      c.t.actions.forEach(a => { const x = c.s.acts[a.id]; if (x && (a.type === "bank" || a.type === "end")) row(key(a.at)).bank += x.amt; });
      const rows = [...m.entries()].sort((a, b) => b[0] - a[0]).map(([k, x]) => { const net = x.bank - x.put; return `<tr><td>${new Date(Math.floor(k / 12), k % 12).toLocaleDateString(undefined, { month: "short", year: "numeric" })}</td><td>${moneyShort(x.put)}</td><td>${moneyShort(x.bank)}</td><td style="color:${net >= 0 ? "var(--win)" : "var(--loss)"}">${signed(net)}</td></tr>`; }).join("");
      return `<h3>Month by month</h3><div class="cap">Money in versus money banked. The current run's balance isn't counted until you bank it.</div>
        <div class="tbl-wrap"><table><thead><tr><th>Month</th><th>Put in</th><th>Banked</th><th>Net</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    } },
  { id: "time", name: "Time", group: "Habits", desc: "When you started, how often you bet and how long runs last.",
    render: c => {
      const { s, t, settled } = c, bets = t.bets, firstAt = bets.length ? bets[0].createdAt : null, days = firstAt ? Math.max(1, (Date.now() - firstAt) / DAY) : 0;
      const st = settled.filter(b => b.settledAt).map(b => b.settledAt - b.createdAt), longest = c.finished.length ? Math.max(...c.finished.map(r => r.end.at - r.startAt)) : NaN;
      return `<h3>Time</h3><div class="tiles">
        ${tileH("Betting since", firstAt ? new Date(firstAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "–", firstAt ? plural(Math.floor(days), "day") + " ago" : "no bets yet")}
        ${tileH("Bets per week", bets.length ? (bets.length / Math.max(1, days / 7)).toFixed(1) : "–", plural(bets.length, "bet") + " total")}
        ${tileH("Avg time to settle", dur(st.length ? st.reduce((a, b) => a + b, 0) / st.length : NaN), "logged → result")}${tileH("Longest run", dur(longest), "finished runs")}
        ${tileH("Current run", dur(Date.now() - s.current.startAt), plural(s.current.bets.length, "bet") + " so far")}${tileH("Bets today", bets.filter(b => Date.now() - b.createdAt < DAY).length, "last 24 hours")}</div>`;
    } },
  { id: "projection", name: "Projection", group: "Outlook", desc: "Your chances of reaching the target and what it's likely to cost.",
    render: c => {
      const { s, t } = c, nStart = winsNeeded(t.start, t.target, s.odds), p = 1 / s.odds, pRun = Math.pow(p, nStart), pNow = s.reached ? 1 : Math.pow(p, s.remaining), expRuns = 1 / pRun;
      const useActual = c.settled.length >= 10 && c.actWR > 0, pRunAct = useActual ? Math.pow(Math.min(c.actWR, .999), nStart) : NaN;
      return `<h3>Projection</h3><div class="cap">At typical odds ${odds2(s.odds)}.</div><div class="tiles">
        ${tileH("Wins per run", winsText(nStart), `${money(t.start)} → ${moneyShort(t.target)}`)}${tileH("Chance per run", chance(pRun), "if the odds are fair")}
        ${tileH("Expected resets", isFinite(expRuns) ? Math.max(0, Math.round(expRuns - 1)).toLocaleString("en-US") : "–", "before one run makes it")}${tileH("Expected cost", isFinite(expRuns) ? moneyShort(expRuns * t.start) : "–", "in starting balances", "loss")}
        ${tileH("From right now", chance(pNow), s.reached ? "already there" : winsText(s.remaining) + " to go")}${tileH("At your win rate", useActual ? chance(pRunAct) : "–", useActual ? `using your ${pct(c.actWR)} per run` : "needs 10 settled bets")}</div>
        <div class="cap" style="margin:10px 0 0">Bookmaker margins make the real chance a bit lower than fair odds suggest. The Planner lets you factor that in.</div>`;
    } },
];
const STAT_DEFAULT = ["winrate", "luck", "form", "bands", "sport", "bust", "peaks", "tilt", "survival", "balance", "money", "projection"];
function statsLayout() {
  const L = state.statsLayout || (state.statsLayout = { order: STAT_WIDGETS.map(w => w.id), hidden: STAT_WIDGETS.filter(w => !STAT_DEFAULT.includes(w.id)).map(w => w.id) });
  // Cards added in later versions join at the end, hidden, so a saved layout never changes on its own.
  for (const w of STAT_WIDGETS) if (!L.order.includes(w.id)) { L.order.push(w.id); L.hidden.push(w.id); }
  L.order = L.order.filter(id => STAT_WIDGETS.some(w => w.id === id));
  return L;
}

function renderStats() {
  const t = active(), s = compute(t);
  const settled = t.bets.filter(b => b.result !== "pending"), wins = settled.filter(b => b.result === "win");
  const allRuns = s.runs.concat([s.current]);
  if (statsRun == null || statsRun >= allRuns.length || statsRunT !== t.id) { statsRun = allRuns.length - 1; statsRunT = t.id; }
  const css = getComputedStyle(document.documentElement), cv = n => css.getPropertyValue(n).trim();
  const c = { t, s, settled, wins, allRuns, finished: s.runs.filter(r => r.end),
    expWR: settled.length ? expOf(settled) : NaN, actWR: settled.length ? wins.length / settled.length : NaN,
    cWin: cv("--win"), cLoss: cv("--loss"), cGold: cv("--gold"), cMuted: cv("--muted"), cFg: cv("--fg") };
  const L = statsLayout(), shown = L.order.filter(id => !L.hidden.includes(id)).map(id => STAT_WIDGETS.find(w => w.id === id));
  $("#view").innerHTML = `
    <div class="head"><div><div class="eyebrow">Stats · ${plural(settled.length, "settled bet")}</div><h1>${esc(t.name)}</h1></div><button class="ghost" id="statsEdit">⚙ Customise</button></div>
    ${shown.map(w => `<div class="glass card stat-card" data-w="${w.id}"><span class="grp">${w.group}</span>${w.render(c)}</div>`).join("")}
    ${shown.length ? "" : `<div class="glass card"><h3>No stats showing</h3><div class="cap">Tap Customise to pick the stats you want here.</div></div>`}
    <button class="ghost" id="statsEdit2" style="display:block;margin:16px auto 0">⚙ Customise stats · ${shown.length} of ${STAT_WIDGETS.length} showing</button>`;
  $("#statsEdit").onclick = $("#statsEdit2").onclick = openStatsMenu;
  document.querySelectorAll("[data-run]").forEach(el => el.onclick = () => { statsRun = +el.dataset.run; statsRunT = t.id; renderStats(); });
  document.querySelectorAll("[data-replay]").forEach(el => el.onclick = () => openReplay(t, +el.dataset.replay));
  const rp = $("#runPick"); if (rp) rp.onchange = () => { statsRun = +rp.value; statsRunT = t.id; renderStats(); };
  const rm = $("#runsMore"); if (rm) rm.onclick = () => { statsAllRuns = !statsAllRuns; renderStats(); };
}

// Customise sheet: tick a card to show it, drag the handle (or use the arrows) to reorder. Changes apply live.
function openStatsMenu() {
  const L = statsLayout();
  const sh = openSheet(`<h3>Customise stats</h3><div class="sub">Tick the stats you want. Drag ☰ or use the arrows to change the order.</div>
    <div class="sm-actions"><button class="chip" data-sm="all">Show all</button><button class="chip" data-sm="none">Hide all</button><button class="chip" data-sm="reset">Reset</button></div>
    <div class="sm-list" id="smList"></div><button class="btn" id="smDone">Done</button>`);
  const list = sh.querySelector("#smList");
  const draw = () => {
    list.innerHTML = L.order.map((id, i) => { const w = STAT_WIDGETS.find(x => x.id === id), on = !L.hidden.includes(id);
      return `<div class="sm-row ${on ? "" : "off"}" data-id="${id}"><span class="sm-grip" aria-label="Drag to reorder">☰</span>
        <label class="sm-main"><input type="checkbox" ${on ? "checked" : ""}><span><b>${w.name}</b><small>${w.group} · ${w.desc}</small></span></label>
        <span class="sm-arrows"><button data-mv="-1" ${i ? "" : "disabled"} aria-label="Move up">▲</button><button data-mv="1" ${i < L.order.length - 1 ? "" : "disabled"} aria-label="Move down">▼</button></span></div>`; }).join("");
  };
  const commit = () => { save(); renderStats(); };
  draw();
  list.addEventListener("change", e => { const id = e.target.closest(".sm-row").dataset.id; L.hidden = e.target.checked ? L.hidden.filter(x => x !== id) : L.hidden.concat(id); e.target.closest(".sm-row").classList.toggle("off", !e.target.checked); commit(); });
  list.addEventListener("click", e => { const b = e.target.closest("[data-mv]"); if (!b) return; const id = b.closest(".sm-row").dataset.id, i = L.order.indexOf(id), j = i + +b.dataset.mv;
    [L.order[i], L.order[j]] = [L.order[j], L.order[i]]; draw(); commit(); list.querySelector(`[data-id="${id}"] [data-mv="${b.dataset.mv}"]`)?.focus(); });
  sh.querySelectorAll("[data-sm]").forEach(b => b.onclick = () => {
    if (b.dataset.sm === "all") L.hidden = []; else if (b.dataset.sm === "none") L.hidden = L.order.slice();
    else { delete state.statsLayout; Object.assign(L, statsLayout()); }
    draw(); commit(); });
  sh.querySelector("#smDone").onclick = closeSheet;
  // Drag to reorder with pointer events so it works with touch and mouse alike.
  list.addEventListener("pointerdown", e => {
    const grip = e.target.closest(".sm-grip"); if (!grip) return;
    e.preventDefault(); const row = grip.closest(".sm-row"); row.classList.add("dragging");
    let y0 = e.clientY;
    const move = ev => {
      row.style.transform = `translateY(${ev.clientY - y0}px)`;
      const rows = [...list.children].filter(r => r !== row), mid = row.getBoundingClientRect().top + row.offsetHeight / 2;
      const before = rows.find(r => { const b = r.getBoundingClientRect(); return mid < b.top + b.height / 2; });
      if (before ? before !== row.nextSibling : row !== list.lastElementChild) {
        // Moving the row in the list shifts its layout spot; move the drag origin with it so it stays under the finger.
        const prev = row.offsetTop; list.insertBefore(row, before || null); y0 += row.offsetTop - prev;
        row.style.transform = `translateY(${ev.clientY - y0}px)`;
      }
    };
    // Listen on window: re-inserting the row drops pointer capture on the grip.
    const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", up);
      row.classList.remove("dragging"); row.style.transform = ""; L.order = [...list.children].map(r => r.dataset.id); draw(); commit(); };
    addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", up);
  });
}

/* ---------- Planner ---------- */
function renderPlanner() {
  const t = active(), s = compute(t);
  const pl = state.planner || (state.planner = { odds: odds2(s.odds), margin: 5 });
  $("#view").innerHTML = `
    <div class="head" style="padding-top:18px"><div><div class="eyebrow">Odds planner · ${esc(t.name)}</div><h1>What will it take?</h1></div></div>
    <div class="glass card" style="margin-top:14px">
      <div class="row2">
        <div class="field"><label for="plOdds">Odds per bet</label><input id="plOdds" inputmode="decimal" value="${esc(pl.odds)}"></div>
        <div class="field"><label for="plMargin">Bookie margin %</label><input id="plMargin" inputmode="decimal" value="${esc(pl.margin)}"></div>
      </div>
      <div class="row2">
        <div class="field"><label for="plStart">From</label><input id="plStart" inputmode="decimal" value="${esc(pl.start ?? t.start)}"></div>
        <div class="field"><label for="plTarget">To</label><input id="plTarget" inputmode="decimal" value="${esc(pl.target ?? t.target)}"></div>
      </div>
      <div class="chips" style="margin-top:-4px"><button class="chip" id="plFromNow">Use current balance (${moneyShort(s.balance)})</button><button class="chip" id="plReset">Use tracker start</button></div>
    </div>
    <div class="glass card" id="plOut"></div>
    <div class="glass card"><h3>Compare odds</h3><div class="cap">Same start and target, different odds.</div><div class="tbl-wrap" id="plTable"></div></div>`;
  const calc = () => {
    const o = num($("#plOdds").value), m = num($("#plMargin").value) || 0, st = num($("#plStart").value), tg = num($("#plTarget").value);
    Object.assign(pl, { odds: $("#plOdds").value, margin: $("#plMargin").value, start: $("#plStart").value, target: $("#plTarget").value }); save();
    const out = $("#plOut");
    if (!(o > 1) || !(st > 0) || !(tg > st)) { out.innerHTML = `<div class="cap" style="margin:0">Enter odds above 1.00 and a target higher than the starting amount.</div>`; $("#plTable").innerHTML = ""; return; }
    const n = winsNeeded(st, tg, o), pf = 1 / o, pm = pf / (1 + m / 100);
    const P = Math.pow(pm, n), Pf = Math.pow(pf, n), rk = riskFor(o), tr = tierFor(n);
    out.innerHTML = `
      <div style="display:grid;gap:14px">
        <div><div class="k">Wins in a row needed</div><div class="bigq">${n}</div><div class="s">ends at ${moneyShort(st * Math.pow(o, n))} · reaches ${tierBadge(tr, undefined, false)}</div></div>
        <div><div class="k">Chance of making it</div><div class="bigq" style="color:${P > .1 ? "var(--win)" : P > .01 ? "var(--pend)" : "var(--loss)"}">${chance(P)}</div><div class="s">${chance(Pf)} with no margin</div></div>
      </div>
      <div class="cap" style="margin:12px 0 0">Each bet wins about ${pct(pm, 1)} of the time${rk ? `, rated ${rk.sym} ${rk.name}` : ""}. On average you'd go through ${Math.max(0, Math.round(1 / P - 1)).toLocaleString("en-US")} resets, costing about ${moneyShort(st / P)} in starting balances, before one run gets there.</div>`;
    const list = [1.02, 1.05, 1.1, 1.2, 1.3, 1.5, 1.75, 2, 2.5, 3, 5];
    $("#plTable").innerHTML = `<table><thead><tr><th>Odds</th><th>Risk</th><th>Wins</th><th>Chance</th></tr></thead><tbody>${list.map(x => { const nn = winsNeeded(st, tg, x), r = riskFor(x); return `<tr${Math.abs(x - o) < .001 ? ' style="font-weight:700"' : ""}><td>${odds2(x)}</td><td>${r ? r.sym + " " + r.name : "🟢 Safe"}</td><td>${nn}</td><td>${chance(Math.pow(1 / x / (1 + m / 100), nn))}</td></tr>`; }).join("")}</tbody></table>`;
  };
  ["#plOdds", "#plMargin", "#plStart", "#plTarget"].forEach(id => $(id).addEventListener("input", calc));
  $("#plFromNow").onclick = () => { $("#plStart").value = Math.round(s.balance * 100) / 100; calc(); };
  $("#plReset").onclick = () => { $("#plStart").value = t.start; $("#plTarget").value = t.target; calc(); };
  calc();
}

/* ---------- Awards ---------- */
function renderAwards() {
  const fresh = evalAchievements(); if (fresh.length) save();
  const best = state.bestStreak || 0;
  const got = Object.keys(state.achievements).length;
  $("#view").innerHTML = `
    <div class="head" style="padding-top:18px"><div><div class="eyebrow">Best streak ever: ${tierFor(best).sym} ${plural(best, "win")}</div><h1>Awards</h1></div></div>
    <div class="section-h"><h2>Themes</h2><span>Longer streaks unlock surprise themes</span></div>
    <div class="skins">${SKINS.map(k => { const open = best >= k.need; return `<button class="skin ${state.skin === k.id ? "on" : ""} ${open ? "" : "locked"}" data-skin="${k.id}" data-open-skin="${open ? 1 : ""}" style="--sw:${open ? k.sw : "linear-gradient(135deg, #2a2d33, #16181c)"}"><div class="sw">${open ? "" : `<b>🔒</b>`}</div><div class="nm">${open ? (k.sym ? k.sym + " " : "") + k.name : `??? · ${k.need} wins`}</div></button>`; }).join("")}</div>
    <div class="section-h"><h2>Badges</h2><span>${got} of ${ACH.length}</span></div>
    <div class="ach-grid">${ACH.map(a => { const at = state.achievements[a.id]; return `<div class="glass ach ${at ? "got" : "locked"}"><div class="e">${a.e}</div><div class="n">${a.n}</div><div class="d">${a.d}</div>${at ? `<div class="d" style="color:var(--gold)">Unlocked ${day(at)}</div>` : ""}</div>`; }).join("")}</div>
    <div class="section-h"><h2>Tier ladder</h2><span>by wins in a row</span></div>
    <div class="glass card"><div class="ladder">${TIERS.map(tr => `<div class="${best >= tr.min ? "" : "no"}">${tierBadge(tr)}<span>${tr.min} wins${best >= tr.min ? " ✓" : ""}</span></div>`).join("")}</div></div>`;
  document.querySelectorAll(".skin[data-skin]").forEach(el => el.onclick = () => {
    if (el.dataset.openSkin) { previewSkin = null; state.skin = el.dataset.skin; save(); render(); }
    else toast(`🔒 Unlocks at ${SKINS.find(k => k.id === el.dataset.skin).need} wins in a row. It's a surprise!`);
  });
}

/* ---------- Arc star sparks ----------
   Every win makes the star at the tip of the arc explode, and a tier-up makes a huge one.
   Grinder sparks keep falling off it only near a tier-up: level 1 at 2 wins to go, level 2 (fierce) at 1 to go.
   No wins (or a paused run) means no sparks at all. */
let sparkLoop = null;
function stopSparks() { if (sparkLoop) { cancelAnimationFrame(sparkLoop.raf); sparkLoop.cv.remove(); sparkLoop = null; } }
function startSparks(ring, on, level) {
  stopSparks();
  if (reduced || !on) return;
  const cv = document.createElement("canvas"); cv.className = "arc-sparks"; document.body.appendChild(cv);
  const ctx = cv.getContext("2d"), ps = [];
  const loop = { cv, raf: 0, hold: false, boost: 0, flash: 0, big: false };
  const fierce = level >= 2;
  sparkLoop = loop;
  let W = 0, H = 0, acc = 0;
  const size = () => { const d = Math.min(2, devicePixelRatio || 1); W = innerWidth; H = innerHeight; cv.width = W * d; cv.height = H * d; ctx.setTransform(d, 0, 0, d, 0, 0); };
  size(); addEventListener("resize", size);
  const rnd = (a, b) => a + Math.random() * (b - a);
  const spray = (x, y, tx, ty, n, hard) => {
    const kick = hard ? (loop.big ? 1.8 : 1) : (fierce ? 1.4 : 1) * (1 + loop.boost * .6);
    for (let i = 0; i < n; i++) {
      const a = hard ? rnd(0, 6.283) : Math.atan2(ty, tx) + Math.PI + rnd(-.9, .9), v = (hard ? rnd(2, 7.5) : rnd(1.5, 4.5)) * kick;
      ps.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - rnd(0, 1.5), g: hard ? .12 : .14, life: rnd(30, hard ? (loop.big ? 80 : 55) : 60), t: 0, w: rnd(1.2, fierce || loop.big ? 2.8 : 2.4), hue: rnd(28, fierce ? 58 : 52) });
    }
  };
  loop.explode = big => { loop.hold = false; loop.big = !!big; loop.boost = 1; loop.flash = 1; loop.pending = true; };
  function frame() {
    if (!ring.isConnected) { removeEventListener("resize", size); if (sparkLoop === loop) stopSparks(); else cv.remove(); return; }
    ctx.clearRect(0, 0, W, H);
    const head = ring.querySelector(".ring-head circle:last-of-type"), box = ring.getBoundingClientRect();
    const hb = head && head.getBoundingClientRect();
    if (hb && hb.width) {
      const hx = hb.left + hb.width / 2, hy = hb.top + hb.height / 2, cx = box.left + box.width / 2, cy = box.top + box.height / 2;
      const ang = Math.atan2(hy - cy, hx - cx), tx = -Math.sin(ang), ty = Math.cos(ang);
      if (loop.pending) { loop.pending = false; spray(hx, hy, tx, ty, loop.big ? 180 : 60, true); }
      if (level && !loop.hold && hy > -40 && hy < H + 40) {
        acc += (fierce ? 2 : .8) * (1 + loop.boost * 4); let n = Math.floor(acc); acc -= n;
        if (Math.random() < (fierce ? .06 : .03)) n += Math.floor(rnd(4, fierce ? 14 : 9));
        if (n) spray(hx, hy, tx, ty, n, false);
      }
      if (loop.flash > 0) {
        const fa = loop.flash, sc = loop.big ? 2.6 : 1, fr = (1 - fa) * 90 * sc, gr = 60 * sc;
        ctx.globalCompositeOperation = "lighter";
        ctx.strokeStyle = `rgba(255,236,190,${fa})`; ctx.lineWidth = (3 * fa + .5) * (loop.big ? 2 : 1); ctx.beginPath(); ctx.arc(hx, hy, fr, 0, 6.283); ctx.stroke();
        if (loop.big) { ctx.strokeStyle = `rgba(255,170,80,${fa * .8})`; ctx.lineWidth = 3 * fa; ctx.beginPath(); ctx.arc(hx, hy, fr * .6, 0, 6.283); ctx.stroke(); }
        const g = ctx.createRadialGradient(hx, hy, 0, hx, hy, gr);
        g.addColorStop(0, `rgba(255,255,255,${fa * .9})`); g.addColorStop(1, "rgba(255,190,110,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(hx, hy, gr, 0, 6.283); ctx.fill();
        loop.flash -= loop.big ? .016 : .025;
      }
    }
    loop.boost *= .97;
    ctx.globalCompositeOperation = "lighter";
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i]; p.t++;
      if (p.t > p.life || p.y > H + 20) { ps.splice(i, 1); continue; }
      const f = 1 - p.t / p.life, ox = p.x, oy = p.y;
      p.vy += p.g; p.vx *= .995; p.x += p.vx; p.y += p.vy;
      ctx.strokeStyle = `hsla(${p.hue},100%,${60 + 30 * f}%,${f})`; ctx.lineWidth = p.w;
      ctx.beginPath(); ctx.moveTo(ox - p.vx * 2, oy - p.vy * 2); ctx.lineTo(p.x, p.y); ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    loop.raf = requestAnimationFrame(frame);
  }
  loop.raf = requestAnimationFrame(frame);
}
// Called on a win: hold the sparks while the star travels to its new spot, then explode (huge on a tier-up).
function sparkWin(big, delay) {
  if (!sparkLoop) return;
  const loop = sparkLoop;
  loop.hold = true;
  setTimeout(() => { if (sparkLoop === loop) loop.explode(big); }, delay);
}

/* ---------- Hints: where short-priced bets usually come from ---------- */
// General patterns, not tips on any game. Each one has the trap to check before betting it.
const HINTS = [
  { sport: "Soccer", e: "⚽", picks: [
      ["Over 0.5 goals", "At least one goal in the match, best in high-scoring leagues and cup ties against much weaker teams."],
      ["Double chance on a big favourite", "Top side to win or draw, at home against a team near the bottom."],
      ["Draw no bet, home favourite", "Your stake comes back if it's a draw."]],
    watch: "Rotated squads in cup games and dead rubbers, and red cards. Roughly 1 game in 13 still ends 0-0." },
  { sport: "Cricket", e: "🏏", picks: [
      ["Big favourite head to head", "A top nation against a much lower-ranked side in a T20 or one-dayer."],
      ["Strong home side not to lose a Test", "Win or draw, on a flat pitch with good weather."],
      ["First innings runs over a low line", "T20 on a small, flat ground."]],
    watch: "Rain and shortened games. Check how your bookie settles a washout or no result before you bet." },
  { sport: "Rugby League", e: "🏉", picks: [
      ["Top of the ladder at home head to head", "Against a side in the bottom four."],
      ["Total points over a low line", "Two attacking sides in dry weather."]],
    watch: "Late team changes and the State of Origin period, when clubs lose their best players. Golden point can swing a close one." },
  { sport: "Rugby Union", e: "🏉", picks: [
      ["Tier-one nation head to head", "Against a tier-two nation, like the big World Cup pool games."],
      ["Total points over a low line", "Two attacking sides on a dry day."]],
    watch: "Wet weather keeps scores low, red cards change games, and a draw loses a head to head bet." },
  { sport: "AFL", e: "🏈", picks: [
      ["Heavy home favourite head to head", "A top-four side at its home ground against a bottom side."],
      ["Favourite with a few points' start", "A safety net when the head to head price is too short to bother."]],
    watch: "Wet nights, travel to the other side of the country, and stars managed late in the season." },
  { sport: "Tennis", e: "🎾", picks: [
      ["Top-10 player vs a qualifier", "Early rounds of a Grand Slam, best of five sets."],
      ["Favourite to win at least one set", "Often priced very short."]],
    watch: "Retirements and injuries. Bookies settle a retirement differently, so check the rules. Best of three is shakier than best of five." },
  { sport: "Basketball", e: "🏀", picks: [
      ["Heavy home favourite head to head", "A contender at home against a team that's tanking."],
      ["Team total over a low line", "Fast-paced sides with a full roster."]],
    watch: "Rest days, back-to-back games and stars sitting out. Check the injury report just before tip-off." },
];
const HINT_HABITS = [
  ["Check team news", "an hour before the start. One late change can turn 1.05 into a coin flip."],
  ["Skip friendlies, preseason and dead rubbers", "Teams don't always try."],
  ["Don't stack them into a multi", "Five legs that each win 95% of the time all win only about 77% of the time."],
  ["Shop around", "1.07 instead of 1.05 is 40% more profit on the same bet."],
  ["Set a limit", "and take a break if it stops being fun."]];
let hintSport = "All";
function renderHints() {
  // Put the sports you bet on most first.
  const n = {}; state.trackers.forEach(t => t.bets.forEach(b => { n[b.sport] = (n[b.sport] || 0) + 1; }));
  const list = HINTS.map((h, i) => ({ h, i })).sort((a, b) => (n[b.h.sport] || 0) - (n[a.h.sport] || 0) || a.i - b.i).map(x => x.h);
  const shown = hintSport === "All" ? list : list.filter(h => h.sport === hintSport);
  const pct = k => Math.round(Math.pow(.95, k) * 100) + "%";
  $("#view").innerHTML = `
    <div class="head" style="padding-top:18px"><div><div class="eyebrow">Low odds, high chance. Never a sure thing.</div><h1>Hints</h1></div></div>
    <div class="glass card hint-real">
      <div class="hint-k">What 1.05 really means</div>
      <div class="hint-big"><b>95%</b><span>The price says it wins about 95 times in 100. Take off the bookie's cut and it's closer to <b>92 to 93</b>.</span></div>
      <div class="hint-streak"><div><b>${pct(10)}</b><small>10 in a row</small></div><div><b>${pct(20)}</b><small>20 in a row</small></div><div><b>${pct(50)}</b><small>50 in a row</small></div></div>
      <div class="cap">Chances of a run of wins when every bet wins 95% of the time. One loss resets your streak, so pick each bet like it's the whole balance, because it is.</div>
    </div>
    <div class="chips hint-chips">${["All", ...list.map(h => h.sport)].map(s => `<button class="chip ${s === hintSport ? "on" : ""}" data-hint="${s}">${s === "All" ? "All" : HINTS.find(h => h.sport === s).e + " " + s}</button>`).join("")}</div>
    ${shown.map(h => `<div class="glass card hint">
      <div class="hint-h"><span class="hint-e">${h.e}</span><h3>${h.sport}</h3>${n[h.sport] ? `<span class="hint-you">You bet this</span>` : ""}</div>
      <ul>${h.picks.map(([a, b]) => `<li><b>${a}</b><span>${b}</span></li>`).join("")}</ul>
      <div class="hint-watch">⚠️ <b>Watch out:</b> ${h.watch}</div></div>`).join("")}
    <div class="section-h"><h2>Smart habits</h2><span>for short odds</span></div>
    <div class="glass card hint"><ul>${HINT_HABITS.map(([a, b]) => `<li><b>${a}</b><span>${b}</span></li>`).join("")}</ul></div>
    <div class="cap hint-foot">These are common patterns for prices around 1.05 to 1.10, not picks for any game. Prices move, so always check the odds yourself.</div>`;
  document.querySelectorAll("[data-hint]").forEach(el => el.onclick = () => { hintSport = el.dataset.hint; render(); });
}

/* ---------- Global clicks ---------- */
document.addEventListener("click", e => {
  if (!state) return;
  if (e.target.closest("#meBtn")) return go(state.page === "profile" ? "home" : "profile");
  if (e.target.closest("[data-stoppreview]")) { previewSkin = null; return render(); }
  const nav = e.target.closest("[data-nav]"); if (nav) return go(nav.dataset.nav);
  const tab = e.target.closest("[data-tab]"); if (tab) { state.activeId = tab.dataset.tab; statsRun = null; save(); render(); return; }
  if (e.target.closest("[data-add]")) {
    const t = newTracker(state.trackers.length + 1);
    state.trackers.push(t); state.activeId = t.id; state.page = "home";
    const fresh = evalAchievements(); save(); render(); openOptions(t, true); announce(fresh);
  }
});

/* =========================================================
   Sheets
   ========================================================= */
let scrim = null;
function openSheet(html, cls = "") {
  closeSheet();
  scrim = document.createElement("div"); scrim.className = "scrim";
  scrim.innerHTML = `<div class="sheet ${cls}" role="dialog" aria-modal="true"><div class="sheet-bar"><button class="sheet-x" aria-label="Close">✕</button></div><div class="grab"></div>${html}</div>`;
  scrim.addEventListener("click", e => { if (e.target === scrim || e.target.closest(".sheet-x, .grab")) closeSheet(); });
  document.body.appendChild(scrim);
  const sh = scrim.querySelector(".sheet");
  // Pull down from the top of the sheet to close it.
  let y0 = null, dy = 0;
  sh.addEventListener("touchstart", e => { y0 = sh.scrollTop <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null; dy = 0; }, { passive: true });
  sh.addEventListener("touchmove", e => {
    if (y0 === null) return;
    dy = e.touches[0].clientY - y0;
    if (dy <= 0 || sh.scrollTop > 0) { if (dy < 0) y0 = null; sh.style.transform = ""; return; }
    e.preventDefault(); sh.style.transition = "none"; sh.style.transform = `translateY(${dy}px)`;
  }, { passive: false });
  sh.addEventListener("touchend", () => {
    if (y0 === null) return; y0 = null;
    if (dy > 90) return closeSheet();
    sh.style.transition = "transform .2s"; sh.style.transform = "";
  });
  return sh;
}
function closeSheet() { if (scrim) { scrim.dispatchEvent(new Event("closing")); scrim.remove(); scrim = null; } }
document.addEventListener("keydown", e => { if (e.key === "Escape") closeSheet(); });
function toast(msg, cls = "") {
  const el = document.createElement("div"); el.className = "toast " + cls; el.textContent = msg;
  document.body.appendChild(el); setTimeout(() => el.remove(), 2600);
}

/* ---------- Tracker options ---------- */
function openOptions(t, isNew) {
  const s = compute(t);
  let mode = t.oddsMode, accent = t.accent;
  const canMove = !s.pending;
  const profit = Math.max(0, s.balance - t.start);
  const sh = openSheet(`
    <h3>${isNew ? "New tracker" : "Tracker options"}</h3>
    <div class="sub">Changes to the numbers recalculate the whole run.</div>
    <div class="field"><label for="oName">Name</label><input id="oName" maxlength="30" value="${esc(t.name)}"></div>
    <div class="field"><label>Accent colour</label><div class="swatches">${ACCENTS.map(c => `<button data-c="${c}" style="--c:${c}" class="${c === accent ? "on" : ""}" aria-label="Colour ${c}"></button>`).join("")}</div></div>
    <div class="row2">
      <div class="field"><label for="oStart">Starting balance</label><input id="oStart" inputmode="decimal" value="${t.start}"></div>
      <div class="field"><label for="oTarget">Target ${t.targetEdits.length ? `<span class="edited">edited</span>` : ""}</label><input id="oTarget" inputmode="decimal" value="${t.target}"></div>
    </div>
    ${t.targetEdits.length ? `<div class="note">${t.targetEdits.map(x => `${money(x.from)} → ${money(x.to)} on ${day(x.at)}`).join(" · ")}</div>` : ""}
    <div class="field"><label>Odds for the forecast</label><div class="seg"><button data-m="auto">Typical of last 10</button><button data-m="fixed">Fixed</button></div></div>
    <div class="field"><label for="oOdds" id="oOddsLbl"></label><input id="oOdds" inputmode="decimal" value="${t.fixedOdds}"><div class="hint" id="oOddsHint"></div></div>
    ${localMode ? "" : `<label class="vis-row"><input type="checkbox" id="oShared" ${t.shared === false ? "" : "checked"}><span><b>👥 Show to friends and community</b><small>Ticked: its bets show in the feed and count on leaderboards and in challenges. Unticked: only you can see it.</small></span></label>`}
    <div class="err" id="oErr"></div>
    <button class="btn" id="oSave">Save</button>
    ${isNew ? "" : `
    <h4>Bank profit</h4>
    <div class="sub" style="margin-bottom:10px">Moves money out of the run into Banked, where a loss can't touch it. Your next stake gets smaller.</div>
    <div class="field" style="margin-bottom:8px"><label for="bkAmt">Amount (balance ${money(s.balance)})</label><input id="bkAmt" inputmode="decimal" placeholder="0.00" ${canMove ? "" : "disabled"}></div>
    <div class="chips" style="margin-bottom:10px">${profit > 0 ? `<button class="chip" data-amt="${profit.toFixed(2)}">Profit ${moneyShort(profit)}</button>` : ""}<button class="chip" data-amt="${(s.balance / 2).toFixed(2)}">Half</button><button class="chip" data-amt="${(s.balance * .25).toFixed(2)}">Quarter</button></div>
    <div class="err" id="bkErr"></div>
    <button class="btn gold" id="bkGo" ${canMove ? "" : "disabled"}>Bank it</button>
    ${canMove ? "" : `<div class="note" style="margin:8px 0 0">Settle the pending bet first.</div>`}
    <h4>Run</h4>
    <div class="btns">
      <button class="btn sec" id="pauseBtn">${t.paused ? "▶️ Resume run" : "⏸ Pause run"}</button>
      <button class="btn warn" id="endBtn" ${canMove ? "" : "disabled"}>🏁 End run and cash out ${money(s.balance)}</button>
    </div>
    <div class="note" style="margin:8px 0 0">Ending a run banks the whole balance and starts run ${s.current.n + 1} from ${money(t.start)}.</div>
    ${delTrackerHTML(t)}`}`);
  const paint = () => {
    sh.querySelectorAll("[data-m]").forEach(b => b.classList.toggle("on", b.dataset.m === mode));
    sh.querySelectorAll("[data-c]").forEach(b => b.classList.toggle("on", b.dataset.c === accent));
    sh.querySelector("#oOddsLbl").textContent = mode === "auto" ? "Odds to use before your first bet" : "Fixed odds";
    sh.querySelector("#oOddsHint").textContent = mode === "auto"
      ? (t.bets.length ? `Auto is on: the middle odds of your last ${Math.min(RECENT, t.bets.length)} bets is ${odds2(typicalOdds(t.bets))}. One-off big bets barely move it.` : "Used until you log your first bet. After that the middle odds of your last 10 bets take over.")
      : "Wins to go always uses this number.";
  };
  sh.querySelectorAll("[data-m]").forEach(b => b.onclick = () => { mode = b.dataset.m; paint(); });
  sh.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { accent = b.dataset.c; paint(); });
  paint();
  sh.querySelector("#oSave").onclick = () => {
    const name = sh.querySelector("#oName").value.trim() || t.name;
    const start = num(sh.querySelector("#oStart").value), target = num(sh.querySelector("#oTarget").value), fo = num(sh.querySelector("#oOdds").value);
    const err = sh.querySelector("#oErr");
    if (!(start > 0)) return err.textContent = "Starting balance must be more than $0.";
    if (!(target > start)) return err.textContent = "Target must be higher than the starting balance.";
    if (!(fo > 1)) return err.textContent = "Average odds must be above 1.00 (decimal odds).";
    if (target !== t.target && !isNew) {
      const at = Date.now();
      t.targetEdits.push({ at, from: t.target, to: target });
      t.actions.push({ id: uid(), type: "target", at, from: t.target, to: target });
    }
    Object.assign(t, { name, start, target, fixedOdds: fo, oddsMode: mode, accent });
    const sharedBox = sh.querySelector("#oShared"), wasShared = t.shared !== false;
    if (sharedBox && sharedBox.checked !== wasShared) t.shared = sharedBox.checked;
    save(); closeSheet(); render();
    if (sharedBox && !isNew && sharedBox.checked !== wasShared) toast(sharedBox.checked ? "👥 Friends and the community can see this tracker." : "🔒 Only you can see this tracker now.");
  };
  if (isNew) return;
  sh.querySelectorAll("[data-amt]").forEach(b => b.onclick = () => { sh.querySelector("#bkAmt").value = b.dataset.amt; });
  sh.querySelector("#bkGo").onclick = () => {
    const amt = Math.round(num(sh.querySelector("#bkAmt").value) * 100) / 100, err = sh.querySelector("#bkErr");
    if (!(amt > 0)) return err.textContent = "Enter an amount to bank.";
    if (amt >= s.balance) return err.textContent = `Leave something to bet with. To take it all, use End run instead.`;
    t.actions.push({ id: uid(), type: "bank", at: Date.now(), amount: amt });
    const fresh = evalAchievements(); save(); closeSheet(); render({ type: "edit", from: s.frac });
    fx(`<div class="stamp" style="filter:drop-shadow(0 0 30px var(--gold))">🏦<b style="color:var(--gold);text-shadow:0 0 18px var(--gold)">${moneyShort(amt)}</b></div>`, 1200);
    toast(`Banked ${money(amt)}.`); announce(fresh);
  };
  sh.querySelector("#pauseBtn").onclick = () => {
    t.paused = !t.paused; t.actions.push({ id: uid(), type: t.paused ? "pause" : "resume", at: Date.now() });
    save(); closeSheet(); render(); toast(t.paused ? "Run paused. Your streak is safe." : "Run resumed.");
  };
  let armed = false;
  sh.querySelector("#endBtn").onclick = e => {
    if (!armed) { armed = true; e.currentTarget.textContent = "Tap again to end this run"; return; }
    t.actions.push({ id: uid(), type: "end", at: Date.now() });
    t.paused = false;
    const fresh = evalAchievements(); save(); closeSheet(); render({ type: "end", from: s.frac, amt: s.balance });
    announce(fresh);
  };
  wireDelTracker(sh, t);
}

/* ---------- Sport picker ---------- */
function sportPicker(wrap, initial, disabled) {
  const input = wrap.querySelector("input"), mark = wrap.querySelector(".picked");
  let value = initial || "", list = null, hi = 0;
  input.value = value; input.disabled = !!disabled;
  const showMark = () => mark.textContent = value && input.value === value ? "✓" : "";
  function matches(q) {
    q = q.trim().toLowerCase();
    const recent = state.recentSports.filter(n => SPORT_NAMES.has(n));
    const score = name => {
      if (!q) return 0;
      const n = name.toLowerCase(), a = (SPORTS.find(s => s.name === name) || { alias: "" }).alias;
      if (n.startsWith(q)) return 3;
      if (n.split(" ").some(w => w.startsWith(q))) return 2;
      if (a.split(" ").some(w => w.startsWith(q)) || n.includes(q)) return 1;
      return -1;
    };
    const res = recent.filter(n => score(n) >= 0).map(n => ({ n, recent: true }));
    const rest = SPORTS.map(s => s.name).filter(n => !recent.includes(n)).map(n => ({ n, s: score(n) })).filter(x => x.s >= 0);
    if (q) rest.sort((x, y) => y.s - x.s);
    res.push(...rest.map(x => ({ n: x.n })));
    if (!res.some(x => x.n === "Other")) res.push({ n: "Other" });
    return res;
  }
  function open() {
    close();
    const items = matches(input.value); hi = 0;
    list = document.createElement("div"); list.className = "sugg"; list.setAttribute("role", "listbox");
    list.innerHTML = items.map((x, i) => `<button type="button" data-s="${esc(x.n)}" class="${i === 0 ? "hi" : ""}">${esc(x.n)}${x.recent ? "<small>recent</small>" : x.n === "Other" ? "<small>not listed</small>" : ""}</button>`).join("");
    list.addEventListener("pointerdown", e => e.preventDefault());
    list.addEventListener("click", e => { const b = e.target.closest("[data-s]"); if (b) pick(b.dataset.s); });
    wrap.appendChild(list);
  }
  function close() { if (list) { list.remove(); list = null; } }
  function pick(n) { value = n; input.value = n; close(); showMark(); }
  input.addEventListener("focus", open);
  input.addEventListener("input", () => { if (input.value !== value) value = ""; showMark(); open(); });
  input.addEventListener("blur", () => setTimeout(() => {
    close();
    if (!value && input.value.trim()) { const m = matches(input.value); if (m.length && m[0].n !== "Other") pick(m[0].n); }
  }, 120));
  input.addEventListener("keydown", e => {
    if (!list) return;
    const btns = [...list.querySelectorAll("button")];
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault(); btns[hi]?.classList.remove("hi");
      hi = (hi + (e.key === "ArrowDown" ? 1 : -1) + btns.length) % btns.length;
      btns[hi].classList.add("hi"); btns[hi].scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter") { e.preventDefault(); if (btns[hi]) pick(btns[hi].dataset.s); }
  });
  showMark();
  return { get value() { return value && input.value === value ? value : ""; }, set(n) { if (SPORT_NAMES.has(n)) pick(n); } };
}
function pushRecent(n) { state.recentSports = [n, ...state.recentSports.filter(x => x !== n)].slice(0, 5); }
function cleanLink(v) { v = v.trim(); if (!v) return ""; return /^https?:\/\//i.test(v) ? v : "https://" + v; }

/* ---------- New bet ---------- */
function openNewBet(t) {
  const s = compute(t);
  const sh = openSheet(`
    <h3>Log a bet</h3>
    <div class="sub">Stakes the whole balance of ${money(s.balance)}.</div>
    <div class="scan" id="scanRow" hidden><button class="btn sec" id="scanBtn" style="width:auto">📷 Fill from screenshot</button><span class="s" id="scanMsg">Pick a screenshot of your bet slip and the app fills in the details.</span><input type="file" id="scanFile" accept="image/*" hidden></div>
    <div class="field"><label for="nOdds">Decimal odds</label><input id="nOdds" inputmode="decimal" placeholder="e.g. 1.85" autocomplete="off"></div>
    <div class="field" id="nSportWrap"><label for="nSport">Sport</label><input id="nSport" placeholder="Start typing, e.g. crick" autocomplete="off"><span class="picked"></span></div>
    <div class="field"><label for="nText">Bet</label><input id="nText" maxlength="60" placeholder="e.g. Storm to win" autocomplete="off"></div>
    <div class="field"><label for="nLink">Link (optional)</label><input id="nLink" inputmode="url" placeholder="https://" autocomplete="off"></div>
    <div class="preview"><span>Returns <b id="nRet">–</b></span><span id="nRisk" class="s"></span></div>
    <div class="err" id="nErr"></div>
    <button class="btn" id="nSave">Log bet</button>`);
  const picker = sportPicker(sh.querySelector("#nSportWrap"), "");
  const oddsIn = sh.querySelector("#nOdds");
  oddsIn.addEventListener("input", () => {
    const o = num(oddsIn.value), rk = o > 1 ? riskFor(o) : null;
    sh.querySelector("#nRet").textContent = o > 1 ? money(s.balance * o) : "–";
    sh.querySelector("#nRisk").innerHTML = o > 1 ? (rk ? `<span class="riskchip" style="--rc:${rk.c}">${rk.sym} ${rk.name}</span>` : "🟢 Under 1.10") : "";
  });
  setTimeout(() => oddsIn.focus(), 250);
  setupScan(sh, picker, s.balance);
  sh.querySelector("#nSave").onclick = () => {
    const o = num(oddsIn.value), sport = picker.value, text = sh.querySelector("#nText").value.trim(), err = sh.querySelector("#nErr");
    if (!(o > 1)) return err.textContent = "Enter decimal odds above 1.00, like 1.85.";
    if (!sport) return err.textContent = "Pick a sport from the list (use Other if it isn't there).";
    if (!text) return err.textContent = "Add a few words about the bet, like “Storm to win”.";
    const before = compute(t);
    const b = { id: uid(), odds: Math.round(o * 1000) / 1000, sport, text, link: cleanLink(sh.querySelector("#nLink").value), result: "pending", createdAt: Date.now(), settledAt: null, edits: [] };
    t.bets.push(b);
    if (sh._slip) attachSlip(b, sh._slip);
    pushRecent(sport);
    const fresh = evalAchievements(); save(); closeSheet();
    render({ type: "pending", from: before.frac, risk: riskFor(b.odds) });
    announce(fresh);
  };
}

/* ---------- Bet slip screenshot reader ---------- */
function setupScan(sh, picker, balance) {
  if (!window.SlipReader) return;
  const row = sh.querySelector("#scanRow"), btn = sh.querySelector("#scanBtn"), file = sh.querySelector("#scanFile"), msg = sh.querySelector("#scanMsg");
  row.hidden = false;
  btn.onclick = () => file.click();
  file.onchange = async () => {
    const f = file.files && file.files[0]; file.value = "";
    if (!f) return;
    row.classList.add("busy"); btn.disabled = true;
    const stage = { prep: "Reading your bet slip…", load: "Getting the slip reader ready. The first time takes a few seconds…", read: "Reading your bet slip…" };
    try {
      const r = await SlipReader.read(f, k => { if (sh.isConnected) msg.textContent = stage[k]; });
      if (!sh.isConnected) return;
      if (!r || !r.found || !(r.odds > 1)) { msg.textContent = "Couldn't find the odds on that image. Try a screenshot of just the slip, or type it in."; return; }
      sh._slip = f;
      sh.querySelector("#nOdds").value = r.odds;
      sh.querySelector("#nOdds").dispatchEvent(new Event("input"));
      if (r.sport && SPORT_NAMES.has(r.sport)) picker.set(r.sport);
      if (r.text) sh.querySelector("#nText").value = r.text.slice(0, 60);
      const miss = [!r.sport && "sport", !r.text && "bet"].filter(Boolean);
      const st = Number(r.stake);
      msg.innerHTML = "✅ Filled in. Check the details, then tap <b>Log bet</b>." + (miss.length ? ` Add the ${miss.join(" and ")} yourself.` : "") + (st > 0 && Math.abs(st - balance) / balance > 0.01 ? ` The slip shows a ${esc(money(st))} stake, but the tracker stakes ${esc(money(balance))}.` : "");
    } catch (e) {
      if (!sh.isConnected) return;
      msg.textContent = e && e.code === "image_rejected" ? "That file couldn't be opened. Try a PNG or JPG screenshot." : "The slip reader couldn't load. Check your connection and try again, or type it in.";
    } finally { row.classList.remove("busy"); btn.disabled = false; }
  };
}

/* ---------- Bet detail ---------- */
function openBet(t, id) {
  const b = t.bets.find(x => x.id === id); if (!b) return;
  const s = compute(t), r = s.rows[id], now = Date.now();
  const isLast = t.bets[t.bets.length - 1].id === id;
  const detailsOpen = now - b.createdAt < DAY;
  const resultLocked = b.result !== "pending" && b.settledAt && now - b.settledAt > DAY;
  const laterActs = t.actions.some(a => a.at > b.createdAt && (a.type === "bank" || a.type === "end"));
  const canResult = res => res === b.result || (!resultLocked && (res !== "pending" || (isLast && !laterActs)));
  const label = { win: "Win", loss: "Loss", pending: "Pending" }, icon = { win: "✅", loss: "❌", pending: "⏳" };
  const rk = riskFor(b.odds);
  const sh = openSheet(`
    <h3>${esc(b.text)}</h3>
    <div class="sub">${esc(b.sport)} · Run ${r.run}, bet ${r.betInRun} · logged ${when(b.createdAt)}${b.edits.length ? ` · <span class="edited">edited</span>` : ""}${rk ? ` · <span class="riskchip" style="--rc:${rk.c}">${rk.sym} ${rk.name}</span>` : ""}</div>
    <div class="results">${["win", "loss", "pending"].map(res => `<button class="${res} ${b.result === res ? "on" : ""}" data-res="${res}" ${canResult(res) ? "" : "disabled"}><span>${icon[res]}</span>${label[res]}</button>`).join("")}</div>
    ${resultLocked ? `<div class="note">🔒 Result locked 24 hours after it was set.</div>` : b.result !== "pending" ? `<div class="note">You can correct the result until ${when(b.settledAt + DAY)}.</div>` : ""}
    <div class="kv">
      <div><div class="k">Stake</div><div class="v">${moneyShort(r.stake)}</div></div>
      <div><div class="k">Odds</div><div class="v">${odds2(b.odds)}</div></div>
      <div><div class="k">${b.result === "win" ? "Paid" : b.result === "loss" ? "Lost" : "Returns"}</div><div class="v">${b.result === "loss" ? moneyShort(r.stake) : moneyShort(r.potential)}</div></div>
    </div>
    ${b.link ? `<p style="margin:-4px 0 16px;font-size:14px">🔗 <a class="link" href="${esc(b.link)}" target="_blank" rel="noopener">${esc(b.link)}</a></p>` : ""}
    ${slipHTML(b)}
    <div class="field"><label for="eOdds">Odds · editable any time</label><input id="eOdds" inputmode="decimal" value="${b.odds}"></div>
    <div class="field"><label for="eText">Bet</label><input id="eText" maxlength="60" value="${esc(b.text)}" ${detailsOpen ? "" : "disabled"}></div>
    <div class="field" id="eSportWrap"><label for="eSport">Sport</label><input id="eSport" autocomplete="off"><span class="picked"></span></div>
    <div class="field"><label for="eLink">Link</label><input id="eLink" inputmode="url" value="${esc(b.link)}" placeholder="https://" ${detailsOpen ? "" : "disabled"}></div>
    <div class="note">${detailsOpen ? `Bet, sport and link lock in ${dur(b.createdAt + DAY - now)}.` : "🔒 Bet, sport and link are locked. Odds can still be fixed."}</div>
    <div class="err" id="eErr"></div>
    <button class="btn sec" id="eSave">Save changes</button>
    ${delBetHTML(b)}
    <h4>Edit history</h4>
    <div class="history">${b.edits.length ? `<ul>${b.edits.slice().reverse().map(e => `<li><b>${when(e.at)}</b>: ${e.changes.map(c => `${esc(c.field)} ${esc(c.from)} → ${esc(c.to)}`).join("; ")}</li>`).join("")}</ul>` : `<div class="hint" style="font-size:13px">No edits. Every change is listed here.</div>`}</div>`);
  const picker = sportPicker(sh.querySelector("#eSportWrap"), b.sport, !detailsOpen);
  wireSlip(sh, t, b);
  wireDelBet(sh, t, b);
  sh.querySelectorAll("[data-res]").forEach(btn => btn.onclick = () => {
    const res = btn.dataset.res;
    if (res === b.result) return;
    const before = compute(t), prev = b.result;
    if (prev !== "pending") b.edits.push({ at: Date.now(), changes: [{ field: "result", from: label[prev], to: label[res] }] });
    b.result = res;
    b.settledAt = res === "pending" ? null : (prev === "pending" ? Date.now() : b.settledAt);
    const fresh = evalAchievements(); save(); closeSheet();
    const after = compute(t);
    render({ type: res, from: before.frac, before, after, risk: riskFor(b.odds) });
    announce(fresh);
  });
  sh.querySelector("#eSave").onclick = () => {
    const err = sh.querySelector("#eErr"), o = num(sh.querySelector("#eOdds").value);
    if (!(o > 1)) return err.textContent = "Odds must be above 1.00.";
    const changes = [], no = Math.round(o * 1000) / 1000;
    if (no !== b.odds) changes.push({ field: "odds", from: odds2(b.odds), to: odds2(no) });
    let upd = {};
    if (detailsOpen) {
      const text = sh.querySelector("#eText").value.trim(), sport = picker.value, link = cleanLink(sh.querySelector("#eLink").value);
      if (!text) return err.textContent = "The bet needs a description.";
      if (!sport) return err.textContent = "Pick a sport from the list.";
      if (text !== b.text) changes.push({ field: "bet", from: `“${b.text}”`, to: `“${text}”` });
      if (sport !== b.sport) { changes.push({ field: "sport", from: b.sport, to: sport }); pushRecent(sport); }
      if (link !== (b.link || "")) changes.push({ field: "link", from: b.link || "none", to: link || "none" });
      upd = { text, sport, link };
    }
    if (!changes.length) return closeSheet();
    const before = compute(t);
    Object.assign(b, upd, { odds: no }); b.edits.push({ at: Date.now(), changes });
    const fresh = evalAchievements(); save(); closeSheet();
    render({ type: "edit", from: before.frac });
    toast(changes.some(c => c.field === "odds") ? "Odds updated. The run was recalculated." : "Changes saved.");
    announce(fresh);
  };
}

/* =========================================================
   Animations
   ========================================================= */
function fx(html, ms, cls = "") {
  const el = document.createElement("div"); el.className = "fx " + cls; el.innerHTML = html;
  document.body.appendChild(el); setTimeout(() => el.remove(), ms); return el;
}
const LOSS_QUIPS = ["Back on the tools 🔧", "Chopper left without you 🚁", "Another swing it is 🛢️", "Pipe dream, mate. Go again 🔧"];
function runAnim(a, s, ring) {
  const goRing = (frac, opt) => requestAnimationFrame(() => requestAnimationFrame(() => setRing(ring, frac, opt)));
  if (a.type === "win") {
    fx(`<div class="stamp">✅<b>WIN</b></div>`, 1200);
    const newTier = a.after.tier !== a.before.tier && a.after.streak > a.before.streak;
    const hit = a.after.reached && !a.before.reached;
    goRing(s.frac, { duration: 1.1, delay: .35 });
    sparkWin(newTier, 1450);
    setTimeout(() => ring.classList.add(newTier || hit ? "surge-big" : "surge"), 380);
    if (newTier) setTimeout(() => tierBurst(a.after.tier), 900);
    if (hit) setTimeout(() => { confetti(["#f5c518", "#ffe27a", "#e8a90c", "#fff3b0", "#c99700"], 240); toast("🚁 Chopper's here. You're off the rig!"); }, newTier ? 2800 : 900);
  } else if (a.type === "loss") {
    crack();
    goRing(s.frac, { duration: 1.5, delay: 1 });
    setTimeout(() => toast(LOSS_QUIPS[Math.floor(Math.random() * LOSS_QUIPS.length)]), 1400);
  } else if (a.type === "pending") {
    const rk = a.risk;
    fx(`<div class="glass-fx" style="--rc:${rk ? rk.c : "var(--pend)"}"><div class="hg">⏳</div>${rk ? `<div class="rk">${rk.sym} ${rk.name}</div>` : ""}</div>`, 1700);
    goRing(s.frac);
  } else if (a.type === "end") {
    fx(`<div class="stamp" style="filter:drop-shadow(0 0 30px var(--gold))">🏁<b style="color:var(--gold);text-shadow:0 0 18px var(--gold)">${moneyShort(a.amt)}</b></div>`, 1300);
    goRing(s.frac, { duration: 1.4, delay: .6 });
  } else goRing(s.frac);
}
function crack(target) {
  const w = innerWidth, h = innerHeight, cx = w / 2, cy = h * .42, paths = [];
  for (let i = 0; i < 9; i++) {
    let ang = (i / 9) * Math.PI * 2 + Math.random() * .5, x = cx, y = cy, d = `M${x},${y}`;
    const reach = Math.hypot(w, h) * .6;
    for (let step = 0; step < 7; step++) {
      ang += (Math.random() - .5) * .7;
      const len = reach / 7 * (.7 + Math.random() * .6);
      x += Math.cos(ang) * len; y += Math.sin(ang) * len; d += ` L${x.toFixed(1)},${y.toFixed(1)}`;
      if (step === 2 && Math.random() > .4) {
        let bx = x, by = y, ba = ang + (Math.random() > .5 ? .9 : -.9), bd = `M${bx},${by}`;
        for (let k = 0; k < 3; k++) { ba += (Math.random() - .5) * .6; bx += Math.cos(ba) * len * .6; by += Math.sin(ba) * len * .6; bd += ` L${bx.toFixed(1)},${by.toFixed(1)}`; }
        paths.push(bd);
      }
    }
    paths.push(d);
  }
  const svg = `<svg viewBox="0 0 ${w} ${h}">${paths.map((d, i) => `<path d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" style="animation-delay:${(i * .02).toFixed(2)}s, 1.2s"/>`).join("")}</svg>`;
  fx(`<div class="flash-red"></div>${svg}<div class="x-mark">❌<b>LOSS</b></div>`, 1800, "crack");
  if (!reduced) {
    const el = target || $("#app"); el.classList.remove("shake"); void el.offsetWidth; el.classList.add("shake");
    setTimeout(() => el.classList.remove("shake"), 600);
    try { navigator.vibrate && navigator.vibrate([60, 40, 120]); } catch (e) {}
  }
}
function tierBurst(tier) {
  const lvl = tier.idx, durS = Math.min(4, 2 + lvl * .14);
  const cosmic = tier.badge === "cosmic";
  if (lvl >= 4) fx(`<div class="screenflash" style="--tc:${tier.c2}"></div>`, 900);
  fx(`<div class="tierburst ${cosmic ? "cosmic" : ""}" style="--tc:${tier.c2};--tdur:${durS}s"><div class="rays"></div><div class="sym">${tier.sym}</div><div class="lbl"><small>New tier · ${tier.min} wins</small>${tier.name}</div></div>`, durS * 1000 + 100);
  if (lvl >= 4) confetti(cosmic ? ["#ffffff", "#ff5fd2", "#3ad6ff", tier.c1, tier.c2] : [tier.c1, tier.c2, "#ffffff"], Math.min(320, 60 + lvl * 18));
  if (!reduced && lvl >= 7) { const app = $("#app"); app.classList.remove("shake"); void app.offsetWidth; app.classList.add("shake"); setTimeout(() => app.classList.remove("shake"), 600); }
}
function confetti(cols, count) {
  const cv = document.createElement("canvas"); cv.className = "confetti"; document.body.appendChild(cv);
  const d = devicePixelRatio || 1; cv.width = innerWidth * d; cv.height = innerHeight * d;
  const ctx = cv.getContext("2d"); ctx.scale(d, d);
  const ps = Array.from({ length: reduced ? 30 : count }, () => ({
    x: innerWidth / 2 + (Math.random() - .5) * 60, y: innerHeight * .42, vx: (Math.random() - .5) * 16, vy: -Math.random() * 16 - 4,
    r: Math.random() * 6 + 3, a: Math.random() * 6, va: (Math.random() - .5) * .4, c: cols[(Math.random() * cols.length) | 0] }));
  const t0 = performance.now();
  (function frame(t) {
    const el = t - t0; ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) {
      p.vy += .35; p.vx *= .99; p.x += p.vx; p.y += p.vy; p.a += p.va;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a); ctx.globalAlpha = Math.max(0, 1 - el / 3800);
      ctx.fillStyle = p.c; ctx.fillRect(-p.r, -p.r / 2.5, p.r * 2, p.r / 1.25); ctx.restore();
    }
    if (el < 3800) requestAnimationFrame(frame); else cv.remove();
  })(t0);
}

/* ---------- Run replay ---------- */
function openReplay(t, runIdx) {
  const s = compute(t), run = s.runs[runIdx];
  if (!run) return;
  const sh = openSheet(`
    <h3>Run ${run.n} replay</h3>
    <div class="sub">${day(run.startAt)} · ${plural(run.bets.length, "bet")} · ${run.end.reason === "loss" ? "ended in a loss" : "cashed out"}</div>
    <div class="ring-wrap" id="rpRing" style="margin-top:4px">${ringSVG({ tier: TIERS[0], frac: 0, total: winsNeeded(t.start, t.target, s.odds), reached: false })}
      <div class="ring-center"><div class="bal" id="rpBal" style="font-size:34px">${money(t.start)}</div><div class="of">of ${moneyShort(t.target)}</div><div class="streak" id="rpStreak" style="font-size:19px">🌱 0 wins</div></div></div>
    <div class="now" id="rpNow">Starting with ${money(t.start)}…</div>
    <div class="row2" style="margin-top:12px"><button class="btn sec" id="rpAgain">↺ Restart</button><button class="btn sec" id="rpSpeed">Speed 1×</button></div>`, "replay");
  let timer = null, speed = 1, i = 0;
  const ring = sh.querySelector("#rpRing");
  scrim.addEventListener("closing", () => clearTimeout(timer));
  const show = step => {
    const tr = tierFor(step.streak);
    sh.querySelector("#rpBal").textContent = money(step.bal);
    sh.querySelector("#rpStreak").textContent = `${tr.sym} ${plural(step.streak, "win")}`;
    const frac = step.type === "loss" || step.type === "end" ? fracFor(step.streak, step.bal || t.start, t.target, s.odds) : fracFor(step.streak, step.bal, t.target, s.odds);
    ring.querySelectorAll("stop")[0].setAttribute("stop-color", tr.c1); ring.querySelectorAll("stop")[1].setAttribute("stop-color", tr.c2);
    setRing(ring, step.type === "loss" ? 0 : frac, { duration: step.type === "loss" ? 1 : .6 / speed });
    let mk = "";
    if (step.type === "win") { mk = "✅"; sh.querySelector("#rpNow").innerHTML = `<b>${esc(step.b.text)}</b> @ ${odds2(step.b.odds)}<br><span style="color:var(--win)">Won · ${money(step.bal)}</span>`; }
    if (step.type === "loss") { mk = "❌"; sh.querySelector("#rpNow").innerHTML = `<b>${esc(step.b.text)}</b> @ ${odds2(step.b.odds)}<br><span style="color:var(--loss)">Lost · run over after ${plural(run.end.streak, "win")}</span>`; ring.classList.remove("shake"); void ring.offsetWidth; ring.classList.add("shake"); }
    if (step.type === "bank") { mk = "🏦"; sh.querySelector("#rpNow").innerHTML = `<span style="color:var(--gold)">Banked ${money(step.amt)}</span>`; }
    if (step.type === "end") { mk = "🏁"; sh.querySelector("#rpNow").innerHTML = `<span style="color:var(--gold)">Cashed out ${money(step.amt)} after ${plural(step.streak, "win")}</span>`; }
    if (mk) { const m = document.createElement("div"); m.className = "replay-stamp"; m.textContent = mk; ring.appendChild(m); setTimeout(() => m.remove(), 900); }
  };
  const tick = () => {
    if (i >= run.steps.length) return;
    show(run.steps[i++]);
    timer = setTimeout(tick, 1100 / speed);
  };
  const restart = () => {
    clearTimeout(timer); i = 0;
    sh.querySelector("#rpBal").textContent = money(t.start); sh.querySelector("#rpStreak").textContent = "🌱 0 wins"; sh.querySelector("#rpNow").textContent = `Starting with ${money(t.start)}…`;
    setRing(ring, 0, { duration: .3 }); timer = setTimeout(tick, 700);
  };
  sh.querySelector("#rpAgain").onclick = restart;
  sh.querySelector("#rpSpeed").onclick = e => { speed = speed === 1 ? 2 : speed === 2 ? 4 : 1; e.currentTarget.textContent = `Speed ${speed}×`; };
  restart();
}

/* =========================================================
   Boot
   ========================================================= */
/* =========================================================
   Account: sign-in screens, profile, import, sync status
   ========================================================= */
const IMPORTED_KEY = () => "streak-charger.imported." + (Cloud.user ? Cloud.user.id : "local");
const NAME_RE = /^[A-Za-z0-9_.]{3,20}$/;
const NAME_HINT = "3 to 20 letters, numbers, dots or underscores.";
let me = null, starting = false, syncState = "saved";

// The profile badge shows the highest live streak across all trackers.
function liveBest() {
  let best = { streak: 0, t: state.trackers[0] };
  for (const t of state.trackers) { const s = compute(t); if (s.streak > best.streak) best = { streak: s.streak, t }; }
  const tier = tierFor(best.streak);
  return { ...best, tier, key: best.streak + ":" + tier.idx };
}
// A round photo (or initial) ringed in the tier's colour, with an optional "🐺 17" streak badge.
function personAvatar(name, url, streak, tier, size, { badge = false, edit = false } = {}) {
  const img = url ? `<img src="${esc(url)}" alt="" loading="lazy">` : `<span class="initial">${esc((name || "?").slice(0, 1).toUpperCase())}</span>`;
  return `<div class="avatar" style="--sz:${size}px;--tc:${tier.c2};--tc2:${tier.c1}">${img}
    ${badge ? `<span class="av-badge tb ${tier.badge}" style="--tc:${tier.c2};--tc2:${tier.c1}">${tier.sym} ${streak}</span>` : ""}
    ${edit ? `<label class="av-edit" aria-label="Change photo">📷<input type="file" accept="image/*" id="avFile" hidden></label>` : ""}</div>`;
}
// Your own badge uses this device's data, so it updates the moment you settle a bet.
function avatarHTML(size, opts) {
  const b = state ? liveBest() : { streak: 0, tier: TIERS[0] };
  return personAvatar(me ? me.display_name : "?", me && me.avatar_url, b.streak, b.tier, size, opts);
}
function glowNameAs(name, t) { return `<span class="glowname g-${t.badge}" style="--tc:${t.c2};--tc2:${t.c1}">${esc(name)}</span>`; }
function glowName(name) { return glowNameAs(name, state ? liveBest().tier : TIERS[0]); }
function renderMe() {
  const btn = $("#meBtn"); if (!btn) return;
  btn.innerHTML = avatarHTML(38) + `<i class="sync-dot ${syncState}" title="${syncState === "saved" ? "Synced" : syncState}"></i>`;
  btn.classList.toggle("on", state.page === "profile");
  // A count on the Friends tab when someone has sent you a request.
  const fb = $('#nav [data-nav="friends"]'), n = incomingCount();
  if (fb) { fb.classList.add("has-dot"); fb.dataset.count = n || ""; }
  const cb = $('#nav [data-nav="chat"]'), u = unreadCount();
  if (cb) { cb.classList.add("has-dot"); cb.dataset.count = u > 99 ? "99+" : u || ""; }
  const lb = $('#nav [data-nav="leaderboard"]');
  if (lb) { lb.classList.add("has-dot"); lb.dataset.count = challengeInvites() || ""; }
  const hb = $('#nav [data-nav="home"]');
  if (hb) { hb.classList.add("has-dot"); hb.dataset.count = state.page === "feed" ? "" : feedNewLabel(); }
  document.body.classList.toggle("in-convo", state.page === "chat" && !!chatWith);
  if (!localMode && Cloud.user) { chatPoll(); syncTyping(); }
}

/* ---------- Signed out ---------- */
function signedOut(on) { document.body.classList.toggle("signed-out", on); }
function renderAuth(mode = "login", note = "") {
  stopFx(); closeSheet(); signedOut(true);
  try { const ui = JSON.parse(localStorage.getItem(UI_KEY) || "{}"); document.documentElement.dataset.skin = ui.skin || "dark"; } catch (e) {}
  setAccent(ACCENTS[0]);
  const signup = mode === "signup";
  $("#view").innerHTML = `
    <div class="auth">
      <div class="auth-logo">${ringSVG({ tier: TIERS[3], frac: .72, total: 23, streak: 17, reached: false })}<span>⚡</span></div>
      <h1>Pipe Dream</h1>
      <p class="sub" style="text-align:center">The offshore crew's get-rich-quick scheme. Stack the wins, buy the last chopper off the rig. 🛢️🚁</p>
      <div class="glass card">
        <div class="seg" style="margin-bottom:16px"><button data-am="login" class="${signup ? "" : "on"}">Log in</button><button data-am="signup" class="${signup ? "on" : ""}">Sign up</button></div>
        ${note ? `<div class="okmsg">${note}</div>` : ""}
        <form id="authForm" novalidate>
          ${signup ? `<div class="field"><label for="aName">Display name</label><input id="aName" autocomplete="nickname" maxlength="20" placeholder="e.g. SkyHigh"><div class="hint" id="aNameHint">${NAME_HINT} Everyone will see this.</div></div>` : ""}
          <div class="field"><label for="aEmail">Email</label><input id="aEmail" type="email" autocomplete="email" inputmode="email"></div>
          <div class="field"><label for="aPass">Password</label><input id="aPass" type="password" autocomplete="${signup ? "new-password" : "current-password"}" minlength="6"></div>
          <div class="err" id="aErr"></div>
          <button class="btn" id="aGo" type="submit">${signup ? "Create account" : "Log in"}</button>
        </form>
        ${signup ? "" : `<button class="linkbtn" id="aForgot">Forgot password?</button>`}
      </div>
    </div>`;
  document.querySelectorAll("[data-am]").forEach(b => b.onclick = () => renderAuth(b.dataset.am));
  const err = $("#aErr"), go = $("#aGo");
  if (signup) {
    let t = null;
    $("#aName").oninput = e => {
      clearTimeout(t); const v = e.target.value.trim(), h = $("#aNameHint");
      if (!v) { h.textContent = NAME_HINT; h.className = "hint"; return; }
      if (!NAME_RE.test(v)) { h.textContent = NAME_HINT; h.className = "hint bad"; return; }
      t = setTimeout(async () => { try { const ok = await Cloud.nameAvailable(v); if ($("#aName") && $("#aName").value.trim() === v) { h.textContent = ok ? `✓ ${v} is available` : `${v} is taken`; h.className = "hint " + (ok ? "good" : "bad"); } } catch (e) {} }, 350);
    };
  }
  $("#authForm").onsubmit = async e => {
    e.preventDefault(); err.textContent = "";
    const email = $("#aEmail").value.trim(), pass = $("#aPass").value, name = signup ? $("#aName").value.trim() : "";
    if (signup && !NAME_RE.test(name)) return err.textContent = "Display name: " + NAME_HINT;
    if (!/^\S+@\S+\.\S+$/.test(email)) return err.textContent = "Enter your email address.";
    if (pass.length < 6) return err.textContent = "Use a password of at least 6 characters.";
    go.disabled = true; go.textContent = signup ? "Creating account…" : "Logging in…";
    try {
      if (signup) {
        if (!(await Cloud.nameAvailable(name))) throw new Error("That display name is taken.");
        const r = await Cloud.signUp(email, pass, name);
        if (r.needsConfirm) return renderAuth("login", `Almost there. We sent a confirmation link to <b>${esc(email)}</b>. Tap it, then log in here.`);
      } else await Cloud.signIn(email, pass);
      await startSignedIn();
    } catch (x) { err.textContent = Cloud.nice(x); go.disabled = false; go.textContent = signup ? "Create account" : "Log in"; }
  };
  const fg = $("#aForgot");
  if (fg) fg.onclick = async () => {
    const email = $("#aEmail").value.trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) return err.textContent = "Type your email above first, then tap Forgot password.";
    try { await Cloud.resetPassword(email); renderAuth("login", `We sent a password reset link to <b>${esc(email)}</b>.`); } catch (x) { err.textContent = Cloud.nice(x); }
  };
}
function openNewPassword() {
  const sh = openSheet(`<h3>Choose a new password</h3><div class="sub">You opened a password reset link. Pick a new password for your account.</div>
    <div class="field"><label for="npPass">New password</label><input id="npPass" type="password" autocomplete="new-password"></div><div class="err" id="npErr"></div><button class="btn" id="npGo">Save password</button>`);
  sh.querySelector("#npGo").onclick = async () => {
    const p = sh.querySelector("#npPass").value;
    if (p.length < 6) return sh.querySelector("#npErr").textContent = "Use at least 6 characters.";
    try { await Cloud.setPassword(p); closeSheet(); toast("Password updated."); } catch (x) { sh.querySelector("#npErr").textContent = Cloud.nice(x); }
  };
}
function renderSetupNeeded() {
  signedOut(true);
  $("#view").innerHTML = `<div class="auth"><h1>Almost ready</h1>
    <div class="glass card"><p style="margin-top:0">This copy of Pipe Dream isn't connected to a database yet, so accounts and syncing are off.</p>
    <p class="cap">Open <b>config.js</b> and paste in your Supabase Project URL and anon key. The setup guide (SETUP.md) walks you through it.</p>
    <button class="btn sec" id="useLocal">Use it on this device for now</button></div></div>`;
  $("#useLocal").onclick = () => { localMode = true; state = deviceState() || freshState(); startApp(); };
}

/* ---------- Signed in ---------- */
function loading(msg) { signedOut(true); $("#view").innerHTML = `<div class="auth"><div class="auth-logo spin-slow">${ringSVG({ tier: TIERS[3], frac: .3, total: 23, streak: 0, reached: false })}</div><p class="sub" style="text-align:center">${msg}</p></div>`; }
async function startSignedIn() {
  if (starting) return; starting = true;
  try {
    loading("Loading your trackers…");
    me = await Cloud.getProfile();
    const remote = await Cloud.load();
    const cache = Cloud.readCache();
    // Changes made on this device that never reached the server are merged back in and synced.
    let s = cache && cache.dirty && cache.state ? Cloud.merge(remote, cache.state, "b") : remote;
    const device = deviceState(), asked = localStorage.getItem(IMPORTED_KEY());
    if (!s && device && !asked) s = (await askImport(device, true)) ? importable(device) : null;
    state = normalise(s ? JSON.parse(JSON.stringify(s)) : freshState());
    const ui = readUI(); if (ui.page) state.page = ui.page; if (ui.activeId && state.trackers.some(t => t.id === ui.activeId)) state.activeId = ui.activeId;
    startApp();
    if (remote && device && !asked) askImport(device, false).then(yes => { if (yes) importData(device, "device"); });
  } catch (x) {
    starting = false;
    renderAuth("login", `<span style="color:var(--loss)">Couldn't load your account: ${esc(Cloud.nice(x))}</span>`);
    return;
  }
  starting = false;
}
function startApp() {
  signedOut(false);
  evalAchievements(); save(); render();
  // A different account may have just logged in on this device, so start the friends list afresh.
  friends = null; friendsErr = ""; fQuery = ""; fResults = null; boards = {};
  chats = null; chatWith = null; convos = {}; feed = null; feedErr = ""; feedPick = null; challenges = null; challengesErr = "";
  if (!localMode) { loadFriends(true); loadChats(true); loadFeed(); loadChallenges(); Cloud.onChat(onChatEvent); }
}
function readUI() { try { return JSON.parse(localStorage.getItem(UI_KEY) || "{}"); } catch (e) { return {}; } }

/* ---------- Importing (device data or a pasted backup) ----------
   Imported ids are re-keyed per account with a stable hash, so the same backup imported twice
   into one account merges instead of duplicating, and two accounts on one device never clash. */
function hashId(s) { let h1 = 0xdeadbeef, h2 = 0x41c6ce57; for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); } h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909); h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909); return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36); }
function importable(src) {
  const salt = Cloud.user ? Cloud.user.id : "local", rk = id => "i" + hashId(salt + ":" + id);
  const s = JSON.parse(JSON.stringify(src));
  for (const t of s.trackers) { t.id = rk(t.id); t.bets.forEach(b => b.id = rk(b.id)); t.actions.forEach(a => a.id = rk(a.id)); }
  if (s.activeId) s.activeId = rk(s.activeId);
  return s;
}
// The device copy, or null once every tracker and bet in it is already in this account.
function notYetImported(device) {
  if (!device || !state) return null;
  const have = new Set(state.trackers.flatMap(t => [t.id, ...t.bets.map(b => b.id)])), dev = importable(device);
  return dev.trackers.some(t => !have.has(t.id) || t.bets.some(b => !have.has(b.id))) ? device : null;
}
function importSummary(s) { const n = s.trackers.reduce((a, t) => a + t.bets.length, 0); return `${plural(s.trackers.length, "tracker")} and ${plural(n, "bet")}`; }
function askImport(device, fresh) {
  return new Promise(res => {
    let done = false; const finish = v => { if (done) return; done = true; try { localStorage.setItem(IMPORTED_KEY(), v ? "yes" : "no"); } catch (e) {} closeSheet(); res(v); };
    const sh = openSheet(`<h3>Bring your data across?</h3>
      <div class="sub">This device has ${importSummary(device)} saved from before you had an account. ${fresh ? "Import them to start your account with everything you've logged." : "Add them to your account alongside what's already there."}</div>
      <div class="btns"><button class="btn" id="imYes">Import to my account</button><button class="btn sec" id="imNo">Start fresh</button></div>
      <div class="note" style="margin:10px 0 0">You'll only be asked once. Your device copy isn't deleted, and you can import it later from your profile.</div>`);
    sh.querySelector("#imYes").onclick = () => finish(true);
    sh.querySelector("#imNo").onclick = () => finish(false);
    scrim.addEventListener("closing", () => { if (!done) { done = true; res(false); } });
  });
}
function importData(src, what) {
  const before = state.trackers.length;
  const merged = Cloud.merge(state, importable(normalise(JSON.parse(JSON.stringify(src)))), "a");
  const ui = { page: state.page, activeId: state.activeId };
  state = normalise(merged); Object.assign(state, ui);
  evalAchievements(); save(); render();
  toast(`Imported ${what === "device" ? "this device's data" : "the backup"}: ${plural(state.trackers.length - before, "new tracker")}.`);
}

/* ---------- Profile ---------- */
function renderProfile() {
  if (localMode) {
    $("#view").innerHTML = `<div class="head" style="padding-top:18px"><div><div class="eyebrow">Profile</div><h1>On this device only</h1></div></div>
      <div class="glass card"><div class="cap">Accounts, profiles and syncing switch on once config.js has your Supabase keys.</div><button class="btn sec" data-nav="awards">🎨 Themes and awards</button></div>`;
    return;
  }
  const b = liveBest(), device = notYetImported(deviceState());
  $("#view").innerHTML = `
    <div class="profile-hero">
      ${avatarHTML(132, { badge: true, edit: true })}
      <h1>${glowName(me.display_name)}</h1>
      <div class="sub" style="margin:0">${tierBadge(b.tier, undefined, false)} ${b.streak ? `${plural(b.streak, "win")} in a row on ${esc(b.t.name)}` : "No live streak yet"}</div>
      <div class="sub" id="pWins" style="margin:4px 0 0"></div>
      <button class="btn sec" id="pShare" style="width:auto;margin-top:12px;padding-inline:20px">📤 Share my stats</button>
      <div class="err" id="avErr" style="margin-top:6px"></div>
    </div>
    <div class="glass card">
      <h3>Display name</h3><div class="cap">${NAME_HINT} Must be unique.</div>
      <div class="field" style="margin-bottom:8px"><input id="pName" maxlength="20" value="${esc(me.display_name)}"><div class="hint" id="pNameHint"></div></div>
      <button class="btn sec" id="pNameSave">Save name</button>
    </div>
    <div class="glass card">
      <h3>Account</h3><div class="cap">${esc(Cloud.user.email)} · <span id="syncText">${syncLabel()}</span></div>
      <div class="row2"><button class="btn sec" id="bkCopy">Copy backup</button><button class="btn sec" id="bkRestore">Import backup</button></div>
      ${device ? `<button class="btn sec" id="imDevice" style="margin-top:8px">Import ${importSummary(device)} from this device</button>` : ""}
    </div>
    <div class="glass card"><button class="btn sec" data-nav="awards">🎨 Themes and awards</button></div>
    <div class="glass card"><h3>Your trackers</h3><div class="cap">Deleting a tracker removes it and all its bets for good.</div>
      <div class="ptrk">${state.trackers.map(t => `<div class="ptrk-row"><span class="ptrk-dot" style="background:${esc(t.accent)}"></span><span class="ptrk-name"><b>${esc(t.name)}</b><small>${plural(t.bets.length, "bet")}${t.shared === false ? " · 🔒 private" : ""}</small></span><button class="ptrk-del" data-pdel="${t.id}" aria-label="Delete ${esc(t.name)}">🗑 Delete</button></div>`).join("")}</div></div>
    <button class="btn warn" id="signOut" style="margin-top:14px">Log out</button>`;
  $("#avFile").onchange = async e => {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    $("#avErr").textContent = ""; $(".profile-hero .avatar").classList.add("busy");
    try { me = await Cloud.uploadAvatar(f, me.avatar_url); render(); toast("Photo updated."); }
    catch (x) { $("#avErr").textContent = Cloud.nice(x); $(".profile-hero .avatar").classList.remove("busy"); }
  };
  Cloud.challengeWins(Cloud.user.id).then(n => { const el = $("#pWins"); if (el && n) el.textContent = `🏆 ${plural(n, "challenge")} won`; }).catch(() => {});
  $("#pNameSave").onclick = async () => {
    const v = $("#pName").value.trim(), h = $("#pNameHint");
    if (v === me.display_name) return;
    if (!NAME_RE.test(v)) { h.textContent = NAME_HINT; h.className = "hint bad"; return; }
    try { if (!(await Cloud.nameAvailable(v))) throw new Error("That display name is taken."); me = await Cloud.updateProfile({ display_name: v }); render(); toast("Name saved."); }
    catch (x) { h.textContent = Cloud.nice(x); h.className = "hint bad"; }
  };
  $("#pShare").onclick = shareStats;
  document.querySelectorAll("[data-pdel]").forEach(btn => {
    let armed = false;
    btn.onclick = async () => {
      const t = state.trackers.find(x => x.id === btn.dataset.pdel); if (!t) return;
      if (!armed) { armed = true; btn.textContent = "Tap again"; btn.classList.add("armed"); return; }
      btn.disabled = true;
      if (!(await cloudDelete(() => Cloud.deleteTracker(t)))) { btn.disabled = false; return; }
      dropTrackers([t.id]); save(); render(); toast(`${t.name} deleted.`);
    };
  });
  $("#bkCopy").onclick = copyBackup;
  $("#bkRestore").onclick = openRestore;
  if ($("#imDevice")) $("#imDevice").onclick = () => importData(device, "device");
  $("#signOut").onclick = async () => { await Cloud.signOut(); state = null; me = null; renderAuth("login", "You're logged out."); };
}
// A short summary of your best live tracker for a group chat: the phone's share sheet,
// or the clipboard where there isn't one.
function statsText() {
  const b = liveBest(), s = compute(b.t), lines = [`⚡ ${me.display_name} on ${document.title}`];
  lines.push(`${b.tier.sym} ${b.tier.name} · ${b.streak ? plural(b.streak, "win") + " in a row" : "no live streak yet"}`);
  lines.push(s.reached ? `🎯 Target hit: ${money(s.balance)}` : `💰 ${money(s.balance)} of ${money(b.t.target)} · ${plural(s.remaining, "win")} to go`);
  const banked = state.trackers.reduce((n, t) => n + compute(t).banked, 0);
  lines.push(`🏆 Best streak ${state.bestStreak || 0}` + (banked > 0 ? ` · 🏦 Banked ${money(banked)}` : ""));
  if (s.pendingBet) lines.push(`⏳ Riding on: ${s.pendingBet.text} @ ${odds2(s.pendingBet.odds)}`);
  lines.push(location.origin);
  return lines.join("\n");
}
async function shareStats() {
  const text = statsText();
  if (navigator.share) { try { await navigator.share({ text }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  try { await navigator.clipboard.writeText(text); toast("Stats copied. Paste them into your group chat."); }
  catch (e) { const sh = openSheet(`<h3>Your stats</h3><div class="sub">Select this text and copy it.</div><div class="field"><textarea readonly style="min-height:150px">${esc(text)}</textarea></div>`); sh.querySelector("textarea").select(); }
}
function syncLabel() { return { saved: "✓ synced to your account", saving: "saving…", offline: "offline, will sync when you're back", error: "sync problem" }[syncState] || ""; }

/* ---------- Coming-soon pages ---------- */
const SOON = {
};
function renderSoon(id) {
  const p = SOON[id];
  $("#view").innerHTML = `<div class="head" style="padding-top:18px"><div><div class="eyebrow">Coming soon</div><h1>${p.title}</h1></div></div>
    <div class="glass card soon"><div class="soon-ic">${p.icon}</div><p>${p.text}</p><ul>${p.items.map(x => `<li>${x}</li>`).join("")}</ul><div class="cap" style="margin:0">This part arrives in the next stage.</div></div>`;
}

/* ---------- Friends ----------
   The list comes from the database, which also works out everyone's streak from their logged bets. */
let friends = null, friendsAt = 0, friendsErr = "", fQuery = "", fResults = null, fTimer = null, fBusy = new Set();
const tierOf = p => TIERS[Math.min(p.tier_idx || 0, TIERS.length - 1)] || TIERS[0];
const incomingCount = () => (friends || []).filter(f => f.status === "pending" && f.incoming).length;
async function loadFriends(force) {
  if (!Cloud.user || localMode || (!force && Date.now() - friendsAt < 15000)) return;
  friendsAt = Date.now();
  try { friends = await Cloud.myFriends(); friendsErr = ""; }
  catch (x) { friendsErr = Cloud.nice(x); }
  if (!state || scrim) return;
  renderMe(); if (state.page === "friends") renderFriends(); else if (state.page === "feed") renderFeedBody(); else if (state.page === "chat" && !chatWith) renderChat();
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible" || !state) return;
  loadFriends(); loadChats(true); loadFeed(state.page === "feed" ? 0 : 30000); loadChallenges(30000); if (state.page === "leaderboard") loadBoard(true);
  if (state.page === "chat" && chatWith) loadConvo(chatWith);
});

function friendLine(p) {
  const t = tierOf(p);
  if (p.streak) return `${t.sym} ${plural(p.streak, "win")} in a row${p.streak_tracker ? ` on ${esc(p.streak_tracker)}` : ""}`;
  return p.best_streak ? `No live streak · best ${p.best_streak}` : "No live streak yet";
}
function friendRow(p, actions) {
  const t = tierOf(p);
  return `<div class="frow" data-fid="${p.id}">
    <button class="fwho" data-fopen="${p.id}">${personAvatar(p.display_name, p.avatar_url, p.streak, t, 46, { badge: true })}
      <span class="fname"><b>${glowNameAs(p.display_name, t)}</b><small>${friendLine(p)}</small></span></button>
    <div class="fact">${actions}</div></div>`;
}
function relationOf(id) { return (friends || []).find(f => f.id === id); }
function actionFor(p) {
  const f = relationOf(p.id), busy = fBusy.has(p.id) ? "disabled" : "";
  if (!f) return `<button class="btn sm" data-fadd="${p.id}" ${busy}>Add</button>`;
  if (f.status === "accepted") return `<span class="fstate">Friends</span>`;
  if (f.incoming) return `<button class="btn sm" data-faccept="${p.id}" ${busy}>Accept</button>`;
  return `<span class="fstate">Sent</span>`;
}

function renderFriends() {
  if (localMode) {
    $("#view").innerHTML = `<div class="head" style="padding-top:18px"><div><div class="eyebrow">Friends</div><h1>Needs an account</h1></div></div>
      <div class="glass card"><div class="cap" style="margin:0">Friends switch on once config.js has your Supabase keys and you're logged in.</div></div>`;
    return;
  }
  loadFriends();
  const list = friends || [], mine = list.filter(f => f.status === "accepted").sort((a, b) => b.streak - a.streak || b.best_streak - a.best_streak || a.display_name.localeCompare(b.display_name));
  const inc = list.filter(f => f.status === "pending" && f.incoming), out = list.filter(f => f.status === "pending" && !f.incoming);
  const searching = fQuery.trim().length >= 2;
  $("#view").innerHTML = `
    <div class="head" style="padding-top:18px"><div><div class="eyebrow">${friends ? plural(mine.length, "friend") : "Friends"}</div><h1>Friends</h1></div></div>
    <div class="field fsearch"><input id="fSearch" type="search" placeholder="Find people by display name" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(fQuery)}"></div>
    <div id="fResults">${searching ? resultsHTML() : ""}</div>
    ${friendsErr ? `<div class="glass card"><div class="err" style="margin:0">${esc(friendsErr)}</div></div>` : ""}
    ${!friends && !friendsErr ? `<div class="glass card"><div class="cap" style="margin:0">Loading your friends…</div></div>` : ""}
    ${inc.length ? `<div class="section-h"><h2>Requests</h2><span>${inc.length === 1 ? "1 person wants" : inc.length + " people want"} to be friends</span></div>
      <div class="glass card flist">${inc.map(p => friendRow(p, `<button class="btn sm" data-faccept="${p.id}">Accept</button><button class="btn sm sec" data-fdecline="${p.id}" aria-label="Decline">✕</button>`)).join("")}</div>` : ""}
    ${friends ? `<div class="section-h"><h2>Your friends</h2><span>${mine.length ? "Longest live streak first" : ""}</span></div>
      ${mine.length ? `<div class="glass card flist">${mine.map((p, i) => friendRow(p, `<span class="frank">#${i + 1}</span>`)).join("")}</div>`
        : `<div class="glass card fempty"><div class="soon-ic">👥</div><p>No friends yet. Search for someone's display name above to send them a request.</p>
           <div class="cap" style="margin:0">Your display name is <b>${esc(me.display_name)}</b>. Share it so friends can find you.</div></div>`}` : ""}
    ${out.length ? `<div class="section-h"><h2>Sent</h2><span>Waiting for them to accept</span></div>
      <div class="glass card flist">${out.map(p => friendRow(p, `<button class="btn sm sec" data-fcancel="${p.id}">Cancel</button>`)).join("")}</div>` : ""}`;
  const inp = $("#fSearch");
  inp.oninput = () => {
    fQuery = inp.value; clearTimeout(fTimer);
    if (fQuery.trim().length < 2) { fResults = null; $("#fResults").innerHTML = ""; return; }
    $("#fResults").innerHTML = resultsHTML(true);
    const q = fQuery.trim();
    fTimer = setTimeout(async () => {
      try { const r = await Cloud.searchProfiles(q); if (fQuery.trim() === q) { fResults = r; $("#fResults").innerHTML = resultsHTML(); } }
      catch (x) { $("#fResults").innerHTML = `<div class="glass card"><div class="err" style="margin:0">${esc(Cloud.nice(x))}</div></div>`; }
    }, 300);
  };
}
function resultsHTML(pending) {
  if (pending || !fResults) return `<div class="glass card flist"><div class="cap" style="margin:0">Searching…</div></div>`;
  if (!fResults.length) return `<div class="glass card flist"><div class="cap" style="margin:0">Nobody called “${esc(fQuery.trim())}”. Check the spelling.</div></div>`;
  return `<div class="glass card flist">${fResults.map(p => friendRow(p, actionFor(p))).join("")}</div>`;
}

async function friendDo(id, fn, msg) {
  if (fBusy.has(id)) return; fBusy.add(id);
  document.querySelectorAll(`[data-fid="${id}"] .fact button`).forEach(b => b.disabled = true);
  try { const r = await fn(); if (msg) toast(typeof msg === "function" ? msg(r) : msg); }
  catch (x) { toast(Cloud.nice(x), "bad"); }
  fBusy.delete(id); boards = {}; await loadFriends(true);
}
const nameOf = id => { const p = relationOf(id) || (fResults || []).find(x => x.id === id); return p ? p.display_name : "them"; };
document.addEventListener("click", e => {
  if (!state || !Cloud.user) return;
  const el = e.target.closest("[data-fadd],[data-faccept],[data-fdecline],[data-fcancel],[data-fopen]"); if (!el) return;
  const d = el.dataset;
  if (d.fadd) return friendDo(d.fadd, () => Cloud.friendRequest(d.fadd), r => r === "friends" ? `You and ${nameOf(d.fadd)} are now friends.` : `Request sent to ${nameOf(d.fadd)}.`);
  if (d.faccept) return friendDo(d.faccept, () => Cloud.friendRespond(d.faccept, true), `You and ${nameOf(d.faccept)} are now friends.`);
  if (d.fdecline) return friendDo(d.fdecline, () => Cloud.friendRespond(d.fdecline, false), "Request declined.");
  if (d.fcancel) return friendDo(d.fcancel, () => Cloud.friendRemove(d.fcancel), "Request cancelled.");
  if (d.fopen) {
    const p = relationOf(d.fopen) || (fResults || []).find(x => x.id === d.fopen) || Object.values(boards).flatMap(b => b.rows || []).find(x => x.id === d.fopen);
    if (p && p.id === Cloud.user.id) return go("profile");
    if (p) openFriend(p);
  }
});

// A friend's profile card: photo with streak badge, glowing name and the stats the database worked out.
function openFriend(p) {
  const t = tierOf(p), f = relationOf(p.id), friendsNow = f && f.status === "accepted";
  const since = f && f.since ? new Date(f.since).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" }) : "";
  const sh = openSheet(`<div class="profile-hero" style="padding-top:6px">
      ${personAvatar(p.display_name, p.avatar_url, p.streak || 0, t, 112, { badge: true })}
      <h1 style="font-size:32px">${glowNameAs(p.display_name, t)}</h1>
      <div class="sub" style="margin:0">${tierBadge(t, undefined, false)} ${p.streak ? `${plural(p.streak, "win")} in a row${p.streak_tracker ? ` on ${esc(p.streak_tracker)}` : ""}` : "No live streak right now"}</div>
    </div>
    ${p.best_streak !== undefined ? `<div class="kv" style="margin-top:14px">
      <div><div class="k">Live streak</div><div class="v">${p.streak || 0}</div></div>
      <div><div class="k">Best streak</div><div class="v">${p.best_streak || 0}</div></div>
      <div><div class="k">Banked</div><div class="v">${moneyShort(p.banked || 0)}</div></div>
    </div>` : ""}
    ${friendsNow ? `<div id="fLive">${liveCardHTML(p.live, p)}</div>
      <div class="note" style="margin:0 0 14px;text-align:center">Friends since ${since}<span id="fWins"></span></div><button class="btn" id="fMessage" style="margin-bottom:10px">💬 Message ${esc(p.display_name)}</button><button class="btn sec" id="fChallenge" style="margin-bottom:10px">⚔️ Challenge ${esc(p.display_name)}</button>
      <div class="section-h"><h2>Bets</h2></div><div class="fbets" id="fBets"><div class="cap" style="margin:0">Loading ${esc(p.display_name)}'s bets…</div></div>
      <button class="btn warn" id="fUnfriend" style="margin-top:16px">Unfriend</button>`
      : f && f.incoming ? `<button class="btn" id="fAccept">Accept friend request</button>`
      : f ? `<button class="btn sec" id="fCancel">Cancel request</button>` : `<button class="btn" id="fAdd">Add friend</button>`}`);
  let armed = false;
  const b = id => sh.querySelector(id);
  if (b("#fUnfriend")) b("#fUnfriend").onclick = () => {
    if (!armed) { armed = true; b("#fUnfriend").textContent = `Tap again to unfriend ${p.display_name}`; return; }
    closeSheet(); friendDo(p.id, () => Cloud.friendRemove(p.id), `You're no longer friends with ${p.display_name}.`);
  };
  if (b("#fMessage")) b("#fMessage").onclick = () => { closeSheet(); openChat(p.id); };
  if (b("#fChallenge")) b("#fChallenge").onclick = () => { closeSheet(); openNewChallenge(p.id); };
  if (b("#fWins")) Cloud.challengeWins(p.id).then(n => { const el = b("#fWins"); if (el && n) el.textContent = ` · 🏆 ${plural(n, "challenge")} won`; }).catch(() => {});
  if (b("#fBets")) loadFriendBets(sh, p);
  if (b("#fAccept")) b("#fAccept").onclick = () => { closeSheet(); friendDo(p.id, () => Cloud.friendRespond(p.id, true), `You and ${p.display_name} are now friends.`); };
  if (b("#fCancel")) b("#fCancel").onclick = () => { closeSheet(); friendDo(p.id, () => Cloud.friendRemove(p.id), "Request cancelled."); };
  if (b("#fAdd")) b("#fAdd").onclick = () => { closeSheet(); friendDo(p.id, () => Cloud.friendRequest(p.id), r => r === "friends" ? `You and ${p.display_name} are now friends.` : `Request sent to ${p.display_name}.`); };
}

/* ---------- Friends' progress and bets ----------
   The database works out each person's progress on the tracker they're furthest along, the same way
   your own ring does: wins so far out of wins so far plus the wins still needed at their usual odds. */
const moneyTiny = n => n >= 1e6 ? "$" + +(n / 1e6).toFixed(1) + "m" : n >= 1000 ? "$" + +(n / 1000).toFixed(n >= 1e4 ? 0 : 1) + "k" : "$" + Math.round(n);
const livePct = l => Math.max(0, Math.min(100, Math.round((l.frac || 0) * 100)));
const liveGoal = l => l.to_go === 0 ? "Target hit 🎯" : l.to_go == null ? "" : `${plural(l.to_go, "win")} to go`;
// Gold, silver and bronze for the top three; everyone else charges in the app's colours.
const PLACE_BAR = { 1: ["#ffe27a", "#f5a300"], 2: ["#f4f7fb", "#9aa6b5"], 3: ["#ffc08a", "#b8662e"] };
function liveBarHTML(l, p, mini, place) {
  if (!l) return "";
  const [c1, c2] = PLACE_BAR[place] || ["#7dffb0", "#22c3ff"];
  return `<span class="lbar ${mini ? "mini" : ""} ${l.pending ? "live" : ""}" style="--b1:${c1};--b2:${c2}" title="${livePct(l)}% of the way to ${moneyShort(l.target)}">
    <span class="lbar-track"><i style="width:${Math.max(livePct(l), 3)}%" data-to="${Math.max(livePct(l), 3)}" data-lid="${p.id}"><b class="lbar-spark"></b></i></span>
    ${mini ? "" : `<span class="lbar-cap">${l.pending ? `<em>⏳ Bet in play</em>` : `<span>${moneyShort(l.balance)} → ${moneyShort(l.target)}</span>`}<span>${liveGoal(l)}</span></span>`}</span>`;
}
function liveCardHTML(l, p) {
  if (!l) return "";
  return `<div class="glass card fprog">
    <div class="fprog-top"><span><small>${esc(l.tracker)}</small><b>${money(l.balance)}</b></span><span class="fprog-pct">${livePct(l)}%</span></div>
    ${liveBarHTML(l, p)}
    <div class="note" style="margin:8px 0 0">Started at ${moneyShort(l.start)}, chasing ${moneyShort(l.target)}${l.streak ? ` with ${plural(l.streak, "win")} in a row` : ""}.</div></div>`;
}
const RES = { win: ["✅", "Won"], loss: ["❌", "Lost"], pending: ["⏳", "In play"] };
function friendBetHTML(b) {
  const r = RES[b.result] || ["🎟️", ""];
  return `<div class="fbet ${b.result}" data-fbet="${esc(b.id)}">
    <button class="fbet-head" data-fbettoggle><span class="fbet-ic">${r[0]}</span>
      <span class="fbet-main"><b>${esc(b.text)}</b><small>${esc(b.sport)} · ${esc(b.tracker)} · ${when(Number(b.created_at))}</small></span>
      <span class="fbet-odds">${b.slip ? "🧾 " : ""}@ ${odds2(b.odds)}</span></button>
    <div class="fbet-more" hidden>
      <div class="fbet-kv"><span>Result</span><b>${r[0]} ${r[1]}</b><span>Odds</span><b>${odds2(b.odds)}</b><span>Sport</span><b>${esc(b.sport)}</b>
        <span>Tracker</span><b><i class="fbet-dot" style="background:${esc(b.accent || "var(--accent)")}"></i>${esc(b.tracker)}</b>
        <span>Logged</span><b>${when(Number(b.created_at))}</b>${b.settled_at ? `<span>Settled</span><b>${when(Number(b.settled_at))}</b>` : ""}</div>
      ${b.link && /^https?:\/\//i.test(b.link) ? `<a class="btn sec fbet-link" href="${esc(b.link)}" target="_blank" rel="noopener">🔗 Open bet link</a>` : ""}
      ${b.slip ? `<button class="slip" data-photo="${esc(b.slip)}" aria-label="Open bet slip"><img data-media="${esc(b.slip)}" alt=""><span><b>🧾 Bet slip</b><small>Tap to view</small></span></button>` : `<div class="cap" style="margin:0">No slip photo on this one.</div>`}
    </div></div>`;
}
async function loadFriendBets(sh, p) {
  const box = sh.querySelector("#fBets");
  let d;
  try { d = await Cloud.friendBets(p.id); }
  catch (x) { if (box.isConnected) box.innerHTML = `<div class="cap" style="margin:0">${/friend_bets/.test(Cloud.nice(x)) ? "Bets show here once the database is updated." : esc(Cloud.nice(x))}</div>`; return; }
  if (!box.isConnected) return;
  if (!d) { box.innerHTML = `<div class="cap" style="margin:0">Only friends can see each other's bets.</div>`; return; }
  const lv = sh.querySelector("#fLive"); if (lv) lv.innerHTML = liveCardHTML(d.live, p);
  const bets = d.bets || [];
  box.innerHTML = bets.length ? bets.map(friendBetHTML).join("") : `<div class="cap" style="margin:0">No bets to show yet. Bets on trackers ${esc(p.display_name)} keeps private don't show here.</div>`;
  box.querySelectorAll("[data-fbettoggle]").forEach(h => h.onclick = () => {
    const el = h.closest(".fbet"), more = el.querySelector(".fbet-more");
    more.hidden = !more.hidden; el.classList.toggle("open", !more.hidden);
    const img = more.querySelector(".slip img:not([src])");
    if (img && !more.hidden) Cloud.mediaUrl(img.dataset.media).then(u => { img.src = u; }).catch(() => img.closest(".slip").classList.add("broken"));
  });
}

/* ---------- Leaderboard ----------
   Ranked by the database from everyone's logged bets. Friends shows you and your friends;
   Everyone shows the top 50 who have something on the board, plus your own spot. */
const BOARD_METRICS = [["streak", "Live streak"], ["best", "Best streak"], ["banked", "Banked"]];
let boards = {}, boardScope = "friends", boardMetric = "streak";
const boardKey = () => boardScope + ":" + boardMetric;
async function loadBoard(force) {
  const k = boardKey(), b = boards[k];
  if (!Cloud.user || localMode || (!force && b && (b.loading || Date.now() - b.at < 15000))) return;
  boards[k] = { ...(b || {}), loading: true, at: Date.now() };
  try { boards[k] = { rows: await Cloud.leaderboard(boardScope, boardMetric), at: Date.now(), got: Date.now() }; }
  catch (x) { boards[k] = { ...(b || {}), err: Cloud.nice(x), at: Date.now() }; }
  if (state && !scrim && state.page === "leaderboard" && boardKey() === k) renderLeaders();
}
// Keep the board live while it's on screen.
setInterval(() => { if (state && !scrim && state.page === "leaderboard" && !document.hidden) loadBoard(true); }, 20000);
const boardValue = (p, m = boardMetric) => m === "banked" ? moneyShort(p.banked || 0) : String(m === "best" ? p.best_streak || 0 : p.streak || 0);
const boardUnit = (p, m = boardMetric) => m === "banked" ? "banked" : m === "best" ? "best" : ((p.streak || 0) === 1 ? "win" : "wins");
const MEDALS = ["🥇", "🥈", "🥉"];

function renderLeaders() {
  if (localMode) {
    $("#view").innerHTML = `<div class="head" style="padding-top:18px"><div><div class="eyebrow">Leaderboard</div><h1>Needs an account</h1></div></div>
      <div class="glass card"><div class="cap" style="margin:0">The leaderboard switches on once config.js has your Supabase keys and you're logged in.</div></div>`;
    return;
  }
  // Coming to the board from another page: fetch fresh results so new wins and losses show straight away.
  const fresh = !document.querySelector("#view [data-boardview]");
  loadBoard(fresh && Date.now() - ((boards[boardKey()] || {}).at || 0) > 3000);
  const b = boards[boardKey()] || {}, rows = b.rows || [], meRow = rows.find(r => r.is_me);
  const top = rows.filter(r => !r.is_me || r.rank <= 50);
  const outside = meRow && !top.includes(meRow);
  const lonely = boardScope === "friends" && rows.length === 1;
  $("#view").innerHTML = `${leadNav()}
    <div class="head" style="padding-top:18px"><div><div class="eyebrow">${boardScope === "friends" ? "You and your friends" : "Everyone on Pipe Dream"}</div><h1>Leaderboard</h1></div></div>
    <div class="seg" style="margin-bottom:10px">${[["friends", "Friends"], ["everyone", "Everyone"]].map(([k, n]) => `<button data-bscope="${k}" class="${boardScope === k ? "on" : ""}">${n}</button>`).join("")}</div>
    <div class="lb-metrics">${BOARD_METRICS.map(([k, n]) => `<button data-bmetric="${k}" class="${boardMetric === k ? "on" : ""}">${n}</button>`).join("")}</div>
    ${b.err ? `<div class="glass card"><div class="err" style="margin:0">${esc(b.err)}</div></div>` : ""}
    ${!b.rows && !b.err ? `<div class="glass card"><div class="cap" style="margin:0">Loading the leaderboard…</div></div>` : ""}
    ${top.length ? `<div class="lb-list">${top.map(boardRow).join("")}</div>` : ""}
    ${outside ? `<div class="section-h"><h2>Your spot</h2></div><div class="lb-list">${boardRow(meRow)}</div>` : ""}
    ${b.rows && lonely ? `<div class="glass card fempty"><div class="soon-ic">🏆</div><p>It's just you so far. Add friends to see how you stack up, or switch to Everyone.</p><button class="btn sec" data-nav="friends">Find friends</button></div>` : ""}
    ${b.rows && !rows.length ? `<div class="glass card fempty"><div class="soon-ic">🏆</div><p>Nobody's on this board yet.</p></div>` : ""}
    ${b.rows ? `<div class="note" data-boardview style="margin:12px 0 0;text-align:center">Worked out from logged bets${boardMetric === "streak" ? ". A loss resets a live streak" : ""}.</div>` : ""}`;
  if (b.rows) animateBoard(rows, fresh, b.got || 0);
}
/* Board animation. Bars charge up from empty when you open the board, and slide from where they were on a refresh.
   Wins, losses and new bets since you last looked get a burst on that person. */
let barShown = {}, bursts = {};
const seenKey = () => "pd.boardSeen." + Cloud.user.id;
function animateBoard(rows, fresh, at) {
  let seen = {}; try { seen = JSON.parse(localStorage.getItem(seenKey()) || "{}"); } catch (x) {}
  const changes = {};
  Object.keys(bursts).forEach(id => { if (bursts[id].until < Date.now()) delete bursts[id]; });
  rows.forEach(p => {
    const was = seen[p.id], now = { s: p.streak || 0, p: !!(p.live && p.live.pending), f: p.live ? livePct(p.live) : null, at };
    // Boards are cached per tab, so only compare against results older than these.
    if (was && was.at >= at) return;
    if (was) {
      if (now.s > was.s) changes[p.id] = ["win", `+${plural(now.s - was.s, "win")} 🔥`];
      else if (now.s < was.s) changes[p.id] = ["loss", "💥 Streak busted"];
      else if (now.p && !was.p) changes[p.id] = ["bet", "⏳ New bet in"];
    }
    if (changes[p.id] && changes[p.id][0] === "loss" && was.f != null) barShown[p.id] = Math.max(was.f, 3);
    seen[p.id] = now;
  });
  try { localStorage.setItem(seenKey(), JSON.stringify(seen)); } catch (x) {}
  const bars = [...document.querySelectorAll("#view .lbar i[data-lid]")];
  bars.forEach((el, i) => {
    const id = el.dataset.lid, to = Number(el.dataset.to), from = fresh && !changes[id] ? 0 : barShown[id] ?? (fresh ? 0 : to);
    barShown[id] = to;
    if (from === to) return;
    el.style.transition = "none"; el.style.width = from + "%"; el.getBoundingClientRect();
    el.style.transition = `width ${changes[id] ? 1.4 : 1}s cubic-bezier(.2,.8,.2,1) ${fresh ? 0.12 * i : 0}s`; el.style.width = to + "%";
    el.closest(".lbar").classList.add("charging"); setTimeout(() => el.closest(".lbar") && el.closest(".lbar").classList.remove("charging"), 1600 + 120 * i);
  });
  Object.entries(changes).forEach(([id, [kind, text]]) => { bursts[id] = { kind, text, until: Date.now() + 4200 }; });
  // Bursts stay put if the board redraws while they're showing.
  Object.entries(bursts).forEach(([id, { kind, text, until }]) => {
    document.querySelectorAll(`#view [data-fid="${CSS.escape(id)}"], #view .lb-pod[data-fopen="${CSS.escape(id)}"]`).forEach(el => {
      el.classList.add("lb-" + kind);
      el.insertAdjacentHTML("beforeend", `<span class="lb-burst ${kind}">${esc(text)}</span>`);
      setTimeout(() => { el.classList.remove("lb-" + kind); el.querySelectorAll(".lb-burst").forEach(x => x.remove()); }, until - Date.now());
    });
  });
}
function boardRow(p) {
  const t = tierOf(p);
  const sub = boardMetric === "streak" ? (p.streak ? `${t.sym} ${t.name}${p.streak_tracker ? ` · on ${esc(p.streak_tracker)}` : ""}` : `No live streak · best ${p.best_streak || 0}`)
    : boardMetric === "best" ? `Live now: ${t.sym} ${p.streak || 0}` : `${t.sym} ${p.streak || 0} live · best ${p.best_streak || 0}`;
  const place = p.rank <= 3 && p.score > 0 ? p.rank : 0;
  return `<div class="frow lb-row ${place ? "place" + place : ""} ${p.is_me ? "me" : ""}" data-fid="${p.id}">
    <span class="lb-rank">${place ? MEDALS[place - 1] : p.rank}</span>
    <button class="fwho" data-fopen="${p.id}">${personAvatar(p.display_name, p.avatar_url, p.streak, t, 42, { badge: true })}
      <span class="fname"><b>${glowNameAs(p.display_name, t)}${p.is_me ? ` <em class="lb-you">You</em>` : ""}</b><small>${sub}</small>${liveBarHTML(p.live, p, false, place)}</span></button>
    <span class="lb-score">${boardValue(p)}</span></div>`;
}
document.addEventListener("click", e => {
  if (!state || !Cloud.user) return;
  const s = e.target.closest("[data-bscope]"), m = e.target.closest("[data-bmetric]");
  if (s) { boardScope = s.dataset.bscope; renderLeaders(); }
  if (m) { boardMetric = m.dataset.bmetric; renderLeaders(); }
});

/* ---------- Chat ----------
   One-to-one chats with friends. New messages arrive live; a quiet check every few seconds
   covers the moments a live connection drops. */
let chatsLoading = false, chats = null, chatsAt = 0, chatsErr = "", chatWith = null, convos = {}, chatBet = null, chatTimer = null, sending = false;
const REACTS = ["🔥", "💪", "😂", "😬", "👏", "❤️"];
let groups = null;
const peopleText = n => n === 1 ? "1 person" : n + " people";
// A group chat is opened as "g:<id>"; a one-to-one chat by the friend's id.
const isGroup = id => typeof id === "string" && id.startsWith("g:"), gidOf = id => Number(id.slice(2));
const groupOf = id => (groups || []).find(g => "g:" + g.id === id);
const unreadCount = () => (chats || []).reduce((a, c) => a + Number(c.unread || 0), 0) + (groups || []).reduce((a, g) => a + Number(g.unread || 0), 0);
async function loadChats(force) {
  if (!Cloud.user || localMode || chatsLoading || (!force && Date.now() - chatsAt < 8000)) return;
  chatsAt = Date.now(); chatsLoading = true;
  // Groups load on their own, so one-to-one chats still work if the database hasn't been updated for groups yet.
  const [c, g] = await Promise.allSettled([Cloud.myChats(), Cloud.myGroups()]);
  if (c.status === "fulfilled") { chats = c.value; chatsErr = ""; } else chatsErr = Cloud.nice(c.reason);
  if (g.status === "fulfilled") groups = g.value; else if (!groups) groups = [];
  chatsLoading = false;
  if (!state || scrim) return;
  renderMe(); if (state.page === "chat" && !chatWith) renderChat();
}
async function loadConvo(id, older) {
  const c = convos[id] || (convos[id] = { msgs: null });
  try {
    const fetch = before => isGroup(id) ? Cloud.groupMessages(gidOf(id), before) : Cloud.chatMessages(id, before);
    if (older) {
      const more = await fetch(c.msgs[0].id);
      c.msgs = more.concat(c.msgs); c.done = more.length < 60;
    } else {
      const fresh = await fetch();
      const grew = !c.msgs || fresh.length !== c.msgs.length || JSON.stringify(fresh) !== JSON.stringify(c.msgs.slice(-fresh.length));
      if (!c.msgs) c.done = fresh.length < 60;
      if (!grew) return;
      c.msgs = c.msgs && c.msgs.length > fresh.length ? c.msgs.slice(0, c.msgs.length - fresh.length).concat(fresh) : fresh;
    }
    c.err = "";
  } catch (x) { c.err = Cloud.nice(x); }
  if (state && state.page === "chat" && chatWith === id) {
    if (isGroup(id)) { const g = groupOf(id); if (g && Number(g.unread)) { g.unread = 0; renderMe(); Cloud.groupMarkRead(gidOf(id)).then(() => loadChats(true)).catch(() => {}); } }
    else if ((c.msgs || []).some(m => m.sender === id && !m.read_at)) Cloud.chatMarkRead(id).then(() => loadChats(true)).catch(() => {});
    renderConvoBody(older);
  }
}
function onChatEvent(kind, row) {
  if (!state || !Cloud.user || !row) return;
  const me = Cloud.user.id;
  if ((kind === "message" || kind === "gmessage") && row.sender && typers.delete(row.sender)) paintTyping();
  loadChats(true);
  if (kind === "gmessage" || kind === "greaction") {
    const gid = "g:" + row.group_id;
    if (state.page === "chat" && chatWith === gid) loadConvo(gid);
    else if (kind === "gmessage" && row.sender && row.sender !== me && state.page !== "chat") {
      const g = groupOf(gid), who = g && (g.members || []).find(m => m.id === row.sender);
      toast(`👥 ${g ? g.name : "Group"} · ${who ? who.name + ": " : ""}${row.body ? row.body.slice(0, 60) : "shared a bet"}`);
    }
    return;
  }
  const other = kind === "reaction" ? null : (row.sender === me ? row.recipient : row.sender);
  if (state.page === "chat" && chatWith && !isGroup(chatWith) && (kind === "reaction" || other === chatWith)) loadConvo(chatWith);
  else if (kind === "message" && row.sender !== me && state.page !== "chat") {
    const c = (chats || []).find(x => x.id === row.sender) || (friends || []).find(x => x.id === row.sender);
    toast(`💬 ${c ? c.display_name : "New message"}: ${row.body ? row.body.slice(0, 60) : "shared a bet"}`);
  }
}
let chatEvery = 0;
function chatPoll() {
  const every = state && state.page === "chat" ? 4000 : 20000;
  if (chatTimer && every === chatEvery) return;
  clearInterval(chatTimer); chatEvery = every;
  chatTimer = setInterval(() => {
    if (!state || localMode || document.visibilityState !== "visible") return;
    if (state.page === "chat" && chatWith) loadConvo(chatWith); else loadChats(true);
    loadFeed(state.page === "feed" ? 15000 : 60000);
    loadChallenges(state.page === "challenges" ? 15000 : 60000);
  }, every);
}
function openChat(id) { chatWith = id; chatBet = null; go("chat"); }
// The Chat tab always opens the list of chats.
document.addEventListener("click", e => { if (state && e.target.closest('#nav [data-nav="chat"]')) { chatWith = null; chatBet = null; } }, true);

function renderChat() {
  if (localMode) {
    $("#view").innerHTML = `<div class="head" style="padding-top:18px"><div><div class="eyebrow">Chat</div><h1>Needs an account</h1></div></div>
      <div class="glass card"><div class="cap" style="margin:0">Chat switches on once config.js has your Supabase keys and you're logged in.</div></div>`;
    return;
  }
  if (chatWith) return renderConvo();
  loadChats(Date.now() - chatsAt > 1500); loadFriends();
  const withChat = new Set((chats || []).map(c => c.id));
  const list = (chats || []).map(c => ({ at: c.last_at, html: chatRow(c) })).concat((groups || []).map(g => ({ at: g.last_at, html: groupRow(g) })))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
  const mates = (friends || []).filter(f => f.status === "accepted"), starters = mates.filter(f => !withChat.has(f.id));
  $("#view").innerHTML = `
    <div class="head" style="padding-top:18px"><div><div class="eyebrow">${unreadCount() ? plural(unreadCount(), "unread message") : "Your chats"}</div><h1>Chat</h1></div>
      <button class="ghost" data-newgroup>👥 New group</button></div>
    ${chatsErr ? `<div class="glass card"><div class="err" style="margin:0">${esc(chatsErr)}</div></div>` : ""}
    ${!chats && !chatsErr ? `<div class="glass card"><div class="cap" style="margin:0">Loading your chats…</div></div>` : ""}
    ${list.length ? `<div class="glass card flist">${list.map(x => x.html).join("")}</div>` : ""}
    ${starters.length ? `<div class="section-h"><h2>Start a chat</h2></div><div class="glass card flist">${starters.map(f => friendRow(f, `<button class="btn sm sec" data-chat="${f.id}">Message</button>`)).join("")}</div>` : ""}
    ${chats && !list.length && friends && !starters.length ? `<div class="glass card fempty"><div class="soon-ic">💬</div><p>Chats are with friends. Add a friend first, then message them here.</p><button class="btn sec" data-nav="friends">Find friends</button></div>` : ""}`;
}
function chatRow(c) {
  const t = tierOf(c), preview = (c.last_from_me ? "You: " : "") + lastText(c);
  return `<button class="frow chat-row ${Number(c.unread) ? "unread" : ""}" data-chat="${c.id}">
    ${personAvatar(c.display_name, c.avatar_url, c.streak, t, 46, { badge: true })}
    <span class="fname"><b>${glowNameAs(c.display_name, t)}</b><small>${esc(preview)}</small></span>
    <span class="chat-meta"><small>${chatTime(c.last_at, true)}</small>${Number(c.unread) ? `<i>${c.unread}</i>` : ""}</span></button>`;
}
// A small stack of the first members' photos stands in for a group's picture.
function groupAvatar(g, size) {
  const others = (g.members || []).filter(m => m.id !== Cloud.user.id).slice(0, 2);
  return `<div class="gav" style="--sz:${size}px">${others.map(m => personAvatar(m.name, m.avatar_url, m.streak, tierOf(m), Math.round(size * .66))).join("")}</div>`;
}
function groupRow(g) {
  const who = g.last_kind === "event" ? "" : g.last_from_me ? "You: " : g.last_sender_name ? g.last_sender_name + ": " : "";
  const preview = g.last_id ? who + lastText(g) : peopleText(Number(g.member_count));
  return `<button class="frow chat-row ${Number(g.unread) ? "unread" : ""}" data-chat="g:${g.id}">
    ${groupAvatar(g, 46)}
    <span class="fname"><b>${esc(g.name)}</b><small>${esc(preview)}</small></span>
    <span class="chat-meta"><small>${chatTime(g.last_at, true)}</small>${Number(g.unread) ? `<i>${g.unread}</i>` : ""}</span></button>`;
}
function lastText(c) { return c.last_body || (c.last_media === "photo" ? "📷 Photo" : c.last_media === "voice" ? "🎤 Voice note" : "🎟️ Shared a bet"); }
function chatTime(ts, short) {
  const d = new Date(ts), now = new Date(), same = d.toDateString() === now.toDateString();
  const time = d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (same) return time;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  const day = d.toDateString() === y.toDateString() ? "Yesterday" : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
  return short ? day : day + ", " + time;
}
function chatPartner(id) { return (chats || []).find(c => c.id === id) || (friends || []).find(f => f.id === id); }

function renderConvo() {
  if (isGroup(chatWith)) return renderGroupConvo();
  const p = chatPartner(chatWith), c = convos[chatWith];
  if (!c) loadConvo(chatWith);
  const t = p ? tierOf(p) : TIERS[0], isFriend = (friends || []).some(f => f.id === chatWith && f.status === "accepted");
  $("#view").innerHTML = `
    <div class="convo-head">
      <button class="convo-back" data-chatback aria-label="Back to chats">‹</button>
      <button class="fwho" data-fopen="${chatWith}">${p ? personAvatar(p.display_name, p.avatar_url, p.streak, t, 40, { badge: true }) : ""}
        <span class="fname"><b>${p ? glowNameAs(p.display_name, t) : "Chat"}</b><small>${p ? friendLine(p) : ""}</small></span></button>
    </div>
    <div class="convo" id="convo"></div>
    <div class="composer" id="composer">
      ${isFriend || !friends ? composerHTML()
      : `<div class="cap" style="text-align:center;margin:0">You're not friends any more, so you can read this chat but not send new messages.</div>`}
    </div>`;
  renderConvoBody();
  wireComposer();
}
function composerHTML() {
  return `<div class="typing" id="typing" aria-live="polite" ${typingLine() ? "" : "hidden"}>${typingLine()}</div>
      <div class="cmp-bet" id="cmpBet" ${chatBet ? "" : "hidden"}></div>
      <div class="cmp-row" id="cmpRow"><button class="cmp-ic" id="cmpPhoto" aria-label="Send a photo">＋</button><input type="file" id="cmpFile" accept="image/*" hidden>
        <button class="cmp-ic" id="cmpShare" aria-label="Share a bet">🎟️</button>
        <textarea id="cmpText" rows="1" maxlength="1000" placeholder="Message"></textarea>
        <button class="cmp-ic cmp-mic" id="cmpMic" aria-label="Record a voice note">🎤</button>
        <button class="cmp-send" id="cmpSend" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M4 12 20 4l-6 16-3-7z"/></svg></button></div>
      <div class="cmp-rec" id="cmpRec" hidden><button class="cmp-ic" id="recCancel" aria-label="Cancel voice note">✕</button>
        <span class="rec-dot"></span><span class="rec-time" id="recTime">0:00</span><span class="rec-hint">Recording…</span>
        <button class="cmp-send" id="recSend" aria-label="Send voice note"><svg viewBox="0 0 24 24"><path d="M4 12 20 4l-6 16-3-7z"/></svg></button></div>`;
}
function renderGroupConvo() {
  const g = groupOf(chatWith), c = convos[chatWith];
  if (!c) loadConvo(chatWith);
  if (!g && groups) { chatWith = null; return renderChat(); }
  const names = g ? (g.members || []).map(m => m.id === Cloud.user.id ? "You" : m.name).join(", ") : "";
  $("#view").innerHTML = `
    <div class="convo-head">
      <button class="convo-back" data-chatback aria-label="Back to chats">‹</button>
      <button class="fwho" data-groupinfo>${g ? groupAvatar(g, 40) : ""}
        <span class="fname"><b>${g ? esc(g.name) : "Group"}</b><small>${esc(names)}</small></span></button>
    </div>
    <div class="convo group" id="convo"></div>
    <div class="composer" id="composer">${composerHTML()}</div>`;
  renderConvoBody();
  wireComposer();
}
function wireComposer() {
  renderAttached();
  const ta = $("#cmpText");
  if (ta) {
    ta.oninput = () => { ta.style.height = "auto"; ta.style.height = Math.min(ta.scrollHeight, 120) + "px"; micOrSend(); typingPing(!!ta.value.trim()); };
    ta.onkeydown = e => { if (e.key === "Enter" && !e.shiftKey && !matchMedia("(pointer: coarse)").matches) { e.preventDefault(); sendChat(); } };
    $("#cmpSend").onclick = sendChat;
    $("#cmpShare").onclick = pickBet;
    $("#cmpPhoto").onclick = () => $("#cmpFile").click();
    $("#cmpFile").onchange = e => { const f = e.target.files && e.target.files[0]; e.target.value = ""; if (f) sendPhoto(f); };
    $("#cmpMic").onclick = startVoice;
    $("#recCancel").onclick = () => stopVoice(false);
    $("#recSend").onclick = () => stopVoice(true);
    micOrSend();
  }
}
// The send arrow shows once there's something typed or a bet attached; otherwise the mic does.
function micOrSend() {
  const ta = $("#cmpText"); if (!ta) return;
  const has = !!ta.value.trim() || !!chatBet;
  $("#cmpMic").hidden = has; $("#cmpSend").hidden = !has;
}

/* ---------- Photos and voice notes ---------- */
// Photos are shrunk to 1600px on the long side and saved as JPEG, so they send fast and stay small.
async function shrinkPhoto(file) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file isn't a photo we can open.")); i.src = URL.createObjectURL(file); });
  const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
  const cv = document.createElement("canvas"); cv.width = w; cv.height = h;
  cv.getContext("2d").drawImage(img, 0, 0, w, h); URL.revokeObjectURL(img.src);
  return { blob: await new Promise(res => cv.toBlob(res, "image/jpeg", .82)), w, h };
}
async function sendMedia(make, label) {
  if (sending) return;
  sending = true; const to = chatWith, note = $("#cmpBet");
  if (note) { note.hidden = false; note.innerHTML = `<span>${label}</span>`; }
  try {
    const media = await make();
    if (isGroup(to)) await Cloud.sendGroupMessage(gidOf(to), "", null, media); else await Cloud.sendMessage(to, "", null, media);
    const box = $("#convo"); if (box) box.dataset.ready = "";
    await loadConvo(to); loadChats(true);
  } catch (x) { toast(x && x.message && !x.code ? x.message : Cloud.nice(x), "bad"); }
  sending = false; renderAttached();
}
function sendPhoto(file) {
  return sendMedia(async () => {
    const { blob, w, h } = await shrinkPhoto(file);
    return { path: await Cloud.uploadChatMedia(blob, "jpg", "image/jpeg"), kind: "photo", meta: { w, h } };
  }, "📷 Sending photo…");
}
// Voice notes: tap 🎤 to record, ✕ to bin it, or the arrow to send. Two minutes at most.
let rec = null;
const VOICE_MAX = 120;
async function startVoice() {
  if (rec || sending) return;
  if (!navigator.mediaDevices || !window.MediaRecorder) return toast("Voice notes don't work in this browser.", "bad");
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
  catch (e) { return toast("Allow the microphone for this app to send voice notes. On iPhone: Settings, then Safari, then Microphone.", "bad"); }
  const type = ["audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg"].find(t => MediaRecorder.isTypeSupported(t)) || "";
  const mr = new MediaRecorder(stream, type ? { mimeType: type } : undefined), chunks = [];
  mr.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
  rec = { mr, stream, chunks, start: Date.now(), to: chatWith, send: false };
  mr.onstop = () => {
    const r = rec; rec = null; stream.getTracks().forEach(t => t.stop()); clearInterval(r.tick); showRec(false);
    const dur = (Date.now() - r.start) / 1000;
    if (!r.send) return;
    if (dur < 1) return toast("That was too short to send. Tap 🎤 and talk, then tap send.");
    const mime = (mr.mimeType || type || "audio/mp4").split(";")[0], ext = /mp4|aac/.test(mime) ? "m4a" : /ogg/.test(mime) ? "ogg" : "webm";
    const blob = new Blob(r.chunks, { type: mime });
    if (chatWith !== r.to) return;
    sendMedia(async () => ({ path: await Cloud.uploadChatMedia(blob, ext, mime === "audio/mp4" ? "audio/mp4" : mime), kind: "voice", meta: { dur: Math.round(dur * 10) / 10 } }), "🎤 Sending voice note…");
  };
  mr.start(250);
  rec.tick = setInterval(() => {
    const sec = Math.floor((Date.now() - rec.start) / 1000), el = $("#recTime");
    if (el) el.textContent = clock(sec); else return stopVoice(false); // left the chat
    if (sec >= VOICE_MAX) stopVoice(true);
  }, 250);
  showRec(true);
}
function stopVoice(send) { if (!rec) return; rec.send = send; if (rec.mr.state !== "inactive") rec.mr.stop(); }
function showRec(on) { const a = $("#cmpRow"), b = $("#cmpRec"); if (a) a.hidden = on; if (b) b.hidden = !on; if (on && $("#recTime")) $("#recTime").textContent = "0:00"; }
const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
function mediaHTML(m) {
  if (m.media_kind === "photo") {
    const mt = m.media_meta || {}, ar = mt.w && mt.h ? `${mt.w} / ${mt.h}` : "4 / 3";
    return `<button class="mphoto" data-photo="${esc(m.media_path)}" style="aspect-ratio:${ar}" aria-label="Open photo"><img data-media="${esc(m.media_path)}" alt=""></button>`;
  }
  if (m.media_kind === "voice") {
    const d = Number((m.media_meta || {}).dur) || 0;
    return `<div class="mvoice" data-voice="${esc(m.media_path)}"><button class="mv-play" aria-label="Play voice note">▶</button><span class="mv-bar"><i></i></span><span class="mv-dur" data-dur="${d}">${clock(d)}</span></div>`;
  }
  return "";
}
// Fill in photos once the signed links come back.
function loadMedia(root) {
  root.querySelectorAll("img[data-media]:not([src])").forEach(img => {
    Cloud.mediaUrl(img.dataset.media).then(u => { img.src = u; }).catch(() => img.closest(".mphoto").classList.add("broken"));
  });
}
function openPhoto(path) {
  const v = document.createElement("div"); v.className = "photo-view"; v.innerHTML = `<button aria-label="Close">✕</button><img alt="">`;
  document.body.appendChild(v); v.onclick = () => v.remove();
  Cloud.mediaUrl(path).then(u => { v.querySelector("img").src = u; }).catch(() => { v.remove(); toast("Couldn't open that photo.", "bad"); });
}
// One voice note plays at a time.
let voice = null;
async function playVoice(el) {
  const path = el.dataset.voice;
  if (voice && voice.path === path) { if (voice.a.paused) voice.a.play(); else voice.a.pause(); return; }
  if (voice) { voice.a.pause(); voice.el.classList.remove("playing"); }
  const a = new Audio(); voice = { a, el, path };
  const btn = el.querySelector(".mv-play"), bar = el.querySelector(".mv-bar i"), dur = el.querySelector(".mv-dur"), total = Number(dur.dataset.dur) || 0;
  a.onplay = () => { el.classList.add("playing"); btn.textContent = "❚❚"; };
  a.onpause = () => { el.classList.remove("playing"); btn.textContent = "▶"; };
  a.ontimeupdate = () => { const d = isFinite(a.duration) && a.duration > 0 ? a.duration : total; bar.style.width = (d ? Math.min(100, a.currentTime / d * 100) : 0) + "%"; dur.textContent = clock(a.currentTime); };
  a.onended = () => { bar.style.width = "0%"; dur.textContent = clock(total); if (voice && voice.a === a) voice = null; };
  try { a.src = await Cloud.mediaUrl(path); await a.play(); }
  catch (e) { toast("Couldn't play that voice note.", "bad"); if (voice && voice.a === a) voice = null; }
}
function renderConvoBody(keepTop) {
  const box = $("#convo"); if (!box) return;
  const c = convos[chatWith], me = Cloud.user.id;
  if (!c || !c.msgs) { box.innerHTML = c && c.err ? `<div class="err">${esc(c.err)}</div>` : `<div class="cap convo-empty">Loading…</div>`; return; }
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80 || !box.dataset.ready;
  const prevH = document.documentElement.scrollHeight;
  let html = c.done ? "" : `<button class="linkbtn convo-older" data-chatolder>Show earlier messages</button>`, lastDay = "";
  if (!c.msgs.length) html += `<div class="cap convo-empty">Say hi 👋, tap 🎟️ to share one of your bets, ＋ for a photo or 🎤 for a voice note.</div>`;
  const lastMine = [...c.msgs].reverse().find(m => m.sender === me), group = isGroup(chatWith);
  let prevSender = null;
  for (const m of c.msgs) {
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) { html += `<div class="convo-day">${chatTime(m.created_at, true) === new Date(m.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) ? "Today" : chatTime(m.created_at, true)}</div>`; lastDay = day; }
    if (m.kind === "event") { html += `<div class="convo-note">${esc(m.body)}</div>`; prevSender = null; continue; }
    const mine = m.sender === me, rx = Object.entries(m.reactions || {});
    // In a group, each run of messages from someone else starts with their name.
    const who = group && !mine && m.sender !== prevSender ? `<div class="msender">${m.sender_name ? glowNameAs(m.sender_name, tierOf({ tier_idx: m.sender_tier })) : "Someone who left"}</div>` : "";
    prevSender = m.sender;
    html += `<div class="msg ${mine ? "mine" : "theirs"}" data-msg="${m.id}">${who}
      <div class="bubble ${m.media_kind ? "has-" + m.media_kind : ""}">${m.media_kind ? mediaHTML(m) : ""}${m.bet ? betCardHTML(m.bet) : ""}${m.body ? `<div class="mtext">${esc(m.body)}</div>` : ""}
        <span class="mtime">${new Date(m.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</span></div>
      ${rx.length ? `<div class="mrx">${rx.map(([u, e]) => `<span class="${u === me ? "me" : ""}">${e}</span>`).join("")}</div>` : ""}
      ${!group && m === lastMine && m.read_at ? `<div class="mseen">Seen</div>` : ""}</div>`;
  }
  // Keep a voice note that's playing alive through live refreshes.
  box.innerHTML = html; box.dataset.ready = "1"; loadMedia(box);
  if (voice) { const el = box.querySelector(`[data-voice="${CSS.escape(voice.path)}"]`); if (el) { el.replaceWith(voice.el); } }
  if (keepTop) scrollTo(0, document.documentElement.scrollHeight - prevH + scrollY);
  else if (atBottom) requestAnimationFrame(() => scrollTo(0, document.documentElement.scrollHeight));
}
function betCardHTML(b) {
  const res = { win: ["✅", "Won", "win"], loss: ["❌", "Lost", "loss"], pending: ["⏳", "Pending", "pend"] }[b.result] || ["🎟️", "", ""];
  return `<div class="mbet ${res[2]}"><div class="mbet-top"><span>🎟️ ${esc(b.sport)}${b.tracker ? ` · ${esc(b.tracker)}` : ""}</span><span class="mbet-res">${res[0]} ${res[1]}</span></div>
    <div class="mbet-text">${esc(b.text)}</div><div class="mbet-odds">@ ${odds2(b.odds)}</div></div>`;
}
function renderAttached() {
  const el = $("#cmpBet"); if (!el) return;
  el.hidden = !chatBet;
  micOrSend();
  if (chatBet) el.innerHTML = `<span>🎟️ Sharing: <b>${esc(chatBet.text)}</b> @ ${odds2(chatBet.odds)}</span><button data-unbet aria-label="Remove">✕</button>`;
}
function pickBet() {
  const all = state.trackers.flatMap(t => t.bets.map(b => ({ ...b, tracker: t.name }))).sort((a, b) => b.createdAt - a.createdAt).slice(0, 25);
  const icon = { win: "✅", loss: "❌", pending: "⏳" };
  const sh = openSheet(`<h3>Share a bet</h3><div class="sub">Pick one of your logged bets. Your friend sees its live result.</div>
    ${all.length ? `<div class="pick-bets">${all.map(b => `<button class="pick-bet" data-pick="${b.id}"><span>${icon[b.result] || "🎟️"}</span><span><b>${esc(b.text)}</b><small>${esc(b.sport)} · ${esc(b.tracker)} · @ ${odds2(b.odds)} · ${when(b.createdAt)}</small></span></button>`).join("")}</div>`
      : `<div class="cap">You haven't logged any bets yet.</div>`}`);
  sh.querySelectorAll("[data-pick]").forEach(el => el.onclick = () => { chatBet = all.find(b => b.id === el.dataset.pick); closeSheet(); renderAttached(); $("#cmpText") && $("#cmpText").focus(); });
}
async function sendChat() {
  const ta = $("#cmpText"); if (!ta || sending) return;
  const body = ta.value.trim(); if (!body && !chatBet) return;
  sending = true; $("#cmpSend").disabled = true;
  const to = chatWith, bet = chatBet;
  try {
    if (isGroup(to)) await Cloud.sendGroupMessage(gidOf(to), body, bet && bet.id); else await Cloud.sendMessage(to, body, bet && bet.id);
    if (chatWith === to) { ta.value = ""; ta.style.height = "auto"; chatBet = null; renderAttached(); typingPing(false); }
    const box = $("#convo"); if (box) box.dataset.ready = "";
    await loadConvo(to); loadChats(true);
  } catch (x) { toast(Cloud.nice(x), "bad"); }
  sending = false; if ($("#cmpSend")) $("#cmpSend").disabled = false;
}
function openReactions(msgEl) {
  document.querySelectorAll(".rx-pick").forEach(x => x.remove());
  const id = Number(msgEl.dataset.msg), m = (convos[chatWith].msgs || []).find(x => x.id === id); if (!m) return;
  const mineNow = (m.reactions || {})[Cloud.user.id];
  msgEl.insertAdjacentHTML("afterbegin", `<div class="rx-pick">${REACTS.map(e => `<button data-react="${e}" class="${mineNow === e ? "on" : ""}">${e}</button>`).join("")}</div>`);
}
document.addEventListener("click", async e => {
  if (!state || !Cloud.user) return;
  const t = e.target;
  const c = t.closest("[data-chat]"); if (c) return openChat(c.dataset.chat);
  if (t.closest("[data-chatback]")) { stopVoice(false); if (voice) { voice.a.pause(); voice = null; } chatWith = null; chatBet = null; return render(); }
  const ph = t.closest("[data-photo]"); if (ph) return openPhoto(ph.dataset.photo);
  const vn = t.closest("[data-voice]"); if (vn) return playVoice(vn);
  if (t.closest("[data-unbet]")) { chatBet = null; return renderAttached(); }
  if (t.closest("[data-chatolder]")) return loadConvo(chatWith, true);
  if (t.closest("[data-newgroup]")) {
    // Check with a fresh friends list, in case someone just accepted.
    const enough = () => (friends || []).filter(f => f.status === "accepted").length >= 2;
    if (!enough()) await loadFriends(true);
    return enough() ? openNewGroup() : toast("Groups need at least two friends. Add one more friend, then tap New group.");
  }
  if (t.closest("[data-groupinfo]")) return openGroupInfo();
  const r = t.closest("[data-react]");
  if (r) {
    const msgEl = r.closest("[data-msg]"), id = Number(msgEl.dataset.msg), m = convos[chatWith].msgs.find(x => x.id === id);
    const emoji = r.dataset.react, prev = (m.reactions || {})[Cloud.user.id];
    m.reactions = { ...(m.reactions || {}) }; if (prev === emoji) delete m.reactions[Cloud.user.id]; else m.reactions[Cloud.user.id] = emoji;
    renderConvoBody();
    try { await (isGroup(chatWith) ? Cloud.groupReact(id, emoji) : Cloud.chatReact(id, emoji)); } catch (x) { toast(Cloud.nice(x), "bad"); }
    return loadConvo(chatWith);
  }
  const b = t.closest(".msg .bubble");
  if (b && state.page === "chat") return openReactions(b.closest("[data-msg]"));
  if (!t.closest(".rx-pick")) document.querySelectorAll(".rx-pick").forEach(x => x.remove());
});

/* ---------- Feed: what you and your friends have been betting ----------
   Bets logged, bets won or lost, and money banked, newest first. Friends react with one emoji each. */
let feed = null, feedAt = 0, feedErr = "", feedLoading = false, feedDone = false, feedPick = null;
const FEED_SEEN_KEY = () => "streak-charger.feedSeen." + (Cloud.user ? Cloud.user.id : "local");
function feedSeen() { try { return Number(localStorage.getItem(FEED_SEEN_KEY())) || 0; } catch (e) { return 0; } }
function markFeedSeen() {
  // Friend activity up to the newest item counts as seen; with none yet, everything before now does.
  const top = (feed || []).find(x => x.user_id !== Cloud.user.id), at = top ? Number(top.at) : Date.now() - 60000;
  if (at > feedSeen()) try { localStorage.setItem(FEED_SEEN_KEY(), String(at)); } catch (e) {}
}
// New friend activity since you last opened the feed (none counted the first time, so it doesn't start at 30).
function feedNew() {
  const seen = feedSeen(); if (!seen || !feed) return 0;
  return feed.filter(x => x.user_id !== Cloud.user.id && x.at > seen).length;
}
const feedNewLabel = () => { const n = feedNew(); return n >= 30 ? "30+" : n || ""; };
async function loadFeed(maxAge = 0, more = false) {
  if (!Cloud.user || localMode || feedLoading || (!more && Date.now() - feedAt < maxAge)) return;
  feedLoading = true; if (!more) feedAt = Date.now();
  try {
    if (more) {
      const last = feed[feed.length - 1], next = await Cloud.feed(last.at, last.key);
      feed = feed.concat(next); feedDone = next.length < 30;
    } else {
      const fresh = await Cloud.feed();
      // Keep any older pages already loaded below the fresh first page.
      const keys = new Set(fresh.map(x => x.key)), last = fresh[fresh.length - 1];
      const rest = feed && last ? feed.filter(x => !keys.has(x.key) && (x.at < last.at || (x.at === last.at && x.key < last.key))) : [];
      if (!rest.length) feedDone = fresh.length < 30;
      feed = fresh.concat(rest);
      if (!feedSeen()) markFeedSeen();
    }
    feedErr = "";
  } catch (x) { feedErr = Cloud.nice(x); }
  feedLoading = false;
  if (!state || scrim) return;
  renderMe();
  if (state.page === "feed") renderFeedBody(); else if (state.page === "home") { const b = $('.subnav [data-nav="feed"]'); if (b) b.dataset.count = feedNewLabel(); }
}

function renderFeed() {
  if (localMode) { go("home"); return; }
  $("#view").innerHTML = `<div class="head" style="padding-top:18px"><div><div class="eyebrow">You and your friends</div><h1>Feed</h1></div></div><div id="feedBody"></div>`;
  renderFeedBody();
  loadFeed(4000); loadFriends();
}
function renderFeedBody() {
  const box = $("#feedBody"); if (!box) return;
  const hasFriends = (friends || []).some(f => f.status === "accepted") || (feed || []).some(x => x.user_id !== Cloud.user.id);
  if (feedErr && !feed) { box.innerHTML = `<div class="glass card"><div class="err" style="margin:0">${esc(feedErr)}</div></div>`; return; }
  if (!feed) { box.innerHTML = `<div class="glass card"><div class="cap" style="margin:0">Loading the feed…</div></div>`; return; }
  const seen = feedSeen();
  let html = friends && !hasFriends ? `<div class="glass card fempty"><div class="soon-ic">📣</div><p>Your feed shows the bets your friends log, win and lose, as they happen. Add a friend to fill it up.</p><button class="btn sec" data-nav="friends">Find friends</button></div>` : "";
  if (!feed.length && hasFriends) html += `<div class="glass card fempty"><div class="soon-ic">📣</div><p>Nothing here yet. When you or your friends log a bet, it shows up here.</p></div>`;
  let lastDay = "";
  for (const it of feed) {
    const day = new Date(it.at).toDateString();
    if (day !== lastDay) { html += `<div class="convo-day feed-day">${day === new Date().toDateString() ? "Today" : chatTime(it.at, true)}</div>`; lastDay = day; }
    html += feedItem(it, it.user_id !== Cloud.user.id && it.at > seen && seen > 0);
  }
  if (feed.length && !feedDone) html += `<button class="btn sec feed-more" data-feedmore ${feedLoading ? "disabled" : ""}>Show older activity</button>`;
  box.innerHTML = html;
  markFeedSeen(); renderMe();
}
function feedWhat(it) {
  if (it.kind === "bank") return `banked <b>${money(it.amount || 0)}</b>`;
  if (it.kind === "result") return it.bet && it.bet.result === "win" ? `won a bet ✅` : `lost a bet ❌`;
  return "logged a bet";
}
function feedItem(it, isNew) {
  const mine = it.user_id === Cloud.user.id, t = tierOf(it), rx = Object.entries(it.reactions || {}).sort((a, b) => b[1] - a[1]);
  const time = new Date(Number(it.at)).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const card = it.bet ? betCardHTML({ ...it.bet, tracker: it.tracker })
    : `<div class="mbet bank"><div class="mbet-top"><span>💰 Banked${it.tracker ? ` · ${esc(it.tracker)}` : ""}</span></div><div class="mbet-text">${money(it.amount || 0)}</div><div class="mbet-odds">Taken off the run and kept</div></div>`;
  const who = (it.reactors || []).map(r => `${esc(r.name)} ${r.emoji}`).join(", ");
  return `<div class="glass feed-item ${isNew ? "new" : ""}" data-fkey="${esc(it.key)}">
    <div class="feed-top">
      <button class="fwho" ${mine ? `data-nav="profile"` : `data-fopen="${it.user_id}"`}>${personAvatar(it.display_name, it.avatar_url, it.streak, t, 40, { badge: true })}</button>
      <div class="feed-line"><span>${mine ? "<b>You</b>" : `<b>${glowNameAs(it.display_name, t)}</b>`} ${feedWhat(it)}</span><small>${time}</small></div>
    </div>
    ${card}
    <div class="feed-rx">
      ${rx.map(([e, n]) => `<span class="rx-chip ${it.my_reaction === e ? "me" : ""}" ${mine ? "" : `data-freact="${e}"`}>${e} ${n}</span>`).join("")}
      ${mine ? (who ? `<small class="feed-who">${who}</small>` : "") : `<button class="rx-add" data-fpick aria-label="React">${it.my_reaction ? "Change" : "React"}</button>`}
    </div>
    ${feedPick === it.key ? `<div class="feed-pick">${REACTS.map(e => `<button data-freact="${e}" class="${it.my_reaction === e ? "on" : ""}">${e}</button>`).join("")}</div>` : ""}
  </div>`;
}
document.addEventListener("click", async e => {
  if (!state || !Cloud.user || state.page !== "feed") return;
  const t = e.target;
  if (t.closest("[data-feedmore]")) { t.closest("[data-feedmore]").disabled = true; return loadFeed(0, true); }
  const card = t.closest("[data-fkey]"); if (!card) { if (feedPick) { feedPick = null; renderFeedBody(); } return; }
  const key = card.dataset.fkey, it = feed.find(x => x.key === key); if (!it) return;
  if (t.closest("[data-fpick]")) { feedPick = feedPick === key ? null : key; return renderFeedBody(); }
  const r = t.closest("[data-freact]"); if (!r) return;
  const emoji = r.dataset.freact, prev = it.my_reaction, rx = { ...(it.reactions || {}) };
  if (prev) { rx[prev]--; if (!rx[prev]) delete rx[prev]; }
  if (prev !== emoji) rx[emoji] = (rx[emoji] || 0) + 1;
  it.reactions = rx; it.my_reaction = prev === emoji ? null : emoji; feedPick = null;
  renderFeedBody();
  try { await Cloud.feedReact(it.kind, it.ref_id, emoji); } catch (x) { toast(Cloud.nice(x), "bad"); loadFeed(); }
});

/* ---------- Group chats: starting one, and the group's info sheet ---------- */
function openNewGroup() {
  const mates = (friends || []).filter(f => f.status === "accepted").sort((a, b) => a.display_name.localeCompare(b.display_name)), picked = new Set();
  const sh = openSheet(`<h3>New group</h3><div class="sub">Pick at least two friends. Anyone in the group can add their own friends later.</div>
    <div class="field"><label for="ngName">Group name</label><input id="ngName" maxlength="40" placeholder="e.g. Sunday multis"></div>
    <div class="pick-people">${mates.map(f => `<label class="pick-person"><input type="checkbox" value="${f.id}">${personAvatar(f.display_name, f.avatar_url, f.streak, tierOf(f), 36)}<span>${glowNameAs(f.display_name, tierOf(f))}</span></label>`).join("")}</div>
    <div class="err" id="ngErr"></div><button class="btn" id="ngGo" disabled>Pick two friends</button>`);
  const name = sh.querySelector("#ngName"), go = sh.querySelector("#ngGo");
  const update = () => {
    const n = picked.size, ok = n >= 2 && name.value.trim();
    go.disabled = !ok; go.textContent = n < 2 ? (n ? "Pick one more friend" : "Pick two friends") : !name.value.trim() ? "Name the group" : `Start group with ${plural(n, "friend")}`;
  };
  sh.querySelectorAll(".pick-person input").forEach(cb => cb.onchange = () => { cb.checked ? picked.add(cb.value) : picked.delete(cb.value); update(); });
  name.oninput = update;
  go.onclick = async () => {
    go.disabled = true; go.textContent = "Starting…";
    try {
      const id = await Cloud.groupCreate(name.value.trim(), [...picked]);
      closeSheet(); await loadChats(true); openChat("g:" + id);
    } catch (x) { sh.querySelector("#ngErr").textContent = Cloud.nice(x); update(); }
  };
}
async function openGroupInfo() {
  const id = chatWith, g = groupOf(id); if (!g) return;
  let people = null, err = "", leaving = false;
  const sh = openSheet(`<div id="giBody"></div>`);
  const paint = () => {
    const inGroup = new Set((people || g.members || []).map(p => p.id));
    const addable = (friends || []).filter(f => f.status === "accepted" && !inGroup.has(f.id));
    sh.querySelector("#giBody").innerHTML = `<h3>${esc(g.name)}</h3><div class="sub">${peopleText(inGroup.size)} in this group</div>
      <div class="field"><label for="giName">Group name</label><div class="gi-rename"><input id="giName" maxlength="40" value="${esc(g.name)}"><button class="btn sm sec" id="giSave">Save</button></div></div>
      <div class="flist gi-list">${(people || []).map(p => `<div class="frow"><button class="fwho" ${p.id === Cloud.user.id ? "" : p.is_friend ? `data-gifriend="${p.id}"` : ""}>${personAvatar(p.display_name, p.avatar_url, p.streak, tierOf(p), 40, { badge: true })}
        <span class="fname"><b>${glowNameAs(p.display_name, tierOf(p))}</b><small>${p.id === Cloud.user.id ? "You" : friendLine(p)}</small></span></button></div>`).join("") || `<div class="cap">Loading…</div>`}</div>
      ${addable.length && inGroup.size < 20 ? `<div class="section-h"><h2>Add your friends</h2></div><div class="flist gi-list">${addable.map(f => friendRow(f, `<button class="btn sm" data-giadd="${f.id}">Add</button>`)).join("")}</div>` : ""}
      <div class="err" id="giErr">${esc(err)}</div>
      <button class="btn warn" id="giLeave">${leaving ? "Tap again to leave the group" : "Leave group"}</button>`;
    sh.querySelector("#giSave").onclick = async () => {
      const v = sh.querySelector("#giName").value.trim(); if (!v || v === g.name) return;
      try { await Cloud.groupRename(gidOf(id), v); g.name = v; err = ""; toast("Group renamed."); await loadChats(true); loadConvo(id); if (chatWith === id) renderConvo(); paint(); }
      catch (x) { err = Cloud.nice(x); paint(); }
    };
    sh.querySelectorAll("[data-giadd]").forEach(b => b.onclick = async () => {
      b.disabled = true;
      try { await Cloud.groupAdd(gidOf(id), b.dataset.giadd); err = ""; people = await Cloud.groupPeople(gidOf(id)); await loadChats(true); loadConvo(id); }
      catch (x) { err = Cloud.nice(x); }
      paint();
    });
    sh.querySelectorAll("[data-gifriend]").forEach(b => b.onclick = () => { const p = people.find(x => x.id === b.dataset.gifriend); closeSheet(); openFriend(p); });
    sh.querySelector("#giLeave").onclick = async () => {
      if (!leaving) { leaving = true; return paint(); }
      try { await Cloud.groupLeave(gidOf(id)); closeSheet(); delete convos[id]; chatWith = null; groups = (groups || []).filter(x => "g:" + x.id !== id); toast(`You left ${g.name}.`); render(); loadChats(true); }
      catch (x) { err = Cloud.nice(x); paint(); }
    };
  };
  paint();
  try { people = await Cloud.groupPeople(gidOf(id)); } catch (x) { err = Cloud.nice(x); }
  paint();
}

/* ---------- Challenges: who gets the longest run of wins in a set time ----------
   The database scores them: only bets logged during the challenge, and settled before it ends, count. */
let challenges = null, challengesAt = 0, challengesErr = "", challengesLoading = false, chBusy = new Set();
// Leaders has the leaderboard and challenges, with a switcher on top. Both screens redraw themselves when data arrives, so each includes it.
const leadNav = () => `<div class="seg subnav">${LEADNAV.map(([id, n]) => `<button data-nav="${id}" class="${state.page === id ? "on" : ""} ${id === "challenges" ? "has-dot" : ""}" ${id === "challenges" ? `data-count="${challengeInvites() || ""}"` : ""}>${n}</button>`).join("")}</div>`;
const challengeInvites = () => (challenges || []).filter(c => c.my_status === "invited" && !c.finished).length;
async function loadChallenges(maxAge = 0) {
  if (!Cloud.user || localMode || challengesLoading || Date.now() - challengesAt < maxAge) return;
  challengesAt = Date.now(); challengesLoading = true;
  try { challenges = await Cloud.myChallenges(); challengesErr = ""; } catch (x) { challengesErr = Cloud.nice(x); }
  challengesLoading = false;
  if (!state || scrim) return;
  renderMe();
  if (state.page === "challenges") renderChallenges();
  else if (state.page === "leaderboard") { const b = $('.subnav [data-nav="challenges"]'); if (b) b.dataset.count = challengeInvites() || ""; }
}
function timeLeft(ts) {
  const ms = new Date(ts) - Date.now(); if (ms <= 0) return "Finished";
  const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.max(1, Math.floor(ms % 36e5 / 6e4));
  return "Ends in " + (d ? `${d}d ${h}h` : h ? `${h}h ${m}m` : `${m}m`);
}
// Players ranked by score; people who haven't accepted go last.
function challengeRows(c) {
  const ps = (c.members || []).filter(m => m.status !== "declined");
  const played = ps.filter(m => m.status === "accepted").sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const top = played.length ? played[0].score : 0;
  return { played, waiting: ps.filter(m => m.status === "invited"), top, winners: c.finished && top > 0 && played.length > 1 ? played.filter(m => m.score === top) : [] };
}
const andList = a => a.length < 2 ? a.join("") : a.slice(0, -1).join(", ") + " and " + a[a.length - 1];
function challengeCard(c) {
  const { played, waiting, top, winners } = challengeRows(c), me = Cloud.user.id, invited = c.my_status === "invited" && !c.finished;
  const from = (c.members || []).find(m => m.id === c.created_by), busy = chBusy.has(c.id) ? "disabled" : "";
  const status = c.finished
    ? (winners.length ? `🏆 ${esc(andList(winners.map(w => w.id === me ? "You" : w.name)))} ${winners.length > 1 ? "shared the win" : winners[0].id === me ? "won" : "won"}` : played.length > 1 ? "No winner: nobody won a bet" : "Nobody else joined")
    : timeLeft(c.ends_at);
  const row = (m, i) => {
    const t = tierOf(m), lead = !c.finished && m.score > 0 && m.score === top && played.length > 1, win = winners.some(w => w.id === m.id);
    return `<div class="ch-row ${m.id === me ? "mine" : ""}">
      <span class="ch-rank">${m.status === "accepted" ? (win ? "🏆" : lead ? "👑" : i + 1) : ""}</span>
      ${personAvatar(m.name, m.avatar_url, m.streak, t, 34)}
      <span class="ch-name">${m.id === me ? "<b>You</b>" : glowNameAs(m.name, t)}</span>
      <span class="ch-score">${m.status === "accepted" ? `<b>${m.score}</b><small>${m.score === 1 ? "win" : "wins"} in a row</small>` : `<small>Invited</small>`}</span></div>`;
  };
  return `<div class="glass ch-card ${c.finished ? "done" : ""} ${invited ? "invite" : ""}">
    <div class="ch-top"><div><div class="eyebrow">${invited ? `⚔️ ${from ? esc(from.name) : "A friend"} challenged you` : c.finished ? "Finished " + new Date(c.ends_at).toLocaleDateString(undefined, { day: "numeric", month: "short" }) : "Live"}</div>
      <h3>${esc(c.title)}</h3></div><span class="ch-status">${status}</span></div>
    <div class="ch-rows">${played.map(row).join("")}${waiting.map(m => row(m, 0)).join("")}</div>
    ${invited ? `<div class="row2" style="margin-top:12px"><button class="btn sec" data-chno="${c.id}" ${busy}>Decline</button><button class="btn" data-chyes="${c.id}" ${busy}>Accept</button></div>
      <div class="note" style="margin:8px 0 0">${timeLeft(c.ends_at)}. Bets you log from now on count once you accept.</div>` : ""}
  </div>`;
}
function renderChallenges() {
  if (localMode) { go("leaderboard"); return; }
  loadChallenges(4000); loadFriends();
  const list = challenges || [], invites = list.filter(c => c.my_status === "invited" && !c.finished);
  const live = list.filter(c => !c.finished && c.my_status === "accepted"), done = list.filter(c => c.finished && c.my_status === "accepted");
  const mates = (friends || []).filter(f => f.status === "accepted");
  $("#view").innerHTML = `${leadNav()}
    <div class="head" style="padding-top:18px"><div><div class="eyebrow">Longest run of wins</div><h1>Challenges</h1></div>
      ${mates.length ? `<button class="ghost" data-newch>⚔️ New</button>` : ""}</div>
    ${challengesErr ? `<div class="glass card"><div class="err" style="margin:0">${esc(challengesErr)}</div></div>` : ""}
    ${!challenges && !challengesErr ? `<div class="glass card"><div class="cap" style="margin:0">Loading your challenges…</div></div>` : ""}
    ${invites.map(challengeCard).join("")}
    ${live.length ? `<div class="section-h"><h2>Running</h2></div>${live.map(challengeCard).join("")}` : ""}
    ${challenges && !invites.length && !live.length ? `<div class="glass card fempty"><div class="soon-ic">⚔️</div><p>Challenge your friends to see who gets the longest run of wins in 3 days, a week or two weeks.</p>
      ${mates.length ? `<button class="btn" data-newch>Start a challenge</button>` : `<button class="btn sec" data-nav="friends">Find friends</button>`}</div>` : ""}
    ${done.length ? `<div class="section-h"><h2>Finished</h2></div>${done.map(challengeCard).join("")}` : ""}
    ${challenges ? `<div class="note" style="margin:12px 0 0;text-align:center">Only bets logged during a challenge, and settled before it ends, count. Your best run across all your trackers is your score, and a loss ends a run.</div>` : ""}`;
}
function openNewChallenge(preset) {
  const mates = (friends || []).filter(f => f.status === "accepted").sort((a, b) => a.display_name.localeCompare(b.display_name)), picked = new Set(preset ? [preset] : []);
  let days = 7;
  const sh = openSheet(`<h3>New challenge</h3><div class="sub">Whoever gets the longest run of wins by the end takes it. It starts as soon as you send it.</div>
    <div class="field"><label for="ncName">Name</label><input id="ncName" maxlength="40" value="Streak showdown"></div>
    <div class="field"><label>How long</label><div class="seg" id="ncDays">${[[3, "3 days"], [7, "1 week"], [14, "2 weeks"]].map(([d, n]) => `<button data-days="${d}" class="${d === days ? "on" : ""}">${n}</button>`).join("")}</div></div>
    <div class="field"><label>Who you're challenging</label></div>
    <div class="pick-people">${mates.map(f => `<label class="pick-person"><input type="checkbox" value="${f.id}" ${picked.has(f.id) ? "checked" : ""}>${personAvatar(f.display_name, f.avatar_url, f.streak, tierOf(f), 36)}<span>${glowNameAs(f.display_name, tierOf(f))}</span></label>`).join("")}</div>
    <div class="err" id="ncErr"></div><button class="btn" id="ncGo">Send challenge</button>`);
  const name = sh.querySelector("#ncName"), send = sh.querySelector("#ncGo");
  const update = () => {
    const n = picked.size;
    send.disabled = !n || n > 9 || !name.value.trim();
    send.textContent = !n ? "Pick a friend" : n > 9 ? "Up to 9 friends" : !name.value.trim() ? "Name the challenge" : `Challenge ${n === 1 ? mates.find(f => picked.has(f.id)).display_name : plural(n, "friend")}`;
  };
  sh.querySelectorAll("[data-days]").forEach(b => b.onclick = () => { days = Number(b.dataset.days); sh.querySelectorAll("[data-days]").forEach(x => x.classList.toggle("on", x === b)); });
  sh.querySelectorAll(".pick-person input").forEach(cb => cb.onchange = () => { cb.checked ? picked.add(cb.value) : picked.delete(cb.value); update(); });
  name.oninput = update; update();
  send.onclick = async () => {
    send.disabled = true; send.textContent = "Sending…";
    try { await Cloud.challengeCreate(name.value.trim(), [...picked], days); closeSheet(); toast("Challenge sent. Good luck! ⚔️"); if (state.page !== "challenges") go("challenges"); await loadChallenges(); }
    catch (x) { sh.querySelector("#ncErr").textContent = Cloud.nice(x); update(); }
  };
}
document.addEventListener("click", async e => {
  if (!state || !Cloud.user) return;
  const t = e.target;
  if (t.closest("[data-newch]")) return openNewChallenge();
  const y = t.closest("[data-chyes],[data-chno]"); if (!y) return;
  const id = Number(y.dataset.chyes || y.dataset.chno), accept = !!y.dataset.chyes;
  chBusy.add(id); renderChallenges();
  try { await Cloud.challengeRespond(id, accept); toast(accept ? "You're in. Good luck! ⚔️" : "Challenge declined."); }
  catch (x) { toast(Cloud.nice(x), "bad"); }
  chBusy.delete(id); loadChallenges();
});


/* ---------- Home Screen app: keep pages at least screen height ---------- */
// iOS puts the bottom bar too high on pages shorter than the screen in the Home Screen app.
function fitScreen() {
  const standalone = navigator.standalone || matchMedia("(display-mode: standalone)").matches;
  document.documentElement.style.setProperty("--screen-h", standalone && innerHeight > innerWidth ? screen.height + "px" : "0px");
}
fitScreen();
addEventListener("resize", fitScreen);

/* ---------- Bet slip photos ----------
   The screenshot used to fill in a bet is kept with it, so it can be opened again from History.
   Signed-in accounts only, since the photo is stored with the account. Once attached it can't be swapped. */
async function attachSlip(b, file) {
  if (localMode || !Cloud.user || b.slip) return false;
  try {
    const { blob } = await shrinkPhoto(file);
    const path = await Cloud.uploadSlip(blob);
    // The state may have been reloaded while the photo uploaded, so find the bet again by id.
    for (const t of state.trackers) { const x = t.bets.find(y => y.id === b.id); if (x && !x.slip) x.slip = path; }
    b.slip = path; save();
    if (!scrim) render();
    return true;
  } catch (x) { toast("Couldn't save the slip photo. Your bet is still logged.", "bad"); return false; }
}
function slipHTML(b) {
  if (b.slip) return `<button class="slip" data-photo="${esc(b.slip)}" aria-label="Open bet slip"><img data-media="${esc(b.slip)}" alt=""><span><b>🧾 Bet slip</b><small>Tap to view</small></span></button>`;
  if (localMode || !Cloud.user) return "";
  return `<button class="btn sec slip-add" data-slipadd>🧾 Add bet slip photo</button><input type="file" accept="image/*" id="slipFile" hidden>`;
}
function wireSlip(sh, t, b) {
  const img = sh.querySelector(".slip img");
  if (img) Cloud.mediaUrl(img.dataset.media).then(u => { img.src = u; }).catch(() => img.closest(".slip").classList.add("broken"));
  const add = sh.querySelector("[data-slipadd]"), f = sh.querySelector("#slipFile");
  if (!add) return;
  add.onclick = () => f.click();
  f.onchange = async () => {
    const file = f.files && f.files[0]; f.value = "";
    if (!file) return;
    add.disabled = true; add.textContent = "Saving slip…";
    const ok = await attachSlip(b, file);
    if (!sh.isConnected) return;
    if (ok) { closeSheet(); openBet(t, b.id); } else { add.disabled = false; add.textContent = "🧾 Add bet slip photo"; }
  };
}

/* ---------- "Typing…" ----------
   While the open chat's composer has text, a ping goes out every few seconds over a private live channel
   for that chat (nothing is saved). A bubble shows who is typing and fades if their pings stop. */
const typers = new Map(); // person id -> when their bubble expires
let typingSentAt = 0, typingOn = false, typingTick = null;
function typingTopic(id) { return isGroup(id) ? "typing:g:" + gidOf(id) : "typing:dm:" + [Cloud.user.id, id].sort().join(":"); }
function syncTyping() {
  const want = state && state.page === "chat" && chatWith ? typingTopic(chatWith) : null;
  if (want === Cloud.typingTopic()) return;
  typers.clear(); typingOn = false; typingSentAt = 0;
  if (want) Cloud.typingJoin(want, p => {
    if (!p || !p.id) return;
    if (p.on) typers.set(p.id, Date.now() + 6000); else typers.delete(p.id);
    paintTyping();
  }); else Cloud.typingLeave();
}
function typingPing(on) {
  if (!chatWith) return;
  const now = Date.now();
  if (on && typingOn && now - typingSentAt < 2500) return;
  if (!on && !typingOn) return;
  typingOn = on; typingSentAt = now; Cloud.typingSend(on);
}
function typingLine() {
  const now = Date.now();
  for (const [id, until] of typers) if (until < now) typers.delete(id);
  if (!typers.size || !chatWith) return "";
  const g = isGroup(chatWith) && groupOf(chatWith);
  const names = [...typers.keys()].map(id => g ? ((g.members || []).find(m => m.id === id) || {}).name : (chatPartner(id) || {}).display_name).filter(Boolean);
  const who = !isGroup(chatWith) ? (names[0] || "Typing") : names.length > 2 ? "Several people" : names.length ? names.join(" and ") : "Someone";
  return `<span class="tdots"><i></i><i></i><i></i></span><span>${esc(who)} ${!isGroup(chatWith) || names.length === 1 ? "is" : "are"} typing</span>`;
}
function paintTyping() {
  const el = $("#typing"); if (!el) return;
  const html = typingLine(); el.innerHTML = html; el.hidden = !html;
  clearInterval(typingTick); typingTick = html ? setInterval(paintTyping, 1000) : null;
}

/* ---------- Deleting ----------
   A pending bet can be deleted; settled bets stay. A whole tracker can be deleted with everything on it.
   The database checks the same rules. */
const canDelBet = b => b.result === "pending";
async function cloudDelete(fn) {
  if (localMode || !Cloud.user) return true;
  try { await Cloud.flush(); await fn(); return true; } catch (x) { toast(Cloud.nice(x), "bad"); return false; }
}
function delBetHTML(b) {
  if (!canDelBet(b)) return "";
  return `<button class="btn warn" id="eDel" style="margin-top:8px">🗑 Delete this bet</button><div class="note" style="margin:6px 0 0">Pending bets can be deleted. Once settled, a bet stays on your record.</div>`;
}
function wireDelBet(sh, t, b) {
  const btn = sh.querySelector("#eDel"); if (!btn) return;
  let armed = false;
  btn.onclick = async () => {
    if (!armed) { armed = true; btn.textContent = "Tap again to delete it for good"; return; }
    btn.disabled = true;
    if (!(await cloudDelete(() => Cloud.deleteBet(b.id)))) { btn.disabled = false; return; }
    t.bets = t.bets.filter(x => x.id !== b.id);
    save(); closeSheet(); render(); toast("Bet deleted.");
  };
}
function delTrackerHTML(t) {
  return `<h4>Delete</h4><button class="btn warn" id="delTracker">🗑 Delete this tracker</button>
    <div class="note" style="margin:8px 0 0">Removes ${esc(t.name)} and its ${plural(t.bets.length, "bet")} for good, including from friends' feeds and leaderboards.</div>`;
}
function dropTrackers(ids) {
  state.trackers = state.trackers.filter(t => !ids.includes(t.id));
  if (!state.trackers.length) state.trackers.push(newTracker(1));
  if (!state.trackers.some(t => t.id === state.activeId)) state.activeId = state.trackers[0].id;
}
function wireDelTracker(sh, t) {
  const btn = sh.querySelector("#delTracker"); if (!btn) return;
  let armed = false;
  btn.onclick = async () => {
    if (!armed) { armed = true; btn.textContent = `Tap again to delete ${t.name} for good`; return; }
    btn.disabled = true;
    if (!(await cloudDelete(() => Cloud.deleteTracker(t)))) { btn.disabled = false; return; }
    dropTrackers([t.id]);
    save(); closeSheet(); render(); toast(`${t.name} deleted.`);
  };
}

/* =========================================================
   Boot
   ========================================================= */
Cloud.onStatus = (s, msg) => {
  syncState = s; if (!state) return;
  const d = $("#meBtn .sync-dot"); if (d) d.className = "sync-dot " + s;
  const st = $("#syncText"); if (st) st.textContent = syncLabel();
  if (s === "error" && msg) toast(msg, "bad");
};
// The server refused a change (a locked bet, say). Reload the account's real data.
Cloud.onRejected = async () => { try { const s = await Cloud.load(); if (s && state) { const ui = { page: state.page, activeId: state.activeId }; state = normalise(s); Object.assign(state, ui); Cloud.writeCache(state, false); render(); } } catch (e) {} };
// Coming back to the app pulls changes made on another device.
async function refreshFromServer() {
  if (!state || localMode || scrim || Cloud.pending()) return;
  try {
    const s = await Cloud.fetchAll(); if (!s || scrim || Cloud.pending()) return;
    const cur = JSON.stringify(state.trackers);
    const ui = { page: state.page, activeId: state.activeId }; Cloud.prime(s);
    const next = normalise(s); Object.assign(next, ui);
    if (!next.trackers.some(t => t.id === next.activeId)) next.activeId = next.trackers[0].id;
    if (JSON.stringify(next.trackers) !== cur || next.skin !== state.skin) { state = next; render(); } else state = next;
  } catch (e) {}
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") refreshFromServer(); });
setInterval(() => { if (state && !scrim && (state.page === "home" || state.page === "stats")) renderTabs(); }, 60000);
(async () => {
  if (!Cloud.configured) return renderSetupNeeded();
  Cloud.onAuth((event, user) => {
    if (event === "PASSWORD_RECOVERY") openNewPassword();
    else if (event === "SIGNED_IN" && user && !state) startSignedIn();
    else if (event === "SIGNED_OUT" && state) { state = null; me = null; renderAuth("login", "You're logged out."); }
  });
  if (await Cloud.currentUser()) startSignedIn(); else if (!starting) renderAuth();
})();
})();
