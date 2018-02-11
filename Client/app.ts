/// <reference path='types/three.d.ts' />
/// <reference path='../Cubes/Message.d.ts' />

let game: Game
window.onload = () => {
    game = new Game()
    new Info()
}

class Game {

    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer

    world: World
    connection: Connection
    chat = new Chat()

    keyboard = new Input.Keyboard()
    pointer: Input.PointerLock

    raycaster = new THREE.Raycaster()
    rollOverMesh: THREE.Mesh

    gui: GUI
    fps = new FPS()

    options = {
        wireframe: false,
        antialias: false,
        fog: false,
        debugInfo: false,
        renderScale: 100,
    }

    constructor() {
        game = this

        let lsStringOptions = localStorage.getItem("options")
        if (lsStringOptions !== null) {
            let lsOptions = JSON.parse(lsStringOptions)
            this.options = lsOptions
        }

        if (Input.PointerLock.isSupported == false) alert("Browser not supported!")
        
        // Scene
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0)
        if(this.options.fog) this.scene.fog = new THREE.Fog(0, 0, 25)

        // Camera
        this.camera = new THREE.PerspectiveCamera(90, 1, 0.1, 1000)

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: this.options.antialias })
        document.body.appendChild(this.renderer.domElement)

        // Setup Lights
        let ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
        this.scene.add(ambientLight)
        let directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(1, 1.5, 0.5).normalize()
        this.scene.add(directionalLight)

        this.onResize()

        this.world = new World()
        this.world.init()

        // Events
        window.addEventListener("resize", () => this.onResize())
        this.pointer = new Input.PointerLock(this.renderer.domElement)
        this.pointer.moveCamera(0, 0)
        window.addEventListener("mousedown", (event) => {
            this.onclick(event)
        })
        window.addEventListener("mouseup", (event) => {
            this.mouseup(event)
        })
        window.onbeforeunload = function () { // Prevent Ctrl+W ... Chrome!
            return "Really want to quit the game?"
        }

        // Network
        this.connection = new Connection()

        // GUI
        this.gui = new GUI()

        let rollOverGeo = new THREE.BoxGeometry(1, 1, 1);
        let rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        this.rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial)

        // Start rendering
        this.stepPreviousTime = Date.now()
        this.animate()
    }

    onResize() {

        // Update render size
        this.renderer.setPixelRatio(this.options.renderScale / 100 * window.devicePixelRatio)
        this.renderer.setSize(window.innerWidth, window.innerHeight)

        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
    }
    mouseup(e: MouseEvent) {
    }

    copyColor() {
        let pos = this.getRayCubePos(true)

        if (pos == null) {
            this.gui.setColor(null)
        } else {
            for (let i = 0, max = this.world.cubes.length; i < max; ++i) {
                if (this.world.cubes[i].position.x == pos.x &&
                    this.world.cubes[i].position.y == pos.y &&
                    this.world.cubes[i].position.z == pos.z) {

                    this.gui.setColor(this.world.cubes[i].color.clone())

                    break
                }
            }
        }
    }

    traceOn = false
    onclick(e: MouseEvent) {

        if (this.gui.layer != GUI_LAYER.ingame) return
        if (e.button != 0) return

        let action = this.gui.getSelectedAction()

        switch (action) {
            case "Pick Color": {
                this.copyColor()
            } break

            case "Teleport": {
                let pos = game.getRayCubePos(true)
                if (pos == null) break

                pos.x += 0.5
                pos.y += 1 // go on top
                pos.z += 0.5
                game.world.player.teleport(pos)
            } break

            case "Remove Block": {
                let pos = this.getRayCubePos(true)
                if (pos == null) break

                for (let i = 0, max = this.world.cubes.length; i < max; ++i) {
                    if (this.world.cubes[i].position.x == pos.x &&
                        this.world.cubes[i].position.y == pos.y &&
                        this.world.cubes[i].position.z == pos.z) {
                        //this.connection.sendMessage({
                        //    type: MessageType.removeCubes,
                        //    cubes: [{ position: this.world.cubes[i].position, type: undefined, color: undefined }]
                        //})
                        //this.world.cubes[i].remove()
                        this.world.cubes.splice(i, 1)
                        this.world.createMashup()
                        break
                    }
                }

                this.world.superCluster.removeCubeAt(pos)
            } break

            default: { // Block
                let blockType
                switch (action) {
                    case "Stone": blockType = CUBE_TYPE.stone; break
                    case "Mono": blockType = CUBE_TYPE.mono; break
                    case "Glas": blockType = CUBE_TYPE.glas; break
                }

                let pos = this.getRayCubePos(false)
                if (pos == null) break

                let cube = new Cube({
                    position: { x: pos.x, y: pos.y, z: pos.z },
                    type: blockType,
                    color: this.gui.getSelectedColor() || undefined,
                })
                this.world.cubes.push(cube)
                cube.init(true)
                this.world.superCluster.addCube(cube)

                this.world.createMashup()

                this.connection.sendMessage({
                    type: MessageType.cubesAdd,
                    cubes: [{ position: cube.position, type: cube.type, color: { r: cube.color.r, g: cube.color.g, b: cube.color.b } }]
                })
            } break
        }
    }

    getRayCubePos(alt: boolean) {
        //if (this.world.superCluster.mashup == null) return

        this.raycaster.set(this.camera.position, this.camera.getWorldDirection())
        let meshes = []
        for (let cluster of this.world.superCluster.clusters) {
            meshes.push(cluster.mashup)
        }
        if (meshes.length == 0) return
        let intersects = this.raycaster.intersectObjects(meshes/*[this.world.superCluster.mashup]*/)
        
        if (intersects.length == 0) return null
        let intersect = intersects[0]
        
        let n = intersect.face.normal.clone()
        if (alt) {
            if (n.x > 0) n.x = -1; else n.x = 0
            if (n.y > 0) n.y = -1; else n.y = 0
            if (n.z > 0) n.z = -1; else n.z = 0
        } else {
            if (n.x > 0) n.x = 0
            if (n.y > 0) n.y = 0
            if (n.z > 0) n.z = 0
        }

        let v = intersect.point.clone().add(n)
        // floating point pression fix for flooring
        let cutoff = (n: number) => { return Math.round(n * 100000000) / 100000000 } 
        v.x = cutoff(v.x)
        v.y = cutoff(v.y)
        v.z = cutoff(v.z)
        return v.floor()
    }

    meshShowing: boolean = false
    animate() {

        if (document.hasFocus() || performance.now() - this.fps.timeLastFrame > 1000 / 8) {

            let t = this.camera.fov
            this.camera.fov = this.world.player.fast ? 100 : 90
            if (t != this.camera.fov) this.camera.updateProjectionMatrix()

            this.step()

            // Raycast poiting position
            if (this.gui.layer == GUI_LAYER.ingame) {
                let onFace: boolean
                switch (this.gui.getSelectedAction()) {
                    case "Teleport":
                    case "Remove Block":
                    case "Pick Color":
                        onFace = false
                        break
                    default:
                        onFace = true
                }
                let pos = this.getRayCubePos(!onFace)

                if (pos == null) {
                    if (this.meshShowing) {
                        this.meshShowing = false
                        this.scene.remove(this.rollOverMesh)
                    }
                } else {
                    this.rollOverMesh.position.copy(pos)
                    this.rollOverMesh.position.addScalar(0.5)
                    if (!this.meshShowing) {
                        this.scene.add(this.rollOverMesh)
                        this.meshShowing = true
                    }
                }
            } else {
                this.meshShowing = false
                this.scene.remove(this.rollOverMesh)
            }

            // Render Scene
            this.renderer.render(this.scene, this.camera)

            // GUI 
            this.gui.animate()

            this.fps.addFrame()
        }

        // Ask to do it again next Frame
        requestAnimationFrame(() => this.animate())
    }

    stepPreviousTime = 0
    step() {
        let stepTime = Date.now()
        let deltaTime = (stepTime - this.stepPreviousTime) / 1000

        this.world.step(deltaTime)

        this.stepPreviousTime = stepTime
    }
}

class World {

    cubes: Cube[] = []
    player: Player
    players: Player[] = []

    superCluster = new SuperCluster()

    lowestPoint = Infinity

    constructor() {
    }

    init() {

        this.player = new Player({ x: 4, y: 2, z: 4 }, true)

        for (let cube of this.cubes) {
            cube.init()
        }
    }

    step(deltaTime: number) {
        this.player.step(deltaTime)
        for (let player of this.players) {
            player.step(deltaTime)
        }
    }

    mashup: THREE.Mesh = null
    createMashup() {
        //console.time("mergeCubesTotal")
        //let geom = new THREE.Geometry()

        //for (let cube of this.cubes) {
        //    geom.merge(cube.geom, new THREE.Matrix4().setPosition(new THREE.Vector3(cube.position.x, cube.position.y, cube.position.z)))
        //}

        //// Reduce CPU->GPU load
        //geom.mergeVertices()
        //if (this.mashup) game.scene.remove(this.mashup)
        //Cube.texture.magFilter = THREE.NearestFilter
        //this.mashup = new THREE.Mesh(
        //    new THREE.BufferGeometry().fromGeometry(geom),
        //    <any>[
        //        new THREE.MeshLambertMaterial( // stone
        //            { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, map: Cube.texture, }),
        //        new THREE.MeshLambertMaterial( // glas
        //            { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, opacity: 0.45, transparent: true }),
        //        new THREE.MeshLambertMaterial( // mono
        //            { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, }),
        //    ])
        ////this.mashup = <any>THREE.SceneUtils.createMultiMaterialObject(geom, [
        ////    new THREE.MeshLambertMaterial({ color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, map: Cube.texture }),
        ////    new THREE.MeshLambertMaterial({ color: 0x888888, wireframe: true }),
        ////])
        
        ////game.scene.add(this.mashup)

        //console.timeEnd("mergeCubesTotal")
    }
}

class SpriteObject {

    position: THREE.Vector3
    velocity: THREE.Vector3

    constructor(pos: Vector3) {
        var spriteMaterial = new THREE.SpriteMaterial({ /*map: spriteMap,*/ color: 0xffffff })
        var sprite = new THREE.Sprite(spriteMaterial)

        this.position = new THREE.Vector3(pos.x, pos.y, pos.z)
        sprite.position.copy(this.position)
        this.velocity = new THREE.Vector3()
        sprite.scale.set(.1,.1,.1)
        game.scene.add(sprite)
    }

}

class SuperCluster {

    clusters: Cluster[] = []

    addCubes(cubes: Cube[]) {
        for (let cube of cubes) {
            this.addCube(cube, false)
        }
        this.createMashup()
    }

    addCube(cube: Cube, updateMesh = true) {
        let clusterX = cube.position.x >> 3
        let clusterY = cube.position.y >> 3
        let clusterZ = cube.position.z >> 3

        // Get Cluster
        let cluster = <Cluster>null
        for (let _cluster of this.clusters) {
            if (clusterX == _cluster.position.x &&
                clusterY == _cluster.position.y &&
                clusterZ == _cluster.position.z) {
                cluster = _cluster
                break
            }
        }
        if (cluster == null) {
            cluster = new Cluster({ x: clusterX, y: clusterY, z: clusterZ, })
            this.clusters.push(cluster)
        }

        cluster.addCube(cube, {
            x: cube.position.x - (clusterX << 3),
            y: cube.position.y - (clusterY << 3),
            z: cube.position.z - (clusterZ << 3),
        }) 

        if (updateMesh) {
            cluster.createMashup()
            this.createMashup()
        }
    }

    removeCubeAt(cubePosition: Vector3, updateMesh = true) {
        let clusterX = cubePosition.x >> 3
        let clusterY = cubePosition.y >> 3
        let clusterZ = cubePosition.z >> 3

        // Get Cluster
        let cluster = <Cluster>null
        for (let _cluster of this.clusters) {
            if (clusterX == _cluster.position.x &&
                clusterY == _cluster.position.y &&
                clusterZ == _cluster.position.z) {
                cluster = _cluster
                break
            }
        }
        if (cluster == null) {
            return
        }

        cluster.removeCubeAt({
            x: cubePosition.x - (clusterX << 3),
            y: cubePosition.y - (clusterY << 3),
            z: cubePosition.z - (clusterZ << 3),
        })

        if (updateMesh) {
            cluster.createMashup()
            this.createMashup()
        }
    }

    mashup: THREE.Mesh = null
    wireMashup: THREE.Mesh = null
    createMashup() {
        console.time("mergeCubesTotal - CLUSTERS")
        for (let cluster of this.clusters) {
            if (cluster.geom == null) cluster.createMashup()
        }
        console.timeEnd("mergeCubesTotal - CLUSTERS")

        //console.time("mergeCubesTotal - SUPER CLUSTER")
        //let geom = new THREE.Geometry()

        //for (let cluster of this.clusters) {
        //    geom.merge(<THREE.Geometry>cluster.geom, new THREE.Matrix4())
        //}

        //// Reduce CPU->GPU load
        //geom.mergeVertices()
        //if (this.mashup) game.scene.remove(this.mashup)
        //Cube.texture.magFilter = THREE.NearestFilter
        //this.mashup = new THREE.Mesh(
        //    geom,//new THREE.BufferGeometry().fromGeometry(geom),
        //    <any>[
        //        new THREE.MeshLambertMaterial( // stone
        //            { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, map: Cube.texture, }),
        //        new THREE.MeshLambertMaterial( // glas
        //            { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, opacity: 0.45, transparent: true }),
        //        new THREE.MeshLambertMaterial( // mono
        //            { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, }),
        //    ])
        //this.mashup = <any>THREE.SceneUtils.createMultiMaterialObject(geom, [
        //    new THREE.MeshLambertMaterial({ color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, map: Cube.texture }),
        //    new THREE.MeshLambertMaterial({ color: 0x888888, wireframe: true }),
        //])
        //game.scene.add(this.mashup)

        //console.timeEnd("mergeCubesTotal - SUPER CLUSTER")


        let wireGeom = new THREE.Geometry()
        for (let cluster of this.clusters) {
            wireGeom.merge(<THREE.Geometry>cluster.wireGeom, new THREE.Matrix4())
        }

        if (this.wireMashup) game.scene.remove(this.wireMashup)
        this.wireMashup = new THREE.Mesh(
            new THREE.BufferGeometry().fromGeometry(wireGeom),
            new THREE.MeshLambertMaterial({ color: 0xffff00, wireframe: true, }))
        game.scene.add(this.wireMashup)

    }
}

class Cluster {
    level: number 
    position: Vector3
    subs: (Cluster | Cube)[][][]

    constructor(position: Vector3) {
        this.position = position
        this.level = 1

        this.subs = []
        for (let x = 0; x < 8; ++x) {
            this.subs[x] = []
            for (let y = 0; y < 8; ++y) {
                this.subs[x][y] = []
                for (let z = 0; z < 8; ++z) {
                    this.subs[x][y][z] = null
                }
            }
        }

        this.wireGeom = new THREE.CubeGeometry(8, 8, 8)
        this.wireGeom.applyMatrix(new THREE.Matrix4().setPosition(
            new THREE.Vector3((this.position.x << 3) + 4, (this.position.y << 3) + 4, (this.position.z << 3) + 4)))
    }

    addCube(cube: Cube, pos: Vector3) {
        this.subs[pos.x][pos.y][pos.z] = cube
    }

    removeCubeAt(cubePosition: Vector3) {
        if (this.level == 1) {
            let pos = this.subs[cubePosition.x][cubePosition.y][cubePosition.z].position;
            (<Cube>this.subs[cubePosition.x][cubePosition.y][cubePosition.z]).remove()
            this.subs[cubePosition.x][cubePosition.y][cubePosition.z] = null
            game.connection.sendMessage({
                type: MessageType.removeCubes,
                cubes: [{ position: pos, type: undefined, color: undefined }]
            })
        }
    }

    mashup: THREE.Mesh
    geom: THREE.Geometry = null
    wireGeom: THREE.Geometry = null
    createMashup() {
        console.time(`mashup cluster l${this.level}`)
        this.geom = new THREE.Geometry()

        for (let sx of this.subs) {
            for (let sy of sx) {
                for (let sub of sy) {
                    if (sub != null) {
                        this.geom.merge(sub.geom, new THREE.Matrix4().setPosition(new THREE.Vector3(sub.position.x, sub.position.y, sub.position.z)))
                    }
                }
            }
        }

        Cube.texture.magFilter = THREE.NearestFilter
        if (this.mashup) game.scene.remove(this.mashup)
        this.mashup = new THREE.Mesh(
            this.geom,//new THREE.BufferGeometry().fromGeometry(geom),
            <any>[
                new THREE.MeshLambertMaterial( // stone
                    { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, map: Cube.texture, }),
                new THREE.MeshLambertMaterial( // glas
                    { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, opacity: 0.45, transparent: true }),
                new THREE.MeshLambertMaterial( // mono
                    { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, }),
            ])
        game.scene.add(this.mashup)


        console.timeEnd(`mashup cluster l${this.level}`)
    }
}

class Cube {

    position: Vector3
    width: number
    height: number

    type: CUBE_TYPE
    geom: THREE.Geometry
    color: THREE.Color

    neighbours: {
        top: Cube, bottom: Cube,
        front: Cube, back: Cube,
        left: Cube, right: Cube,
    } = {
        top: null, bottom: null,
        front: null, back: null,
        left: null, right: null,
    }

    static texture: THREE.Texture = null

    constructor(cubeData: Cube_Data) {
        this.position = cubeData.position
        if (cubeData.type == undefined) this.type = Math.floor(Math.random() * 3)
        else this.type = cubeData.type
        if (cubeData.color == undefined) this.color = new THREE.Color(Math.random(), Math.random(), Math.random())
        else this.color = new THREE.Color(cubeData.color.r, cubeData.color.g, cubeData.color.b)

        if (this.type== CUBE_TYPE.stone) this.color = new THREE.Color(0x888888)

        if (this.position.y < game.world.lowestPoint) game.world.lowestPoint = this.position.y
        
        if (Cube.texture == null) Cube.texture = new THREE.TextureLoader().load("cube.png")
    }

    init(updateNeighbours = false) {

        this.checkNeighbours(updateNeighbours)
        this.buildGeometry()
    }

    buildGeometry() {

        let c0 = this.color.clone().multiplyScalar(0.5)
        let c1 = this.color
        let c2 = this.color.clone().multiplyScalar(0.8)
        let c3 = this.color.clone().multiplyScalar(0.9)

        this.geom = new THREE.Geometry()

        let face = (neighbour: Cube) => {
            return neighbour == null || (neighbour.type == CUBE_TYPE.glas && this.type != CUBE_TYPE.glas)
        }

        let faces = {
            top: face(this.neighbours.top),
            bottom: face(this.neighbours.bottom),
            left: face(this.neighbours.left),
            right: face(this.neighbours.right),
            front: face(this.neighbours.front),
            back: face(this.neighbours.back),
        }

        // Vertices
        let vbbl: number, vbfl: number, vbfr: number, vbbr: number,
            vtbl: number, vtfl: number, vtfr: number, vtbr: number
        if (faces.bottom || faces.back || faces.left) {
            vbbl = this.geom.vertices.push(new THREE.Vector3(0, 0, 0)) - 1
        }
        if (faces.bottom || faces.front || faces.left) {
            vbfl = this.geom.vertices.push(new THREE.Vector3(1, 0, 0)) - 1
        }
        if (faces.bottom || faces.front || faces.right) {
            vbfr = this.geom.vertices.push(new THREE.Vector3(1, 0, 1)) - 1
        }
        if (faces.bottom || faces.back || faces.right) {
            vbbr = this.geom.vertices.push(new THREE.Vector3(0, 0, 1)) - 1
        }
        if (faces.top || faces.back || faces.left) {
            vtbl = this.geom.vertices.push(new THREE.Vector3(0, 1, 0)) - 1
        }
        if (faces.top || faces.front || faces.left) {
            vtfl = this.geom.vertices.push(new THREE.Vector3(1, 1, 0)) - 1
        }
        if (faces.top || faces.front || faces.right) {
            vtfr = this.geom.vertices.push(new THREE.Vector3(1, 1, 1)) - 1
        }
        if (faces.top || faces.back || faces.right) {
            vtbr = this.geom.vertices.push(new THREE.Vector3(0, 1, 1)) - 1
        }

        // Faces
        this.geom.faceVertexUvs[0] = []
        if (faces.bottom) {
            this.geom.faces.push(new THREE.Face3(vbfl, vbbr, vbbl, new THREE.Vector3(0, -1, 0), c0, this.type))
            this.geom.faces.push(new THREE.Face3(vbbr, vbfl, vbfr, new THREE.Vector3(0, -1, 0), c0, this.type))

            let offsetx = 1 / 4
            let offsety = 2 / 4
            let d = 1 / 4
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(1, 3 / 4),
                new THREE.Vector2(3 / 4, 2 / 4),
                new THREE.Vector2(1, 2 / 4),
            ])
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(3 / 4, 2 / 4),
                new THREE.Vector2(1, 3 / 4),
                new THREE.Vector2(3 / 4, 3 / 4)
            ])
        }
        if (faces.top) {
            this.geom.faces.push(new THREE.Face3(vtbl, vtbr, vtfl, new THREE.Vector3(0, +1, 0), c1, this.type))
            this.geom.faces.push(new THREE.Face3(vtfr, vtfl, vtbr, new THREE.Vector3(0, +1, 0), c1, this.type))

            let offsetx = 1 / 4
            let offsety = 2 / 4
            let d = 1 / 4
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(offsetx + d * 0, offsety + d * 0),
                new THREE.Vector2(offsetx + d * 1, offsety + d * 0),
                new THREE.Vector2(offsetx + d * 0, offsety + d * 1),
            ])
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(offsetx + d * 1, offsety + d * 1),
                new THREE.Vector2(offsetx + d * 0, offsety + d * 1),
                new THREE.Vector2(offsetx + d * 1, offsety + d * 0)
            ])
        }
        if (faces.left) {
            this.geom.faces.push(new THREE.Face3(vbbl, vtbl, vbfl, new THREE.Vector3(0, 0, -1), c2, this.type))
            this.geom.faces.push(new THREE.Face3(vtfl, vbfl, vtbl, new THREE.Vector3(0, 0, -1), c2, this.type))

            let offsetx = 1 / 4
            let offsety = 2 / 4
            let d = 1 / 4
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(0, 2 / 4),
                new THREE.Vector2(1 / 4, 2 / 4),
                new THREE.Vector2(0, 3 / 4),
            ])
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(1 / 4, 3 / 4),
                new THREE.Vector2(0, 3 / 4),
                new THREE.Vector2(1 / 4, 2 / 4)
            ])
        }
        if (faces.right) {
            this.geom.faces.push(new THREE.Face3(vbfr, vtbr, vbbr, new THREE.Vector3(0, 0, +1), c2, this.type))
            this.geom.faces.push(new THREE.Face3(vtbr, vbfr, vtfr, new THREE.Vector3(0, 0, +1), c2, this.type))

            let offsetx = 2 / 4
            let offsety = 2 / 4
            let d = 1 / 4
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(3 / 4, 3 / 4),
                new THREE.Vector2(2 / 4, 2 / 4),
                new THREE.Vector2(3 / 4, 2 / 4),
            ])
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(2 / 4, 2 / 4),
                new THREE.Vector2(3 / 4, 3 / 4),
                new THREE.Vector2(2 / 4, 3 / 4)
            ])
        }
        if (faces.back) {
            this.geom.faces.push(new THREE.Face3(vbbl, vbbr, vtbl, new THREE.Vector3(-1, 0, 0), c3, this.type))
            this.geom.faces.push(new THREE.Face3(vtbr, vtbl, vbbr, new THREE.Vector3(-1, 0, 0), c3, this.type))

            let offsetx = 1 / 4
            let offsety = 1 / 4
            let d = 1 / 4
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(offsetx + d * 0, offsety + d * 0),
                new THREE.Vector2(offsetx + d * 1, offsety + d * 0),
                new THREE.Vector2(offsetx + d * 0, offsety + d * 1),
            ])
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(offsetx + d * 1, offsety + d * 1),
                new THREE.Vector2(offsetx + d * 0, offsety + d * 1),
                new THREE.Vector2(offsetx + d * 1, offsety + d * 0)
            ])
        }
        if (faces.front) {
            this.geom.faces.push(new THREE.Face3(vtfl, vbfr, vbfl, new THREE.Vector3(+1, 0, 0), c3, this.type))
            this.geom.faces.push(new THREE.Face3(vbfr, vtfl, vtfr, new THREE.Vector3(+1, 0, 0), c3, this.type))

            let offsetx = 1 / 4
            let offsety = 3 / 4
            let d = 1 / 4
            let mirror = true
            let a = mirror ? 0 : 1
            let b = mirror ? 1 : 0
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(offsetx + d * a, offsety + d * a),
                new THREE.Vector2(offsetx + d * b, offsety + d * b),
                new THREE.Vector2(offsetx + d * a, offsety + d * b),
            ])
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(offsetx + d * b, offsety + d * b),
                new THREE.Vector2(offsetx + d * a, offsety + d * a),
                new THREE.Vector2(offsetx + d * b, offsety + d * a)
            ])
        }
    }

    remove() {
        if (this.neighbours.back) {
            this.neighbours.back.neighbours.front = null
            this.neighbours.back.buildGeometry()
        }
        if (this.neighbours.bottom) {
            this.neighbours.bottom.neighbours.top = null
            this.neighbours.bottom.buildGeometry()
        }
        if (this.neighbours.front) {
            this.neighbours.front.neighbours.back = null
            this.neighbours.front.buildGeometry()
        }
        if (this.neighbours.left) {
            this.neighbours.left.neighbours.right = null
            this.neighbours.left.buildGeometry()
        }
        if (this.neighbours.right) {
            this.neighbours.right.neighbours.left = null
            this.neighbours.right.buildGeometry()
        }
        if (this.neighbours.top) {
            this.neighbours.top.neighbours.bottom = null
            this.neighbours.top.buildGeometry()
        }
        
        if (this.position.y == game.world.lowestPoint) {
            game.world.lowestPoint = Infinity
            for (let cube of game.world.cubes) {
                if (cube.position.y < game.world.lowestPoint)
                    game.world.lowestPoint = cube.position.y
            }
        }
    }

    checkNeighbours(updateOthers = false) {

        this.neighbours = {
            top: null, bottom: null,
            front: null, back: null,
            left: null, right: null,
        }

        for (let cube of game.world.cubes) {
            if (cube == this) continue

            // same level
            if (cube.position.y == this.position.y) {

                // front back
                if (cube.position.z == this.position.z) {
                    if (cube.position.x == this.position.x + 1) {
                        this.neighbours.front = cube
                        if (updateOthers) {
                            cube.neighbours.back = this
                            cube.buildGeometry()
                        }
                    } else if (cube.position.x == this.position.x - 1) {
                        this.neighbours.back = cube
                        if (updateOthers) {
                            cube.neighbours.front = this
                            cube.buildGeometry()
                        }
                    }
                }

                // left right
                if (cube.position.x == this.position.x) {
                    if (cube.position.z == this.position.z - 1) {
                        this.neighbours.left = cube
                        if (updateOthers) {
                            cube.neighbours.right = this
                            cube.buildGeometry()
                        }
                    } else if (cube.position.z == this.position.z + 1) {
                        this.neighbours.right = cube
                        if (updateOthers) {
                            cube.neighbours.left = this
                            cube.buildGeometry()
                        }
                    }
                }
            } else if (cube.position.x == this.position.x && cube.position.z == this.position.z) {

                // bottom top
                if (cube.position.y == this.position.y - 1) {
                    this.neighbours.bottom = cube
                    if (updateOthers) {
                        cube.neighbours.top = this
                        cube.buildGeometry()
                    }
                } else if (cube.position.y == this.position.y + 1) {
                    this.neighbours.top = cube
                    if (updateOthers) {
                        cube.neighbours.bottom = this
                        cube.buildGeometry()
                    }
                }
            }
        }

    }

}