var Input;
(function (Input) {
    var Pointer = /** @class */ (function () {
        function Pointer(canvas) {
            var _this = this;
            this.canvas = canvas;
            this.locked = false;
            this.lat = 0;
            this.lon = 0;
            this.canvas.addEventListener("mousedown", this.canvas.requestPointerLock);
            document.addEventListener('pointerlockchange', function () { return _this.pointerlockchange(); }, false);
            this.callback = function (e) { return _this.mousemove(e); };
        }
        Object.defineProperty(Pointer, "isSupported", {
            get: function () {
                return 'pointerLockElement' in document;
            },
            enumerable: true,
            configurable: true
        });
        Pointer.prototype.pointerlockchange = function () {
            if (document.pointerLockElement === this.canvas && this.locked == false) {
                this.locked = true;
                document.addEventListener("mousemove", this.callback, false);
            }
            else if (document.pointerLockElement !== this.canvas && this.locked == true) {
                this.locked = false;
                document.removeEventListener("mousemove", this.callback, false);
            }
        };
        Pointer.prototype.mousemove = function (e) {
            // https://bugs.chromium.org/p/chromium/issues/detail?id=781182
            if (Math.abs(e.movementX) > 200 || Math.abs(e.movementY) > 200)
                return;
            this.moveCamera(e.movementX, e.movementY);
        };
        Pointer.prototype.moveCamera = function (deltaX, deltaY) {
            var speed = .2;
            this.lon += deltaX * speed;
            this.lat -= deltaY * speed;
            this.lat = Math.max(-89.99999, Math.min(89.99999, this.lat));
            var phi = THREE.Math.degToRad(90 - this.lat);
            var theta = THREE.Math.degToRad(this.lon);
            game.camera.lookAt(new THREE.Vector3(game.camera.position.x + Math.sin(phi) * Math.cos(theta), game.camera.position.y + Math.cos(phi), game.camera.position.z + Math.sin(phi) * Math.sin(theta)));
        };
        return Pointer;
    }());
    Input.Pointer = Pointer;
})(Input || (Input = {}));
//# sourceMappingURL=file1.js.map