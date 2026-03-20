import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const normalizeBaseUrl = (value) => {
  const trimmedValue = String(value ?? '').trim();

  if (!trimmedValue) {
    return null;
  }

  let parsedUrl;

  try {
    parsedUrl = new URL(trimmedValue);
  } catch {
    throw new Error('YOUTUBE_BRIDGE_PUBLIC_URL must be a valid absolute URL.');
  }

  parsedUrl.hash = '';
  parsedUrl.search = '';

  const normalizedPathname = parsedUrl.pathname.replace(/\/+$/u, '');

  return normalizedPathname && normalizedPathname !== '/'
    ? `${parsedUrl.origin}${normalizedPathname}`
    : parsedUrl.origin;
};

const helperHost = process.env.YOUTUBE_BRIDGE_HOST ?? '127.0.0.1';
const helperPort = Number.parseInt(process.env.YOUTUBE_BRIDGE_PORT ?? '5185', 10);
const helperOrigin = `http://${helperHost}:${helperPort}`;
const publicBaseUrl = normalizeBaseUrl(process.env.YOUTUBE_BRIDGE_PUBLIC_URL) ?? helperOrigin;
const jobTtlMs = 60 * 60 * 1000;
const audioFormat = 'mp3';
const audioQuality = process.env.YOUTUBE_BRIDGE_AUDIO_QUALITY ?? '320K';
const cacheDir = path.resolve(
  process.env.YOUTUBE_BRIDGE_CACHE_DIR ?? path.join(projectRoot, '.cache', 'youtube-mp3'),
);
const ffmpegLocation = process.env.FFMPEG_LOCATION ?? process.env.FFMPEG_BIN ?? '';
const localYtDlpPath = fileURLToPath(new URL('./bin/yt-dlp.exe', import.meta.url));
const ytDlpCommand = existsSync(localYtDlpPath)
  ? localYtDlpPath
  : (process.env.YTDLP_BIN ?? 'yt-dlp');
const ytDlpBaseArgs = ['--ignore-config'];

let ytDlpVersionPromise = null;

const importJobs = new Map();
const importsInFlight = new Map();

const logBridge = (message) => {
  console.log(`[youtube-bridge] ${message}`);
};

const logJob = (job, message) => {
  logBridge(`[job ${job.jobId.slice(0, 8)} ${job.videoId}] ${message}`);
};

const setCorsHeaders = (response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, ngrok-skip-browser-warning');
  response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
};

const sendJson = (response, statusCode, payload) => {
  response.statusCode = statusCode;
  setCorsHeaders(response);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
};

const deleteMediaFile = async (mediaPath) => {
  if (!mediaPath) {
    return false;
  }

  try {
    await unlink(mediaPath);
    return true;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return false;
    }

    throw error;
  }
};

const cleanExpiredJobs = () => {
  const now = Date.now();

  for (const [jobId, job] of importJobs.entries()) {
    if (
      now - job.createdAt > jobTtlMs
      && job.state !== 'resolving'
      && job.state !== 'downloading'
      && job.state !== 'processing'
    ) {
      importJobs.delete(jobId);
      void deleteMediaFile(job.mediaPath).catch((error) => {
        logJob(job, `expired-job cleanup failed: ${error instanceof Error ? error.message : 'unknown error'}`);
      });
    }
  }
};

const sanitizeFileStem = (value) => String(value ?? '')
  .replace(/[<>:"/\\|?*]+/g, '')
  .replace(/\s+/g, ' ')
  .trim();

const extractYouTubeVideoId = (input) => {
  const trimmedInput = String(input ?? '').trim();

  if (/^[A-Za-z0-9_-]{11}$/u.test(trimmedInput)) {
    return trimmedInput;
  }

  try {
    const parsedUrl = new URL(trimmedInput);
    const hostname = parsedUrl.hostname.replace(/^www\./u, '').toLowerCase();
    const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);

    if (hostname === 'youtu.be') {
      return pathSegments[0] ?? null;
    }

    if (hostname.endsWith('youtube.com')) {
      if (parsedUrl.pathname === '/watch') {
        return parsedUrl.searchParams.get('v');
      }

      if (['shorts', 'embed', 'live'].includes(pathSegments[0] ?? '')) {
        return pathSegments[1] ?? null;
      }
    }
  } catch {
    return null;
  }

  return null;
};

const readJsonBody = async (request) => {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
};

const getYtDlpVersion = async () => {
  if (!ytDlpVersionPromise) {
    ytDlpVersionPromise = new Promise((resolve, reject) => {
      const child = spawn(ytDlpCommand, [...ytDlpBaseArgs, '--version'], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      const stdoutChunks = [];
      const stderrChunks = [];

      child.stdout.on('data', (chunk) => {
        stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      child.stderr.on('data', (chunk) => {
        stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });

      child.on('error', reject);

      child.on('close', (exitCode) => {
        const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
        const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();

        if (exitCode === 0) {
          resolve(stdout);
          return;
        }

        reject(new Error(stderr || stdout || `yt-dlp exited with code ${exitCode ?? 'unknown'}.`));
      });
    });
  }

  return ytDlpVersionPromise;
};

const getCachedMp3Path = (videoId) => path.join(cacheDir, `${videoId}.${audioFormat}`);

const normalizePrintedMetadataValue = (value) => {
  const trimmedValue = String(value ?? '').trim();

  if (!trimmedValue || trimmedValue === 'NA') {
    return null;
  }

  return trimmedValue;
};

const normalizePrintedMetadataList = (value) => {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalizedValues = value
    .map((entry) => normalizePrintedMetadataValue(entry))
    .filter(Boolean);

  return normalizedValues.length
    ? normalizedValues.join(', ')
    : null;
};

const normalizeDurationSeconds = (value) => {
  const normalizedValue = normalizePrintedMetadataValue(value);

  if (!normalizedValue) {
    return null;
  }

  const durationSeconds = Number.parseInt(normalizedValue, 10);

  return Number.isFinite(durationSeconds) && durationSeconds >= 0
    ? durationSeconds
    : null;
};

const pickThumbnailUrl = (thumbnails) => {
  if (!Array.isArray(thumbnails) || !thumbnails.length) {
    return null;
  }

  const normalizedThumbnails = thumbnails
    .filter((thumbnail) => thumbnail && typeof thumbnail === 'object' && typeof thumbnail.url === 'string')
    .sort((left, right) => {
      const leftPreference = (Number(left.preference) || 0) + (Number(left.width) || 0);
      const rightPreference = (Number(right.preference) || 0) + (Number(right.width) || 0);

      return rightPreference - leftPreference;
    });

  return normalizedThumbnails.length
    ? normalizePrintedMetadataValue(normalizedThumbnails[0].url)
    : null;
};

const resolveYouTubeMetadata = async (sourceUrl) => new Promise((resolve, reject) => {
  const args = [
    ...ytDlpBaseArgs,
    '--no-playlist',
    '--no-warnings',
    '--skip-download',
    '--dump-single-json',
    sourceUrl,
  ];
  const child = spawn(ytDlpCommand, args, {
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const stdoutChunks = [];
  const stderrChunks = [];

  child.stdout.on('data', (chunk) => {
    stdoutChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  child.stderr.on('data', (chunk) => {
    stderrChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });

  child.on('error', reject);

  child.on('close', (exitCode) => {
    const stdout = Buffer.concat(stdoutChunks).toString('utf8').trim();
    const stderr = Buffer.concat(stderrChunks).toString('utf8').trim();

    if (exitCode !== 0) {
      reject(new Error(stderr || stdout || 'yt-dlp could not resolve YouTube metadata.'));
      return;
    }

    try {
      const metadata = JSON.parse(stdout);
      const artistList = normalizePrintedMetadataList(metadata.artists);
      const albumArtistList = normalizePrintedMetadataList(metadata.album_artists);

      resolve({
        artist: normalizePrintedMetadataValue(
          metadata.artist
            ?? artistList
            ?? metadata.album_artist
            ?? albumArtistList
            ?? metadata.channel
            ?? metadata.uploader
            ?? metadata.creator,
        ),
        channel: normalizePrintedMetadataValue(
          metadata.channel
            ?? metadata.uploader,
        ),
        channelId: normalizePrintedMetadataValue(
          metadata.channel_id
            ?? metadata.uploader_id,
        ),
        durationSeconds: normalizeDurationSeconds(metadata.duration),
        thumbnailUrl: normalizePrintedMetadataValue(metadata.thumbnail)
          ?? pickThumbnailUrl(metadata.thumbnails),
        title: normalizePrintedMetadataValue(
          metadata.track
            ?? metadata.title
            ?? metadata.fulltitle,
        ),
        uploadDate: normalizePrintedMetadataValue(metadata.upload_date),
        uploaderId: normalizePrintedMetadataValue(metadata.uploader_id),
        videoUrl: normalizePrintedMetadataValue(
          metadata.webpage_url
            ?? metadata.original_url
            ?? metadata.url,
        ),
      });
    } catch (error) {
      reject(new Error(
        error instanceof Error
          ? `Could not parse yt-dlp metadata JSON: ${error.message}`
          : 'Could not parse yt-dlp metadata JSON.',
      ));
    }
  });
});

const createJobPayload = (job) => ({
  artist: job.artist,
  error: job.error,
  jobId: job.jobId,
  mediaUrl: job.mediaUrl,
  metadata: {
    channel: job.channel,
    channelId: job.channelId,
    durationSeconds: job.durationSeconds,
    thumbnailUrl: job.thumbnailUrl,
    uploadDate: job.uploadDate,
    uploaderId: job.uploaderId,
    videoUrl: job.videoUrl,
  },
  message: job.message,
  progressPercent: job.progressPercent,
  state: job.state,
  title: job.title,
  videoId: job.videoId,
});

const updateJob = (jobId, patch) => {
  const existingJob = importJobs.get(jobId);

  if (!existingJob) {
    return null;
  }

  Object.assign(existingJob, patch, {
    updatedAt: Date.now(),
  });

  return existingJob;
};

const applyProgressUpdate = (jobId, progressUpdate) => {
  const job = importJobs.get(jobId);

  if (!job || !progressUpdate) {
    return;
  }

  const nextProgress = typeof progressUpdate.progressPercent === 'number'
    ? progressUpdate.progressPercent
    : job.progressPercent;
  const nextState = progressUpdate.state ?? job.state;
  const nextMessage = progressUpdate.message ?? job.message;
  const nextBucket = nextProgress >= 100
    ? 100
    : Math.max(0, Math.floor(nextProgress / 10) * 10);
  const shouldLog = nextState !== job.lastLoggedState
    || nextBucket !== job.lastLoggedProgressBucket
    || nextMessage !== job.lastLoggedMessage;

  updateJob(jobId, progressUpdate);

  if (!shouldLog) {
    return;
  }

  job.lastLoggedProgressBucket = nextBucket;
  job.lastLoggedState = nextState;
  job.lastLoggedMessage = nextMessage;

  logJob(job, nextMessage);
};

const parseYtDlpFailure = (stderrLines) => {
  const errorLine = [...stderrLines].reverse().find((line) => line.startsWith('ERROR:'));
  return (errorLine ?? stderrLines.at(-1) ?? 'yt-dlp failed to import the requested video.')
    .replace(/^ERROR:\s*/u, '');
};

const parseProgressUpdate = (line) => {
  const trimmedLine = line.trim();

  if (!trimmedLine) {
    return null;
  }

  if (trimmedLine.startsWith('[download]')) {
    if (trimmedLine.includes('Destination:')) {
      return {
        message: 'Starting YouTube download...',
        progressPercent: 0,
        state: 'downloading',
      };
    }

    const percentMatch = trimmedLine.match(/\[download\]\s+(\d+(?:\.\d+)?)%/u);
    const etaMatch = trimmedLine.match(/\bETA\s+([0-9:]+)/u);
    const speedMatch = trimmedLine.match(/\bat\s+([0-9.]+\w+\/s)/u);

    if (percentMatch) {
      let message = `Downloading mp3... ${percentMatch[1]}%`;

      if (speedMatch) {
        message += ` at ${speedMatch[1]}`;
      }

      if (etaMatch) {
        message += `, ETA ${etaMatch[1]}`;
      }

      return {
        message,
        progressPercent: Number.parseFloat(percentMatch[1]),
        state: 'downloading',
      };
    }

    if (trimmedLine.includes('100%')) {
      return {
        message: 'Download complete. Converting to mp3...',
        progressPercent: 100,
        state: 'processing',
      };
    }
  }

  if (trimmedLine.startsWith('[ExtractAudio]')) {
    return {
      message: 'Converting to mp3...',
      progressPercent: 100,
      state: 'processing',
    };
  }

  if (trimmedLine.includes('Deleting original file')) {
    return {
      message: 'Finalizing mp3...',
      progressPercent: 100,
      state: 'processing',
    };
  }

  return null;
};

const runImportJob = async (jobId, sourceUrl, videoId) => {
  const job = importJobs.get(jobId);

  if (!job) {
    return;
  }

  const cachedMp3Path = getCachedMp3Path(videoId);

  if (existsSync(cachedMp3Path)) {
    const deletedStaleFile = await deleteMediaFile(cachedMp3Path);

    if (deletedStaleFile) {
      logJob(job, `removed stale temporary mp3 -> ${cachedMp3Path}`);
    }
  }

  await mkdir(cacheDir, { recursive: true });

  updateJob(jobId, {
    message: 'Resolving YouTube metadata...',
    progressPercent: 0,
    state: 'resolving',
  });
  logJob(job, `resolving metadata for ${sourceUrl}`);

  let resolvedMetadata = {
    artist: null,
    channel: null,
    channelId: null,
    durationSeconds: null,
    thumbnailUrl: null,
    title: null,
    uploadDate: null,
    uploaderId: null,
    videoUrl: sourceUrl,
  };

  try {
    resolvedMetadata = await resolveYouTubeMetadata(sourceUrl);
    updateJob(jobId, resolvedMetadata);
  } catch (error) {
    logJob(job, `metadata preflight failed: ${error instanceof Error ? error.message : 'unknown error'}`);
  }

  const args = [
    ...ytDlpBaseArgs,
    '--no-playlist',
    '--newline',
    '--extract-audio',
    '--audio-format',
    audioFormat,
    '--audio-quality',
    audioQuality,
    '--output',
    path.join(cacheDir, '%(id)s.%(ext)s'),
    '--print',
    'after_move:file=%(filepath)s',
  ];

  if (ffmpegLocation) {
    args.push('--ffmpeg-location', ffmpegLocation);
  }

  args.push(sourceUrl);

  updateJob(jobId, {
    message: 'Queued YouTube import...',
    progressPercent: 0,
    state: 'downloading',
  });
  logJob(job, `starting mp3 import for ${sourceUrl}`);

  await new Promise((resolve, reject) => {
    const child = spawn(ytDlpCommand, args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const stderrLines = [];
    let mediaPath = null;

    const stdoutInterface = createInterface({ input: child.stdout });
    const stderrInterface = createInterface({ input: child.stderr });

    stdoutInterface.on('line', (line) => {
      if (line.startsWith('after_move:file=')) {
        mediaPath = path.resolve(line.slice('after_move:file='.length).trim());
        logJob(job, `mp3 written to ${mediaPath}`);
      }
    });

    stderrInterface.on('line', (line) => {
      const trimmedLine = line.trim();

      if (!trimmedLine) {
        return;
      }

      stderrLines.push(trimmedLine);

      const progressUpdate = parseProgressUpdate(trimmedLine);

      if (progressUpdate) {
        applyProgressUpdate(jobId, progressUpdate);
      }
    });

    child.on('error', reject);

    child.on('close', (exitCode) => {
      stdoutInterface.close();
      stderrInterface.close();

      if (exitCode !== 0) {
        reject(new Error(parseYtDlpFailure(stderrLines)));
        return;
      }

      const resolvedMediaPath = mediaPath ?? cachedMp3Path;

      stat(resolvedMediaPath)
        .then((fileInfo) => {
          if (!fileInfo.isFile()) {
            throw new Error('yt-dlp finished, but the mp3 file could not be found.');
          }

          updateJob(jobId, {
            artist: resolvedMetadata.artist,
            channel: resolvedMetadata.channel,
            channelId: resolvedMetadata.channelId,
            durationSeconds: resolvedMetadata.durationSeconds,
            mediaPath: resolvedMediaPath,
            mediaUrl: `${publicBaseUrl}/media/${jobId}`,
            message: 'MP3 download complete. Ready to load.',
            progressPercent: 100,
            state: 'ready',
            thumbnailUrl: resolvedMetadata.thumbnailUrl,
            title: resolvedMetadata.title,
            uploadDate: resolvedMetadata.uploadDate,
            uploaderId: resolvedMetadata.uploaderId,
            videoUrl: resolvedMetadata.videoUrl,
          });
          logJob(job, 'mp3 download complete');
          resolve();
        })
        .catch(reject);
    });
  });
};

const startYouTubeImport = async (sourceUrl) => {
  const videoId = extractYouTubeVideoId(sourceUrl);

  if (!videoId) {
    throw new Error('Paste a valid YouTube link.');
  }

  const existingJobId = importsInFlight.get(videoId);

  if (existingJobId) {
    const existingJob = importJobs.get(existingJobId);

    if (existingJob) {
      return existingJob;
    }
  }

  const jobId = randomUUID();
  const job = {
    artist: null,
    channel: null,
    channelId: null,
    createdAt: Date.now(),
    durationSeconds: null,
    error: null,
    jobId,
    lastLoggedMessage: null,
    lastLoggedProgressBucket: null,
    lastLoggedState: null,
    mediaPath: null,
    mediaUrl: null,
    message: 'Queued YouTube import...',
    progressPercent: 0,
    sourceUrl,
    state: 'queued',
    thumbnailUrl: null,
    title: null,
    uploadDate: null,
    updatedAt: Date.now(),
    uploaderId: null,
    videoId,
    videoUrl: null,
  };

  importJobs.set(jobId, job);
  importsInFlight.set(videoId, jobId);

  runImportJob(jobId, sourceUrl, videoId)
    .catch((error) => {
      updateJob(jobId, {
        error: error instanceof Error ? error.message : 'The bridge could not finish the YouTube request.',
        message: 'YouTube import failed.',
        state: 'error',
      });
      logJob(job, `failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    })
    .finally(() => {
      importsInFlight.delete(videoId);
    });

  return job;
};

const serveCachedMedia = async (response, jobId) => {
  const job = importJobs.get(jobId);

  if (!job?.mediaPath) {
    sendJson(response, 404, {
      error: 'The requested mp3 is no longer available. Start the YouTube import again.',
    });
    return;
  }

  const fileInfo = await stat(job.mediaPath).catch(() => null);

  if (!fileInfo?.isFile()) {
    sendJson(response, 404, {
      error: 'The requested mp3 file could not be found on disk.',
    });
    return;
  }

  setCorsHeaders(response);
  response.statusCode = 200;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Length', fileInfo.size);
  response.setHeader('Content-Type', 'audio/mpeg');
  response.setHeader(
    'Content-Disposition',
    `inline; filename="${sanitizeFileStem(job.title ?? job.videoId) || job.videoId}.mp3"`,
  );

  const sourceStream = createReadStream(job.mediaPath);
  let didCleanup = false;

  const cleanupServedJob = async () => {
    if (didCleanup) {
      return;
    }

    didCleanup = true;

    const deletedFile = await deleteMediaFile(job.mediaPath);
    importJobs.delete(jobId);
    logJob(job, deletedFile
      ? 'temporary mp3 deleted after streaming'
      : 'temporary mp3 was already missing after streaming');
  };

  sourceStream.on('error', (error) => {
    response.destroy(error);
  });

  sourceStream.on('close', () => {
    void cleanupServedJob().catch((error) => {
      logJob(job, `post-stream cleanup failed: ${error instanceof Error ? error.message : 'unknown error'}`);
    });
  });

  response.on('close', () => {
    if (!sourceStream.destroyed) {
      sourceStream.destroy();
    }
  });

  sourceStream.pipe(response);
};

const releaseImportJob = async (jobId) => {
  const job = importJobs.get(jobId);

  if (!job) {
    return {
      deletedFile: false,
      deletedJob: false,
      job: null,
    };
  }

  if (
    job.state === 'queued'
    || job.state === 'resolving'
    || job.state === 'downloading'
    || job.state === 'processing'
  ) {
    throw new Error('Cannot delete a YouTube import while it is still downloading.');
  }

  const deletedFile = await deleteMediaFile(job.mediaPath);
  importJobs.delete(jobId);

  return {
    deletedFile,
    deletedJob: true,
    job,
  };
};

const server = createServer(async (request, response) => {
  cleanExpiredJobs();

  if (!request.url || !request.method) {
    sendJson(response, 400, { error: 'Malformed bridge request.' });
    return;
  }

  if (request.method === 'OPTIONS') {
    response.statusCode = 204;
    setCorsHeaders(response);
    response.end();
    return;
  }

  const requestUrl = new URL(request.url, helperOrigin);

  try {
    if (request.method === 'GET' && requestUrl.pathname === '/health') {
      const extractorVersion = await getYtDlpVersion();
      sendJson(response, 200, {
        audioFormat,
        audioQuality,
        cacheDir,
        extractor: 'yt-dlp',
        extractorCommand: ytDlpCommand,
        extractorVersion,
        ffmpegLocation: ffmpegLocation || 'PATH',
        service: 'youtube-bridge',
        bridgeHost: helperHost,
        bridgePort: helperPort,
        publicBaseUrl,
      });
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/ingest/youtube') {
      const payload = await readJsonBody(request);
      const sourceUrl = typeof payload.url === 'string' ? payload.url : '';
      const job = await startYouTubeImport(sourceUrl);

      sendJson(response, 202, {
        jobId: job.jobId,
        message: job.message,
        progressPercent: job.progressPercent,
        state: job.state,
        statusUrl: `${publicBaseUrl}/imports/${job.jobId}`,
      });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname.startsWith('/imports/')) {
      const jobId = requestUrl.pathname.slice('/imports/'.length);
      const job = importJobs.get(jobId);

      if (!job) {
        sendJson(response, 404, {
          error: 'That YouTube import job could not be found.',
        });
        return;
      }

      sendJson(response, 200, createJobPayload(job));
      return;
    }

    if (request.method === 'DELETE' && requestUrl.pathname.startsWith('/imports/')) {
      const jobId = requestUrl.pathname.slice('/imports/'.length);
      const releaseResult = await releaseImportJob(jobId);

      sendJson(response, 200, {
        deletedFile: releaseResult.deletedFile,
        deletedJob: releaseResult.deletedJob,
        jobId,
      });
      return;
    }

    if (request.method === 'GET' && requestUrl.pathname.startsWith('/media/')) {
      const jobId = requestUrl.pathname.slice('/media/'.length);
      await serveCachedMedia(response, jobId);
      return;
    }

    sendJson(response, 404, { error: 'Bridge route not found.' });
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : 'The bridge could not finish the YouTube request.',
    });
  }
});

server.listen(helperPort, helperHost, () => {
  logBridge(`listening on ${helperOrigin}`);
  logBridge(`public base URL: ${publicBaseUrl}`);
  logBridge(`extractor: ${ytDlpCommand}`);
  logBridge(`cache: ${cacheDir}`);
  logBridge(`output format: ${audioFormat} @ ${audioQuality}`);
});
