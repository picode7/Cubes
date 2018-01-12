/// <reference path='types/three.d.ts' />

const enum MessageType {
    getCubes,
    cubesAdd,
    playerPosition,
}
interface Message {
    type: MessageType
    cubes?: { x: number, y: number, z: number }[]
    player?: {
        id: number,
        position: { x: number, y: number, z: number }
    }
}

let game: Game
window.onload = () => {
    game = new Game()
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

    constructor() {

        if(Input.Pointer.isSupported == false) alert("Browser not supported!")

        game = this

        // Scene
        this.scene = new THREE.Scene()
        this.scene.background = new THREE.Color(0x111010);

        // Camera
        this.camera = new THREE.PerspectiveCamera(90, 1, 0.1, 1000);

        // Renderer
        this.renderer = new THREE.WebGLRenderer()
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
        this.pointer.moveCamera(0,0)
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
        let rollOverGeo = new THREE.BoxGeometry(1, 1, 1);
        let rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.2, transparent: true });
        this.rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial)

        // Start rendering
        this.stepPreviousTime = Date.now()
        this.animate()
        setInterval(() => this.step(), 1000 / 100)
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
                return true
            }))

            if (intersects.length > 0) {
                let position = this.getRayCubePos(intersects[0])
                let cube = new Cube({ x: position.x, y: position.y, z: position.z })
                this.world.cubes.push(cube)
                cube.init(true)
                let message: Message = {
                    type: MessageType.cubesAdd,
                    cubes: [cube.position]
                }
                this.connection.ws.send(JSON.stringify(message))
                cube.mesh.position = position
            }
        }
    }

    getRayCubePos(intersect: THREE.Intersection) {
        let n = intersect.face.normal.clone()
        if (n.x > 0) n.x = 0
        if (n.y > 0) n.y = 0
        if (n.z > 0) n.z = 0
        return intersect.point.clone().add(n).floor()
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
                this.rollOverMesh.position.copy(this.getRayCubePos(intersects[0]))
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
            `Connection: ${this.connection.ws.readyState}<br/>` +
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

class Connection {
    ws: WebSocket

    constructor() {
        this.ws = new WebSocket(`${location.protocol == "https:" ? "wss" : "ws"}://${location.host}${location.pathname}`)
        this.ws.onopen = () => {
            let message: Message = {
                type: MessageType.getCubes
            }
            this.ws.send(JSON.stringify(message))
        }
        this.ws.onmessage = (ev) => {
            let message: Message = JSON.parse(ev.data)
            
            switch (message.type) {

                case MessageType.cubesAdd:
                    for (let cubePosition of message.cubes) {
                        let cube = new Cube(cubePosition)
                        game.world.cubes.push(cube)
                        cube.init(true)
                    }
                    setTimeout(() => game.world.createMashup(), 1000)
                    break

                case MessageType.playerPosition:

                    break
            }
        }
    }
}

class World {

    cubes: Cube[] = []
    player: Player

    constructor() {

        this.player = new Player({ x: 4, y: 2, z: 4 })
        
        for (let y = 0; y < 8; ++y) {
            for (let z = 0; z < 8; ++z) {
                for (let x = 0; x < 8; ++x) {
                    if (
                        (y == 7 && (x == 0 || z == 0 || x == 7 || z == 7)) ||
                        y == 0 ||
                        ((x == 0 || x == 7) && (z == 7 || z == 0))
                    ) {
                        this.cubes.push(new Cube({ x: x, y: y, z: z }))
                    }
                }
            }
        }
    }

    init() {
        for (let cube of this.cubes) {
            cube.init()
        }
    }

    step(deltaTime: number) {
        this.player.step(deltaTime)
    }

    mashup: THREE.BufferGeometry = null
    createMashup() {
        let geom = new THREE.Geometry()

        for (let cube of this.cubes) {
            geom.merge(<THREE.Geometry>cube.mesh.geometry, cube.mesh.matrix)
            game.scene.remove(cube.mesh)
        }

        let mesh = new THREE.Mesh(
            new THREE.BufferGeometry().fromGeometry(geom),
            new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true }))
        game.scene.add(mesh)
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

        //let geometry = new THREE.BoxGeometry(1, 1, 1)
        ////let material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })
        //let material = new THREE.MeshLambertMaterial({ color: color.getHex() })
        //this.mesh = new THREE.Mesh(geometry, material)
        //this.mesh.position.x = this.position.x + 0.5
        //this.mesh.position.y = this.position.y + 0.5
        //this.mesh.position.z = this.position.z + 0.5

        game.scene.add(this.mesh)
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


        if (this.mesh) game.scene.remove(this.mesh)
        this.mesh = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ color: /*0xffffff || */this.color.getHex(), wireframe: false }))

        this.mesh.position.x = this.position.x
        this.mesh.position.y = this.position.y
        this.mesh.position.z = this.position.z
        game.scene.add(this.mesh)
    }

    checkNeighbours(updateOthers = false) {

        this.neighbours = {
            top: null,
            bottom: null,
            front: null,
            back: null,
            left: null,
            right: null,
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

class Player {

    position: Vector3

    mesh: THREE.Mesh

    constructor(position: Vector3) {

        this.position = position

        let color = new THREE.Color(0xff8800)
        let geometry = new THREE.CylinderGeometry(1 / 2, 1 / 2, 2, 30, 1)
        let material = new THREE.MeshLambertMaterial ({ color: color.getHex() })
        this.mesh = new THREE.Mesh(geometry, material)
        game.scene.add(this.mesh)

        this.spawn()
        

    }

    spawn() {
        this.position.x = 4
        this.position.y = 2
        this.position.z = 4
        this.velocityY = 0
    }
    
    velocityY = 0
    step(deltaTime: number) {

        let facingDirection = game.camera.rotation.y
        let walkSpeed = 0
        let walkSideSpeed = 0
        let fast = false

        // Keyboard Input
        for (let i = game.keysDown.length - 1; i >= 0; --i) {
            switch (game.keysDown[i]) {
                case Input.KEY.W: if (walkSpeed == 0) walkSpeed = 6 / 3.6; break
                case Input.KEY.S: if (walkSpeed == 0) walkSpeed = -6 / 3.6; break
                case Input.KEY.A: if (walkSideSpeed == 0) walkSideSpeed = -6 / 3.6; break
                case Input.KEY.D: if (walkSideSpeed == 0) walkSideSpeed = 6 / 3.6; break
                case Input.KEY.SPACE: if (this.velocityY == 0) this.velocityY = 9.81 / 2; break
                case Input.KEY.CTRL: fast = true; break
            }
        }

        // Gravity
        this.velocityY += -9.81 * deltaTime

        // Angle
        game.camera.rotation.order = 'YXZ';
        this.mesh.rotation.order = 'YXZ';
        this.mesh.rotation.y = facingDirection

        // Adjust Speeds
        let walkingDirection = facingDirection
        if (fast) walkSpeed *= 2
        let speed = walkSpeed
        if (speed == 0) {
            if (walkSideSpeed != 0) {
                walkingDirection -= Math.PI / 2
                speed = walkSideSpeed
            }
        } else if (speed > 0) {
            if (walkSideSpeed > 0) walkingDirection -= Math.PI / 4
            if (walkSideSpeed < 0) walkingDirection += Math.PI / 4
        } else if (speed < 0) {
            if (walkSideSpeed > 0) walkingDirection += Math.PI / 4
            if (walkSideSpeed < 0) walkingDirection -= Math.PI / 4
        }
        const radians = walkingDirection > 0 ? walkingDirection : (2 * Math.PI) + walkingDirection;
        
        // Wanted movement
        let deltaX = speed * Math.sin(-radians) * deltaTime
        let deltaY = this.velocityY * deltaTime
        let deltaZ = speed * -Math.cos(-radians) * deltaTime

        if (this.position.y < -50) {

            // Respawn
            this.spawn()
        } else {

            // Collisions
            let collisionRadius = Math.sqrt(0.5 * 0.5 / 2)

            for (let cube of game.world.cubes) {

                // Ignore if not colliding
                if (!Collision.circle_rect(
                    this.position.x + deltaX, this.position.z + deltaZ, collisionRadius,
                    cube.position.x, cube.position.z, cube.position.x + 1, cube.position.z + 1,
                )) continue

                // Check side collisions
                if (this.position.y >= cube.position.y && this.position.y < cube.position.y + 1) {
                    // only collide if it wasn't allready colliding previously
                    if (!Collision.circle_rect(
                        this.position.x, this.position.z, collisionRadius,
                        cube.position.x, cube.position.z,cube.position.x + 1, cube.position.z + 1,
                    )) {
                        deltaX = 0
                        deltaZ = 0
                    }
                }

                // Check from top down
                if (this.position.y >= cube.position.y + 1 && this.position.y + deltaY < cube.position.y + 1) {
                    deltaY = (cube.position.y + 1) - this.position.y
                    this.velocityY = 0
                }
            }

            // Finally update position
            this.position.x += deltaX
            this.position.y += deltaY
            this.position.z += deltaZ
        }

        // Update Object Position
        this.mesh.position.x = this.position.x
        this.mesh.position.y = this.position.y + 1 
        this.mesh.position.z = this.position.z

        // Update Camera
        let camX = 0//0.5 * Math.sin(-radians)
        let camZ = 0//0.5 * -Math.cos(-radians)
        game.camera.position.x = this.mesh.position.x
        game.camera.position.y = this.mesh.position.y + 0.25
        game.camera.position.z = this.mesh.position.z
    }
}

namespace Input {

    export class Pointer {

        locked: boolean = false

        constructor(public canvas: HTMLCanvasElement) {
            this.canvas.addEventListener("mousedown", this.canvas.requestPointerLock)
            document.addEventListener('pointerlockchange', () => this.pointerlockchange(), false)
            this.callback = (e) => this.mousemove(e)
        }
        
        static get isSupported(): boolean {
            return 'pointerLockElement' in document
        }

        callback: (e:MouseEvent)=>any
        pointerlockchange() {
            if (document.pointerLockElement === this.canvas && this.locked == false) {
                this.locked = true
                document.addEventListener("mousemove", this.callback, false)
            } else if (document.pointerLockElement !== this.canvas && this.locked == true) {
                this.locked = false
                document.removeEventListener("mousemove", this.callback, false)
            }
        }

        mousemove(e: MouseEvent) {

            // https://bugs.chromium.org/p/chromium/issues/detail?id=781182
            if (Math.abs(e.movementX) > 200 || Math.abs(e.movementY) > 200) return
            this.moveCamera(e.movementX, e.movementY)
        }

        lat = 0
        lon = 0
        moveCamera(deltaX, deltaY) {
            let phi, theta
            let speed = .3

            this.lon += deltaX * speed
            this.lat -= deltaY * speed

            this.lat = Math.max(- 85, Math.min(85, this.lat));
            phi = THREE.Math.degToRad(90 - this.lat);

            theta = THREE.Math.degToRad(this.lon)

            let lookAt = new THREE.Vector3(
                game.camera.position.x + Math.sin(phi) * Math.cos(theta),
                game.camera.position.y + Math.cos(phi),
                game.camera.position.z + Math.sin(phi) * Math.sin(theta)
            )
            game.camera.lookAt(lookAt)
        }
    }
    
    export const enum KEY {
        BACKSPACE = 8,
        TAB = 9,

        ENTER = 13,

        SHIFT = 16,
        CTRL = 17,
        ALT = 18,
        PAUSE_BREAK = 19,
        CAPS_LOCK = 20,

        ESC = 27,

        SPACE = 32,
        PAGE_UP = 33,
        PAGE_DOWN = 34,
        END = 35,
        HOME = 36,
        LEFT_ARROW = 37,
        UP_ARROW = 38,
        RIGHT_ARROW = 39,
        DOWN_ARROW = 40,

        INSERT = 45,
        DELETE = 46,

        _0 = 48,
        _1 = 49,
        _2 = 50,
        _3 = 51,
        _4 = 52,
        _5 = 53,
        _6 = 54,
        _7 = 55,
        _8 = 56,
        _9 = 57,

        A = 65,
        B = 66,
        C = 67,
        D = 68,
        E = 69,
        F = 70,
        G = 71,
        H = 72,
        I = 73,
        J = 74,
        K = 75,
        L = 76,
        M = 77,
        N = 78,
        O = 79,
        P = 80,
        Q = 81,
        R = 82,
        S = 83,
        T = 84,
        U = 85,
        V = 86,
        W = 87,
        X = 88,
        Y = 89,
        Z = 90,
        LEFT_WINDOW_KEY = 91,
        RIGHT_WINDOW_KEY = 92,
        SELECT_KEY = 93,

        NUMPAD_0 = 96,
        NUMPAD_1 = 97,
        NUMPAD_2 = 98,
        NUMPAD_3 = 99,
        NUMPAD_4 = 100,
        NUMPAD_5 = 101,
        NUMPAD_6 = 102,
        NUMPAD_7 = 103,
        NUMPAD_8 = 104,
        NUMPAD_9 = 105,
        NUMPAD_MULTIPLY = 106,
        NUMPAD_ADD = 107,
        //NUMPAD_ENTER = 108,
        NUMPAD_SUBSTRACT = 109,
        NUMPAD_DECIMAL = 110,
        NUMPAD_DEVIDE = 111,
        F1 = 112,
        F2 = 113,
        F3 = 114,
        F4 = 115,
        F5 = 116,
        F6 = 117,
        F7 = 118,
        F8 = 119,
        F9 = 120,
        F10 = 121,
        F11 = 122,
        F12 = 123,
        F13 = 124,
        F14 = 125,
        F15 = 126,

        NUM_LOCK = 144,
        SCROLL_LOCK = 145,

        COLON = 186,
        EQUAL = 187,
        COMMA = 188,
        UNDERSCORE = 189,
        PERIOD = 190,
        FORWARD_SLASH = 191,
        GRAVE_ACCENT = 192,

        OPEN_BRAKET = 219,
        BACK_SLASH = 220,
        CLOSE_BRAKET = 221,
        SINGLE_QUOTE = 222,
    }
}

function elementFromHTML(html: string): HTMLElement {
    let div = document.createElement('div')
    div.innerHTML = html
    let el = <HTMLElement>div.firstElementChild
    div.removeChild(el)
    return el
}

namespace Collision {
    export function rect_rect(r1x1, r1y1, r1x2, r1y2, r2x1, r2y1, r2x2, r2y2) {
        return !(r1x1 >= r2x2 || r1x2 <= r2x1 || r1y1 >= r2y2 || r1y2 <= r2y1);
    }

    export function circle_rect(cx, cy, cr, rx1, ry1, rx2, ry2) {
        if (((rx1 - cr < cx) && (rx2 + cr > cx) && (ry1 - cr < cy) && (ry2 + cr > cy))) {
            if (cy < ry1) {
                if (cx < rx1) {
                    return circle_point(cx, cy, cr, rx1, ry1);
                } else if (cx > rx2) {
                    return circle_point(cx, cy, cr, rx2, ry1);
                }
            } else if (cy > ry2) {
                if (cx < rx1) {
                    return circle_point(cx, cy, cr, rx1, ry2);
                } else if (cx > rx2) {
                    return circle_point(cx, cy, cr, rx2, ry2);
                }
            }
            return true;
        }
        return false;
    }

    export function circle_point(cx, cy, cr, px, py) {
        var dx = cx - px;
        var dy = cy - py;
        return (dx * dx + dy * dy < cr * cr);
    }
}

interface Vector3 {
    x: number
    y: number
    z: number
}

declare namespace THREE {
    export class OrbitControls {
        constructor(camera: THREE.Camera, domEl: HTMLCanvasElement)
        update(): void
        enablePan: boolean
        enableZoom: boolean
        target: THREE.Vector3
    }
    export interface Object3D {
        material: THREE.Material
    }
    export interface Material {
        color: THREE.Color
    }
}
