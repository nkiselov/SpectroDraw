function makeButton(label, onclick){
    let button = document.createElement("button")
    button.onclick = onclick
    button.innerHTML = label
    return button
}

function makehbox(elems){
    let hbox = document.createElement("div")
    hbox.className = "hbox"
    elems.forEach((e)=>hbox.appendChild(e))
    return hbox
}

function makevbox(elems){
    let vbox = document.createElement("div")
    vbox.className = "vbox"
    elems.forEach((e)=>vbox.appendChild(e))
    return vbox
}

function makeh(text){
    let h = document.createElement("h")
    h.innerHTML = text
    return h
}

function makeCanvas(cellSize,cols,rows){
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    canvas.width = cellSize*cols
    canvas.height = cellSize*rows
    canvas.style.width = canvas.width/2
    canvas.style.height = canvas.height/2
    let arr

    function render() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                const value = arr[x][rows-1-y];
                const hue = 240 *Math.pow(1-value,2);
                ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
                ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
            }
        }
    }

    return {
        html: canvas,
        setArray: sarr=>{
            arr = sarr
            render()
        }
    }
}

function makeDrawableCanvas(cellSize,cols,rows){
    let canvas = makeCanvas(cellSize,cols,rows)
    
    let grid = Array(cols).fill().map(() => Array(rows).fill(0));
    
    let brushRadius = 60;
    let brushIntensity = 5;
    let isDrawing = false;
    let stride = 0.01
    let px = 0
    let py = 0
    const brushSizeDisplay = makeh(brushRadius)
    function drawCell(x,y,intensity) {
        const center = {
            x: Math.round(x*cols),
            y: Math.round(y*rows)
        };
        
        const radiusCells = Math.ceil(brushRadius / cellSize);
        
        for (let i = -radiusCells; i <= radiusCells; i++) {
            for (let j = -radiusCells; j <= radiusCells; j++) {
                const cellX = center.x + j;
                const cellY = center.y + i;
                
                if (cellX >= 0 && cellX < cols && cellY >= 0 && cellY < rows) {
                    const distanceX = (cellX - center.x) * cellSize;
                    const distanceY = (cellY - center.y) * cellSize;
                    const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
                    
                    if (distance <= brushRadius) {
                        grid[cellX][rows-1-cellY] += intensity * Math.pow(1 - distance / brushRadius,2);
                        grid[cellX][rows-1-cellY] = Math.min(1, grid[cellX][rows-1-cellY]);
                    }
                }
            }
        }
        
        canvas.setArray(grid)
    }
    
    window.addEventListener('mousedown', (e) => {
        isDrawing = true;
    });
    
    window.addEventListener('mousemove', (e) => {
        const rect = canvas.html.getBoundingClientRect();
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        if (isDrawing) {
            let len = 0
            while(true){
                let dx = x-px
                let dy = y-py
                len = Math.sqrt(dx*dx+dy*dy)
                if(len<stride) break
                px+=stride*dx/len
                py+=stride*dy/len
                drawCell(px,py,brushIntensity*stride);
                console.log(len)
            }
            drawCell(x,y,brushIntensity*len);
        }
        px = x
        py = y
    });
    
    window.addEventListener('mouseup', () => {
        isDrawing = false;
    });
    
    canvas.html.addEventListener('wheel', (e) => {
        e.preventDefault();
        brushRadius = Math.max(1, brushRadius - Math.sign(e.deltaY) * 2);
        brushSizeDisplay.textContent = brushRadius;
    }, { passive: false });
    
    canvas.setArray(grid)

    return {
        html: makevbox([
            brushSizeDisplay,
            canvas.html,
            makeButton("Clear",()=>{
                grid = Array(cols).fill().map(() => Array(rows).fill(0));
                canvas.setArray(grid)
            })
        ]),
        getArray: ()=>grid
    }
}

function makeKeyDown(elem, callback) {
    elem.addEventListener('mousedown', e => {
        const rect = elem.getBoundingClientRect();
        
        const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
        
        callback(x, y);
    });
}
