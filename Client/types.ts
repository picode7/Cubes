
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
