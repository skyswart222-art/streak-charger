# Streak Charger

A phone-first compound bet streak tracker. Every bet stakes the whole balance, wins roll over and a loss resets the run. Accounts, data and profile photos live in Supabase, and the site is hosted as static files on Vercel. There is no build step.

**To put it online, follow [SETUP.md](SETUP.md).**

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Page shell and all styles |
| `app.js` | The tracker: screens, maths, animations and the account screens |
| `cloud.js` | Sign-in, loading, and saving changes to Supabase (works offline and catches up later) |
| `config.js` | Your Supabase Project URL and publishable key |
| `schema.sql` | Tables, security rules, the photo bucket, streak calculation and friends. Paste it into the Supabase SQL Editor. Safe to re-run, and re-run it whenever it changes. |
| `supabase.js` | Supabase JavaScript client v2.117.2, bundled so nothing loads from other sites |
| `vercel.json` | Cache and security headers |

## Navigation

The bottom bar has Home, Stats, Friends, Leaders and Chat. Planner and Awards are inside Stats, the All trackers grid is the button next to the tracker tabs, and your profile and settings open from your photo in the top right. Friends lets you find people by display name, send and accept requests, and see each friend's live streak, tier, best streak and banked total. Leaders and Chat are placeholders for later stages.

## Known limits

- **Screenshot bet-slip reader:** it used Claude's artifact runtime, so it hides itself here. It needs an AI API key and a small server function, planned for a later stage.
- **Streaks come from logged bets:** the database works out everyone's live streak, best streak and banked total from their logged bets, so nobody can type a number in. The bets themselves are still self-reported.
