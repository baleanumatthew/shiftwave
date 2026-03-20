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
    const tempo = extractTempo(audio, sampleRate);
    self.postMessage({
        tempo: tempo.tempo,
    });
};

const extractTempo = (audioSrc, sampleRate) => {
    const audioVector = essentia.arrayToVector(audioSrc);
    const tempo = essentia.RhythmExtractor(
        audioVector, 
        undefined, 
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        sampleRate);
    audioVector.delete();
    return {tempo: tempo.bpm};
};

