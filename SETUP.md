# Putting Streak Charger online

This guide takes you from these files to a live app at your own web address, with accounts that sync across your phone and computer. It takes about 30 minutes, everything is free, and you don't need to install anything.

You'll set up three free services:

| Service | What it does for the app |
| --- | --- |
| **Supabase** | Stores accounts, bets and profile photos, and enforces the security rules |
| **GitHub** | Holds a copy of the app's files |
| **Vercel** | Takes the files from GitHub and puts them on the internet |

> Websites change their buttons from time to time. If something is named slightly differently from what's written here, look for the closest match. It will be in the same area of the page.

---

## Step 1: Create your Supabase project

1. Go to **https://supabase.com** and click **Start your project**.
2. Sign up. **Continue with GitHub** is easiest if you already have a GitHub account. If you don't, use your email address.
3. If it asks you to create an **organization**, type any name (for example `Sky`), choose the **Free** plan and click **Create organization**.
4. Click **New project** and fill in the form:
   - **Project name:** `streak-charger`
   - **Database password:** click **Generate a password**, then copy it somewhere safe. The app doesn't need it, but Supabase may ask for it later.
   - **Region:** choose the one closest to you, for example *Sydney* if you're in Australia.
5. Click **Create new project**. Wait a minute or two while it says it's setting up.

## Step 2: Add the database and security rules

These rules are what stop anyone else from seeing or changing your data, and what stop bets from being deleted.

1. In the left-hand menu of your Supabase project, click **SQL Editor** (the icon looks like `>_`).
2. Click **New query**, or the **+** button.
3. Open the file `schema.sql`, select everything in it and copy it. On iPhone, open it in the Files app, tap and hold the text, then tap **Select All** and **Copy**. On a computer, press Ctrl+A or Cmd+A, then copy.
4. Paste it into the big empty box in Supabase.
5. Click **Run** in the bottom right corner, or press Ctrl+Enter.
6. You should see **Success. No rows returned**. That's the result you want.

If Supabase shows a warning about "destructive operations", click **Run this query** to continue. The file only creates things, and you can safely run it again later.

## Step 3: Copy your two keys

1. In Supabase, click the **Connect** button at the top of the page. You can also go to **Project Settings** (the gear icon at the bottom left), then **API Keys**, and then **Data API** for the URL.
2. Find these two values and keep the page open:
   - **Project URL.** It looks like `https://abcdefghijkl.supabase.co`.
   - **Publishable key.** It starts with `sb_publishable_`. Older projects call it the **anon public** key instead, and it starts with `eyJ`. Either one works.

> **Never use the key labelled `secret` or `service_role`.** That key skips all the security rules. The publishable (anon) key is meant to be public, and your data stays protected by the rules from step 2.

You'll paste these two values into the app in step 5.

## Step 4: Put the files on GitHub

1. Go to **https://github.com** and sign up (or log in).
2. Click the **+** in the top right corner and choose **New repository**.
3. Set **Repository name** to `streak-charger`. Leave everything else as it is (Public is fine, since nothing secret is in the files) and click **Create repository**.
4. On the next page, tap the link **uploading an existing file**.
5. Choose the app's files:
   - **On iPhone:** tap **choose your files**, then **Browse** to open the Files app. Go to the unzipped `streak-charger-app` folder, tap **Select** in the top right, tap **Select All**, then tap **Open**. (If you haven't unzipped it yet: save the zip to the Files app, then tap the zip once, and Files makes the folder for you.)
   - **On a computer:** unzip `streak-charger-app.zip`, open the folder, select everything inside it and drag it into the GitHub page.
6. Check that all 9 files are listed: `index.html`, `app.js`, `cloud.js`, `supabase.js`, `config.js`, `schema.sql`, `vercel.json`, `README.md` and `SETUP.md`. Then tap **Commit changes** at the bottom.

## Step 5: Paste your keys into `config.js`

1. In your GitHub repository, click **config.js**.
2. Click the **pencil icon** ✏️ (Edit this file) in the top right of the file.
3. Replace `https://YOUR-PROJECT-ID.supabase.co` with your **Project URL**. Keep the quote marks on both sides.
4. Replace `PASTE-YOUR-PUBLISHABLE-OR-ANON-KEY-HERE` with your **publishable key**. Keep the quote marks here too.

   When you're done, it should look like this, with your own values:

   ```js
   window.STREAK_CONFIG = {
     supabaseUrl: "https://abcdefghijkl.supabase.co",
     supabaseAnonKey: "sb_publishable_xxxxxxxxxxxxxxxx",
   };
   ```

5. Click **Commit changes…**, then **Commit changes** again.

## Step 6: Put it online with Vercel

1. Go to **https://vercel.com**, click **Sign Up**, choose **Hobby** (free) and **Continue with GitHub**. Allow access when GitHub asks.
2. Click **Add New…** and then **Project**.
3. Find `streak-charger` in the list and click **Import**. If it isn't listed, click **Adjust GitHub App Permissions**, give Vercel access to the repository, and come back.
4. On the settings screen, set **Framework Preset** to **Other**. Leave everything else as it is.
5. Click **Deploy**. After a few seconds you'll see confetti.
6. Click **Continue to Dashboard**. Your web address is shown under **Domains**, for example `streak-charger-sky.vercel.app`. Copy it.

From now on, every time a file changes on GitHub, Vercel updates the live app by itself.

## Step 7: Tell Supabase your web address

This makes the email links (confirm your account, reset your password) open your app.

1. In Supabase, go to **Authentication** in the left-hand menu, then **URL Configuration**.
2. In **Site URL**, paste your Vercel address with `https://` in front, for example `https://streak-charger-sky.vercel.app`. Click **Save**.
3. Under **Redirect URLs**, click **Add URL**, paste the same address again, and save.

### Email confirmation

New Supabase projects ask people to confirm their email before they can log in. The app handles this: after signing up, you'll see a message asking you to check your inbox.

Supabase's built-in email sender only sends a few emails per hour. That's fine for you and a few friends, but if you're testing lots of sign-ups you can switch confirmation off for now:
**Authentication → Sign In / Providers → Email → turn off "Confirm email" → Save.**
Before you open the app to lots of people, turn it back on and set up a proper email sender under **Authentication → Emails → SMTP Settings**.

## Step 8: First login and bringing your data across

1. Open your Vercel address on your phone.
2. Tap **Sign up**, then choose a display name (3 to 20 letters, numbers, dots or underscores), an email address and a password.
3. If you left email confirmation on, tap the link in the email and log in.
4. **Your existing trackers:** the app can only see data saved by this same web address. The Claude artifact version has a different address, so do this:
   1. In the **old** app, open **All trackers** and tap **Copy backup**.
   2. In the **new** app, tap your photo in the top right, tap **Import backup**, paste and confirm.

   If data was already saved on the device under the new address, the app asks once whether to import it. Importing twice is safe, because nothing gets duplicated.
5. Tap your photo, then the 📷 button, to add a profile picture.
6. To install it like an app on iPhone: open it in Safari, tap **Share**, then **Add to Home Screen**.

---

## Troubleshooting

| What you see | What to do |
| --- | --- |
| A screen saying **"Almost ready"** | `config.js` still has the placeholder values. Redo step 5, wait about 30 seconds and refresh. |
| **"Invalid API key"** or **"Failed to fetch"** | Check that the URL and key in `config.js` were copied exactly, with no spaces and with the quote marks still there. |
| **"relation … does not exist"**, or nothing saves | The SQL from step 2 didn't run. Run it again and look for the **Success** message. |
| Sign-up works but the email link opens a "localhost" page | Redo step 7. |
| **"Email rate limit exceeded"** | Supabase's free email sender is busy. Wait an hour, or turn off "Confirm email" (see step 7). |
| Vercel shows **404** | `index.html` isn't in the repository, or it ended up inside a folder. On GitHub, the file list should show `index.html` directly. |
| The app shows an old version | Pull down to refresh, or close and reopen the tab. |

## What's protected

These rules are checked by the database itself, so they hold even for someone who tries to bypass the app:

- You can only read and change your own trackers, bets and settings.
- A logged bet can never be deleted.
- The bet, sport and link lock 24 hours after logging. Odds can change at any time, and every change is recorded in the bet's "edited" history, which can't be rewritten.
- A win or loss can be corrected within 24 hours of setting it, and after that it's final.
- Bets can't be dated in the future.
- Display names are unique, ignoring capital letters.
- You can only upload or replace your own profile photo.
