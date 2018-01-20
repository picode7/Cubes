import fs = require('fs')
import WebSocket = require('ws')
import path = require('path')
import http = require('http')
import * as express from 'express'
import * as compression from 'compression'

// Extend WS Definition for added params
interface WebSocketEx extends WebSocket {
    isAlive: boolean
}

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



let cubes: { x: number, y: number, z: number }[] = []
load()
setInterval(() => save(), 10 * 1000)
function load() {
    fs.readFile("../data.json", 'utf8', (err, data) => {
        if (err) return
        cubes = JSON.parse(data)
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
                cubes.push(...data.cubes)
                broadcast(data, socket)
                break

            case MessageType.getCubes:
                socket.send(JSON.stringify({
                    type: MessageType.cubesAdd,
                    cubes: cubes
                }))
                break

            case MessageType.playerPosition:
                broadcast(data, socket)
                break
        }
    })

    socket.on("error", (event) => {
        console.log("client error", event)
    })

    socket.on("close", (code, reason) => {
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