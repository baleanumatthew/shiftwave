import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const devServerUrl = 'http://127.0.0.1:5173';

const wait = (durationMs) => new Promise((resolve) => {
  setTimeout(resolve, durationMs);
});

const waitForDevServer = async () => {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(devServerUrl);

      if (response.ok) {
        return;
      }
    } catch {
      await wait(250);
    }
  }

  throw new Error(`Vite did not become available at ${devServerUrl}.`);
};

const startProcess = (command, args, options = {}) => spawn(command, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  windowsHide: true,
  ...options,
});

const viteProcess = startProcess(process.execPath, [
  path.join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js'),
  '--host',
  '127.0.0.1',
  '--port',
  '5173',
  '--strictPort',
]);

const stopVite = () => {
  if (!viteProcess.killed) {
    viteProcess.kill();
  }
};

process.once('SIGINT', () => {
  stopVite();
  process.exit(130);
});

process.once('SIGTERM', () => {
  stopVite();
  process.exit(143);
});

viteProcess.once('exit', (exitCode) => {
  if (exitCode && exitCode !== 0) {
    process.exit(exitCode);
  }
});

await waitForDevServer();

const electronProcess = startProcess(process.execPath, [
  path.join(projectRoot, 'node_modules', 'electron', 'cli.js'),
  projectRoot,
], {
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: devServerUrl,
  },
});

electronProcess.once('exit', (exitCode) => {
  stopVite();
  process.exit(exitCode ?? 0);
});
