﻿
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

        callback: (e: MouseEvent) => any
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

            let speed = .2
            this.lon += deltaX * speed
            this.lat -= deltaY * speed

            this.lat = Math.max(-89.99999, Math.min(89.99999, this.lat))

            let phi = THREE.Math.degToRad(90 - this.lat)
            let theta = THREE.Math.degToRad(this.lon)

            game.camera.lookAt(new THREE.Vector3(
                game.camera.position.x + Math.sin(phi) * Math.cos(theta),
                game.camera.position.y + Math.cos(phi),
                game.camera.position.z + Math.sin(phi) * Math.sin(theta)
            ))
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