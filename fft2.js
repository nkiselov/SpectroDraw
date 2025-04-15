/**
 * Convert mel spectrogram to linear frequency spectrogram with resizing
 * @param {Array<Array<number>>} melSpectrogram - 2D array of mel spectrogram values
 * @param {number} targetHeight - Desired height (frequency bins) of output spectrogram
 * @returns {Array<Array<number>>} Linear frequency spectrogram
 */
function melToLinear(melSpectrogram, targetHeight, fmax, sampleRate) {
    const nFrames = melSpectrogram.length;
    const nMels = melSpectrogram[0].length;
    
    // Initialize output linear spectrogram
    const linearSpectrogram = Array(nFrames).fill().map(() => Array(targetHeight).fill(0));
    
    // For each frame
    for (let i = 0; i < nFrames; i++) {
      const melFrame = melSpectrogram[i];
      
      // For each target frequency bin
      for (let linearBin = 0; linearBin < targetHeight; linearBin++) {
        // Convert linear bin to frequency in Hz (assuming linear scale from 0 to Nyquist)
        const normalizedFreq = linearBin / (targetHeight - 1);
        
        // Convert to mel scale
        const melValue = hzToMel(normalizedFreq * sampleRate/2); // Assuming Nyquist = 22050 Hz
        
        // Find the corresponding position in mel bins (will be fractional)
        const melPosition = (melValue / hzToMel(fmax)) * nMels;
        
        // Linear interpolation between closest mel bins
        const melLowerBin = Math.floor(melPosition);
        const melUpperBin = Math.min(Math.ceil(melPosition), nMels - 1);
        const fraction = melPosition - melLowerBin;
        
        // Interpolate between the two closest mel bins
        if (melLowerBin >= 0 && melLowerBin < nMels) {
          if (melLowerBin === melUpperBin) {
            linearSpectrogram[i][linearBin] = melFrame[melLowerBin];
          } else {
            linearSpectrogram[i][linearBin] = 
              (1 - fraction) * melFrame[melLowerBin] + 
              fraction * melFrame[melUpperBin];
          }
        }
      }
    }
    
    return linearSpectrogram;
  }
  
  /**
   * Convert linear spectrogram to audio using Griffin-Lim algorithm
   * @param {Array<Array<number>>} linearSpectrogram - Linear frequency magnitude spectrogram
   * @param {number} fftSize - Size of FFT
   * @param {number} hopLength - Hop size between frames
   * @param {number} iterations - Number of Griffin-Lim iterations
   * @returns {Array<number>} Reconstructed audio waveform
   */
  function griffinLim(linearSpectrogram, fftSize, hopLength, iterations = 32) {
    const nFrames = linearSpectrogram.length;
    const nFft = (linearSpectrogram[0].length - 1) * 2;
    
    // Initialize random phase
    let angles = [];
    for (let i = 0; i < nFrames; i++) {
      const frameAngles = [];
      for (let j = 0; j < linearSpectrogram[0].length; j++) {
        frameAngles.push(Math.random() * 2 * Math.PI - Math.PI);
      }
      angles.push(frameAngles);
    }
    
    // Create complex spectrogram with magnitude and random phase
    let complexSpectrogram = linearSpectrogram.map((frame, i) => 
      frame.map((mag, j) => [mag * Math.cos(angles[i][j]), mag * Math.sin(angles[i][j])]));
    
    // Griffin-Lim iterations
    for (let i = 0; i < iterations; i++) {
      // Inverse STFT
      const waveform = istft(complexSpectrogram, hopLength, fftSize);
      
      // STFT
      const newComplexSpec = stft(waveform, fftSize, hopLength);
      
      // Update phase, keep magnitude
      complexSpectrogram = newComplexSpec.map((frame, i) => {
        return frame.map((bin, j) => {
          const magnitude = linearSpectrogram[i][j];
          const phase = Math.atan2(bin[1], bin[0]);
          return [magnitude * Math.cos(phase), magnitude * Math.sin(phase)];
        });
      });
    }
    
    // Final reconstruction
    return istft(complexSpectrogram, hopLength, fftSize);
  }
  
  /**
   * Create a mel filterbank matrix
   * @param {number} fftSize - Size of FFT
   * @param {number} sampleRate - Audio sample rate in Hz
   * @param {number} nMels - Number of mel bands
   * @param {number} minFreq - Minimum frequency in Hz
   * @param {number} maxFreq - Maximum frequency in Hz
   * @returns {Array<Array<number>>} Mel filterbank matrix
   */
  function createMelFilterbank(fftSize, sampleRate, nMels, minFreq, maxFreq) {
    const nFft = Math.floor(fftSize / 2) + 1;
    const filterbank = Array(nMels).fill().map(() => Array(nFft).fill(0));
    
    // Convert Hz to mel
    const melMin = hzToMel(minFreq);
    const melMax = hzToMel(maxFreq);
    
    // Create equally spaced points in mel scale
    const melPoints = [];
    for (let i = 0; i < nMels + 2; i++) {
      melPoints.push(melMin + (melMax - melMin) * i / (nMels + 1));
    }
    
    // Convert mel points back to Hz
    const freqPoints = melPoints.map(mel => melToHz(mel));
    
    // Convert Hz to FFT bin indices
    const fftFreqs = [];
    for (let i = 0; i < nFft; i++) {
      fftFreqs.push(i * sampleRate / fftSize);
    }
    
    // Create triangular filters
    for (let i = 0; i < nMels; i++) {
      const f_mel_lower = freqPoints[i];
      const f_mel_center = freqPoints[i + 1];
      const f_mel_upper = freqPoints[i + 2];
      
      for (let j = 0; j < nFft; j++) {
        const freq = fftFreqs[j];
        
        // Rising edge
        if (freq >= f_mel_lower && freq <= f_mel_center) {
          filterbank[i][j] = (freq - f_mel_lower) / (f_mel_center - f_mel_lower);
        }
        // Falling edge
        else if (freq >= f_mel_center && freq <= f_mel_upper) {
          filterbank[i][j] = (f_mel_upper - freq) / (f_mel_upper - f_mel_center);
        }
      }
    }
    
    return filterbank;
  }
  
  /**
   * Convert frequency in Hz to mel scale
   * @param {number} hz - Frequency in Hz
   * @returns {number} Frequency in mel scale
   */
  function hzToMel(hz) {
    return 2595 * Math.log10(1 + hz / 700);
  }
  
  /**
   * Convert mel scale frequency to Hz
   * @param {number} mel - Frequency in mel scale
   * @returns {number} Frequency in Hz
   */
  function melToHz(mel) {
    return 700 * (Math.pow(10, mel / 2595) - 1);
  }
  
  /**
   * Calculate pseudo-inverse of a matrix using SVD
   * @param {Array<Array<number>>} matrix - Input matrix
   * @returns {Array<Array<number>>} Pseudo-inverse of input matrix
   */
  function pinv(matrix) {
    // Very simplified pseudoinverse implementation
    // In a real implementation, use a proper linear algebra library
    // This is a naive implementation for demonstration
    
    const rows = matrix.length;
    const cols = matrix[0].length;
    const transpose = transposeMatrix(matrix);
    
    // For mel filterbank, often rows < cols, so use (M^T * M)^-1 * M^T
    if (rows < cols) {
      const mtm = multiplyMatrices(transpose, matrix);
      const mtmInv = invertMatrix(mtm);
      return multiplyMatrices(mtmInv, transpose);
    }
    // Otherwise use M^T * (M * M^T)^-1
    else {
      const mmt = multiplyMatrices(matrix, transpose);
      const mmtInv = invertMatrix(mmt);
      return multiplyMatrices(transpose, mmtInv);
    }
  }
  
  /**
   * Transpose a matrix
   * @param {Array<Array<number>>} matrix - Input matrix
   * @returns {Array<Array<number>>} Transposed matrix
   */
  function transposeMatrix(matrix) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const result = Array(cols).fill().map(() => Array(rows).fill(0));
    
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        result[j][i] = matrix[i][j];
      }
    }
    
    return result;
  }
  
  /**
   * Multiply two matrices
   * @param {Array<Array<number>>} a - First matrix
   * @param {Array<Array<number>>} b - Second matrix
   * @returns {Array<Array<number>>} Result of multiplication
   */
  function multiplyMatrices(a, b) {
    const rowsA = a.length;
    const colsA = a[0].length;
    const colsB = b[0].length;
    const result = Array(rowsA).fill().map(() => Array(colsB).fill(0));
    
    for (let i = 0; i < rowsA; i++) {
      for (let j = 0; j < colsB; j++) {
        for (let k = 0; k < colsA; k++) {
          result[i][j] += a[i][k] * b[k][j];
        }
      }
    }
    
    return result;
  }
  
  /**
   * Apply matrix multiplication to a vector
   * @param {Array<Array<number>>} matrix - Matrix
   * @param {Array<number>} vector - Vector
   * @returns {Array<number>} Result vector
   */
  function applyMatrix(matrix, vector) {
    const rows = matrix.length;
    const cols = matrix[0].length;
    const result = Array(rows).fill(0);
    
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < cols; j++) {
        result[i] += matrix[i][j] * vector[j];
      }
    }
    
    return result;
  }
  
  /**
   * Invert a matrix using Gaussian elimination
   * @param {Array<Array<number>>} matrix - Input matrix
   * @returns {Array<Array<number>>} Inverted matrix
   */
  function invertMatrix(matrix) {
    // Very simplified matrix inversion
    // In a real implementation, use a proper linear algebra library
    // This is a placeholder - real implementation requires LU decomposition or similar
    
    const n = matrix.length;
    const result = Array(n).fill().map(() => Array(n).fill(0));
    
    // Initialize identity matrix
    for (let i = 0; i < n; i++) {
      result[i][i] = 1;
    }
    
    // Deep copy the input matrix
    const augmentedMatrix = matrix.map(row => [...row]);
    
    // Gaussian elimination
    for (let i = 0; i < n; i++) {
      // Find pivot
      let maxRow = i;
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(augmentedMatrix[j][i]) > Math.abs(augmentedMatrix[maxRow][i])) {
          maxRow = j;
        }
      }
      
      // Swap rows
      if (maxRow !== i) {
        [augmentedMatrix[i], augmentedMatrix[maxRow]] = [augmentedMatrix[maxRow], augmentedMatrix[i]];
        [result[i], result[maxRow]] = [result[maxRow], result[i]];
      }
      
      // Scale pivot row
      const pivot = augmentedMatrix[i][i];
      for (let j = 0; j < n; j++) {
        augmentedMatrix[i][j] /= pivot;
        result[i][j] /= pivot;
      }
      
      // Eliminate other rows
      for (let j = 0; j < n; j++) {
        if (j !== i) {
          const factor = augmentedMatrix[j][i];
          for (let k = 0; k < n; k++) {
            augmentedMatrix[j][k] -= factor * augmentedMatrix[i][k];
            result[j][k] -= factor * result[i][k];
          }
        }
      }
    }
    
    return result;
  }
  
  /**
   * Short-time Fourier transform
   * @param {Array<number>} signal - Input audio signal
   * @param {number} fftSize - Size of FFT
   * @param {number} hopLength - Hop size between frames
   * @returns {Array<Array<Array<number>>>} Complex spectrogram
   */
  function stft(signal, fftSize, hopLength) {
    const numFrames = Math.floor((signal.length - fftSize) / hopLength) + 1;
    const result = [];
    
    for (let i = 0; i < numFrames; i++) {
      const start = i * hopLength;
      
      // Extract frame and apply window
      const frame = [];
      for (let j = 0; j < fftSize; j++) {
        if (start + j < signal.length) {
          // Apply Hann window
          const window = 0.5 * (1 - Math.cos(2 * Math.PI * j / fftSize));
          frame.push(signal[start + j] * window);
        } else {
          frame.push(0);
        }
      }
      
      // Compute FFT (this is a placeholder - real implementation would use FFT)
      const fftResult = computeFFT(frame);
      result.push(fftResult);
    }
    
    return result;
  }
  
  /**
   * Inverse short-time Fourier transform
   * @param {Array<Array<Array<number>>>} complexSpectrogram - Complex spectrogram
   * @param {number} hopLength - Hop size between frames
   * @param {number} fftSize - Size of FFT
   * @returns {Array<number>} Reconstructed audio signal
   */
  function istft(complexSpectrogram, hopLength, fftSize) {
    const numFrames = complexSpectrogram.length;
    const outputLength = (numFrames - 1) * hopLength + fftSize;
    const result = Array(outputLength).fill(0);
    const windowSum = Array(outputLength).fill(0);
    
    for (let i = 0; i < numFrames; i++) {
      const start = i * hopLength;
      
      // Compute inverse FFT
      const frame = computeIFFT(complexSpectrogram[i]);
      
      // Apply window and overlap-add
      for (let j = 0; j < fftSize; j++) {
        if (start + j < outputLength) {
          // Apply Hann window
          const window = 0.5 * (1 - Math.cos(2 * Math.PI * j / fftSize));
          result[start + j] += frame[j] * window;
          windowSum[start + j] += window * window;
        }
      }
    }
    
    // Normalize by window sum
    for (let i = 0; i < outputLength; i++) {
      if (windowSum[i] > 1e-6) {
        result[i] /= windowSum[i];
      }
    }
    
    return result;
  }
  
  /**
 * Compute FFT using Cooley-Tukey algorithm (radix-2)
 * @param {Array<number>} signal - Input signal (length must be power of 2)
 * @returns {Array<Array<number>>} Complex FFT result ([real, imag] pairs)
 */
function computeFFT(signal) {
    const n = signal.length;
    
    // Verify length is power of 2
    if ((n & (n - 1)) !== 0) {
        throw new Error("Signal length must be a power of 2");
    }
    
    // Base case
    if (n === 1) {
        return [[signal[0], 0]];
    }
    
    // Split into even and odd indices
    const even = [], odd = [];
    for (let i = 0; i < n; i++) {
        (i % 2 === 0 ? even : odd).push(signal[i]);
    }
    
    // Recursively compute FFT of even and odd parts
    const evenTransformed = computeFFT(even);
    const oddTransformed = computeFFT(odd);
    
    // Combine results
    const result = Array(n).fill().map(() => [0, 0]);
    const halfN = n / 2;
    
    for (let k = 0; k < halfN; k++) {
        // Compute twiddle factor
        const angle = -2 * Math.PI * k / n;
        const twiddleReal = Math.cos(angle);
        const twiddleImag = Math.sin(angle);
        
        // Multiply with odd part
        const oddReal = oddTransformed[k][0];
        const oddImag = oddTransformed[k][1];
        const productReal = twiddleReal * oddReal - twiddleImag * oddImag;
        const productImag = twiddleReal * oddImag + twiddleImag * oddReal;
        
        // Combine with even part
        const evenReal = evenTransformed[k][0];
        const evenImag = evenTransformed[k][1];
        
        // First half
        result[k][0] = evenReal + productReal;
        result[k][1] = evenImag + productImag;
        
        // Second half (using periodicity)
        result[k + halfN][0] = evenReal - productReal;
        result[k + halfN][1] = evenImag - productImag;
    }
    
    return result;
}

/**
 * Compute inverse FFT using Cooley-Tukey algorithm
 * @param {Array<Array<number>>} complexSignal - Complex input ([real, imag] pairs)
 * @returns {Array<number>} Real signal
 */
function computeIFFT(complexSignal) {
    const n = complexSignal.length;
    
    // Conjugate the input
    const conjugated = complexSignal.map(([real, imag]) => [real, -imag]);
    
    // Compute forward FFT of conjugated input
    const fftResult = computeFFT(conjugated.map(([real, imag]) => real));
    
    // Conjugate again and scale
    const result = fftResult.map(([real, imag]) => real / n);
    
    return result;
}

// Helper function to pad signal to next power of 2
function padToPowerOf2(signal) {
    const n = signal.length;
    const nextPower = Math.pow(2, Math.ceil(Math.log2(n)));
    return [...signal, ...Array(nextPower - n).fill(0)];
}
  
  // Example usage:
  // const melSpec = [...]; // Your mel spectrogram (list of lists)
  // const linearSpec = melToLinear(melSpec, 2048, 22050);
  // const audio = griffinLim(linearSpec, 2048, 512, 32);
