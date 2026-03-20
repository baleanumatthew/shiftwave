import { defaultGlowPalette } from '../constants.js';
import { normalizeMetadataText } from './display.js';

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const formatGlowColor = ({ r, g, b }) => (
  `rgb(${Math.round(clampNumber(r, 0, 255))} ${Math.round(clampNumber(g, 0, 255))} ${Math.round(clampNumber(b, 0, 255))})`
);

const mixRgbColors = (firstColor, secondColor, ratio = 0.5) => ({
  r: (firstColor.r * (1 - ratio)) + (secondColor.r * ratio),
  g: (firstColor.g * (1 - ratio)) + (secondColor.g * ratio),
  b: (firstColor.b * (1 - ratio)) + (secondColor.b * ratio),
});

const getColorDistance = (firstColor, secondColor) => Math.hypot(
  firstColor.r - secondColor.r,
  firstColor.g - secondColor.g,
  firstColor.b - secondColor.b,
);

const rgbToHsl = ({ r, g, b }) => {
  const normalizedRed = r / 255;
  const normalizedGreen = g / 255;
  const normalizedBlue = b / 255;
  const maxChannel = Math.max(normalizedRed, normalizedGreen, normalizedBlue);
  const minChannel = Math.min(normalizedRed, normalizedGreen, normalizedBlue);
  const delta = maxChannel - minChannel;
  const lightness = (maxChannel + minChannel) / 2;

  if (!delta) {
    return {
      h: 0,
      s: 0,
      l: lightness,
    };
  }

  const saturation = lightness > 0.5
    ? delta / (2 - maxChannel - minChannel)
    : delta / (maxChannel + minChannel);

  let hue;

  switch (maxChannel) {
    case normalizedRed:
      hue = ((normalizedGreen - normalizedBlue) / delta) + (normalizedGreen < normalizedBlue ? 6 : 0);
      break;
    case normalizedGreen:
      hue = ((normalizedBlue - normalizedRed) / delta) + 2;
      break;
    default:
      hue = ((normalizedRed - normalizedGreen) / delta) + 4;
      break;
  }

  return {
    h: hue * 60,
    s: saturation,
    l: lightness,
  };
};

const hueToRgb = (firstBound, secondBound, hueValue) => {
  let wrappedHue = hueValue;

  if (wrappedHue < 0) {
    wrappedHue += 1;
  }

  if (wrappedHue > 1) {
    wrappedHue -= 1;
  }

  if (wrappedHue < (1 / 6)) {
    return firstBound + ((secondBound - firstBound) * 6 * wrappedHue);
  }

  if (wrappedHue < 0.5) {
    return secondBound;
  }

  if (wrappedHue < (2 / 3)) {
    return firstBound + ((secondBound - firstBound) * ((2 / 3) - wrappedHue) * 6);
  }

  return firstBound;
};

const hslToRgb = ({ h, s, l }) => {
  if (!s) {
    const grayscaleChannel = Math.round(l * 255);
    return {
      r: grayscaleChannel,
      g: grayscaleChannel,
      b: grayscaleChannel,
    };
  }

  const normalizedHue = ((h % 360) + 360) % 360 / 360;
  const secondBound = l < 0.5
    ? l * (1 + s)
    : l + s - (l * s);
  const firstBound = (2 * l) - secondBound;

  return {
    r: Math.round(hueToRgb(firstBound, secondBound, normalizedHue + (1 / 3)) * 255),
    g: Math.round(hueToRgb(firstBound, secondBound, normalizedHue) * 255),
    b: Math.round(hueToRgb(firstBound, secondBound, normalizedHue - (1 / 3)) * 255),
  };
};

const createGlowColor = (color, {
  hueShift = 0,
  lightnessFloor = 0.54,
  saturationFloor = 0.42,
} = {}) => {
  const hslColor = rgbToHsl(color);

  return hslToRgb({
    h: hslColor.h + hueShift,
    s: clampNumber(Math.max(hslColor.s, saturationFloor), 0, 0.9),
    l: clampNumber(Math.max(hslColor.l, lightnessFloor), 0.42, 0.78),
  });
};

const finalizeGlowPalette = (colors) => {
  const [firstColor] = colors;

  if (!firstColor) {
    return defaultGlowPalette;
  }

  const secondColor = colors[1] ?? mixRgbColors(firstColor, { r: 255, g: 255, b: 255 }, 0.28);
  const thirdColor = colors[2] ?? mixRgbColors(firstColor, secondColor, 0.5);

  return {
    primary: formatGlowColor(createGlowColor(firstColor, {
      lightnessFloor: 0.62,
      saturationFloor: 0.5,
    })),
    secondary: formatGlowColor(createGlowColor(secondColor, {
      hueShift: 10,
      lightnessFloor: 0.56,
      saturationFloor: 0.44,
    })),
    tertiary: formatGlowColor(createGlowColor(thirdColor, {
      hueShift: -12,
      lightnessFloor: 0.52,
      saturationFloor: 0.38,
    })),
  };
};

const loadArtworkForSampling = (artworkUrl) => new Promise((resolve, reject) => {
  const image = new window.Image();

  image.crossOrigin = 'anonymous';
  image.decoding = 'async';
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Failed to load artwork for glow extraction.'));
  image.src = artworkUrl;
});

export const createArtworkObjectUrl = (picture) => {
  if (!picture || !(picture.data instanceof Uint8Array || picture.data instanceof ArrayBuffer)) {
    return null;
  }

  const artworkMimeType = normalizeMetadataText(picture.format) ?? 'image/jpeg';
  const artworkBuffer = picture.data instanceof Uint8Array
    ? picture.data
    : new Uint8Array(picture.data);

  return URL.createObjectURL(new Blob([artworkBuffer], {
    type: artworkMimeType,
  }));
};

export const extractGlowPaletteFromArtwork = async (artworkUrl) => {
  const image = await loadArtworkForSampling(artworkUrl);
  const sampleCanvas = document.createElement('canvas');
  const sampleSize = 36;

  sampleCanvas.width = sampleSize;
  sampleCanvas.height = sampleSize;

  const context = sampleCanvas.getContext('2d', { willReadFrequently: true });

  if (!context) {
    throw new Error('Canvas sampling is unavailable.');
  }

  const squareSize = Math.min(image.naturalWidth || image.width, image.naturalHeight || image.height);
  const sourceX = ((image.naturalWidth || image.width) - squareSize) / 2;
  const sourceY = ((image.naturalHeight || image.height) - squareSize) / 2;

  context.drawImage(
    image,
    sourceX,
    sourceY,
    squareSize,
    squareSize,
    0,
    0,
    sampleSize,
    sampleSize,
  );

  const imageData = context.getImageData(0, 0, sampleSize, sampleSize).data;
  const colorBuckets = new Map();

  for (let index = 0; index < imageData.length; index += 4) {
    const alpha = imageData[index + 3] / 255;

    if (alpha < 0.85) {
      continue;
    }

    const red = imageData[index];
    const green = imageData[index + 1];
    const blue = imageData[index + 2];
    const maxChannel = Math.max(red, green, blue);
    const minChannel = Math.min(red, green, blue);
    const brightness = (red + green + blue) / (255 * 3);
    const saturation = maxChannel
      ? (maxChannel - minChannel) / maxChannel
      : 0;

    if (brightness < 0.08) {
      continue;
    }

    const bucketRed = Math.round(red / 24) * 24;
    const bucketGreen = Math.round(green / 24) * 24;
    const bucketBlue = Math.round(blue / 24) * 24;
    const bucketKey = `${bucketRed}-${bucketGreen}-${bucketBlue}`;
    const weight = 1 + (saturation * 2.1) + (brightness * 0.35);
    const existingBucket = colorBuckets.get(bucketKey) ?? {
      weight: 0,
      red: 0,
      green: 0,
      blue: 0,
    };

    existingBucket.weight += weight;
    existingBucket.red += red * weight;
    existingBucket.green += green * weight;
    existingBucket.blue += blue * weight;

    colorBuckets.set(bucketKey, existingBucket);
  }

  const rankedColors = [...colorBuckets.values()]
    .map((bucket) => ({
      weight: bucket.weight,
      r: bucket.red / bucket.weight,
      g: bucket.green / bucket.weight,
      b: bucket.blue / bucket.weight,
    }))
    .sort((firstBucket, secondBucket) => secondBucket.weight - firstBucket.weight);

  const distinctColors = [];

  rankedColors.forEach((candidateColor) => {
    if (distinctColors.length >= 3) {
      return;
    }

    const isDistinctEnough = distinctColors.every(
      (existingColor) => getColorDistance(existingColor, candidateColor) >= 52,
    );

    if (isDistinctEnough) {
      distinctColors.push(candidateColor);
    }
  });

  return finalizeGlowPalette(distinctColors);
};

export const revokeMetadataArtworkUrl = (metadata) => {
  if (!metadata?.artworkUrl || !metadata.artworkIsObjectUrl) {
    return;
  }

  URL.revokeObjectURL(metadata.artworkUrl);
};

export const revokeArtworkDisplayTarget = (target) => {
  if (!target?.metadata) {
    return;
  }

  revokeMetadataArtworkUrl(target.metadata);
};
