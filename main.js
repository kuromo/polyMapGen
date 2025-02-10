let map = {}
let canvasSize = {width: 400, height: 200}
let waterColor = "hsl(240, 30%, 50%)"
let landColor = "hsl(90, 20%, 50%)"



function updateCanvas(e){
    let axis = e.dataset.axis
    document.querySelectorAll('canvas').forEach(element => {
        element[axis] = parseInt(e.value)
        canvasSize[axis] = parseInt(e.value)
    });
}


function genPoint(wLines){
    let spacing = parseInt(document.getElementById("spacePoints").value)
    let pointGen = poissonDiscSampler(canvasSize.width,canvasSize.height,spacing)
    
    console.log("gen start")
    let poiArr = []
    let convertedPoints = []


    for (let i = 0; i < document.getElementById("amtPoints").value; i++) {
        let currPt = pointGen.next().value 
        if(!currPt){
            
        }else if(currPt.add){
            poiArr.push(currPt)
            convertedPoints.push({x:currPt.add[0], y:currPt.add[1]})
        }else if(currPt.remove){
            
        }
    }
    console.log(poiArr)
    console.log(convertedPoints)

    printPoints(poiArr,wLines)
    genVoro(convertedPoints)
}

function printPoints(poiArr,wLines){
    console.log("wiline = " +wLines)
    let c = document.getElementById("myCanvas");
    let ctx = c.getContext("2d");
    ctx.clearRect(0,0,canvasSize.width,canvasSize.height)

    for(let i in poiArr){

        //draw lines
        if(wLines && poiArr[i].parent){
            console.log("has wl and parent")
            ctx.beginPath()
            ctx.lineWidth = 0.05;
            ctx.strokeStyle = "#0f0"
            ctx.moveTo(poiArr[i].add[0],poiArr[i].add[1]);
            ctx.lineTo(poiArr[i].parent[0],poiArr[i].parent[1]);
            ctx.stroke();
        }

        //draw points
        ctx.fillStyle = "red"
        ctx.beginPath()
        ctx.fillRect(poiArr[i].add[0],poiArr[i].add[1],1,1);
        
    }
}

function genBorderPoints(points){
    //add point outsine of map bounds to generate cleaner corner polygons

    let spacing = parseInt(document.getElementById("spacePoints").value)
    let borderSpace = spacing//10
    //calculate how many points on each axis (+1 for 0 point)
    let xPointsAmnt = Math.floor(canvasSize.width / spacing) +1
    let yPointsAmnt = Math.floor(canvasSize.height / spacing) +1

        let layers = document.getElementById("borderLayers").value
        for (let l = 1; l <= layers; l++) {
            //add 4 corner points
            points.push({x: -borderSpace * l, y: -borderSpace * l});                                  // LT
            points.push({x: canvasSize.width + borderSpace * l, y: canvasSize.height + borderSpace * l}); // RB
            points.push({y: -borderSpace * l, x: canvasSize.width + borderSpace * l});                  // RT
            points.push({y: canvasSize.height + borderSpace * l, x: -borderSpace * l});                 // LB

            //gen x axis points
            for (let i = 0; i < xPointsAmnt; i++) {
                points.push({x: spacing * i, y: -borderSpace * l});
                points.push({x: spacing * i, y: canvasSize.height + borderSpace * l});
            }

            //gen y axis points
            for (let i = 0; i < yPointsAmnt; i++) {
                points.push({x: -borderSpace * l, y: spacing * i});
                points.push({x: canvasSize.width + borderSpace * l, y: spacing * i});
            }
        }


    return points
}

function genVoro(points){
    if(document.getElementById("borderfix").checked){
        points = genBorderPoints(points)
    }

    let delaunay = Delaunator.from(points, loc => loc.x, loc => loc.y);
    const numTriangles = delaunay.halfedges.length / 3;
    let centroids = [];

    for (let t = 0; t < numTriangles; t++) {
        let sumOfX = 0, sumOfY = 0;
        for (let i = 0; i < 3; i++) {
            let s = 3*t + i;
            let p = points[delaunay.triangles[s]];
            sumOfX += p.x;
            sumOfY += p.y;
        }
        centroids[t] = {x: sumOfX / 3, y: sumOfY / 3};
    }

    //console.log(centroids)

    map = {
        points: points,
        numRegions: points.length,
        numTriangles: delaunay.halfedges.length / 3,
        numEdges: delaunay.halfedges.length,
        halfedges: delaunay.halfedges,
        triangles: delaunay.triangles,
        centers: centroids
    };

    console.log(map)
    drawCellBoundaries(document.getElementById("voroCanvas"),map, delaunay)
}


function triangleOfEdge(e)  { return Math.floor(e / 3); }
function nextHalfedge(e) { return (e % 3 === 2) ? e - 2 : e + 1; }

function drawCellBoundaries(canvas, map, delaunay) {
    let {points, centers, halfedges, triangles, numEdges} = map;
    let ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvasSize.width,canvasSize.height)
    ctx.save();
    ctx.lineWidth = 0.02;
    ctx.strokeStyle = "#0f0";
    for (let e = 0; e < numEdges; e++) {
        if (e < delaunay.halfedges[e]) {
            const p = centers[triangleOfEdge(e)];
            const q = centers[triangleOfEdge(halfedges[e])];
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
        }
    }

    if(document.getElementById("renderCenters").checked){
        for(let i in centers){

            //draw points
            ctx.fillStyle = "blue"
            ctx.beginPath()
            ctx.fillRect(centers[i].x,centers[i].y,1,1);
            
        }
    }
    if(document.getElementById("renderPoints").checked){
        for(let i in points){

            //draw points
            ctx.fillStyle = "red"
            ctx.beginPath()
            ctx.fillRect(points[i].x,points[i].y,1,1);
            
        }
    }

    ctx.restore();

    map.elevation = assignElevation(map);

    let elevTresh = parseFloat(document.getElementById("elevationTresh").value)
    drawCellColors(
        document.getElementById("elevationCanvas"),
        map,
        r => map.elevation[r] < elevTresh? waterColor : landColor,
        delaunay
    );

    console.log(map)
}

function assignElevation(map) {
    let waveLength = parseFloat(document.getElementById("noiseWL").value)
    const noise = new SimplexNoise();
    let {points, numRegions} = map;
    let elevation = [];
    for (let r = 0; r < numRegions; r++) {
        let nx = points[r].x / canvasSize.width - 1/2,
            ny = points[r].y / canvasSize.height - 1/2;
        // start with noise:
        elevation[r] = (1 + noise.noise2D(nx / waveLength, ny / waveLength)) / 2;
        // modify noise to make islands:
        let d = 2 * Math.max(Math.abs(nx), Math.abs(ny)); // should be 0-1
        //console.log(d)
        elevation[r] = (1 + elevation[r] - d) / 2;
    }
    return elevation;
}

function edgesAroundPoint(delaunay, start) {
    const result = [];
    let incoming = start;
    do {
        result.push(incoming);
        const outgoing = nextHalfedge(incoming);
        incoming = delaunay.halfedges[outgoing];
    } while (incoming !== -1 && incoming !== start);
    return result;
}

function drawCellColors(canvas, map, colorFn, delaunay) {
    let ctx = canvas.getContext('2d');
    ctx.save();
    ctx.clearRect(0,0,canvasSize.width,canvasSize.height)
    let seen = new Set();  // of region ids
    let {triangles, numEdges, centers, points} = map;
    for (let e = 0; e < numEdges; e++) {
        const r = triangles[nextHalfedge(e)];
        if (!seen.has(r)) {
            seen.add(r);
            let vertices = edgesAroundPoint(delaunay, e)
                .map(e => centers[triangleOfEdge(e)]);
            ctx.fillStyle = colorFn(r);
            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);
            
            for (let i = 1; i < vertices.length; i++) {
                ctx.lineTo(vertices[i].x, vertices[i].y);
                //set poly to water if any point is outside canvas
                if(vertices[i].x<0||vertices[i].y<0||vertices[i].x>canvasSize.width||vertices[i].y>canvasSize.height){
                    ctx.fillStyle = waterColor
                }

                //@TODO maybe figgure out this shit? some edgesAroundPoint returns have less than 3 vertices (no triangle/poly)
                /*if(vertices.length<3){
                    
                    ctx.strokeStyle = "magenta"
                    ctx.stroke()
                    ctx.moveTo(vertices[i].x, vertices[i].y);
                }*/
            }
            if(vertices.length<3){
                //ctx.strokeStyle = "pink"
                //ctx.stroke()
            }else{
                ctx.fill();
            }
            //console.log(vertices.length)
        }
    }

    if(document.getElementById("renderCenters").checked){
        for(let i in centers){

            //draw points
            ctx.fillStyle = "blue"
            ctx.beginPath()
            ctx.fillRect(centers[i].x,centers[i].y,1,1);
            
        }
    }
    if(document.getElementById("renderPoints").checked){
        for(let i in points){

            //draw points
            ctx.fillStyle = "red"
            ctx.beginPath()
            ctx.fillRect(points[i].x,points[i].y,1,1);
            
        }
    }
}

