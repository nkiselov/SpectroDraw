(()=>{
let w = 100
let h = 80
let s = 5
let fftSize = 512
let SAMPLE_RATE = 16000
let canv = makeDrawableCanvas(10,w,h)
let linSpec = makeCanvas(2,s*w,fftSize)
let hmSpec = makeCanvas(2,s*w,fftSize)
let audioView = makeSampleView()
audioView.html.style.width = "800px"

let compBtn = makeButton("Compute",()=>{
    let mSpec = interpolateVectors(canv.getArray(),s*w)
    mSpec.map(v=>v.map(x=>Math.exp(x)-1))
    let spec = melToLinear(mSpec,fftSize,6000,SAMPLE_RATE)
    linSpec.setArray(spec)
    let hspec = addHarmonicStacks(spec,8,200)
    hmSpec.setArray(hspec)
    hspec = hspec.map(v=>v.map(x=>Math.exp(5*x)-1))
    let audio = griffinLim(hspec,fftSize,64,5)
    audio = normalizeAudio(audio)
    audioView.setAudio(audio)
})

document.body.appendChild(
    makevbox([
        makehbox([compBtn]),
        makehbox([
            canv.html,
        ]),
        makehbox([
            linSpec.html,
            hmSpec.html,
        ]),
        audioView.html
    ])
)
})()