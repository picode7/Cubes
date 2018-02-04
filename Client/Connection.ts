
class Connection {
    private ws: WebSocket
    wasConnected = false
    connectedSinceAttempt = false
    handshake = false

    constructor() {
        this.start()
    }

    start() {
        this.handshake = false
        this.timeConnectAttempt = Date.now()
        this.ws = new WebSocket(`${location.protocol == "https:" ? "wss" : "ws"}://${location.host}${location.pathname}`)
        
        this.ws.onopen = () => {
            game.chat.onmessage("connected to server")

            let message1: Message = {
                type: MessageType.handshake
            }
            this.ws.send(JSON.stringify(message1))

            if (this.wasConnected == false) {
                let message2: Message = {
                    type: MessageType.getCubes
                }
                this.ws.send(JSON.stringify(message2))
                this.wasConnected = true
            }
            this.connectedSinceAttempt = true
        }

        this.ws.onmessage = (ev) => {
            let message: Message = JSON.parse(ev.data)

            switch (message.type) {

                case MessageType.handshake:
                    game.world.player.id = message.player.id
                    this.handshake = true
                    break

                case MessageType.chat:
                    game.chat.onmessage(message.text)
                    break

                case MessageType.cubesAdd:
                    let newCubes: Cube[] = []
                    for (let cubeData of message.cubes) {
                        let cube = new Cube(cubeData)
                        newCubes.push(cube)
                        game.world.cubes.push(cube)
                    }
                    for (let cube of newCubes) {
                        cube.init(true)
                    }
                    game.world.createMashup()
                    break

                case MessageType.removeCubes:
                    for (let cubeData of message.cubes) {
                        for (let i = 0, max = game.world.cubes.length; i < max; ++i) {
                            if (game.world.cubes[i].position.x == cubeData.position.x &&
                                game.world.cubes[i].position.y == cubeData.position.y &&
                                game.world.cubes[i].position.z == cubeData.position.z) {
                                game.world.cubes[i].remove()
                                game.world.cubes.splice(i, 1)
                                break
                            }
                        }
                    }
                    game.world.createMashup()
                    break

                case MessageType.playerUpdate:
                    if (game.world.players === undefined) break

                    if (message.player.position == null) {
                        // remove player
                        for (let i = 0; i < game.world.players.length; ++i) {
                            if (game.world.players[i].id == message.player.id) {
                                game.world.players[i].remove()
                                game.world.players.splice(i, 1)
                                game.chat.onmessage("player left")
                                break
                            }
                        }
                    } else {
                        let found: Player = null
                        for (let player of game.world.players) {
                            if (player.id == message.player.id) {
                                found = player
                                break
                            }
                        }
                        if (found == null) {
                            // add player
                            game.chat.onmessage("player joined")
                            found = new Player(message.player.position, false)
                            found.id = message.player.id
                            game.world.players.push(found)
                        } else {
                            found.position = message.player.position
                            found.updateMeshPosition()
                        }
                    }

                    break
            }
        }
        this.ws.onerror = () => {}
        this.ws.onclose = (ev) => {
            if (this.connectedSinceAttempt) game.chat.onmessage("disconnected from server")
            this.reconnect()
            this.connectedSinceAttempt = false
        }
    }
    
    timeConnectAttempt = 0
    timeOutReconnect = 0
    private reconnect() {
        if (Date.now() - this.timeConnectAttempt > 5 * 1000) {
            this.start()
        } else {
            this.timeOutReconnect = setTimeout(() => this.start(), 1000)
        }
    }

    readyState(): number {
        return this.ws.readyState
    }

    sendMessage(msg: Message) {
        if (this.ws.readyState != 1 || this.handshake == false) return
        this.ws.send(JSON.stringify(msg))
    }
}
