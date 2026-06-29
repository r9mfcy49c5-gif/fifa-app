# Lytle Lemon FIFA Project v1.3

Vercel-ready Next.js tournament app with realtime Supabase updates, Twilio SMS hooks, hidden Admin portal, Game 1 picks, TV mode, and phone whistle/stadium sounds.

## What is included

- Player registration with first name, last name, U.S. mobile number, and 4-digit player code
- Duplicate player codes allowed
- Game 1 picks: Canada vs South Africa
- Save / Update Picks button
- Realtime pick totals
- Realtime leaderboard
- TV Display Mode
- Hidden Admin portal
- Admin manual score overrides
- Admin manual player score/stat changes
- Admin manual pick overrides
- Lock/unlock registration
- Lock/unlock Game 1 picks
- Auto-advance bracket winners
- Twilio SMS API route
- Admin broadcast SMS
- Live event banner
- Referee whistle and crowd sound effects on phones/browsers when sound is enabled

## Admin access

- Admin mobile: `7209880163`
- Admin passcode: `3737`

The Admin portal is only exposed after entering the admin mobile and passcode in the Admin card.

## Vercel environment variables

Add these in Vercel under Project Settings → Environment Variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
TWILIO_ACCOUNT_SID=AC...
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_PHONE_NUMBER=+18043521044
# Optional if you create a Twilio Messaging Service later:
TWILIO_MESSAGING_SERVICE_SID=MG...
```

Do not put Twilio secrets in frontend code.

## Supabase setup

1. Create a Supabase project.
2. Open SQL Editor.
3. Paste and run `supabase-schema.sql`.
4. Add the Supabase URL and anon key to Vercel.
5. Redeploy.

## Sound behavior

Phones/browsers require a user gesture before custom audio can play. Each player should tap **Enable Whistle Sound** once after opening the app. After that, Admin live events can play the whistle/crowd sounds on that open browser session.

SMS cannot play a custom whistle when the app is closed; it uses the phone's normal SMS alert sound.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

This package was build-tested successfully with Next.js 16.2.9.

Created by C. Lemon — DECIDE • COMMIT • SWING
