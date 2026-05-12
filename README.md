## Shiftwave

Shiftwave is a React audio player with tempo/key analysis, local file uploads, and desktop packaging.

## Local Development

Install dependencies and start the frontend:

```bash
npm install
npm run dev
```

You can export your adjusted audio to a .wav file.

## Desktop App

Run the Electron desktop shell in development:

```bash
npm run desktop:dev
```

Package the desktop app:

```bash
npm run desktop:build
```

The desktop shell packages the local-file audio player as a Windows app.
