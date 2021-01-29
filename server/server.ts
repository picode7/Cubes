/// <reference path='Message.d.ts' />

import fs = require('fs')
import WebSocket = require('ws')
import path = require('path')
import http = require('http')
import * as express from 'express'
import * as compression from 'compression'

// Extend WS Definition for added params
interface WebSocketEx extends WebSocket {
    isAlive: boolean
    player: Player
}

class Player {
    id: string
    position: { x: number, y: number, z: number }
    orientation: { x: number, y: number, z: number }
    inventory: { gold: number }

    constructor(playerId: string) {
        if (playerId != "") {
            this.id = playerId
        } else {
            this.id = uuidv4()
        }
    }

    static playerById(playerId) {
        let player = Player.getPlayer(playerId)
        if (player == null) {
            player = new Player(playerId)
            Player.players.push(player)
        }
        return player
    }
    static players: Player[] = []
    static getPlayer(id: string) {
        for (let player of Player.players) {
            if (player.id == id)
                return player
        }
        return null
    }
    static readonly filePath = "../players.json"
    static load() {
        fs.readFile(Player.filePath, 'utf8', (err, data) => {
            if (!err) {
                Player.players = JSON.parse(data)
            }
        })
    }
    static save() {
        fs.writeFile(Player.filePath, JSON.stringify(Player.players), { encoding: 'utf8' }, () => { })
    }
}


let cubes: Cube_Data[] = []
function loadCubes() {
    fs.readFile("../data.json", 'utf8', (err, data) => {
        if (!err) {
            cubes = JSON.parse(data)
        }

        // Default platform
        if (!cubes || !cubes.length) {
            for (let y = 0; y < 8; ++y) {
                for (let z = 0; z < 8; ++z) {
                    for (let x = 0; x < 8; ++x) {
                        if (
                            (y == 7 && (x == 0 || z == 0 || x == 7 || z == 7)) ||
                            y == 0 ||
                            ((x == 0 || x == 7) && (z == 7 || z == 0))
                        ) {
                            cubes.push({ position: { x: x, y: y, z: z }, type: CUBE_TYPE.stone, color: { r: 0.5, g: 0.5, b: 0.5 } })
                        }
                    }
                }
            }
        }
    })
}
function saveCubes() {
    fs.writeFile("../data.json", JSON.stringify(cubes), { encoding: 'utf8' }, () => { })
}


loadCubes()
Player.load()
setInterval(() => save(), 10 * 1000)
function save() {
    saveCubes()
    Player.save()
}

const app = express()
const server = http.createServer(app)
const wsServer = new WebSocket.Server({ server })

// Websocket-Server
wsServer.on("connection", (socket: WebSocketEx) => {

    socket.isAlive = true
    socket.on("pong", () => {
        socket.isAlive = true
    })

    socket.on("message", (message: string) => {
        let data: Message = JSON.parse(message)

        switch (data.type) {

            case MessageType.cubesAdd:
                broadcast(data, socket)
                cubes.push(...data.cubes)
                break

            case MessageType.chat:
                broadcast(data, socket)
                break

            case MessageType.removeCubes:
                broadcast(data, socket)
                for (let cubeData of data.cubes) {
                    for (let i = 0, max = cubes.length; i < max; ++i) {
                        if (cubes[i].position.x == cubeData.position.x &&
                            cubes[i].position.y == cubeData.position.y &&
                            cubes[i].position.z == cubeData.position.z) {
                            cubes.splice(i, 1)
                            break
                        }
                    }
                }
                break

            case MessageType.getCubes:
                socket.send(JSON.stringify({
                    type: MessageType.cubesAdd,
                    cubes: cubes
                }))
                break

            case MessageType.playerUpdate:
                if (data.player.position) socket.player.position = data.player.position
                if (data.player.orientation) socket.player.orientation = data.player.orientation
                if (data.player.inventory) socket.player.inventory = data.player.inventory
                broadcast({ type: MessageType.playerUpdate, player: socket.player }, socket)
                break

            case MessageType.handshake:
                let playerId = ""
                if (data.player && uuidv4_validate(data.player.id)) playerId = data.player.id
                socket.player = Player.playerById(playerId)

                socket.send(JSON.stringify({
                    type: MessageType.handshake,
                    player: socket.player,
                }))
                break
        }
    })

    socket.on("error", (event) => {
        if ((<any>event).code != "ECONNRESET") // yeah well ignore this one, it should fire onclose anyway
            console.log("client error", event, (<any>event).code)
    })

    socket.on("close", (code, reason) => { // https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
        let message: Message = {
            type: MessageType.playerUpdate,
            player: {
                id: socket.player.id,
                position: null,
            }
        }
        broadcast(message, socket)

        console.log("client lost", code, reason)
    })
})

function broadcast(message: Message, sender: WebSocket = null) {
    wsServer.clients.forEach((clientSocket) => {
        if (clientSocket == sender || clientSocket.readyState !== WebSocket.OPEN) return
        clientSocket.send(JSON.stringify(message))
    })
}

setInterval(() => {
    wsServer.clients.forEach((socket: WebSocketEx) => {

        if (!socket.isAlive) return socket.terminate();

        socket.isAlive = false;
        socket.ping(null, false, true);
    });
}, 10000);

let lastUpdateTime = 0
fs.watch("../client/", { recursive: true }, (curr, prev) => {
    let now = Date.now()
    if (now - lastUpdateTime < 3333) return // don't promt to often in case multiple files change
    lastUpdateTime = now
    broadcast({
        type: MessageType.chat,
        text: "game updates available (reload game)"
    })
})

// Settings
app.disable('x-powered-by')
app.set("strict routing", true)
app.set("case sensitive routing", true)
app.use(compression())

// Routes
app.get("/", (req, res, next) => {
    let filePath = path.resolve('../client/index.html')

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        next()
    }
})
app.get("/changelog.json", (req, res, next) => {
    let filePath = path.resolve('../client/changelog.json')

    if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
    } else {
        next()
    }
})
app.use(express.static(path.resolve('../client/')));
app.all("*", (req, res) => {
    console.log(req.path, "Not found")
    resError(res, 404)
})
function resError(res: express.Response, errCode: number, errMsg?: string) {

    if (errMsg === undefined) {
        switch (errCode) {
            case 400: errMsg = "Bad Request"; break
            case 401: errMsg = "Unauthorized "; break
            case 403: errMsg = "Forbidden "; break
            case 404: errMsg = "Not Found"; break
            case 503: errMsg = "Service Unavailable"; break
        }
    }

    res.status(errCode).json({
        error: errMsg
    })
}

// Start Server
server.listen(8088, () => {

    let host = server.address().address
    let port = server.address().port

    console.log("Server listening on %s:%s", host, port)
})

server.addListener("close", () => {
    console.log("Server closed")
})


// https://stackoverflow.com/a/2117523/4339170
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, // random integer 0 to 15
            v = c == 'x' ?
                r :
                (r & 0x3 | 0x8) // integer from 8 to 11
        return v.toString(16);
    });
}

function uuidv4_validate(str: string): boolean {
    return str.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[4][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i) != null
}