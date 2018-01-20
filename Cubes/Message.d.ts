
declare const enum MessageType {
    handshake,
    getCubes,
    cubesAdd,
    removeCubes,
    playerUpdate,
}

interface Message {
    type: MessageType
    cubes?: { x: number, y: number, z: number }[]
    player?: {
        id: string,
        position: { x: number, y: number, z: number }
    }
}
