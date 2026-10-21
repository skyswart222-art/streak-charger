# Pipe Dream

A phone-first compound bet streak tracker. Every bet stakes the whole balance, wins roll over and a loss resets the run. Accounts, data and profile photos live in Supabase, and the site is hosted as static files on Vercel. There is no build step.

**To put it online, follow [SETUP.md](SETUP.md).**

## Files

| Path | What it is |
| --- | --- |
| `index.html` | Page shell and all styles |
| `app.js` | The tracker: screens, maths, animations and the account screens |
| `cloud.js` | Sign-in, loading, and saving changes to Supabase (works offline and catches up later) |
| `config.js` | Your Supabase Project URL and publishable key |
| `schema.sql` | Tables, security rules, the photo bucket, streak calculation, friends, the leaderboard, chat, group chats, chat photos and voice notes, the feed and challenges. Paste it into the Supabase SQL Editor. Safe to re-run, and re-run it whenever it changes. |
| `supabase.js` | Supabase JavaScript client v2.117.2, bundled so nothing loads from other sites |
| `vercel.json` | Cache and security headers |
| `manifest.webmanifest`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `favicon-32.png` | The app icon and Home Screen settings |
| `slipreader.js` | Fills in a bet from a bet slip screenshot. It reads the image on the phone and picks out the odds, sport and bet |
| `ocr/` | Tesseract.js 5.1.1 text recognition and its English data (Apache 2.0), bundled and only downloaded the first time someone scans a slip |

## Navigation

The bottom bar has Home, Stats, Friends, Leaders and Chat. Home switches between your tracker and the Feed, which shows the bets you and your friends log, win and lose, and money banked, with emoji reactions. Planner, Awards and Hints are inside Stats, the All trackers grid is the button next to the tracker tabs, and your profile and settings open from your photo in the top right. Hints is a short guide to where bets around 1.05 to 1.10 usually come from in each sport, what to watch out for, and what a 1.05 price really means for a streak. Friends lets you find people by display name, send and accept requests, and see each friend's live streak, tier, best streak and banked total. Leaders ranks you and your friends, or everyone, by live streak, best streak or banked total, with your own spot always shown. Its Challenges switch lets you challenge friends to see who gets the longest run of wins in 3 days, a week or two weeks. Chat is private messaging between friends, one to one or in groups of up to 20: share a bet as a live card that updates when it settles, send photos and voice notes, react with an emoji, and see when a message was read.

## Known limits

- **Tracker privacy:** each tracker has a "Show to friends and community" tick in Tracker options. Unticked, only you can see it: its bets stay out of the feed, and it doesn't count on leaderboards or in challenges.
- **Friends' progress:** the leaderboard shows a live progress bar for each person's furthest-along shown tracker, worked out by the database, with ⏳ when a bet is in play. Tap a friend to see their bets, with details and slip photos. Only friends can see bets.
- **Screenshot bet-slip reader:** it reads text with plain rules, not AI, so odds and stake are reliable but the sport and the bet description are best guesses to check. The reading happens on the phone. When you're signed in, the screenshot is then saved privately with the bet, so you can open it again from History (only you and your friends can see it, and friends only on trackers you show). You can also add a slip photo to a bet you typed in.
- **Streaks come from logged bets:** the database works out everyone's live streak, best streak and banked total from their logged bets, so nobody can type a number in. The bets themselves are still self-reported.
