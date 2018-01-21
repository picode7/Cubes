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
    id: string = uuidv4()
    position: {x: number, y: number, z: number}
}

let cubes: { x: number, y: number, z: number }[] = []
load()
setInterval(() => save(), 10 * 1000)
function load() {
    fs.readFile("../data.json", 'utf8', (err, data) => {
        if (!err) {
            cubes = JSON.parse(data)
        }

        // Default platform
        if (!cubes|| !cubes.length ) {
            for (let y = 0; y < 8; ++y) {
                for (let z = 0; z < 8; ++z) {
                    for (let x = 0; x < 8; ++x) {
                        if (
                            (y == 7 && (x == 0 || z == 0 || x == 7 || z == 7)) ||
                            y == 0 ||
                            ((x == 0 || x == 7) && (z == 7 || z == 0))
                        ) {
                            cubes.push({ x: x, y: y, z: z })
                        }
                    }
                }
            }
        }
    })
}
function save() {
    fs.writeFile("../data.json", JSON.stringify(cubes), { encoding: 'utf8' }, () => { })
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

            case MessageType.removeCubes:
                broadcast(data, socket)
                for (let cubePosition of data.cubes) {
                    for (let i = 0, max = cubes.length; i < max; ++i) {
                        if (cubes[i].x == cubePosition.x &&
                            cubes[i].y == cubePosition.y &&
                            cubes[i].z == cubePosition.z) {
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
                socket.player.position = data.player.position
                broadcast({ type: MessageType.playerUpdate, player: socket.player }, socket)
                break

            case MessageType.handshake:
                socket.player = new Player()
                socket.send(JSON.stringify({
                    type: MessageType.handshake,
                    player: socket.player,
                }))
                break
        }
    })

    socket.on("error", (event) => {
        console.log("client error", event)
    })

    socket.on("close", (code, reason) => {
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
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}