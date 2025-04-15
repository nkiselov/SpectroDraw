(function(root, factory) {
    root.fft = factory.call(root);
}(this, function() {

function createSpectrogram(samples, {
    fftSize = 512,
    hopSize = 256,
    windowType = 'hann'
  } = {}) {
    const fft = new Float32Array(fftSize);
    const spectrum = new Float32Array(fftSize/2);
    const spectrogram = [];
    
    // Create window function
    const window = new Float32Array(fftSize);
    for (let i = 0; i < fftSize; i++) {
      if (windowType === 'hann') {
        window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (fftSize - 1)));
      }
    }
  
    let times = []
    // Process frames
    for (let start = 0; start + fftSize <= samples.length; start += hopSize) {
      // Apply window and prepare FFT input
      for (let i = 0; i < fftSize; i++) {
        fft[i] = samples[start + i] * window[i];
      }
      
      // Compute FFT
      const real = new Float32Array(fft);
      const imag = new Float32Array(fftSize);
      FFT(real, imag);
      
      // Compute magnitude spectrum
      for (let i = 0; i < fftSize/2; i++) {
        spectrum[i] = Math.sqrt(real[i]**2 + imag[i]**2);
      }
      
      spectrogram.push(Array.from(spectrum));
      times.push(start/16000)
    }
    
    return {
      spectrogram: spectrogram,
      times: times,
      freqs: [...Array(fftSize/2).keys()].map(i=>(i+1)/fftSize*16000)
    }
  }
  
  // FFT implementation
  function FFT(real, imag) {
    const n = real.length;
    
    // Bit reversal
    for (let i = 0; i < n; i++) {
      const j = reverseBits(i, Math.log2(n));
      if (j > i) {
        [real[i], real[j]] = [real[j], real[i]];
        [imag[i], imag[j]] = [imag[j], imag[i]];
      }
    }
    
    // Cooley-Tukey FFT
    for (let size = 2; size <= n; size *= 2) {
      const halfsize = size / 2;
      const angle = -2 * Math.PI / size;
      
      for (let i = 0; i < n; i += size) {
        for (let j = 0; j < halfsize; j++) {
          const k = i + j;
          const l = k + halfsize;
          const tReal = real[l] * Math.cos(angle * j) - imag[l] * Math.sin(angle * j);
          const tImag = real[l] * Math.sin(angle * j) + imag[l] * Math.cos(angle * j);
          real[l] = real[k] - tReal;
          imag[l] = imag[k] - tImag;
          real[k] = real[k] + tReal;
          imag[k] = imag[k] + tImag;
        }
      }
    }
  }
  
  function reverseBits(x, bits) {
    let y = 0;
    for (let i = 0; i < bits; i++) {
      y = (y << 1) | (x & 1);
      x >>= 1;
    }
    return y;
  }

  return {
    createSpectrogram: createSpectrogram
  }
}))