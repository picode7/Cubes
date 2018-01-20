
class Connection {
    ws: WebSocket

    constructor() {
        this.ws = new WebSocket(`${location.protocol == "https:" ? "wss" : "ws"}://${location.host}${location.pathname}`)
        this.ws.onopen = () => {
            let message1: Message = {
                type: MessageType.handshake
            }
            this.ws.send(JSON.stringify(message1))

            let message2: Message = {
                type: MessageType.getCubes
            }
            this.ws.send(JSON.stringify(message2))
        }
        this.ws.onmessage = (ev) => {
            let message: Message = JSON.parse(ev.data)

            switch (message.type) {

                case MessageType.handshake:
                    game.world.player.id = message.player.id
                    break

                case MessageType.cubesAdd:
                    for (let cubePosition of message.cubes) {
                        let cube = new Cube(cubePosition)
                        game.world.cubes.push(cube)
                        cube.init(true)
                    }
                    setTimeout(() => game.world.createMashup(), 100)
                    break

                case MessageType.playerUpdate:
                    if (game.world.players === undefined) break

                    if (message.player.position == null) {
                        // remove player
                        console.log(game.world.players)
                        for (let i = 0; i < game.world.players.length; ++i) {
                            if (game.world.players[i].id == message.player.id) {
                                game.world.players[i].remove()
                                game.world.players.splice(i, 1)
                                break
                            }
                        }
                        console.log(game.world.players)
                    } else {
                        let found: Player = null
                        for (let player of game.world.players) {
                            if (player.id == message.player.id) {
                                found = player
                                break
                            }
                        }
                        if (found == null) {
                            found = new Player(message.player.position)
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
    }
}
