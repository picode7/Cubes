/// <reference path='types/three.d.ts' />
var game;
window.onload = function () {
    game = new Game();
};
var Game = /** @class */ (function () {
    function Game() {
        var _this = this;
        this.raycaster = new THREE.Raycaster();
        this.keysDown = [];
        this.meshShowing = false;
        this.stepPreviousTime = 0;
        if (Input.Pointer.isSupported == false)
            alert("Browser not supported!");
        game = this;
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x111010);
        // Camera
        this.camera = new THREE.PerspectiveCamera(90, 1, 0.1, 1000);
        // Renderer
        this.renderer = new THREE.WebGLRenderer();
        document.body.appendChild(this.renderer.domElement);
        // Setup Lights
        var ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        var directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1, 0.5).normalize();
        this.scene.add(directionalLight);
        this.onResize();
        this.world = new World();
        this.world.init();
        var rollOverGeo = new THREE.BoxGeometry(1, 1, 1);
        var rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000, opacity: 0.2, transparent: true });
        this.rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
        // Events
        window.addEventListener("resize", function () { return _this.onResize(); });
        this.pointer = new Input.Pointer(this.renderer.domElement);
        this.pointer.moveCamera(0, 0);
        window.addEventListener("mousedown", function (event) {
            _this.onclick();
        });
        window.addEventListener("keydown", function (e) {
            var pos = _this.keysDown.indexOf(e.keyCode);
            if (pos != -1)
                _this.keysDown.splice(pos, 1);
            _this.keysDown.push(e.keyCode);
        });
        window.addEventListener("keyup", function (e) {
            _this.keysDown.splice(_this.keysDown.indexOf(e.keyCode), 1);
        });
        // Start rendering
        this.stepPreviousTime = Date.now();
        this.animate();
        setInterval(function () { return _this.step(); }, 1000 / 100);
    }
    Game.prototype.onResize = function () {
        // Update render size
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    };
    Game.prototype.onclick = function () {
        var _this = this;
        // Put block
        if (this.pointer.locked) {
            this.raycaster.set(this.camera.position, this.camera.getWorldDirection());
            var intersects = this.raycaster.intersectObjects(this.scene.children.filter(function (obj) {
                if (obj == _this.rollOverMesh)
                    return false;
                if (obj == _this.world.player.mesh)
                    return false;
                return true;
            }));
            if (intersects.length > 0) {
                var position = new THREE.Vector3().copy(intersects[0].object.position).add(intersects[0].face.normal);
                var cube = new Cube({ x: position.x, y: position.y, z: position.z });
                this.world.cubes.push(cube);
                cube.init(true);
                cube.mesh.position = position;
            }
        }
    };
    Game.prototype.animate = function () {
        var _this = this;
        // Raycast poiting position
        if (this.pointer.locked) {
            this.raycaster.set(this.camera.position, this.camera.getWorldDirection());
            var intersects = this.raycaster.intersectObjects(this.scene.children.filter(function (obj) {
                if (obj == _this.rollOverMesh)
                    return false;
                if (obj == _this.world.player.mesh)
                    return false;
                return true;
            }));
            if (intersects.length == 0) {
                if (this.meshShowing) {
                    this.meshShowing = false;
                    this.scene.remove(this.rollOverMesh);
                }
            }
            else if (!this.meshShowing) {
                this.scene.add(this.rollOverMesh);
                this.meshShowing = true;
            }
            if (intersects.length) {
                this.rollOverMesh.position.copy(intersects[0].object.position).add(intersects[0].face.normal);
                this.rollOverMesh.position.addScalar(0.5);
            }
        }
        else {
            this.meshShowing = false;
            this.scene.remove(this.rollOverMesh);
        }
        // Render Scene
        this.renderer.render(this.scene, this.camera);
        // Ask to do it again next Frame
        requestAnimationFrame(function () { return _this.animate(); });
    };
    Game.prototype.step = function () {
        var stepTime = Date.now();
        var deltaTime = (stepTime - this.stepPreviousTime) / 1000;
        this.world.step(deltaTime);
        this.stepPreviousTime = stepTime;
    };
    return Game;
}());
var World = /** @class */ (function () {
    function World() {
        this.cubes = [];
        this.player = new Player({ x: 4, y: 2, z: 4 });
        for (var y = 0; y < 8; ++y) {
            for (var z = 0; z < 8; ++z) {
                for (var x = 0; x < 8; ++x) {
                    if ((y == 7 && (x == 0 || z == 0 || x == 7 || z == 7)) ||
                        y == 0 ||
                        ((x == 0 || x == 7) && (z == 7 || z == 0))) {
                        this.cubes.push(new Cube({ x: x, y: y, z: z }));
                    }
                }
            }
        }
    }
    World.prototype.init = function () {
        for (var _i = 0, _a = this.cubes; _i < _a.length; _i++) {
            var cube = _a[_i];
            cube.init();
        }
    };
    World.prototype.step = function (deltaTime) {
        this.player.step(deltaTime);
    };
    return World;
}());
var Cube = /** @class */ (function () {
    function Cube(position) {
        this.position = position;
    }
    Cube.prototype.init = function (updateNeighbours) {
        if (updateNeighbours === void 0) { updateNeighbours = false; }
        var c = Math.random();
        this.color = new THREE.Color(c, c, c);
        this.checkNeighbours(updateNeighbours);
        this.buildGeometry();
        //let geometry = new THREE.BoxGeometry(1, 1, 1)
        ////let material = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true })
        //let material = new THREE.MeshLambertMaterial({ color: color.getHex() })
        //this.mesh = new THREE.Mesh(geometry, material)
        //this.mesh.position.x = this.position.x + 0.5
        //this.mesh.position.y = this.position.y + 0.5
        //this.mesh.position.z = this.position.z + 0.5
        game.scene.add(this.mesh);
    };
    Cube.prototype.buildGeometry = function () {
        var geom = new THREE.Geometry();
        // Vertices
        var vbbl, vbfl, vbfr, vbbr, vtbl, vtfl, vtfr, vtbr;
        if (this.neighbours.bottom == null || this.neighbours.back == null || this.neighbours.left == null) {
            vbbl = geom.vertices.push(new THREE.Vector3(0, 0, 0)) - 1;
        }
        if (this.neighbours.bottom == null || this.neighbours.front == null || this.neighbours.left == null) {
            vbfl = geom.vertices.push(new THREE.Vector3(1, 0, 0)) - 1;
        }
        if (this.neighbours.bottom == null || this.neighbours.front == null || this.neighbours.right == null) {
            vbfr = geom.vertices.push(new THREE.Vector3(1, 0, 1)) - 1;
        }
        if (this.neighbours.bottom == null || this.neighbours.back == null || this.neighbours.right == null) {
            vbbr = geom.vertices.push(new THREE.Vector3(0, 0, 1)) - 1;
        }
        if (this.neighbours.top == null || this.neighbours.back == null || this.neighbours.left == null) {
            vtbl = geom.vertices.push(new THREE.Vector3(0, 1, 0)) - 1;
        }
        if (this.neighbours.top == null || this.neighbours.front == null || this.neighbours.left == null) {
            vtfl = geom.vertices.push(new THREE.Vector3(1, 1, 0)) - 1;
        }
        if (this.neighbours.top == null || this.neighbours.front == null || this.neighbours.right == null) {
            vtfr = geom.vertices.push(new THREE.Vector3(1, 1, 1)) - 1;
        }
        if (this.neighbours.top == null || this.neighbours.back == null || this.neighbours.right == null) {
            vtbr = geom.vertices.push(new THREE.Vector3(0, 1, 1)) - 1;
        }
        // Faces
        if (this.neighbours.bottom == null) {
            geom.faces.push(new THREE.Face3(vbfl, vbbr, vbbl, new THREE.Vector3(0, -1, 0)));
            geom.faces.push(new THREE.Face3(vbbr, vbfl, vbfr, new THREE.Vector3(0, -1, 0)));
        }
        if (this.neighbours.top == null) {
            geom.faces.push(new THREE.Face3(vtbl, vtbr, vtfl, new THREE.Vector3(0, +1, 0)));
            geom.faces.push(new THREE.Face3(vtfr, vtfl, vtbr, new THREE.Vector3(0, +1, 0)));
        }
        if (this.neighbours.left == null) {
            geom.faces.push(new THREE.Face3(vbbl, vtbl, vbfl, new THREE.Vector3(0, 0, -1)));
            geom.faces.push(new THREE.Face3(vtfl, vbfl, vtbl, new THREE.Vector3(0, 0, -1)));
        }
        if (this.neighbours.right == null) {
            geom.faces.push(new THREE.Face3(vbfr, vtbr, vbbr, new THREE.Vector3(0, 0, +1)));
            geom.faces.push(new THREE.Face3(vtbr, vbfr, vtfr, new THREE.Vector3(0, 0, +1)));
        }
        if (this.neighbours.back == null) {
            geom.faces.push(new THREE.Face3(vbbl, vbbr, vtbl, new THREE.Vector3(-1, 0, 0)));
            geom.faces.push(new THREE.Face3(vtbr, vtbl, vbbr, new THREE.Vector3(-1, 0, 0)));
        }
        if (this.neighbours.front == null) {
            geom.faces.push(new THREE.Face3(vtfl, vbfr, vbfl, new THREE.Vector3(+1, 0, 0)));
            geom.faces.push(new THREE.Face3(vbfr, vtfl, vtfr, new THREE.Vector3(+1, 0, 0)));
        }
        if (this.mesh)
            game.scene.remove(this.mesh);
        this.mesh = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ color: /*0xffffff || */ this.color.getHex(), wireframe: false }));
        this.mesh.position.x = this.position.x;
        this.mesh.position.y = this.position.y;
        this.mesh.position.z = this.position.z;
        game.scene.add(this.mesh);
    };
    Cube.prototype.checkNeighbours = function (updateOthers) {
        if (updateOthers === void 0) { updateOthers = false; }
        this.neighbours = {
            top: null,
            bottom: null,
            front: null,
            back: null,
            left: null,
            right: null,
        };
        for (var _i = 0, _a = game.world.cubes; _i < _a.length; _i++) {
            var cube = _a[_i];
            if (cube == this)
                continue;
            // same level
            if (cube.position.y == this.position.y) {
                // front back
                if (cube.position.z == this.position.z) {
                    if (cube.position.x == this.position.x + 1) {
                        this.neighbours.front = cube;
                        if (updateOthers) {
                            cube.neighbours.back = this;
                            cube.buildGeometry();
                        }
                    }
                    else if (cube.position.x == this.position.x - 1) {
                        this.neighbours.back = cube;
                        if (updateOthers) {
                            cube.neighbours.front = this;
                            cube.buildGeometry();
                        }
                    }
                }
                // left right
                if (cube.position.x == this.position.x) {
                    if (cube.position.z == this.position.z - 1) {
                        this.neighbours.left = cube;
                        if (updateOthers) {
                            cube.neighbours.right = this;
                            cube.buildGeometry();
                        }
                    }
                    else if (cube.position.z == this.position.z + 1) {
                        this.neighbours.right = cube;
                        if (updateOthers) {
                            cube.neighbours.left = this;
                            cube.buildGeometry();
                        }
                    }
                }
            }
            else if (cube.position.x == this.position.x && cube.position.z == this.position.z) {
                // bottom top
                if (cube.position.y == this.position.y - 1) {
                    this.neighbours.bottom = cube;
                    if (updateOthers) {
                        cube.neighbours.top = this;
                        cube.buildGeometry();
                    }
                }
                else if (cube.position.y == this.position.y + 1) {
                    this.neighbours.top = cube;
                    if (updateOthers) {
                        cube.neighbours.bottom = this;
                        cube.buildGeometry();
                    }
                }
            }
        }
    };
    return Cube;
}());
var Player = /** @class */ (function () {
    function Player(position) {
        this.velocityY = 0;
        this.position = position;
        var color = new THREE.Color(0xff8800);
        var geometry = new THREE.CylinderGeometry(1 / 2, 1 / 2, 2, 30, 1);
        var material = new THREE.MeshLambertMaterial({ color: color.getHex() });
        this.mesh = new THREE.Mesh(geometry, material);
        game.scene.add(this.mesh);
        this.spawn();
    }
    Player.prototype.spawn = function () {
        this.position.x = 4;
        this.position.y = 2;
        this.position.z = 4;
        this.velocityY = 0;
    };
    Player.prototype.step = function (deltaTime) {
        var facingDirection = game.camera.rotation.y;
        var walkSpeed = 0;
        var walkSideSpeed = 0;
        var fast = false;
        // Keyboard Input
        for (var i = game.keysDown.length - 1; i >= 0; --i) {
            switch (game.keysDown[i]) {
                case 87 /* W */:
                    if (walkSpeed == 0)
                        walkSpeed = 6 / 3.6;
                    break;
                case 83 /* S */:
                    if (walkSpeed == 0)
                        walkSpeed = -6 / 3.6;
                    break;
                case 65 /* A */:
                    if (walkSideSpeed == 0)
                        walkSideSpeed = -6 / 3.6;
                    break;
                case 68 /* D */:
                    if (walkSideSpeed == 0)
                        walkSideSpeed = 6 / 3.6;
                    break;
                case 32 /* SPACE */:
                    if (this.velocityY == 0)
                        this.velocityY = 9.81 / 2;
                    break;
                case 16 /* SHIFT */:
                    fast = true;
                    break;
            }
        }
        // Gravity
        this.velocityY += -9.81 * deltaTime;
        // Angle
        game.camera.rotation.order = 'YXZ';
        this.mesh.rotation.order = 'YXZ';
        this.mesh.rotation.y = facingDirection;
        // Adjust Speeds
        var walkingDirection = facingDirection;
        if (fast)
            walkSpeed *= 1.5;
        var speed = walkSpeed;
        if (speed == 0) {
            if (walkSideSpeed != 0) {
                walkingDirection -= Math.PI / 2;
                speed = walkSideSpeed;
            }
        }
        else if (speed > 0) {
            if (walkSideSpeed > 0)
                walkingDirection -= Math.PI / 4;
            if (walkSideSpeed < 0)
                walkingDirection += Math.PI / 4;
        }
        else if (speed < 0) {
            if (walkSideSpeed > 0)
                walkingDirection += Math.PI / 4;
            if (walkSideSpeed < 0)
                walkingDirection -= Math.PI / 4;
        }
        var radians = walkingDirection > 0 ? walkingDirection : (2 * Math.PI) + walkingDirection;
        // Wanted movement
        var deltaX = speed * Math.sin(-radians) * deltaTime;
        var deltaY = this.velocityY * deltaTime;
        var deltaZ = speed * -Math.cos(-radians) * deltaTime;
        if (this.position.y < -50) {
            // Respawn
            this.spawn();
        }
        else {
            // Collisions
            var collisionRadius = Math.sqrt(0.5 * 0.5 / 2);
            for (var _i = 0, _a = game.world.cubes; _i < _a.length; _i++) {
                var cube = _a[_i];
                // Ignore if not colliding
                if (!Collision.circle_rect(this.position.x + deltaX, this.position.z + deltaZ, collisionRadius, cube.position.x, cube.position.z, cube.position.x + 1, cube.position.z + 1))
                    continue;
                // Check side collisions
                if (this.position.y >= cube.position.y && this.position.y < cube.position.y + 1) {
                    // only collide if it wasn't allready colliding previously
                    if (!Collision.circle_rect(this.position.x, this.position.z, collisionRadius, cube.position.x, cube.position.z, cube.position.x + 1, cube.position.z + 1)) {
                        deltaX = 0;
                        deltaZ = 0;
                    }
                }
                // Check from top down
                if (this.position.y >= cube.position.y + 1 && this.position.y + deltaY < cube.position.y + 1) {
                    deltaY = (cube.position.y + 1) - this.position.y;
                    this.velocityY = 0;
                }
            }
            // Finally update position
            this.position.x += deltaX;
            this.position.y += deltaY;
            this.position.z += deltaZ;
        }
        // Update Object Position
        this.mesh.position.x = this.position.x;
        this.mesh.position.y = this.position.y + 1;
        this.mesh.position.z = this.position.z;
        // Update Camera
        var camX = 0; //0.5 * Math.sin(-radians)
        var camZ = 0; //0.5 * -Math.cos(-radians)
        game.camera.position.x = this.mesh.position.x;
        game.camera.position.y = this.mesh.position.y + 0.25;
        game.camera.position.z = this.mesh.position.z;
    };
    return Player;
}());
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
            var phi, theta;
            var speed = .3;
            this.lon += deltaX * speed;
            this.lat -= deltaY * speed;
            this.lat = Math.max(-85, Math.min(85, this.lat));
            phi = THREE.Math.degToRad(90 - this.lat);
            theta = THREE.Math.degToRad(this.lon);
            var lookAt = new THREE.Vector3(game.camera.position.x + Math.sin(phi) * Math.cos(theta), game.camera.position.y + Math.cos(phi), game.camera.position.z + Math.sin(phi) * Math.sin(theta));
            game.camera.lookAt(lookAt);
        };
        return Pointer;
    }());
    Input.Pointer = Pointer;
})(Input || (Input = {}));
var Collision;
(function (Collision) {
    function rect_rect(r1x1, r1y1, r1x2, r1y2, r2x1, r2y1, r2x2, r2y2) {
        return !(r1x1 >= r2x2 || r1x2 <= r2x1 || r1y1 >= r2y2 || r1y2 <= r2y1);
    }
    Collision.rect_rect = rect_rect;
    function circle_rect(cx, cy, cr, rx1, ry1, rx2, ry2) {
        if (((rx1 - cr < cx) && (rx2 + cr > cx) && (ry1 - cr < cy) && (ry2 + cr > cy))) {
            if (cy < ry1) {
                if (cx < rx1) {
                    return circle_point(cx, cy, cr, rx1, ry1);
                }
                else if (cx > rx2) {
                    return circle_point(cx, cy, cr, rx2, ry1);
                }
            }
            else if (cy > ry2) {
                if (cx < rx1) {
                    return circle_point(cx, cy, cr, rx1, ry2);
                }
                else if (cx > rx2) {
                    return circle_point(cx, cy, cr, rx2, ry2);
                }
            }
            return true;
        }
        return false;
    }
    Collision.circle_rect = circle_rect;
    function circle_point(cx, cy, cr, px, py) {
        var dx = cx - px;
        var dy = cy - py;
        return (dx * dx + dy * dy < cr * cr);
    }
    Collision.circle_point = circle_point;
})(Collision || (Collision = {}));
//# sourceMappingURL=app.js.map