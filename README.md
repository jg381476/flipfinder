# FlipFinder

**Live app:** https://jg381476.github.io/flipfinder/

Mobile-first PWA for flea markets and thrift stores: **photo → identify → estimated resale value → profit check → save**.
Shared between two people, 100% free tools (React + Vite, Supabase free tier, Google Gemini free tier, GitHub Pages).

## How it works (and what it will NOT do)

- **SCAN ITEM** opens the camera / photo library. The photo is shrunk in the browser and sent to a Supabase Edge Function that asks Google Gemini to identify the item (name, brand, model, condition) and give a price estimate.
- **Prices are never presented as facts.** The AI price is always labelled **"AI estimate, not a real market price"**, with a confidence level. Marketplaces have no free public price API, and we do not scrape them (that breaks their terms). Instead, buttons open each marketplace's *own* search page: **eBay (sold listings)**, **Vinted**, **Wallapop**, **FINN.no**. Look at what really sold, type your own price into the calculator, and the label changes to "Your own price".
- **Profit calculator**: selling price − selling costs (% fees/packaging) − shipping you pay − purchase price = net profit and ROI. The traffic light:
  - 🟢 Good deal: profit ≥ €10 **and** ROI ≥ 100%
  - 🟠 Possible deal: profit ≥ €5 **and** ROI ≥ 40%
  - 🔴 Not worth buying: anything less
  - *Suggested max purchase price* = the highest price that still gives green.
  - Default selling costs (8% + €5 shipping) are rough assumptions. Change them in Settings or per item.
- **Saved finds** are stored in Supabase so you both see the same list (it refreshes whenever you open the app).
- No Supabase configured? The app still works: details are entered by hand and finds are saved **on that phone only**.

## Security model

- The **Gemini API key never leaves Supabase** (it is an Edge Function secret). The browser only holds the Supabase URL and *anon* key, which are public by design.
- You share **one login** (email + password you create in Supabase). Row-level security allows only signed-in users to read/write finds, and the Edge Function refuses requests without a valid login, so strangers cannot burn your AI quota or read your data. Turn off public sign-ups (step 3).
- Photos go to Google's Gemini API for identification. Avoid photographing people.

## Live deployment (current setup)

| Piece | Where |
|---|---|
| App | <https://jg381476.github.io/flipfinder/> (GitHub Pages, deployed by `.github/workflows/deploy.yml` on every push to `main`) |
| Database + login | Supabase project `flipfinder` (EU / Ireland, free plan), project ref `szxcevwionolcfcxuyal` |
| AI | Supabase Edge Function `identify` calling Google Gemini (free tier); the key is the Supabase secret `GEMINI_API_KEY` |
| Public config | GitHub repo *Variables* `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (publishable key, safe to expose) |

**Sign-in:** one shared email + password lives in Supabase (Authentication → Users), and public sign-ups are disabled. The password is deliberately **not** in this repo. To change it: Supabase dashboard → Authentication → Users → the user → *Send password recovery* or *Update password*.

**Install on iPhone:** open the URL in Safari → Share → *Add to Home Screen*. **Android:** Chrome menu → *Install app*.

**Rotate the Gemini key:** create a new key at <https://aistudio.google.com/apikey>, then Supabase → Edge Functions → Secrets → set `GEMINI_API_KEY`. No redeploy needed.

**If a GitHub Pages deploy ever hangs on "updating_pages"** (it happened once on the very first deploy), push any new commit; re-running the same commit did not help.

**Edge Function note:** the function does its own sign-in check (it asks Supabase Auth who is calling). When deploying it in the dashboard, "Verify JWT" can stay on or off; with Supabase's newer API keys it is safest to leave the function's own check in charge.

---

## Setup from scratch (about 30 minutes, only needed for a fresh copy)

### 1. Put the code on GitHub
```bash
cd flipfinder
git branch -M main
git remote add origin https://github.com/<your-username>/flipfinder.git   # create an empty repo first on github.com
git push -u origin main
```
The repository name becomes part of the URL (`https://<you>.github.io/flipfinder/`); the workflow handles that automatically.

### 2. Supabase project (free)
1. Sign up at <https://supabase.com> → **New project** (free plan, pick an EU region, save the database password).
2. **SQL Editor** → paste all of [`supabase/schema.sql`](supabase/schema.sql) → **Run**.
3. **Authentication → Users → Add user → Create new user**: choose an email and a strong password, tick **Auto Confirm User**. This is the shared login for both of you.
4. **Authentication → Sign In / Providers**: turn **off** "Allow new users to sign up". When creating the project, untick *Automatically expose new tables* (the schema grants access explicitly).
5. **Project Settings → API**: copy the **Project URL** and the **anon / public key** (not the service_role key).

### 3. Gemini key (free, no card)
Create a key at <https://aistudio.google.com/apikey>. The free tier has daily/minute request limits that Google changes from time to time; when used up, the app tells you and you can enter details by hand.

### 4. Deploy the AI function
```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>      # the xxxx in https://xxxx.supabase.co
npx supabase secrets set GEMINI_API_KEY=<your-gemini-key>
npx supabase functions deploy identify
```
(No CLI? In the Supabase dashboard: **Edge Functions → Deploy a new function → Via Editor**, name it `identify`, paste [`supabase/functions/identify/index.ts`](supabase/functions/identify/index.ts), then add the secret under **Edge Functions → Secrets**.)
Optional secret `GEMINI_MODEL` overrides the model (default `gemini-flash-latest`).

### 5. GitHub Pages
In your GitHub repo:
1. **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables → New repository variable** (use *Variables*, these two are public values):
   - `VITE_SUPABASE_URL` = your Project URL
   - `VITE_SUPABASE_ANON_KEY` = your anon key
3. **Actions** tab → *Deploy to GitHub Pages* → **Run workflow** (it also runs on every push to `main`).
4. Your app is at `https://<your-username>.github.io/flipfinder/`.

### 6. Install on both iPhones
1. Open the URL in **Safari** (it must be Safari for iPhone installs).
2. Tap **Share** → **Add to Home Screen** → **Add**.
3. Open FlipFinder from the home-screen icon, sign in with the shared email + password (once per phone). Allow camera/photo access when asked.
4. Do the same on the other phone. Anything saved on one appears on the other when the app is opened or brought back to the foreground.

Android: Chrome menu → **Install app**.

Updates: push to `main`; the app updates itself the next time it is opened (close and reopen it once or twice).

## Local development
```bash
npm install
cp .env.example .env      # optional: add Supabase values; empty = local-only mode
npm run dev               # http://localhost:5173
npm test                  # profit calculator tests
npm run build && npm run preview
```
Camera capture needs HTTPS; `localhost` counts as secure, but to try it on your phone use the GitHub Pages URL.

## Project layout
```
src/calc.js                    profit maths, traffic light, marketplace search links (unit-tested)
src/components/ItemScreen.jsx  scan result: identify, correct, compare, calculate, save
src/store.js                   saved finds (Supabase, or localStorage when not configured)
src/ai.js, src/image.js        call the Edge Function; shrink photos
supabase/schema.sql            table + row-level security
supabase/functions/identify    Gemini call (holds the secret key)
```

## Honest limitations
- AI price estimates can be wrong, especially for unbranded or rare items. That is why every one is labelled and paired with sold-listing links.
- Vinted, Wallapop and FINN.no show asking prices; only eBay offers sold-listing search.
- Free-tier limits (Gemini requests, Supabase 500 MB database / projects pausing after about a week of no activity) may change; check the providers' pages.
- Saved-find photos are stored as small JPEGs in the database; thousands of finds fit comfortably in the free tier.
