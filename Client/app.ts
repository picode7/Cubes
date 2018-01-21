/// <reference path='types/three.d.ts' />
/// <reference path='../Cubes/Message.d.ts' />

let game: Game
window.onload = () => {
    game = new Game()
    new Info()
}


interface ChangelogEntry {
    version: string
    changes: string[]
}
class Info {
    constructor() {
        let req = new XMLHttpRequest()
        req.open("GET", "changelog.json")
        req.onreadystatechange = () => {
            if (req.readyState == 4 && req.status == 200) {
                this.changelog(JSON.parse(req.responseText))
            }
        }
        req.send()
    }

    private changelog(logs: ChangelogEntry[]) {

        logs.sort((a, b) => { return a.version > b.version ? -1 : 1 })
        console.log(logs)

        if (localStorage.getItem("version") !== logs[0].version) {
            document.getElementById("info").style.display = "block"
            localStorage.setItem("version", logs[0].version)
        }

        let elVersionLog = document.getElementById("versionlog")
        for (let version of logs) {
            let elVersion = document.createElement("h3")
            elVersion.innerText = version.version
            elVersionLog.appendChild(elVersion)
            let elVersionsLog = document.createElement("ul")
            elVersionLog.appendChild(elVersionsLog)
            for (let log of version.changes) {
                let elVersionLog = document.createElement("li")
                elVersionLog.innerText = log
                elVersionsLog.appendChild(elVersionLog)
            }
        }
    }
}

class Game {

    scene: THREE.Scene
    camera: THREE.PerspectiveCamera
    renderer: THREE.WebGLRenderer

    elDebugInfo: HTMLElement

    world: World
    connection: Connection

    pointer: Input.Pointer
    raycaster = new THREE.Raycaster()
    keysDown: Input.KEY[] = []
    rollOverMesh: THREE.Mesh

    options = {
        wireframe: false,
        antialias: false,
        fog: false,
        debugInfo: false,
    }

    constructor() {

        let lsStringOptions = localStorage.getItem("options")
        if (lsStringOptions !== null) {
            let lsOptions = JSON.parse(lsStringOptions)
            this.options = lsOptions
            this.updateOptionsGUI()
        }

        if (Input.Pointer.isSupported == false) alert("Browser not supported!")

        game = this

        // Scene
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0)
        if(this.options.fog) this.scene.fog = new THREE.Fog(0, 0, 25)

        // Camera
        this.camera = new THREE.PerspectiveCamera(90, 1, 0.1, 1000);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: this.options.antialias })
        document.body.appendChild(this.renderer.domElement)

        // Setup Lights
        let ambientLight = new THREE.AmbientLight(0xffffff, 0.4)
        this.scene.add(ambientLight)
        let directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(1, 1, 0.5).normalize()
        this.scene.add(directionalLight)

        this.onResize()

        this.world = new World()
        this.world.init()

        // Events
        window.addEventListener("resize", () => this.onResize())
        this.pointer = new Input.Pointer(this.renderer.domElement)
        this.pointer.moveCamera(0, 0)
        window.addEventListener("mousedown", (event) => {
            this.onclick()
        })
        window.onbeforeunload = function () { // Prevent Ctrl+W ... Chrome!
            return "Really want to quit the game?"
        }
        window.addEventListener("keydown", (e) => {
            let pos = this.keysDown.indexOf(e.keyCode)
            if (pos != -1) this.keysDown.splice(pos, 1)
            this.keysDown.push(e.keyCode)
            e.preventDefault()
            return false
        })
        window.addEventListener("keyup", (e) => {
            this.keysDown.splice(this.keysDown.indexOf(e.keyCode), 1)
        })

        // Network
        this.connection = new Connection()

        // GUI
        document.body.appendChild(elementFromHTML(
            `<div style="position:absolute; left:50%; top:50%; height:1px; width:1px; background:red;pointer-events:none"></div>`))
        this.elDebugInfo = document.body.appendChild(elementFromHTML(
            `<div style="position:absolute; left:0; top:0; width:200px; color: white; font-size:10pt;font-family: Consolas;pointer-events:none"></div>`))
        this.elDebugInfo.style.display = this.options.debugInfo ? "block" : "none"

        let rollOverGeo = new THREE.BoxGeometry(1, 1, 1);
        let rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.2, transparent: true });
        this.rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial)

        // Start rendering
        this.stepPreviousTime = Date.now()
        this.animate()
        setInterval(() => this.step(), 1000 / 100)
    }

    isKeyDown(key: Input.KEY): boolean {
        for (let i = 0, max = this.keysDown.length; i < max; ++i) {
            if(this.keysDown[i] == key) return true
        }
        return false
    }


    updateOptionsGUI() {
        ; (<HTMLInputElement>document.getElementById("settings_aa")).checked = this.options.antialias
            ; (<HTMLInputElement>document.getElementById("settings_debug")).checked = this.options.debugInfo
            ; (<HTMLInputElement>document.getElementById("settings_fog")).checked = this.options.fog
            ; (<HTMLInputElement>document.getElementById("settings_wireframe")).checked = this.options.wireframe
    }

    updateOptions(reload = false) {

        this.options.antialias = (<HTMLInputElement>document.getElementById("settings_aa")).checked
        this.options.debugInfo = (<HTMLInputElement>document.getElementById("settings_debug")).checked
        this.options.fog = (<HTMLInputElement>document.getElementById("settings_fog")).checked
        this.options.wireframe = (<HTMLInputElement>document.getElementById("settings_wireframe")).checked

        localStorage.setItem("options", JSON.stringify(this.options))

        // Debug Info
        this.elDebugInfo.style.display = this.options.debugInfo ? "block" : "none"

        // Wireframe
        game.world.createMashup()

        // Fog
        if (this.options.fog) {
            this.scene.fog = new THREE.Fog(0, 0, 25)
        } else {
            this.scene.fog = null
        }

        if (reload) location.reload()
    }

    onResize() {

        // Update render size
        this.renderer.setSize(window.innerWidth, window.innerHeight)

        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight
        this.camera.updateProjectionMatrix()
    }

    onclick() {

        // Put block
        if (this.pointer.locked) {
            this.raycaster.set(this.camera.position, this.camera.getWorldDirection())
            let intersects = this.raycaster.intersectObjects(this.scene.children.filter((obj) => {
                if (obj == this.rollOverMesh) return false
                if (obj == this.world.player.mesh) return false
                for (let player of this.world.players)
                    if (obj == player.mesh) return false
                return true
            }))

            if (intersects.length > 0) {
                let altKey = this.isKeyDown(Input.KEY.ALT)
                let position = this.getRayCubePos(intersects[0], altKey)

                if (altKey == false) {
                    // Add Cube
                    let cube = new Cube({ x: position.x, y: position.y, z: position.z })
                    this.world.cubes.push(cube)
                    cube.init(true)

                    this.world.createMashup()

                    this.connection.sendMessage({
                        type: MessageType.cubesAdd,
                        cubes: [cube.position]
                    })
                    cube.mesh.position = position
                } else {
                    // Remove Cube
                    for (let i = 0, max = this.world.cubes.length; i < max; ++i) {
                        if (this.world.cubes[i].position.x == position.x &&
                            this.world.cubes[i].position.y == position.y &&
                            this.world.cubes[i].position.z == position.z) {
                            this.connection.sendMessage({
                                type: MessageType.removeCubes,
                                cubes: [this.world.cubes[i].position]
                            })
                            this.world.cubes[i].remove()
                            this.world.cubes.splice(i, 1)
                            this.world.createMashup()
                            break
                        }
                    }
                }
            }
        }
    }

    getRayCubePos(intersect: THREE.Intersection, alt: boolean) {
        if (alt) {
            let n = intersect.face.normal.clone()
            if (n.x > 0) n.x = -1; else n.x = 0
            if (n.y > 0) n.y = -1; else n.y = 0
            if (n.z > 0) n.z = -1; else n.z = 0
            return intersect.point.clone().add(n).floor()
        } else {
            let n = intersect.face.normal.clone()
            if (n.x > 0) n.x = 0
            if (n.y > 0) n.y = 0
            if (n.z > 0) n.z = 0
            return intersect.point.clone().add(n).floor()
        }
    }

    meshShowing: boolean = false
    timeLastFrame = 0
    fps = 0
    animate() {

        let timeNow = performance.now()
        this.fps = this.fps / 10 * 9 + 1000 / (timeNow - this.timeLastFrame) / 10 * 1
        this.timeLastFrame = timeNow

        // Raycast poiting position
        if (this.pointer.locked) {
            this.raycaster.set(this.camera.position, this.camera.getWorldDirection())
            let intersects = this.raycaster.intersectObjects(this.scene.children.filter((obj) => {
                if (obj == this.rollOverMesh) return false
                if (obj == this.world.player.mesh) return false
                for (let player of this.world.players)
                    if (obj == player.mesh) return false
                return true
            }))

            if (intersects.length == 0) {
                if (this.meshShowing) {
                    this.meshShowing = false
                    this.scene.remove(this.rollOverMesh)
                }
            } else if (!this.meshShowing) {
                this.scene.add(this.rollOverMesh)
                this.meshShowing = true
            }

            if (intersects.length) {
                this.rollOverMesh.position.copy(this.getRayCubePos(intersects[0], this.isKeyDown(Input.KEY.ALT)))
                this.rollOverMesh.position.addScalar(0.5)
            }
        } else {
            this.meshShowing = false
            this.scene.remove(this.rollOverMesh)
        }

        // Render Scene
        this.renderer.render(this.scene, this.camera)

        // Ask to do it again next Frame
        requestAnimationFrame(() => this.animate())
    }

    stepPreviousTime = 0
    step() {
        let stepTime = Date.now()
        let deltaTime = (stepTime - this.stepPreviousTime) / 1000

        this.world.step(deltaTime)

        function f(n: number) {
            return (n >= 0 ? '+' : '') + n.toFixed(10)
        }

        // Update Log
        this.elDebugInfo.innerHTML =
            `FPS: ${this.fps.toFixed(0)}<br/>` +
        `Connection: ${this.connection.readyState()}<br/>` +
        `Players: ${this.world.players.length + 1}<br/>` +
            `Cubes: ${this.world.cubes.length}<br/>` +
            `Pointer: ${this.pointer.locked ? "locked" : "not tracking"}<br/>` +
            `Position:<br>&nbsp;
x ${f(this.world.player.position.x)}<br>&nbsp;
y ${f(this.world.player.position.y)}<br>&nbsp;
z ${f(this.world.player.position.z)}<br/>` +
            `Looking:<br>&nbsp;
x ${f(this.camera.getWorldDirection().x)}<br>&nbsp;
y ${f(this.camera.getWorldDirection().y)}<br>&nbsp;
z ${f(this.camera.getWorldDirection().z)}<br/>` +
            ""

        this.stepPreviousTime = stepTime
    }
}

class World {

    cubes: Cube[] = []
    player: Player
    players: Player[] = []

    constructor() {
    }

    init() {

        this.player = new Player({ x: 4, y: 2, z: 4 })

        for (let cube of this.cubes) {
            cube.init()
        }
    }

    step(deltaTime: number) {
        this.player.step(deltaTime)
    }

    mashup: THREE.Mesh = null
    createMashup() {
        console.time("mergeCubesTotal")
        let geom = new THREE.Geometry()

        for (let cube of this.cubes) {
            geom.merge(<THREE.Geometry>cube.mesh.geometry, cube.mesh.matrix)
        }

        // Reduce CPU->GPU load
        geom.mergeVertices()

        if (this.mashup) game.scene.remove(this.mashup)

        this.mashup = new THREE.Mesh(
            new THREE.BufferGeometry().fromGeometry(geom),
            new THREE.MeshLambertMaterial({ color: 0xffffff, wireframe: game.options.wireframe }))

        game.scene.add(this.mashup)

        console.timeEnd("mergeCubesTotal")
    }
}

class Cube {

    position: Vector3
    width: number
    height: number

    mesh: THREE.Mesh
    color: THREE.Color

    neighbours: {
        top: Cube, bottom: Cube,
        front: Cube, back: Cube,
        left: Cube, right: Cube,
    }

    constructor(position: Vector3) {
        this.position = position
    }

    init(updateNeighbours = false) {

        let c = Math.random()
        this.color = new THREE.Color(
            c, c, c
        )

        this.checkNeighbours(updateNeighbours)
        this.buildGeometry()
    }

    buildGeometry() {
        let geom = new THREE.Geometry()

        // Vertices
        let vbbl: number, vbfl: number, vbfr: number, vbbr: number,
            vtbl: number, vtfl: number, vtfr: number, vtbr: number
        if (this.neighbours.bottom == null || this.neighbours.back == null || this.neighbours.left == null) {
            vbbl = geom.vertices.push(new THREE.Vector3(0, 0, 0)) - 1
        }
        if (this.neighbours.bottom == null || this.neighbours.front == null || this.neighbours.left == null) {
            vbfl = geom.vertices.push(new THREE.Vector3(1, 0, 0)) - 1
        }
        if (this.neighbours.bottom == null || this.neighbours.front == null || this.neighbours.right == null) {
            vbfr = geom.vertices.push(new THREE.Vector3(1, 0, 1)) - 1
        }
        if (this.neighbours.bottom == null || this.neighbours.back == null || this.neighbours.right == null) {
            vbbr = geom.vertices.push(new THREE.Vector3(0, 0, 1)) - 1
        }
        if (this.neighbours.top == null || this.neighbours.back == null || this.neighbours.left == null) {
            vtbl = geom.vertices.push(new THREE.Vector3(0, 1, 0)) - 1
        }
        if (this.neighbours.top == null || this.neighbours.front == null || this.neighbours.left == null) {
            vtfl = geom.vertices.push(new THREE.Vector3(1, 1, 0)) - 1
        }
        if (this.neighbours.top == null || this.neighbours.front == null || this.neighbours.right == null) {
            vtfr = geom.vertices.push(new THREE.Vector3(1, 1, 1)) - 1
        }
        if (this.neighbours.top == null || this.neighbours.back == null || this.neighbours.right == null) {
            vtbr = geom.vertices.push(new THREE.Vector3(0, 1, 1)) - 1
        }

        // Faces
        if (this.neighbours.bottom == null) {
            geom.faces.push(new THREE.Face3(vbfl, vbbr, vbbl, new THREE.Vector3(0, -1, 0)))
            geom.faces.push(new THREE.Face3(vbbr, vbfl, vbfr, new THREE.Vector3(0, -1, 0)))
        }
        if (this.neighbours.top == null) {
            geom.faces.push(new THREE.Face3(vtbl, vtbr, vtfl, new THREE.Vector3(0, +1, 0)))
            geom.faces.push(new THREE.Face3(vtfr, vtfl, vtbr, new THREE.Vector3(0, +1, 0)))
        }
        if (this.neighbours.left == null) {
            geom.faces.push(new THREE.Face3(vbbl, vtbl, vbfl, new THREE.Vector3(0, 0, -1)))
            geom.faces.push(new THREE.Face3(vtfl, vbfl, vtbl, new THREE.Vector3(0, 0, -1)))
        }
        if (this.neighbours.right == null) {
            geom.faces.push(new THREE.Face3(vbfr, vtbr, vbbr, new THREE.Vector3(0, 0, +1)))
            geom.faces.push(new THREE.Face3(vtbr, vbfr, vtfr, new THREE.Vector3(0, 0, +1)))
        }
        if (this.neighbours.back == null) {
            geom.faces.push(new THREE.Face3(vbbl, vbbr, vtbl, new THREE.Vector3(-1, 0, 0)))
            geom.faces.push(new THREE.Face3(vtbr, vtbl, vbbr, new THREE.Vector3(-1, 0, 0)))
        }
        if (this.neighbours.front == null) {
            geom.faces.push(new THREE.Face3(vtfl, vbfr, vbfl, new THREE.Vector3(+1, 0, 0)))
            geom.faces.push(new THREE.Face3(vbfr, vtfl, vtfr, new THREE.Vector3(+1, 0, 0)))
        }

        this.mesh = new THREE.Mesh(
            geom,
            new THREE.MeshLambertMaterial({ color: /*0xffffff || */this.color.getHex(), wireframe: false }))

        this.mesh.position.x = this.position.x
        this.mesh.position.y = this.position.y
        this.mesh.position.z = this.position.z
        this.mesh.updateMatrix()
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