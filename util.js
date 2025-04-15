function maxArr(arr){
    return arr.reduce((sm, a) => Math.max(sm,a), 0)
}

function flipVector(v){
  return [...Array(v.length).keys()].map(i=>v[v.length-1-i])
}

function interpolateVectors(vectors, targetLength) {
  if (vectors.length === 0) return [];
  if (vectors.length === 1) return Array(targetLength).fill([...vectors[0]]);
  
  // Calculate the step size in the original array for each new point
  const step = (vectors.length - 1) / (targetLength - 1);
  const result = [];
  
  for (let i = 0; i < targetLength; i++) {
      const pos = i * step;
      const index = Math.floor(pos);
      const fraction = pos - index;
      
      // Handle the case when we're at the last original vector
      if (index >= vectors.length - 1) {
          result.push([...vectors[vectors.length - 1]]);
          continue;
      }
      
      // Linearly interpolate between current and next vector
      const current = vectors[index];
      const next = vectors[index + 1];
      const interpolated = current.map((val, j) => 
          val + fraction * (next[j] - val)
      );
      
      result.push(interpolated);
  }
  
  return result;
}

function addHarmonicStacks(vectors, step, decay){
  return vectors.map(v=>v.map((x,i)=>{
      let harmonic = 2*Math.pow(Math.sin(i/step*Math.PI),4)
      let noise = Math.random()*0.4
      let w0 = Math.exp(-i/decay)
      let w1 = 1-w0
      return (w0*harmonic + w1*noise)*x
  }))
}

function normalizeAudio(audio){
    let vr = 0
    audio.forEach(x=>vr+=x*x)
    vr = Math.sqrt(vr/audio.length)
    return audio.map(x=>x/vr/10)
}