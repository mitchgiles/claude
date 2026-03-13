# SpinSync — Spotify Spin Class Generator

Generate personalized indoor cycling workouts from your Spotify playlists. SpinSync uses Spotify's Audio Features API to analyze BPM, energy, danceability, and valence for every track, then maps each song to a spin class segment (warmup, sprint, climb, intervals, recovery, cooldown).

## Features

- **Spotify OAuth** — secure login via Spotify's authorization flow
- **Playlist browser** — browse all your saved and followed playlists
- **Audio analysis** — fetches tempo, energy, danceability, and valence for every track
- **Smart workout generation** — classifies each track into an intensity tier:
  - Warm Up · Steady State · Seated Climb · Intervals · Standing Climb · Sprint · Recovery · Cool Down
- **Visual timeline** — interactive heatmap of the full workout with hover tooltips
- **Live timer** — start the workout and follow along with live segment callouts
- **Stats** — avg BPM, avg energy, estimated calories, and more

## Tech Stack

- **Next.js 16** (App Router, TypeScript)
- **Tailwind CSS v4**
- **Spotify Web API** — OAuth 2.0 + Audio Features

## Setup

### 1. Create a Spotify App

1. Go to [Spotify Developer Dashboard](https://developer.spotify.com/dashboard)
2. Create a new app
3. Add `http://127.0.0.1:3000/api/auth/callback` as a Redirect URI
   > Spotify's dashboard rejects `localhost` — use `127.0.0.1` instead
4. Copy your **Client ID** and **Client Secret**

### 2. Configure Environment

Create a `.env.local` file in the project root:

```env
SPOTIFY_CLIENT_ID=your_spotify_client_id
SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
NEXTAUTH_URL=http://127.0.0.1:3000
NEXTAUTH_SECRET=any_random_secret_string
```

### 3. Install and Run

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and click **Connect with Spotify**.

## How It Works

```
Spotify Playlist
       ↓
GET /api/spotify/tracks      — fetch track metadata
       ↓
GET /api/spotify/features    — fetch audio features (BPM, energy, etc.)
       ↓
workout-generator.ts          — classify intensity per track
       ↓
SpinClass object              — timeline, instructions, resistance & cadence cues
```

### Intensity Classification

| Intensity       | Tempo        | Energy    | Notes                        |
|-----------------|--------------|-----------|------------------------------|
| Sprint          | > 145 BPM    | > 0.85    | Max effort, fast legs        |
| Standing Climb  | 125–145 BPM  | > 0.75    | Out of saddle, high resistance |
| Intervals       | any          | > 0.7     | High danceability            |
| Seated Climb    | 115–135 BPM  | 0.55–0.80 | Stay seated, moderate climb  |
| Steady State    | 110–130 BPM  | 0.40–0.65 | Consistent pace              |
| Recovery        | any          | < 0.45    | Catch your breath            |
| Warm Up         | first track  | —         | Positional override          |
| Cool Down       | last track   | —         | Positional override          |

## Deployment

Deploy to [Vercel](https://vercel.com) with the environment variables set in project settings. Update `NEXTAUTH_URL` to your production URL and add the production callback URL to your Spotify app's Redirect URIs.
