/* global Essentia, importScripts */

let exports = {};

try {
    importScripts('https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.umd.js',
                  'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.js')
} catch (e) {
    console.error(e.message);
}

let essentia = new Essentia(exports.EssentiaWASM, false);
let audio = null;

onmessage = function listenToMainThread (msg) {
    if (!essentia) {
        this.postMessage({error: "EssentiaNotLoaded"});
        return 1;
    }

    audio = msg.data.audio;
    const sampleRate = msg.data.sr;
    const key = extractKey(audio, sampleRate);
    self.postMessage({
        key: key.key,
        scale: key.scale
    });
};

const extractKey = (audioSrc, sampleRate) => {
    const audioVector = essentia.arrayToVector(audioSrc);
    const key = essentia.KeyExtractor(
        audioVector,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        sampleRate);
    audioVector.delete();
    return {key: key.key, scale: key.scale};
};
