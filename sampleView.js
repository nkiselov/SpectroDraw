
function stringToColor(str) {
    if(!isNaN(str)) str+='caa'
    // Use djb2 hash for better distribution
    let hash = 5381;
    for (let c of str) {
      hash = ((hash << 5) + hash) + c.charCodeAt(0);
    }
    hash = Math.abs(hash);
    
    // Map to [0,1] range excluding 220-260 degrees when scaled to 360
    const available = 320; // 360 - (260-220) = 320 degrees available
    let hue = (hash % available) / available; // [0,1]
    
    // Shift values that would fall in 220-260 range
    if (hue * 360 >= 220) {
      hue = (hue * 360 + 40) / 360; // Add width of excluded range
    }
    
    return `hsl(${Math.floor(hue * 360)}, 100%, 50%)`;
}

function makeTranscriptLine(){
    let container = document.createElement("div")
    container.style.display = "flex"
    container.style.position = "relative"
    container.style.paddingBottom = "20px"
    return {
        html: makevbox([container]),
        setTranscript: (width, transcript)=>{
            container.innerHTML = ""
            transcript.forEach(el => {
                let block = makeh(el.symbol)
                block.style.width = (100*(el.end-el.start)/width)+"%"
                block.style.left = (100*el.start/width)+"%"
                block.style.background = stringToColor(el.symbol)
                block.style.textAlign = "center"
                block.style.position = "absolute"
                block.style.height = "20px"
                container.appendChild(block)
            });
        },
        eraseTranscript: ()=>{
            container.innerHTML = ""
        }
    }
}

function make2DArrayView(){
    let canvas = document.createElement("canvas")
    let container = makehbox([canvas])
    canvas.style.width = "100%"
    canvas.style.height = "250px"
    return {
        html: container,
        setData: data=>{
            const ctx = canvas.getContext('2d');
            const width = data.length;
            const height = data[0].length;
            
            canvas.width = width;
            canvas.height = height;
            canvas.style.aspectRatio = width/height;
            const imageData = ctx.createImageData(width, height);
            
            // Find max value for normalization
            const maxVal = maxArr(data.flat());
            
            for (let x = 0; x < width; x++) {
                for (let y = 0; y < height; y++) {
                const i = ((height-1-y) * width + x) * 4;
                const intensity = Math.log1p(data[x][y]) / Math.log1p(maxVal);
                
                // Grayscale visualization
                const value = Math.floor(intensity * 255);
                imageData.data[i] = value;     // R
                imageData.data[i+1] = value;   // G
                imageData.data[i+2] = value;   // B
                imageData.data[i+3] = 255;     // A
                }
            }
            
            ctx.putImageData(imageData, 0, 0);
        }
    }
}

function makeSpectrogramView(){
    let view = make2DArrayView()
    return {
        html: view.html,
        setAudio: audio=>{
            view.setData(fft.createSpectrogram(audio).spectrogram)
        }
    }
}

class PCMPlayer {
    constructor(sampleRate = 16000) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)()
      this.sampleRate = sampleRate
    }
  
    setAudioData(data) {
        this.data = data
        this.time = 0
    }

    play(offset){
        if(this.curSource) this.curSource.stop()
        let data = this.data
        const audioBuffer = this.audioContext.createBuffer(1, data.length, this.sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        for (let i = 0; i < data.length; i++) {
            channelData[i] = data[i];
        }
        let source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext.destination);
        source.start(0,offset)
        let interval = setInterval(()=>{
            this.updateTime(offset+this.audioContext.currentTime-startTime)
        },10)
        source.onended = ()=>{
            clearInterval(interval)
        }
        this.curSource = source
        let startTime = this.audioContext.currentTime
    }

    updateTime(time){
        this.time = time
        if(this.timeCallback) this.timeCallback(this.time)
    }

    start() {
        this.setTime(0)
    }

    stop(){
        this.updateTime(0)
        if(this.curSource) this.curSource.stop()
    }

    setTime(time){
        this.updateTime(time)
        this.play(this.time)
    }

    getLength(){
        return (this.data.length/this.sampleRate)
    }
}

function makeProgressLine(){
    let line = document.createElement("div")
    line.style.height = "100%"
    line.style.width = "1px"
    line.style.position = "absolute"
    line.style.background = "red"
    return {
        html: line,
        setProgress: (p)=>line.style.left = (100*p)+"%"
    }
}

function makeSampleView(){
    let title = makeh("Sample View")
    let transcriptLines = new Array(1).fill(0).map(()=>makeTranscriptLine())
    let spectrogram = makeSpectrogramView()
    let audioPlayer = new PCMPlayer()
    let progressLine = makeProgressLine()
    audioPlayer.timeCallback = (t)=>progressLine.setProgress(t/audioPlayer.getLength())
    let spectrogramContainer = makevbox([
        spectrogram.html,
        progressLine.html
    ])
    makeKeyDown(spectrogramContainer,(x,y)=>audioPlayer.setTime(audioPlayer.getLength()*x))
    spectrogramContainer.style.position = "relative"
    let curAudio
    let container = makevbox([
        makehbox([
            makeButton("Start",()=>audioPlayer.start()),
            makeButton("Stop",()=>audioPlayer.stop()),
            makeButton("Download",()=>wavio.downloadWav(curAudio,"sample.wav")),
            title
        ]),
        spectrogramContainer,
        ...transcriptLines.map(el=>el.html)
    ])
    container.style.width = "100%"
    return {
        html: container,
        setAudio: (audio)=>{
            curAudio = audio
            spectrogram.setAudio(audio)
            audioPlayer.setAudioData(audio)
            title.innerHTML = ""
            transcriptLines[0].eraseTranscript()
            // transcriptLines[1].eraseTranscript()
        },
        setSample: (sample)=>{
            curAudio = sample.audio
            spectrogram.setAudio(sample.audio)
            audioPlayer.setAudioData(sample.audio)
            transcriptLines[0].setTranscript(sample.audio.length,sample.phonetic)
            // transcriptLines[1].setTranscript(sample.audio.length,sample.word)
            title.innerHTML = sample.sentence.symbol
        }
    }
}

function make2DArrayViewTranscript(){
    let transcriptLines = new Array(1).fill(0).map(()=>makeTranscriptLine())
    let arrayView = make2DArrayView()
    return {
        html: makevbox([arrayView.html,...transcriptLines.map(el=>el.html)]),
        setData: data => arrayView.setData(data),
        setTranscript: (ind,width,trans) => transcriptLines[ind].setTranscript(width,trans)
    }
}

function make2DArrayViewGallery(name,arrs,n){
    shuffleArr(arrs)
    let tables = Array(n).fill(0).map(()=>make2DArrayView())
    let input = makeInput("<b>"+name+"</b>",0,val=>{
        let start = Math.max(n*val,0)
        let end = Math.min(arrs.length,n*val+n)
        for(let i=0; i<n; i++){
            if(start+i<end){
                tables[i].html.style.display="block"
                tables[i].setData(arrs[start+i])
            }else{
                tables[i].html.style.display="none"
            }
        }
    })
    let res = makehbox(tables.map(tbl=>makevbox([tbl.html])))
    res.style.justifyContent="center"
    res.style.gap="10px"
    return makevbox([makehbox([input.html,makeh(arrs.length+"/"+n)]),res])
}