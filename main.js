let map = {}
let canvasSize = {width: 400, height: 200}
let waterColor = "hsl(240, 30%, 50%)"
let landColor = "hsl(90, 20%, 50%)"

function updateCanvasSize(e){
    let axis = e.dataset.axis
    document.querySelectorAll('canvas').forEach(element => {
        element[axis] = parseInt(e.value)
        canvasSize[axis] = parseInt(e.value)
    });
}

function getCanvasContext(canvasId){
    let c = document.getElementById(canvasId);
    let ctx = c.getContext("2d");

    return ctx
}

//delauney halpers
function triangleOfEdge(e)  { return Math.floor(e / 3); }
function edgesOfTriangle(t) { return [3 * t, 3 * t + 1, 3 * t + 2]; }
function nextHalfedge(e) { return (e % 3 === 2) ? e - 2 : e + 1; }
function prevHalfedge(e) { return (e % 3 === 0) ? e + 2 : e - 1; }
function pointsOfTriangle(t) {
    return edgesOfTriangle(t)
        .map(e => map.triangles[e]);
}
function trianglesAdjacentToTriangle(t) {
    const adjacentTriangles = [];
    for (const e of edgesOfTriangle(t)) {
        const opposite = map.halfedges[e];
        if (opposite >= 0) {
            adjacentTriangles.push(triangleOfEdge(opposite));
        }
    }
    return adjacentTriangles;
}
function edgesAroundPoint(start) {
    const result = [];
    let incoming = start;
    do {
        result.push(incoming);
        const outgoing = nextHalfedge(incoming);
        incoming = map.halfedges[outgoing];
    } while (incoming !== -1 && incoming !== start);
    return result;
}
// helper to get edgesAroundPoint from point id/index
function pointIdToPoint(pId){
    for (let e = 0; e < map.triangles.length; e++) {
        const p = map.triangles[nextHalfedge(e)];
        if (map.points.indexOf(map.points[p])==pId) {
            //return first result as multiple edges will end there
            return e
        }
    }
}



function genMap(){
    genPoints(getCanvasContext("poissonCanvas"))
    initDelauney()
    genCentroids()
    drawVoronoiEdges(getCanvasContext("voroCanvas"))
    noiseElevation();
    map.elevationTreshold = parseFloat(document.getElementById("elevationTresh").value)

    drawCellColors(
        getCanvasContext("elevationCanvas"),
        r => map.elevation[r] < map.elevationTreshold? waterColor : landColor
    );
}

//generate points with poisson disc sampling
function genPoints(ctx){
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

    if(document.getElementById("borderfix").checked){
        convertedPoints = addGeneratedBorderPoints(convertedPoints)
    }

    map.points = convertedPoints
    map.numRegions = convertedPoints.length

    //if canvasId parameter render points on it
    if(ctx){
        printPoints(poiArr, ctx)
    }
}

function printPoints(poiArr, ctx){
    let renderLines = document.getElementById("renderPoissonLines").checked
    ctx.clearRect(0,0,canvasSize.width,canvasSize.height)

    for(let i in poiArr){

        //draw lines
        if(renderLines && poiArr[i].parent){
            console.log("has wl and parent")
            ctx.beginPath()
            ctx.lineWidth = 0.5;
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

function addGeneratedBorderPoints(points){
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

function initDelauney(){
    let delaunay = Delaunator.from(map.points, loc => loc.x, loc => loc.y);
    const numTriangles = delaunay.halfedges.length / 3;

    map.numTriangles = delaunay.halfedges.length / 3
    map.numEdges = delaunay.halfedges.length
    map.halfedges = delaunay.halfedges
    map.triangles = delaunay.triangles
}

function genCentroids(){
    let centroids = [];

    for (let t = 0; t < map.numTriangles; t++) {
        let sumOfX = 0, sumOfY = 0;
        for (let i = 0; i < 3; i++) {
            let s = 3*t + i;
            let p = map.points[map.triangles[s]];
            sumOfX += p.x;
            sumOfY += p.y;
        }
        centroids[t] = {x: sumOfX / 3, y: sumOfY / 3};
    }

    map.centers = centroids
}

function drawVoronoiEdges(ctx) {
    if(!ctx){
        //cant render without canvas
        return
    }
    let {points, centers, halfedges, triangles, numEdges} = map;

    ctx.clearRect(0,0,canvasSize.width,canvasSize.height)
    ctx.lineWidth = 0.5;

    for (let e = 0; e < numEdges; e++) {
        if (e < map.halfedges[e]) {
            const p = centers[triangleOfEdge(e)];
            const q = centers[triangleOfEdge(halfedges[e])];

            ctx.strokeStyle = "#0f0";
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
        }
    }

    //debug render options
    if(document.getElementById("renderTriangles").checked){
        for(let i = 0; i < triangles.length; i++){
            if (i > halfedges[i]) {
                const p = points[triangles[i]];
                const q = points[triangles[nextHalfedge(i)]];
                ctx.strokeStyle = "orange"
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(q.x, q.y);
                ctx.stroke();
            }
        }
    }
    if(document.getElementById("renderCenters").checked){
        for(let i in centers){
            ctx.fillStyle = "blue"
            ctx.beginPath()
            ctx.fillRect(centers[i].x,centers[i].y,1,1);
        }
    }
    if(document.getElementById("renderPoints").checked){
        for(let i in points){
            ctx.fillStyle = "red"
            ctx.beginPath()
            ctx.fillRect(points[i].x,points[i].y,1,1);
        }
    }
}

function noiseElevation() {
    let waveLength = parseFloat(document.getElementById("noiseWL").value)

    let noiseSeed = Math.random()
    if(document.getElementById("customNoiseSeed").checked){
        noiseSeed = parseFloat(document.getElementById("noiseSeed").value)
    }
    document.getElementById("noiseSeed").value = noiseSeed

    const noise = new SimplexNoise(noiseSeed);
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
    map.elevation = elevation
}

function drawCellColors(ctx, colorFn) {
    if(!ctx){
        //cant render without canvas
        return
    }
    ctx.clearRect(0,0,canvasSize.width,canvasSize.height)
    let seen = new Set();  // of region ids
    let {triangles, numEdges, centers, points} = map;
    let landTri = []
    for (let e = 0; e < numEdges; e++) {
        const r = triangles[nextHalfedge(e)];
        if (!seen.has(r)) {
            seen.add(r);
            let vertices = edgesAroundPoint(e)
                .map(e => centers[triangleOfEdge(e)])
            ctx.fillStyle = colorFn(r);
            ctx.beginPath();
            ctx.moveTo(vertices[0].x, vertices[0].y);


            if(map.elevation[r] > map.elevationTreshold){
                landTri.push(r)
            }
            
            for (let i = 1; i < vertices.length; i++) {
                ctx.lineTo(vertices[i].x, vertices[i].y);
                //set poly to water if any point is outside canvas
                if(vertices[i].x<0||vertices[i].y<0||vertices[i].x>canvasSize.width||vertices[i].y>canvasSize.height){
                    //ctx.fillStyle = waterColor

                    //@TODO set elevation of poly to sub treshold
                    //landTri.pop(r)

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

    map.landTri = landTri

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


function getLandPoints(){
    let landPoints = []

    for(let p = 0; p < map.points.length; p++){
        if(map.elevation[p]>map.elevationTreshold){
            landPoints.push(p)
        }
      }

    return landPoints
}

function drawShore(drawEdges){
    let c = document.getElementById("elevationCanvas")
    let ctx = c.getContext('2d');
    let landPoints = getLandPoints()
    let shorePoints = []

    for (let e = 0; e < landPoints.length; e++) {
        let originPoint = pointIdToPoint(landPoints[e])
        const edges = edgesAroundPoint(originPoint);
        
        for(let i = 0;i < edges.length; i++){
            let ptIndex = map.triangles[edges[i]]
            let pt = map.points[ptIndex]
            let triangle = triangleOfEdge(edges[i])
            if(!landPoints.includes(ptIndex)){
                let oppositeEdge = map.halfedges[edges[i]]
                let oppositeTri = triangleOfEdge(oppositeEdge)
                let oppositePoint = map.points[map.triangles[oppositeEdge]]
                let coastP1 = map.centers[triangle]
                let coastP2 = map.centers[oppositeTri]

                //paint shore line (voronoi edges)
                ctx.beginPath()
                ctx.strokeStyle = "magenta"
                ctx.moveTo(coastP1.x,coastP1.y)
                ctx.lineTo(coastP2.x,coastP2.y)
                ctx.stroke()

                if(drawEdges){
                    // paint edges with one point on land and one in water
                    ctx.beginPath()
                    ctx.strokeStyle = "orange"
                    ctx.moveTo(oppositePoint.x,oppositePoint.y)
                    ctx.lineTo(pt.x,pt.y)
                    ctx.stroke()
                }

                if(!shorePoints.includes(map.triangles[oppositeEdge])){
                    shorePoints.push(map.triangles[oppositeEdge])
                }
            }
        }
    }

    map.shorePoints = shorePoints
    
}

function renderShorePoints(){
    let c = document.getElementById("elevationCanvas")
    let ctx = c.getContext('2d');
    for(let p in map.shorePoints){
        let pt = map.points[map.shorePoints[p]]

        ctx.fillStyle = "yellow"
        ctx.beginPath()
        ctx.fillRect(pt.x,pt.y,2,2);
    }
}

function drawPolyById(inp){
    let c = document.getElementById("elevationCanvas")
    let ctx = c.getContext('2d');
   
    let originPt = pointIdToPoint(inp)
    const edges = edgesAroundPoint(originPt);
    const triangles = edges.map(e => triangleOfEdge(e))
    const vertices = triangles.map(p => map.centers[p])

    //console.log("origin point: " +map.points.indexOf(map.points[map.triangles[map.halfedges[edges[0]]]]))



    ctx.strokeStyle = "magenta"
    ctx.beginPath();
    ctx.moveTo(vertices[0].x, vertices[0].y);
    for (let i = 1; i < vertices.length; i++) {
        ctx.lineTo(vertices[i].x, vertices[i].y);
    }
    ctx.lineTo(vertices[0].x, vertices[0].y);
    ctx.stroke()


    for(let i = 0;i < edges.length; i++){
        let tri = map.triangles[edges[i]]
        let pt = map.points[tri]
        let sp = map.points[map.triangles[map.halfedges[edges[i]]]]

        ctx.beginPath()
        ctx.strokeStyle = "orange"
        ctx.moveTo(sp.x,sp.y)
        //ctx.lineTo(map.points[eop[e]].x,map.points[eop[e]].y)
        ctx.lineTo(pt.x,pt.y)
        ctx.stroke()
    }
}