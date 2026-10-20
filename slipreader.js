/* Pipe Dream bet-slip reader. Reads a screenshot on the phone itself with Tesseract
   (files in ocr/, loaded on first use), then picks out the odds, stake, sport and selection
   with plain rules. Nothing is uploaded anywhere. */
(function () {
  "use strict";

  /* ---------- Sport hints: [sport, weight, words] ---------- */
  // League names and sport-only market words weigh most; team nicknames weigh 1 because
  // several are shared between sports (Bulldogs, Tigers, Eagles, Warriors...).
  const HINTS = [
    ["Rugby League", 5, "nrl|state of origin|super league|rugby league"],
    ["Rugby League", 3, "try ?scorer|first try|anytime try|wests tigers|sea eagles|canterbury|south sydney|rabbitohs|parramatta|cronulla|penrith|manly|st george|dolphins"],
    ["Rugby League", 1, "storm|broncos|roosters|panthers|sharks|eels|raiders|knights|cowboys|titans|dragons|warriors|bulldogs"],
    ["AFL", 5, "afl|aussie rules"],
    ["AFL", 3, "disposals|behinds|western bulldogs|north melbourne|port adelaide|gws|greater western sydney|collingwood|essendon|fremantle|geelong|richmond|carlton|hawthorn|st kilda"],
    ["AFL", 1, "crows|lions|blues|magpies|bombers|dockers|cats|suns|giants|hawks|demons|kangaroos|power|tigers|saints|swans|eagles|bulldogs"],
    ["Soccer", 5, "epl|premier league|a-league|la liga|serie a|bundesliga|champions league|ligue 1|mls"],
    ["Soccer", 3, "goalscorer|goal scorer|both teams to score|btts|1x2|clean sheet|corners|arsenal|chelsea|liverpool|man city|man utd|manchester|tottenham|everton|newcastle|aston villa|west ham|brighton|real madrid|barcelona|bayern|juventus|psg|inter milan|ac milan|sydney fc|melbourne victory|melbourne city|wellington phoenix"],
    ["Soccer", 1, "draw|spurs|united|city|fc"],
    ["Basketball", 5, "nba|nbl|wnba|basketball"],
    ["Basketball", 3, "rebounds|assists|3-pointers|three pointers|lakers|celtics|knicks|76ers|sixers|bucks|nuggets|mavericks|clippers|rockets|timberwolves|pelicans|grizzlies|pistons|pacers|cavaliers|raptors|wizards|hornets|trail blazers|golden state"],
    ["Basketball", 1, "warriors|bulls|heat|nets|suns|spurs|thunder|kings|jazz|magic|hawks|points"],
    ["Cricket", 5, "cricket|ipl|bbl|big bash|t20|odi|test match|sheffield shield"],
    ["Cricket", 3, "wickets|top batter|top bowler|top run ?scorer|innings runs|sixes|most sixes|century|strikers|scorchers|sixers|stars|renegades|heat|thunder|hurricanes"],
    ["Tennis", 5, "tennis|atp|wta|wimbledon|roland garros|australian open|us open"],
    ["Tennis", 3, "set betting|sets handicap|games handicap|total games|tie ?break|first set"],
    ["American Football", 5, "nfl|ncaaf|college football"],
    ["American Football", 3, "touchdown|td scorer|passing yards|rushing yards|receiving yards|chiefs|49ers|patriots|packers|ravens|steelers|commanders|seahawks|vikings|bengals|texans|chargers|colts|jaguars|falcons|buccaneers|browns|bills"],
    ["American Football", 1, "broncos|raiders|dolphins|jets|giants|titans|saints|panthers|cardinals|rams|lions|bears|eagles|cowboys"],
    ["Baseball", 5, "mlb|baseball"],
    ["Baseball", 3, "run line|runline|home run|strikeouts|yankees|dodgers|red sox|mets|cubs|astros|braves|phillies|padres|mariners|blue jays|orioles|guardians|brewers|twins|white sox|diamondbacks|rockies|marlins|nationals|pirates|royals|angels"],
    ["Baseball", 1, "reds|tigers|athletics|rangers|rays|giants"],
    ["Ice Hockey", 5, "nhl|ice hockey"],
    ["Ice Hockey", 3, "puck ?line|bruins|maple leafs|canadiens|blackhawks|penguins|red wings|oilers|flames|canucks|avalanche|lightning|capitals|islanders|golden knights|kraken|predators|blue jackets|sabres|senators|devils|flyers"],
    ["Ice Hockey", 1, "hurricanes|ducks|sharks|stars|wild|rangers|kings|jets|blues"],
    ["MMA", 5, "ufc|mma|bellator|pfl"],
    ["MMA", 2, "method of victory|submission|by ko|ko/tko|tko|round betting|go the distance"],
    ["Boxing", 5, "boxing|wbc|wba|ibf|wbo"],
    ["Boxing", 2, "points decision|by ko|ko/tko|round betting|go the distance"],
    ["Horse Racing", 5, "horse racing|thoroughbred|gallops"],
    ["Horse Racing", 3, "jockey|trainer|barrier|each way|win/place|win & place|place only|race \\d+|r\\d+ |randwick|flemington|caulfield|rosehill|moonee valley|eagle farm|doomben|morphettville|ascot|melbourne cup|cox plate"],
    ["Greyhound Racing", 5, "greyhound|greyhounds|the dogs"],
    ["Greyhound Racing", 3, "box \\d|wentworth park|sandown park|the meadows"],
    ["Harness Racing", 5, "harness|trots|trotting|pacing"],
    ["Formula 1", 5, "formula 1|formula one|f1|grand prix"],
    ["Formula 1", 3, "verstappen|hamilton|leclerc|norris|piastri|russell|sainz|alonso|pole position|fastest lap|podium finish"],
    ["Golf", 5, "golf|pga|liv golf|the masters|us pga|dp world"],
    ["Golf", 3, "top 5 finish|top 10 finish|top 20 finish|make the cut|first round leader|tournament winner|hole in one"],
    ["Darts", 5, "darts|pdc"],
    ["Darts", 3, "180s|most 180s|checkout"],
    ["Snooker", 5, "snooker"],
    ["Esports", 5, "esports|cs2|csgo|counter-strike|league of legends|dota|valorant"],
    ["Netball", 5, "netball|super netball"],
    ["Politics", 5, "election|prime minister|president"],
  ].map(([sport, w, words]) => ({ sport, w, re: new RegExp("(?:^|[^a-z0-9])(?:" + words + ")(?![a-z0-9])", "gi") }));

  function guessSport(text) {
    const score = {};
    HINTS.forEach(h => { const m = text.match(h.re); if (m) score[h.sport] = (score[h.sport] || 0) + h.w * Math.min(m.length, 2); });
    let best = null;
    Object.keys(score).forEach(s => { if (!best || score[s] > score[best]) best = s; });
    return best && score[best] >= 2 ? best : null;
  }

  /* ---------- Numbers ---------- */
  const CUR = "[$£€]|AUD|USD|NZD|GBP|EUR|A\\$|NZ\\$";
  const MONEY_RE = new RegExp("(?:" + CUR + ")\\s?(\\d{1,3}(?:,\\d{3})+(?:\\.\\d{1,2})?|\\d+(?:\\.\\d{1,2})?)", "i");
  const STAKE_RE = /\b(stake|staked|wager|bet amount|total stake|risk|amount)\b/i;
  const RETURN_RE = /\b(returns?|payout|pays|collect|potential return|est\.? return|estimated return|to return)\b/i;
  const PROFIT_RE = /\b(to win|profit|potential win|winnings)\b/i;
  const MULTI_RE = /\b(multi|multis|parlay|accumulator|acca|same game|sgm|sgp|treble|trixie|\d+\s*-?\s*legs?|\d+\s*-?\s*fold)\b/i;
  const ODDS_KEY_RE = /\b(total odds|combined odds|multi odds|parlay odds|odds|price)\b/i;
  const WIN_MKT_RE = /\b(head to head|h2h|match result|moneyline|money line|match winner|match betting|winner|to win|win)\b/i;
  const NOISE_RE = /^(bet ?slip|my bets|open bets|pending|placed|bet placed|receipt|single|singles|cash ?out|share|reuse|bet id|ticket|ref|reference|status|unsettled|active|back|done|close|ok)\b/i;

  const money = line => { const m = line.match(MONEY_RE); return m ? Number(m[1].replace(/,/g, "")) : null; };
  // A value on a labelled line, or on the line just after a label that stands alone.
  function labelled(lines, re, skip) {
    for (let i = 0; i < lines.length; i++) {
      if (!re.test(lines[i]) || (skip && skip.test(lines[i]))) continue;
      const v = money(lines[i]) ?? (lines[i + 1] ? money(lines[i + 1]) : null);
      if (v > 0) return v;
    }
    return null;
  }

  // Every odds-looking number on a line: decimal, fractional, American and "Evens".
  function oddsIn(line) {
    const out = [];
    const clean = line.replace(new RegExp("(?:" + CUR + ")\\s?\\d[\\d,]*(?:\\.\\d+)?", "gi"), " ");
    let m;
    const dec = /(^|[^\d.+\-\/:])(\d{1,3}\.\d{2,3})(?![\d.%\/:])/g;
    while ((m = dec.exec(clean))) { const v = Number(m[2]); if (v > 1 && v < 1001) out.push(v); }
    const frac = /(^|[^\d\/.])(\d{1,3})\/(\d{1,3})(?![\d\/])/g;
    while ((m = frac.exec(clean))) { const a = +m[2], b = +m[3]; if (a > 0 && b > 0 && b <= 100) out.push(1 + a / b); }
    const amer = /(^|[\s(@])([+-])(\d{3,4})(?![\d.])/g;
    while ((m = amer.exec(clean))) { const n = +m[3]; if (n >= 100) out.push(m[2] === "+" ? 1 + n / 100 : 1 + 100 / n); }
    if (/\b(evens|evs|even money)\b/i.test(clean)) out.push(2);
    return out;
  }

  function cleanSelection(s) {
    return s.replace(new RegExp("(?:" + CUR + ")\\s?\\d[\\d,]*(?:\\.\\d+)?", "gi"), " ")
      .replace(/@\s*\d+(\.\d+)?/g, " ")
      .replace(/(^|\s)(\d{1,3}\.\d{2,3}|\d{1,3}\/\d{1,3}|[+-]\d{3,4})(?=\s|$)/g, " ")
      .replace(/\b(odds|price|single|selection|win|to win|head to head|h2h|match result|match winner|match betting|moneyline|money line)\b:?/gi, " ")
      .replace(/[|•·®©™»«<>{}\[\]_=~*#^]/g, " ")
      .replace(/\s+/g, " ").trim().replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9)]+$/g, "");
  }
  const round = v => Math.round(v * 1000) / 1000;
  const near = (a, b) => Math.abs(a - b) / b < 0.03;

  function parseSlip(raw) {
    const text = String(raw || "").replace(/\r/g, "").replace(/(\d)\s?[,](\d{2})(?!\d)(?![^\n]*[$£€])/g, "$1.$2").replace(/(\d)[oO](\d)/g, "$10$2");
    const lines = text.split("\n").map(l => l.replace(/\s+/g, " ").trim()).filter(Boolean);
    const multi = MULTI_RE.test(text);
    const stake = labelled(lines, STAKE_RE, /total odds/i);
    let ret = labelled(lines, RETURN_RE);
    if (ret == null && stake) { const p = labelled(lines, PROFIT_RE); if (p != null) ret = stake + p; }
    const ratio = stake > 0 && ret > stake ? ret / stake : null;

    // Collect candidates, skipping lines that are about money.
    const cands = [];
    lines.forEach((l, i) => {
      if (STAKE_RE.test(l) || RETURN_RE.test(l) || PROFIT_RE.test(l) && MONEY_RE.test(l)) return;
      const key = ODDS_KEY_RE.test(l) || /@/.test(l);
      const total = /\b(total|combined|multi|parlay)\b/i.test(l) && ODDS_KEY_RE.test(l);
      let vals = oddsIn(l);
      if (!vals.length && key && lines[i + 1] && !MONEY_RE.test(lines[i + 1])) vals = oddsIn(lines[i + 1]);
      vals.forEach(v => cands.push({ v, i, key, total }));
    });

    let odds = null;
    const totals = cands.filter(c => c.total);
    if (totals.length) odds = totals[totals.length - 1].v;
    else if (ratio) {
      const hit = cands.find(c => near(c.v, ratio));
      odds = hit ? hit.v : ratio;
    } else if (multi && cands.length > 1) {
      odds = cands.reduce((p, c) => p * c.v, 1);
    } else if (cands.length) {
      const keyed = cands.filter(c => c.key);
      odds = (keyed[0] || cands[0]).v;
    }
    if (!(odds > 1)) return { found: false };
    odds = round(odds);

    // Description: the leg count for a multi, otherwise the selection near the odds.
    let desc = "";
    if (multi) {
      const legs = (text.match(/\b(\d+)\s*-?\s*(?:legs?|fold)\b/i) || [])[1] || (cands.length > 1 && !totals.length ? cands.length : totals.length ? cands.length - totals.length : 0);
      desc = /same game|sgm|sgp/i.test(text) ? "Same game multi" : "Multi";
      if (legs > 1) desc = legs + "-leg " + desc.toLowerCase();
    } else {
      // The selection sits on the odds line or just above it. Market names and
      // "Team A v Team B" event lines are only used when nothing better is near.
      const at = cands.find(c => near(c.v, odds)) || cands[0];
      const tries = at ? [at.i, at.i - 1, at.i - 2, at.i - 3, at.i + 1] : [];
      let event = "";
      for (const i of tries) {
        const l = lines[i];
        if (!l || NOISE_RE.test(l) || STAKE_RE.test(l) || RETURN_RE.test(l)) continue;
        const s = cleanSelection(l).replace(/^\d{1,2}[.)]\s+/, "");
        if (!/[A-Za-z]{3,}/.test(s) || /^(odds|price|total|place|nrl|afl|nba|nfl|epl)$/i.test(s)) continue;
        if (/\s(v|vs|@)\.?\s/i.test(" " + s + " ") && /\s(v|vs)\.?\s/i.test(s)) { event = event || s; continue; }
        desc = s; break;
      }
      desc = desc || event;
      if (desc && !/\b(win|over|under|\+|-\d|to|draw|place|line|handicap|margin)\b/i.test(desc) && WIN_MKT_RE.test(text)) desc += " to win";
    }
    desc = desc.slice(0, 40).trim();
    return { found: true, odds, sport: guessSport(text), text: desc, stake: stake || null, multi };
  }

  /* ---------- Reading the image ---------- */
  let workerP = null;
  function loadScript(src) {
    return new Promise((ok, bad) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = () => bad(new Error("load")); document.head.appendChild(s); });
  }
  function worker() {
    if (!workerP) {
      const base = new URL("ocr/", document.baseURI).href;
      workerP = (window.Tesseract ? Promise.resolve() : loadScript(base + "tesseract.min.js"))
        .then(() => window.Tesseract.createWorker("eng", 1, { workerPath: base + "worker.min.js", corePath: base, langPath: base.replace(/\/$/, ""), gzip: true, workerBlobURL: false }))
        .catch(e => { workerP = null; throw e; });
    }
    return workerP;
  }
  // Scale small screenshots up, go greyscale, and flip dark-mode slips to dark text on white.
  function prepare(file) {
    return new Promise((ok, bad) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const k = Math.min(3, Math.max(1, 1400 / img.naturalWidth)), w = Math.round(img.naturalWidth * k), h = Math.round(img.naturalHeight * k);
        const c = document.createElement("canvas"); c.width = w; c.height = h;
        const x = c.getContext("2d"); x.drawImage(img, 0, 0, w, h);
        const d = x.getImageData(0, 0, w, h), p = d.data;
        let sum = 0;
        for (let i = 0; i < p.length; i += 4) { const g = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]; p[i] = p[i + 1] = p[i + 2] = g; sum += g; }
        if (sum / (p.length / 4) < 128) for (let i = 0; i < p.length; i += 4) p[i] = p[i + 1] = p[i + 2] = 255 - p[i];
        x.putImageData(d, 0, 0);
        ok(c);
      };
      img.onerror = () => { URL.revokeObjectURL(url); bad(Object.assign(new Error("image"), { code: "image_rejected" })); };
      img.src = url;
    });
  }
  async function read(file, onStage) {
    onStage && onStage("prep");
    const canvas = await prepare(file);
    onStage && onStage("load");
    const w = await worker();
    onStage && onStage("read");
    const { data } = await w.recognize(canvas);
    return Object.assign(parseSlip(data.text), { raw: data.text });
  }

  window.SlipReader = { read, parseSlip, guessSport };
})();
