(function(root, factory) {
    root.wavio = factory.call(root);
}(this, function() {

function pcmToWav(pcmData, numChannels = 1, sampleRate = 16000, bitsPerSample = 16) {
    // Create the WAV file header
    const blockAlign = numChannels * (bitsPerSample / 8);
    const byteRate = sampleRate * blockAlign;
    const dataSize = pcmData.length * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataSize);
    const view = new DataView(buffer);

    // Write WAV header
    // "RIFF" chunk descriptor
    writeString(view, 0, 'RIFF');
    view.setUint32(4, 36 + dataSize, true);
    writeString(view, 8, 'WAVE');

    // "fmt " sub-chunk
    writeString(view, 12, 'fmt ');
    view.setUint32(16, 16, true); // fmt chunk size
    view.setUint16(20, 1, true); // audio format (1 for PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);

    // "data" sub-chunk
    writeString(view, 36, 'data');
    view.setUint32(40, dataSize, true);

    // Write PCM data
    if (bitsPerSample === 16) {
        let offset = 44;
        for (let i = 0; i < pcmData.length; i++) {
            view.setInt16(offset, pcmData[i] * 0x7FFF, true);
            offset += 2;
        }
    } else if (bitsPerSample === 8) {
        let offset = 44;
        for (let i = 0; i < pcmData.length; i++) {
            view.setUint8(offset, (pcmData[i] * 0x7F + 0x80));
            offset += 1;
        }
    }

    return buffer;
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

function downloadWav(pcmData, filename = 'audio.wav') {
    const wavBuffer = pcmToWav(pcmData);
    const blob = new Blob([wavBuffer], { type: 'audio/wav' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    
    URL.revokeObjectURL(url);
}

return {
    downloadWav: downloadWav
}

}))