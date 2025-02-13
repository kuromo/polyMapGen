let map = {}
let delaunay
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

    delaunay = Delaunator.from(points, loc => loc.x, loc => loc.y);
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
function prevHalfedge(e) { return (e % 3 === 0) ? e + 2 : e - 1; }
function pointsOfTriangle(t) {
    return edgesOfTriangle(t)
        .map(e => map.triangles[e]);
}
function edgesOfTriangle(t) { return [3 * t, 3 * t + 1, 3 * t + 2]; }
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

function drawCellBoundaries(canvas, map, delaunay) {
    let {points, centers, halfedges, triangles, numEdges} = map;
    let ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,canvasSize.width,canvasSize.height)
    ctx.save();
    ctx.lineWidth = 0.5;
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
    return elevation;
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

function drawCellColors(canvas, map, colorFn, delaunay) {
    let ctx = canvas.getContext('2d');
    ctx.save();
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


            if(map.elevation[r] > parseFloat(document.getElementById("elevationTresh").value)){
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
        if(map.elevation[p]>parseFloat(document.getElementById("elevationTresh").value)){
            landPoints.push(p)
        }
      }

    return landPoints
}





function bare(inp){
    let c = document.getElementById("elevationCanvas")
    let ctx = c.getContext('2d');
   
    const seen = new Set();  // of point ids
    for (let e = 0; e < map.triangles.length; e++) {
        const p = map.triangles[nextHalfedge(e)];
        if (!seen.has(p)&&map.points.indexOf(map.points[p])==inp) {
            seen.add(p);
            const edges = edgesAroundPoint(e);
            const triangles = edges.map(e => triangleOfEdge(e))
            const vertices = triangles.map(e => map.centers[e])

            console.log("origin point: " +map.points.indexOf(map.points[map.triangles[map.halfedges[edges[0]]]]))



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
    }






/*

    for(let i = 0;i < eop.length; i++){
        let tris = triangleOfEdge(eop[i])


        let tri = map.triangles[eop[i]]
        let pt = map.points[tri]
        let sp = map.points[map.triangles[map.halfedges[eop[i]]]]


        console.log("sub index: " + map.points.indexOf(sp))
        ctx.fillStyle = "yellow"
        ctx.beginPath()
        ctx.fillRect(sp.x,sp.y,5,5);


        ctx.beginPath()
        ctx.strokeStyle = "orange"
        ctx.moveTo(sp.x,sp.y)
        //ctx.lineTo(map.points[eop[e]].x,map.points[eop[e]].y)
        ctx.lineTo(pt.x,pt.y)
        ctx.stroke()
    }*/
    
}

















//////////// DEAD TESTING SHIT ////////////////
/*
function getLandPolys(){
    let landPolys = []

    for(let p in map.points){
        if(map.elevation[p]>parseFloat(document.getElementById("elevationTresh").value)){
            landPolys.push(p)
        }
      }

    return landPolys
}

function landPoints(){
    let landPolys = getLandPolys()
    let c = document.getElementById("elevationCanvas")
    let ctx = c.getContext('2d');


    for(let p in landPolys){
        let landPoint = map.points[landPolys[p]]
        console.log(map.elevation[landPolys[p]])
        
        ctx.fillStyle = "magenta"
        ctx.beginPath()
        ctx.fillRect(landPoint.x,landPoint.y,1,1);
    }
}

function landEdges(){
    let landPolys = getLandPolys()
    let c = document.getElementById("elevationCanvas")
    let ctx = c.getContext('2d');

    console.log("land poly count " + landPolys.length)

    for(let p in landPolys){

        let landPoint = map.points[landPolys[p]]

        console.log("poly " +landPolys[p])
        
        ctx.fillStyle = "magenta"
        ctx.beginPath()
        ctx.fillRect(landPoint.x,landPoint.y,3,3);

        let centers = map.centers
        let points = map.points
        let landEdges = edgesAroundPoint(parseInt(landPolys[p]))
            //.map(r => points[triangleOfEdge(r)]);

            ctx.strokeStyle = "magenta"
            
            //console.log("edge count " + landEdges.length)
            for (let i = 0; i < landEdges.length; i++) {
                let tri = triangleOfEdge(landEdges[i])
                let p1 = centers[tri]
                let p2 = centers[tri+1]
                let p3 = centers[tri+2]

                console.log("edge " +landPolys[p])
                console.log("p1 " +p1.x + " : " +p1.y)
                console.log("p2 " +p2.x + " : " +p2.y)
                console.log("p3 " +p3.x + " : " +p3.y)

                ctx.fillStyle = "yellow"
                ctx.beginPath()
                ctx.fillRect(p1.x,p1.y,1,1);
                ctx.beginPath()
                ctx.fillRect(p2.x,p2.y,1,1);
                ctx.beginPath()
                ctx.fillRect(p3.x,p3.y,1,1);
            }

        
            let seen = new Set();  // of region ids
            let {triangles, numEdges, centers, points} = map;
            for (let e = 0; e < numEdges; e++) {
                const r = tr;iangles[nextHalfedge(e)];
                if (!seen.has(r)) {
                    seen.add(r);
                    let vertices = edgesAroundPoint(delaunay, e)
                        .map(e => centers[triangleOfEdge(e)])



        let centers = map.centers
        let landEdges = edgesAroundPoint(delaunay, parseInt(landPolys[p]))
            .map(r => centers[triangleOfEdge(r)]);

            ctx.strokeStyle = "magenta"
            ctx.beginPath();
            ctx.moveTo(landEdges[0].x, landEdges[0].y);
            
            for (let i = 0; i < landEdges.length; i++) {
                ctx.lineTo(landEdges[i].x, landEdges[i].y);
                ctx.stroke()
                ctx.moveTo(landEdges[i].x, landEdges[i].y);
            }

    }
}


function findShore(){
    let c = document.getElementById("elevationCanvas")
    let ctx = c.getContext('2d');
    let shoreAm = []
    for(let i in map.landTri){
        let adjTri = trianglesAdjacentToTriangle(map.landTri[i])
        for(let a in adjTri){
            if(!map.landTri.includes(adjTri[a])){

                let pois= pointsOfTriangle(adjTri[a])
                let p0 = map.points[pois[0]]
                let p1 = map.points[pois[1]]
                let p2 = map.points[pois[2]]

                ctx.fillStyle = "yellow"
                ctx.beginPath()
                ctx.moveTo(p0.x,p0.y);
                ctx.lineTo(p1.x,p1.y);
                ctx.lineTo(p2.x,p2.y);
                ctx.fill()

                //console.log(map.halfedges[adjTri[a]] + " is not land and connected to " +map.landTri[i] + "whis has edges: "+edgesOfTriangle(map.landTri[i]))
                //console.log(edgesOfTriangle(map.landTri[i]))
                let landEdges = edgesOfTriangle(map.landTri[i])
                let adjEdges = edgesOfTriangle(adjTri[a])
                for(let e in adjEdges){
                    let currEdge = map.halfedges[adjEdges[e]]
                    if(landEdges.includes(currEdge) && !shoreAm.includes(adjEdges[e])){
                        shoreAm.push(currEdge)

                        ctx.fillStyle = "magenta"
                        //ctx.beginPath()
                        //ctx.fillRect(map.points[map.triangles[currEdge]].x,map.points[map.triangles[currEdge]].y,3,3);
                    }
                }
            }
        }
    }
    console.log(shoreAm.length +" total shore edges")
    console.log(shoreAm)
}



function edgeTypes(){
    let c = document.getElementById("elevationCanvas")
    let ctx = c.getContext('2d');
    for(let e = 0;e < map.landTri.length; e++){
        let tri = map.landTri[e]
        let sp = map.points[tri]
        ctx.fillStyle = "magenta"
        ctx.beginPath()
        ctx.fillRect(sp.x,sp.y,5,5);

        let prev = nextHalfedge(tri)

        let eop = edgesAroundPoint(prev)
        //.map(r => map.points[map.triangles[r]]);

        console.log("base index of triangle: " +tri)

        for(let i = 0;i < eop.length; i++){
            let tri = map.triangles[eop[i]]
            let pt = map.points[tri]
            let sp = map.points[map.triangles[map.halfedges[eop[i]]]]


            console.log("sub index: " + map.points.indexOf(sp))
            ctx.fillStyle = "yellow"
            ctx.beginPath()
            ctx.fillRect(sp.x,sp.y,5,5);


            ctx.beginPath()
            ctx.strokeStyle = "orange"
            ctx.moveTo(sp.x,sp.y)
            //ctx.lineTo(map.points[eop[e]].x,map.points[eop[e]].y)
            ctx.lineTo(pt.x,pt.y)
            ctx.stroke()
        }
    }
}

// WORKS
let c = document.getElementById("elevationCanvas")
let ctx = c.getContext('2d');
for(let e = 0;e < map.landTri.length; e++){
  let tri = map.landTri[e]
  let sp = map.points[tri]
	ctx.fillStyle = "yellow"
  ctx.beginPath()
  ctx.fillRect(sp.x,sp.y,5,5);

}


function findShore(){
    let landPoints = getLandPoints()
    let c = document.getElementById("elevationCanvas")
    let ctx = c.getContext('2d');

    for(let p = 0;p < landPoints.length; p++){
        let landPoint = map.points[landPoints[p]]
        
        ctx.fillStyle = "magenta"
        ctx.beginPath()
        ctx.fillRect(landPoint.x,landPoint.y,5,5);

        let ind = map.points.indexOf(landPoint)
        let wtf = landPoints[p]

        let eop = edgesAroundPoint(parseInt(landPoints[p]))
        //.map(r => map.points[map.triangles[r]]);
        console.log(eop)
        for(let e = 0;e < eop.length; e++){
            let tri = map.triangles[eop[e]]
            let pt = map.points[tri]
            let sp = map.points[map.triangles[map.halfedges[eop[e]]]]

            ctx.fillStyle = "yellow"
            ctx.beginPath()
            ctx.fillRect(sp.x,sp.y,5,5);


            ctx.beginPath()
            ctx.strokeStyle = "orange"
            ctx.moveTo(sp.x,sp.y)
            //ctx.lineTo(map.points[eop[e]].x,map.points[eop[e]].y)
            ctx.lineTo(pt.x,pt.y)
            ctx.stroke()
        }
    }
}
*/