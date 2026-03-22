## Shiftwave

Shiftwave is a React audio player with tempo/key analysis, local file uploads, and an optional YouTube import bridge.

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

You can also export your adjusted audio to a .wav file