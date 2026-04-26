const SHARP_CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_CHROMATIC_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const NOTE_TO_INDEX = {
  'C': 0,
  'B#': 0,
  'C#': 1,
  'Db': 1,
  'D': 2,
  'D#': 3,
  'Eb': 3,
  'E': 4,
  'Fb': 4,
  'E#': 5,
  'F': 5,
  'F#': 6,
  'Gb': 6,
  'G': 7,
  'G#': 8,
  'Ab': 8,
  'A': 9,
  'A#': 10,
  'Bb': 10,
  'B': 11,
  'Cb': 11,
};

export const normalizeMetadataText = (value) => {
  const trimmedValue = String(value ?? '').trim();
  return trimmedValue ? trimmedValue : null;
};

const normalizeMetadataComparisonText = (value) => (
  String(value ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
);

const normalizeKey = (key) => {
  if (!key) {
    return null;
  }

  const normalizedAccidentals = key
    .trim()
    .replaceAll('\u266d', 'b')
    .replaceAll('\u266f', '#')
    .replace(/\s+flat$/i, 'b')
    .replace(/\s+sharp$/i, '#')
    .replace(/\s+/g, '');

  const match = normalizedAccidentals.match(/^([A-Ga-g])([#b]?)/);

  if (!match) {
    return null;
  }

  return `${match[1].toUpperCase()}${match[2]}`;
};

export const transposeKey = (key, semitoneOffset) => {
  const normalizedKey = normalizeKey(key);
  const startingIndex = normalizedKey ? NOTE_TO_INDEX[normalizedKey] : undefined;

  if (startingIndex === undefined) {
    return key;
  }

  const wrappedIndex = (startingIndex + (semitoneOffset % 12) + 12) % 12;
  const prefersFlats = normalizedKey.includes('b');

  return prefersFlats
    ? FLAT_CHROMATIC_SCALE[wrappedIndex]
    : SHARP_CHROMATIC_SCALE[wrappedIndex];
};

export const formatDisplayKey = (key) => {
  if (!key) {
    return '';
  }

  const normalizedKey = normalizeKey(key);
  const displayKey = normalizedKey ?? key;

  return displayKey.replaceAll('b', '\u266d');
};

export const formatDisplayScale = (scale) => {
  const normalizedScale = normalizeMetadataText(scale);

  if (!normalizedScale) {
    return '';
  }

  return normalizedScale.charAt(0).toUpperCase() + normalizedScale.slice(1);
};

export const formatBpm = (tempo) => {
  if (tempo === null || Number.isNaN(tempo)) {
    return '';
  }

  return `${Math.round(tempo)} BPM`;
};

export const formatMetadataList = (value) => {
  if (!Array.isArray(value)) {
    return null;
  }

  const normalizedValues = value
    .map((entry) => normalizeMetadataText(entry))
    .filter(Boolean);

  return normalizedValues.length ? normalizedValues.join(', ') : null;
};

export const getLocalFileTitleFallback = (fileName) => {
  const normalizedName = normalizeMetadataText(fileName);

  if (!normalizedName) {
    return null;
  }

  return normalizedName.replace(/\.[^.]+$/u, '');
};

export const createArtworkDisplayTarget = (metadata) => {
  if (metadata?.artworkUrl) {
    return {
      alt: metadata.title ? `${metadata.title} cover art` : 'Source cover art',
      key: `image:${metadata.artworkUrl}`,
      kind: 'image',
      metadata,
    };
  }

  if (metadata) {
    return {
      key: `placeholder:no-cover:${metadata.title ?? ''}:${metadata.artist ?? ''}:${metadata.sourceType ?? ''}`,
      kind: 'placeholder',
      label: 'No Cover Art',
      metadata,
    };
  }

  return {
    key: 'placeholder:blank:initial',
    kind: 'placeholder',
    label: '',
    metadata: null,
  };
};

export const createMetadataDisplayTarget = (metadata) => {
  const metadataTitle = metadata?.title ?? null;
  const metadataArtist = metadata?.artist ?? null;
  const youtubeTitleContainsAuthor = metadata?.sourceType === 'youtube'
    && Boolean(metadataTitle)
    && Boolean(metadataArtist)
    && normalizeMetadataComparisonText(metadataTitle).includes(
      normalizeMetadataComparisonText(metadataArtist),
    );
  const showsArtistLabelSuffix = !(youtubeTitleContainsAuthor || !metadataArtist);
  const summary = metadataTitle
    ? (!showsArtistLabelSuffix
        ? metadataTitle
        : `${metadataTitle} - ${metadataArtist}`)
    : (metadataArtist ?? '');

  return {
    key: summary ? `metadata:${showsArtistLabelSuffix ? 'title-artist' : 'title'}:${summary}` : 'metadata:empty',
    label: 'Title',
    showsArtistLabelSuffix,
    summary,
  };
};
