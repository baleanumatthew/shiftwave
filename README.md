## Shiftwave

Shiftwave is a Vite + React audio player with tempo/key analysis, local file uploads, and an optional YouTube import bridge.

## Local Development

Install dependencies and start the frontend:

```bash
npm install
npm run dev
```

The YouTube bridge is optional. During local development, the app will look for it at `http://127.0.0.1:5185` unless you set `VITE_YOUTUBE_BRIDGE_BASE_URL`.

To run the bridge locally:

```bash
npm run youtube-bridge
```

If you expose that bridge through a tunnel or host it elsewhere, set `VITE_YOUTUBE_BRIDGE_BASE_URL` for the frontend and `YOUTUBE_BRIDGE_PUBLIC_URL` for the bridge process.

## Vercel Deployment

This repo is ready to deploy to Vercel as a static Vite frontend.

1. Push the repo to GitHub, GitLab, or Bitbucket.
2. Import the project into Vercel.
3. Vercel should detect Vite automatically. This repo also includes `vercel.json` with the build output set to `dist`.
4. If you want YouTube URL imports in production, add `VITE_YOUTUBE_BRIDGE_BASE_URL` in the Vercel project settings and point it at a separately hosted bridge service.

If `VITE_YOUTUBE_BRIDGE_BASE_URL` is not set in production, the deployed site still works for local audio uploads and disables the YouTube import UI instead of trying to call `127.0.0.1`.

## Bridge Architecture

`scripts/youtube-bridge.mjs` is a standalone Node server that shells out to `yt-dlp` and `ffmpeg`. It is not part of the static Vercel deployment.

That means the practical production setup is:

1. Deploy the React frontend on Vercel.
2. Host the YouTube bridge somewhere that can run Node, `yt-dlp`, and `ffmpeg`.
3. Set `VITE_YOUTUBE_BRIDGE_BASE_URL` in Vercel to the bridge's public HTTPS URL.

Use `.env.example` as the starting point for environment variables.
