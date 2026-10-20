/* =========================================================
   Cloud: Supabase sign-in, profiles, photo uploads and syncing.
   The app keeps working on one plain "state" object, exactly as before.
   This file turns that object into database rows, and only sends the
   rows that changed since the last successful sync.
   ========================================================= */
(() => {
"use strict";

const cfg = window.STREAK_CONFIG || {};
const configured = !!(cfg.supabaseUrl && cfg.supabaseAnonKey && !/YOUR-|PASTE/i.test(cfg.supabaseUrl + cfg.supabaseAnonKey));
// Tests can swap in a stand-in client; real use always goes through supabase.createClient.
const sb = !configured ? null : window.__mockSupabase || window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

let user = null;            // the signed-in Supabase user
let synced = new Map();     // "table:id" → JSON of the row as the server last confirmed it
let timer = null, running = null, again = false;
let onStatus = () => {}, onRejected = () => {};

const cacheKey = () => "streak-charger.cloud." + (user ? user.id : "anon");
const nice = e => {
  const m = (e && (e.message || e.error_description || e.msg)) || String(e || "Something went wrong");
  if (/Invalid login credentials/i.test(m)) return "That email and password don't match an account.";
  if (/Email not confirmed/i.test(m)) return "Confirm your email first. Check your inbox for the link.";
  if (/User already registered/i.test(m)) return "There's already an account with that email. Try logging in.";
  if (/Database error saving new user/i.test(m)) return "That display name was just taken. Try another.";
  if (/Password should be at least/i.test(m)) return "Use a password of at least 6 characters.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Can't reach the server. Check your connection.";
  if (/profiles_display_name_unique|duplicate key/i.test(m)) return "That display name is taken.";
  if (/Could not find the function|schema cache|does not exist/i.test(m)) return "The database needs updating: run schema.sql again in the Supabase SQL Editor.";
  return m;
};
const must = ({ data, error }) => { if (error) throw error; return data; };

/* ---------- Rows ↔ state ---------- */
const SETTINGS_KEYS = ["skin", "recentSports", "achievements", "bestStreak", "statsLayout", "planner"];
function rowsFor(state) {
  const rows = [];
  state.trackers.forEach((t, i) => {
    rows.push(["trackers", t.id, { id: t.id, name: t.name, accent: t.accent, start_balance: t.start, target: t.target, odds_mode: t.oddsMode,
      fixed_odds: t.fixedOdds, paused: !!t.paused, target_edits: t.targetEdits || [], position: i, created_at: Math.round(t.createdAt) }]);
    for (const b of t.bets) rows.push(["bets", b.id, { id: b.id, tracker_id: t.id, odds: b.odds, sport: b.sport, text: b.text, link: b.link || "",
      result: b.result, created_at: Math.round(b.createdAt), settled_at: b.settledAt ? Math.round(b.settledAt) : null, edits: b.edits || [] }]);
    for (const a of t.actions) { const { id, type, at, ...payload } = a; rows.push(["tracker_actions", id, { id, tracker_id: t.id, type, at: Math.round(at), payload }]); }
  });
  const data = {}; for (const k of SETTINGS_KEYS) if (state[k] !== undefined) data[k] = state[k];
  rows.push(["user_settings", "me", { data }]);
  return rows;
}
function stateFrom(trackers, bets, actions, settings) {
  if (!trackers.length) return null;
  const byT = new Map(trackers.sort((a, b) => a.position - b.position || a.created_at - b.created_at).map(r => [r.id, {
    id: r.id, name: r.name, accent: r.accent, start: r.start_balance, target: r.target, oddsMode: r.odds_mode, fixedOdds: r.fixed_odds,
    paused: r.paused, targetEdits: r.target_edits || [], createdAt: Number(r.created_at), bets: [], actions: [] }]));
  bets.sort((a, b) => a.created_at - b.created_at || (a.id < b.id ? -1 : 1)).forEach(r => { const t = byT.get(r.tracker_id); if (t) t.bets.push({
    id: r.id, odds: r.odds, sport: r.sport, text: r.text, link: r.link || "", result: r.result, createdAt: Number(r.created_at),
    settledAt: r.settled_at == null ? null : Number(r.settled_at), edits: r.edits || [] }); });
  actions.sort((a, b) => a.at - b.at).forEach(r => { const t = byT.get(r.tracker_id); if (t) t.actions.push({ id: r.id, type: r.type, at: Number(r.at), ...(r.payload || {}) }); });
  return { trackers: [...byT.values()], ...((settings && settings.data) || {}) };
}

/* ---------- Merging (offline edits, imports) ----------
   Union by id. Rows only one side has are kept. For rows both sides have, `prefer`
   decides: "a" keeps the first state's copy (used for imports, where the account wins),
   "b" keeps the second's (used for unsynced edits made on this device). */
function merge(a, b, prefer = "a") {
  if (!a) return b; if (!b) return a;
  const out = JSON.parse(JSON.stringify(a));
  for (const tb of b.trackers) {
    let ta = out.trackers.find(t => t.id === tb.id);
    if (!ta) { out.trackers.push(JSON.parse(JSON.stringify(tb))); continue; }
    if (prefer === "b") Object.assign(ta, { ...tb, bets: ta.bets, actions: ta.actions });
    for (const key of ["bets", "actions"]) for (const x of tb[key]) {
      const i = ta[key].findIndex(y => y.id === x.id);
      if (i < 0) ta[key].push(JSON.parse(JSON.stringify(x))); else if (prefer === "b") ta[key][i] = JSON.parse(JSON.stringify(x));
    }
    ta.bets.sort((x, y) => x.createdAt - y.createdAt); ta.actions.sort((x, y) => x.at - y.at);
  }
  // Settings: achievements keep the earliest unlock, best streak keeps the max, the rest follow `prefer`.
  const ach = { ...(b.achievements || {}) }; for (const [k, v] of Object.entries(a.achievements || {})) ach[k] = ach[k] ? Math.min(ach[k], v) : v;
  out.achievements = ach; out.bestStreak = Math.max(a.bestStreak || 0, b.bestStreak || 0);
  for (const k of ["skin", "recentSports", "statsLayout", "planner"]) if (out[k] === undefined || (prefer === "b" && b[k] !== undefined)) out[k] = b[k];
  return out;
}

/* ---------- Auth ---------- */
async function currentUser() { if (!sb) return null; const { data } = await sb.auth.getSession(); user = data && data.session ? data.session.user : null; return user; }
function onAuth(cb) { if (sb) sb.auth.onAuthStateChange((event, session) => { user = session ? session.user : null; cb(event, user); }); }
async function nameAvailable(name) { return must(await sb.rpc("name_available", { name })); }
async function signUp(email, password, displayName) {
  const data = must(await sb.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: location.origin + location.pathname } }));
  user = data.session ? data.user : null;
  return { needsConfirm: !data.session };
}
async function signIn(email, password) { const data = must(await sb.auth.signInWithPassword({ email, password })); user = data.user; return user; }
async function resetPassword(email) { must(await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname })); }
async function setPassword(password) { must(await sb.auth.updateUser({ password })); }
async function signOut() { await flush().catch(() => {}); offChat(); try { localStorage.removeItem(cacheKey()); } catch (e) {} await sb.auth.signOut(); user = null; synced = new Map(); }

/* ---------- Profile ---------- */
async function getProfile() { return must(await sb.from("profiles").select("*").eq("id", user.id).maybeSingle()); }
async function updateProfile(patch) { return must(await sb.from("profiles").update(patch).eq("id", user.id).select().maybeSingle()); }
// Photos are squared, shrunk to 512px and saved as JPEG before upload, so they stay small.
async function uploadAvatar(file, oldUrl) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("That file isn't an image we can read.")); i.src = URL.createObjectURL(file); });
  const side = Math.min(img.naturalWidth, img.naturalHeight), size = Math.min(512, side);
  const cv = document.createElement("canvas"); cv.width = cv.height = size;
  cv.getContext("2d").drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
  URL.revokeObjectURL(img.src);
  const blob = await new Promise(res => cv.toBlob(res, "image/jpeg", .86));
  const path = `${user.id}/avatar-${Date.now()}.jpg`;
  must(await sb.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", cacheControl: "31536000" }));
  const url = sb.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const prof = await updateProfile({ avatar_url: url });
  const m = oldUrl && oldUrl.match(/\/avatars\/(.+)$/);
  if (m) sb.storage.from("avatars").remove([decodeURIComponent(m[1])]).catch(() => {});
  return prof;
}

/* ---------- Friends (every change goes through a database function that checks it) ---------- */
const rpc = async (fn, args) => must(await sb.rpc(fn, args));
const searchProfiles = q => rpc("search_profiles", { q });
const myFriends = () => rpc("my_friends");
const friendRequest = id => rpc("friend_request", { target: id });
const friendRespond = (id, accept) => rpc("friend_respond", { other: id, accept });
const friendRemove = id => rpc("friend_remove", { other: id });
const leaderboard = (scope, metric) => rpc("leaderboard", { scope, metric, lim: 50 });

/* ---------- Chat ---------- */
const myChats = () => rpc("my_chats");
const chatMessages = (other, beforeId) => rpc("chat_messages", { other, before_id: beforeId || null, lim: 60 });
const chatMarkRead = other => rpc("chat_mark_read", { other });
const chatReact = (msg, emoji) => rpc("chat_react", { msg, emoji });
const myGroups = () => rpc("my_groups");
const groupMessages = (g, beforeId) => rpc("group_chat_messages", { g, before_id: beforeId || null, lim: 60 });
const groupMarkRead = g => rpc("group_mark_read", { g });
const groupReact = (msg, emoji) => rpc("group_react", { msg, emoji });
const groupCreate = (name, members) => rpc("group_create", { name, members });
const groupAdd = (g, target) => rpc("group_add", { g, target });
const groupRename = (g, name) => rpc("group_rename", { g, name });
const groupLeave = g => rpc("group_leave", { g });
const groupPeople = g => rpc("group_people", { g });
const myChallenges = () => rpc("my_challenges");
const challengeCreate = (title, members, days) => rpc("challenge_create", { title, members, days });
const challengeRespond = (c, accept) => rpc("challenge_respond", { c, accept });
const challengeWins = uid => rpc("challenge_wins", { uid });
const feed = (beforeAt, beforeKey) => rpc("feed", { before_at: beforeAt || null, before_key: beforeKey || null, lim: 30 });
const feedReact = (kind, ref, emoji) => rpc("feed_react", { kind, ref, emoji });
// media, when given, is { path, kind: "photo" | "voice", meta } from uploadChatMedia.
const mediaCols = m => m ? { media_path: m.path, media_kind: m.kind, media_meta: m.meta || {} } : {};
async function sendMessage(other, body, betId, media) {
  if (betId) await flush(); // a shared bet has to reach the server before a message can point at it
  return must(await sb.from("messages").insert({ recipient: other, body: body || "", bet_id: betId || null, ...mediaCols(media) }).select("id").single());
}
async function sendGroupMessage(g, body, betId, media) {
  if (betId) await flush();
  return must(await sb.from("group_messages").insert({ group_id: g, body: body || "", bet_id: betId || null, ...mediaCols(media) }).select("id").single());
}
// Photos and voice notes go into your own folder of the private "chat-media" bucket, then a
// message points at the file. Opening one takes a signed link that works for an hour.
async function uploadChatMedia(blob, ext, type) {
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, "0")).join("");
  const path = `${user.id}/${rand}.${ext}`;
  must(await sb.storage.from("chat-media").upload(path, blob, { contentType: type, cacheControl: "31536000" }));
  return path;
}
const mediaLinks = new Map();
async function mediaUrl(path) {
  const hit = mediaLinks.get(path); if (hit && hit.until > Date.now()) return hit.url;
  const url = must(await sb.storage.from("chat-media").createSignedUrl(path, 3600)).signedUrl;
  mediaLinks.set(path, { url, until: Date.now() + 50 * 60000 });
  return url;
}
// Live updates for new messages and reactions. The database only sends rows this account may read.
let chatChannel = null;
function onChat(cb) {
  if (chatChannel || !sb.channel || !user) return;
  try {
    chatChannel = sb.channel("chat-" + user.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, p => cb("message", p.new))
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages" }, p => cb("read", p.new))
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, p => cb("reaction", p.new || p.old))
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "group_messages" }, p => cb("gmessage", p.new))
      .on("postgres_changes", { event: "*", schema: "public", table: "group_reactions" }, p => cb("greaction", p.new || p.old))
      .subscribe();
  } catch (e) { chatChannel = null; }
}
function offChat() { if (chatChannel) { try { sb.removeChannel(chatChannel); } catch (e) {} chatChannel = null; } }

/* ---------- Loading ---------- */
async function fetchAll() {
  const [trackers, bets, actions, settings] = await Promise.all([
    sb.from("trackers").select("*").then(must), sb.from("bets").select("*").then(must),
    sb.from("tracker_actions").select("*").then(must), sb.from("user_settings").select("*").eq("user_id", user.id).maybeSingle().then(must),
  ]);
  return stateFrom(trackers, bets, actions, settings);
}
// Loads the account's data and remembers it as the synced baseline.
async function load() { const s = await fetchAll(); prime(s); return s; }
function prime(s) { synced = new Map(); if (s) for (const [tb, id, row] of rowsFor(s)) synced.set(tb + ":" + id, JSON.stringify(row)); }

/* ---------- Device cache (works offline, survives reloads before a sync lands) ---------- */
function readCache() { try { return JSON.parse(localStorage.getItem(cacheKey()) || "null"); } catch (e) { return null; } }
function writeCache(state, dirty) { try { localStorage.setItem(cacheKey(), JSON.stringify({ state, dirty, at: Date.now() })); } catch (e) {} }

/* ---------- Saving ---------- */
// Your profile's streak, tier and banked total are worked out by the database from these rows.
let latest = null;
function queue(state) {
  latest = state;
  writeCache(state, true);
  clearTimeout(timer); timer = setTimeout(flush, 500);
}
async function flush() {
  clearTimeout(timer);
  if (!latest || !user) return;
  if (running) { again = true; return running; }
  running = (async () => {
    const rows = rowsFor(latest), changed = { trackers: [], bets: [], tracker_actions: [], user_settings: [] };
    for (const [tb, id, row] of rows) { const j = JSON.stringify(row); if (synced.get(tb + ":" + id) !== j) changed[tb].push([id, row, j]); }
    const total = Object.values(changed).reduce((a, x) => a + x.length, 0);
    try {
      if (total) onStatus("saving");
      // Trackers first, because bets and actions point at them.
      if (changed.trackers.length) must(await sb.from("trackers").upsert(changed.trackers.map(x => x[1]), { onConflict: "id" }));
      if (changed.bets.length) must(await sb.from("bets").upsert(changed.bets.map(x => x[1]), { onConflict: "id" }));
      // Actions are a permanent record: new ones are added, existing ones are never rewritten.
      if (changed.tracker_actions.length) must(await sb.from("tracker_actions").upsert(changed.tracker_actions.map(x => x[1]), { onConflict: "id", ignoreDuplicates: true }));
      if (changed.user_settings.length) must(await sb.from("user_settings").upsert({ user_id: user.id, ...changed.user_settings[0][1] }, { onConflict: "user_id" }));
      for (const tb in changed) for (const [id, , j] of changed[tb]) synced.set(tb + ":" + id, j);
      writeCache(latest, false);
      if (total) onStatus("saved");
    } catch (e) {
      const offline = /Failed to fetch|NetworkError|Load failed|fetch/i.test(String(e && e.message));
      onStatus(offline ? "offline" : "error", nice(e));
      // The server refused a change (for example a locked bet). Put the account's real data back.
      if (!offline) { latest = null; writeCache(readCache()?.state || null, false); onRejected(nice(e)); }
    }
  })();
  try { await running; } finally { running = null; if (again) { again = false; flush(); } }
}
const pending = () => !!(timer || running || (readCache() || {}).dirty);
addEventListener("online", () => latest && flush());
addEventListener("pagehide", () => { if (latest) flush(); });

window.Cloud = { configured, currentUser, onAuth, nameAvailable, signUp, signIn, signOut, resetPassword, setPassword,
  getProfile, updateProfile, uploadAvatar, searchProfiles, myFriends, friendRequest, friendRespond, friendRemove, leaderboard, myChats, chatMessages, chatMarkRead, chatReact, feed, feedReact, sendMessage, uploadChatMedia, mediaUrl, myGroups, groupMessages, groupMarkRead, groupReact, groupCreate, groupAdd, groupRename, groupLeave, groupPeople, sendGroupMessage, myChallenges, challengeCreate, challengeRespond, challengeWins, onChat, offChat, load, fetchAll, prime, merge, readCache, writeCache, queue, flush, pending, nice,
  get user() { return user; }, set onStatus(f) { onStatus = f; }, set onRejected(f) { onRejected = f; } };
})();
