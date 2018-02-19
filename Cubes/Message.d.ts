
declare const enum MessageType {
    handshake,
    getCubes,
    cubesAdd,
    removeCubes,
    playerUpdate,
    chat,
    system,
}

declare const enum CUBE_TYPE {
    stone,
    glas, 
    mono,
}

interface COLOR_RGB {
    r: number, g: number, b: number,
}

interface Cube_Data {
    position: { x: number, y: number, z: number },
    type: CUBE_TYPE,
    color: COLOR_RGB,
}

interface Message {
    type: MessageType
    cubes?: Cube_Data[]
    player?: {
        id: string,
        position?: { x: number, y: number, z: number },
        orientation?: { x: number, y: number, z: number },
        inventory?: { gold: number },
    }
    text?: string
}
