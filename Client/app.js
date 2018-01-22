/// <reference path='types/three.d.ts' />
/// <reference path='../Cubes/Message.d.ts' />
var game;
window.onload = function () {
    game = new Game();
    new Info();
};
var Info = /** @class */ (function () {
    function Info() {
        var _this = this;
        var req = new XMLHttpRequest();
        req.open("GET", "changelog.json");
        req.onreadystatechange = function () {
            if (req.readyState == 4 && req.status == 200) {
                _this.changelog(JSON.parse(req.responseText));
            }
        };
        req.send();
    }
    Info.prototype.changelog = function (logs) {
        var oldVersion = localStorage.getItem("version");
        var oldKnownIssues = localStorage.getItem("knownIssues");
        var knownIssues = JSON.stringify(logs["known issues"]);
        var oldWorkInProgress = localStorage.getItem("workInProgress");
        var workInProgress = JSON.stringify(logs["work in progress"]);
        logs.versions.sort(function (a, b) { return a.version > b.version ? -1 : 1; });
        if (oldVersion == null || oldVersion < logs.versions[0].version
            || oldKnownIssues != knownIssues
            || oldWorkInProgress != workInProgress) {
            document.getElementById("info").style.display = "block";
            localStorage.setItem("version", logs.versions[0].version);
            localStorage.setItem("knownIssues", knownIssues);
            localStorage.setItem("workInProgress", workInProgress);
        }
        var elVersionLog = document.getElementById("versionlog");
        var putContentInto = elVersionLog;
        var elSpoilerContent = document.createElement("div");
        headList(oldKnownIssues != knownIssues ? elVersionLog : elSpoilerContent, "known issues", logs["known issues"]);
        headList(oldWorkInProgress != workInProgress ? elVersionLog : elSpoilerContent, "work in progress", logs["work in progress"]);
        for (var _i = 0, _a = logs.versions; _i < _a.length; _i++) {
            var version = _a[_i];
            // put content into spoler if it's not new
            if (oldVersion >= version.version) {
                putContentInto = elSpoilerContent;
            }
            headList(putContentInto, version.version, version.changes);
        }
        if (elSpoilerContent.childElementCount) {
            var spoiler_1 = elementFromHTML("<div style=\"cursor:pointer;color:lightblue\">Show more</div>");
            spoiler_1.onclick = function () { elSpoilerContent.style.display = "block"; spoiler_1.style.display = "none"; };
            elVersionLog.appendChild(spoiler_1);
            elSpoilerContent.style.display = "none";
            elVersionLog.appendChild(elSpoilerContent);
        }
        function headList(parent, title, list) {
            var elTitle = document.createElement("h3");
            elTitle.innerText = title;
            parent.appendChild(elTitle);
            var elList = document.createElement("ul");
            parent.appendChild(elList);
            for (var _i = 0, list_1 = list; _i < list_1.length; _i++) {
                var log = list_1[_i];
                var elItem = document.createElement("li");
                elItem.innerText = log;
                elList.appendChild(elItem);
            }
        }
    };
    return Info;
}());
var Chat = /** @class */ (function () {
    function Chat() {
        var _this = this;
        this.elC = document.getElementById("chat");
        this.elCL = document.getElementById("chatLog");
        this.elCI = document.getElementById("chatInput");
        this.elCS = document.getElementById("chatSend");
        this.elCS.onclick = function () { return _this.send(); };
        this.elCI.onblur = function () { return _this.show(); };
        window.addEventListener("keydown", function (e) {
            if (e.keyCode == 13 /* ENTER */) {
                if (_this.elCI !== document.activeElement) {
                    _this.show();
                    _this.elCI.focus();
                }
                else {
                    _this.send();
                    _this.elCI.blur();
                }
            }
        });
    }
    Chat.prototype.show = function () {
        var _this = this;
        this.elC.style.display = "block";
        clearTimeout(this.hideTimeout);
        this.hideTimeout = setTimeout(function () { return _this.hide(); }, 5000);
    };
    Chat.prototype.hide = function () {
        if (this.elCI == document.activeElement)
            return;
        this.elC.style.display = "none";
        this.elCI.blur();
    };
    Chat.prototype.send = function () {
        var txt = this.elCI.value.trim();
        this.elCI.value = "";
        this.onmessage(txt, true);
    };
    Chat.prototype.onmessage = function (text, self) {
        if (self === void 0) { self = false; }
        this.show();
        this.elCL.appendChild(elementFromHTML("<div" + (self ? " style=\"color:#ccc\"" : "") + ">" + text + "</div>"));
        if (self) {
            game.connection.sendMessage({
                type: 5 /* chat */,
                text: text
            });
        }
    };
    return Chat;
}());
var Game = /** @class */ (function () {
    function Game() {
        var _this = this;
        this.chat = new Chat();
        this.keyboard = new Input.Keyboard();
        this.raycaster = new THREE.Raycaster();
        this.options = {
            wireframe: false,
            antialias: false,
            fog: false,
            debugInfo: false,
            renderScale: 100,
        };
        this.mouseRightDown = false;
        this.traceOn = false;
        this.meshShowing = false;
        this.timeLastFrame = 0;
        this.fps = 0;
        this.stepPreviousTime = 0;
        var lsStringOptions = localStorage.getItem("options");
        if (lsStringOptions !== null) {
            var lsOptions = JSON.parse(lsStringOptions);
            this.options = lsOptions;
            this.updateOptionsGUI();
        }
        if (Input.PointerLock.isSupported == false)
            alert("Browser not supported!");
        game = this;
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0);
        if (this.options.fog)
            this.scene.fog = new THREE.Fog(0, 0, 25);
        // Camera
        this.camera = new THREE.PerspectiveCamera(90, 1, 0.1, 1000);
        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: this.options.antialias });
        document.body.appendChild(this.renderer.domElement);
        // Setup Lights
        var ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);
        var directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(1, 1.5, 0.5).normalize();
        this.scene.add(directionalLight);
        this.onResize();
        this.world = new World();
        this.world.init();
        // Events
        window.addEventListener("resize", function () { return _this.onResize(); });
        this.pointer = new Input.PointerLock(this.renderer.domElement);
        this.pointer.moveCamera(0, 0);
        window.addEventListener("mousedown", function (event) {
            _this.onclick(event);
        });
        window.addEventListener("mouseup", function (event) {
            _this.mouseup(event);
        });
        window.onbeforeunload = function () {
            return "Really want to quit the game?";
        };
        // Network
        this.connection = new Connection();
        // GUI
        document.body.appendChild(elementFromHTML("<div style=\"position:absolute; left:50%; top:50%; height:1px; width:1px; background:red;pointer-events:none\"></div>"));
        this.elDebugInfo = document.body.appendChild(elementFromHTML("<div style=\"position:absolute; left:0; top:0; width:200px; color: white; font-size:10pt;font-family: Consolas;pointer-events:none\"></div>"));
        this.elDebugInfo.style.display = this.options.debugInfo ? "block" : "none";
        var rollOverGeo = new THREE.BoxGeometry(1, 1, 1);
        var rollOverMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true });
        this.rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
        // Start rendering
        this.stepPreviousTime = Date.now();
        this.animate();
        //setInterval(() => this.step(), 1000 / 30)
    }
    Game.prototype.updateOptionsGUI = function () {
        ;
        document.getElementById("settings_aa").checked = this.options.antialias;
        document.getElementById("settings_debug").checked = this.options.debugInfo;
        document.getElementById("settings_fog").checked = this.options.fog;
        document.getElementById("settings_wireframe").checked = this.options.wireframe;
        document.getElementById("settings_renderScale").selectedIndex = [25, 50, 75, 100, 150, 200].indexOf(this.options.renderScale);
    };
    Game.prototype.updateOptions = function (reload) {
        if (reload === void 0) { reload = false; }
        this.options.antialias = document.getElementById("settings_aa").checked;
        this.options.debugInfo = document.getElementById("settings_debug").checked;
        this.options.fog = document.getElementById("settings_fog").checked;
        this.options.wireframe = document.getElementById("settings_wireframe").checked;
        this.options.renderScale = [25, 50, 75, 100, 150, 200][document.getElementById("settings_renderScale").selectedIndex];
        localStorage.setItem("options", JSON.stringify(this.options));
        // Debug Info
        this.elDebugInfo.style.display = this.options.debugInfo ? "block" : "none";
        // Wireframe
        game.world.createMashup();
        // Fog
        if (this.options.fog) {
            this.scene.fog = new THREE.Fog(0, 0, 25);
        }
        else {
            this.scene.fog = null;
        }
        // Render Scale
        this.renderer.setPixelRatio(this.options.renderScale / 100 * window.devicePixelRatio);
        if (reload)
            location.reload();
    };
    Game.prototype.onResize = function () {
        // Update render size
        this.renderer.setPixelRatio(this.options.renderScale / 100 * window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    };
    Game.prototype.mouseup = function (e) {
        if (e.button == 2)
            this.mouseRightDown = false;
    };
    Game.prototype.onclick = function (e) {
        // Put block
        if (this.pointer.locked) {
            if (e.button == 0) {
                var altKey = this.keyboard.keysDown["AltLeft"];
                var pos = this.getRayCubePos(altKey);
                if (pos != null) {
                    if (altKey == false) {
                        // Add Cube
                        var cube = new Cube({ x: pos.x, y: pos.y, z: pos.z });
                        this.world.cubes.push(cube);
                        cube.init(true);
                        this.world.createMashup();
                        this.connection.sendMessage({
                            type: 2 /* cubesAdd */,
                            cubes: [cube.position]
                        });
                        cube.mesh.position = pos.clone();
                    }
                    else {
                        // Remove Cube
                        for (var i = 0, max = this.world.cubes.length; i < max; ++i) {
                            if (this.world.cubes[i].position.x == pos.x &&
                                this.world.cubes[i].position.y == pos.y &&
                                this.world.cubes[i].position.z == pos.z) {
                                this.connection.sendMessage({
                                    type: 3 /* removeCubes */,
                                    cubes: [this.world.cubes[i].position]
                                });
                                this.world.cubes[i].remove();
                                this.world.cubes.splice(i, 1);
                                this.world.createMashup();
                                break;
                            }
                        }
                    }
                }
            }
            else if (e.button == 2) {
                this.mouseRightDown = true;
            }
        }
    };
    Game.prototype.getRayCubePos = function (alt) {
        this.raycaster.set(this.camera.position, this.camera.getWorldDirection());
        var intersects = this.raycaster.intersectObjects([this.world.mashup]);
        if (intersects.length == 0)
            return null;
        var intersect = intersects[0];
        if (alt) {
            var n = intersect.face.normal.clone();
            if (n.x > 0)
                n.x = -1;
            else
                n.x = 0;
            if (n.y > 0)
                n.y = -1;
            else
                n.y = 0;
            if (n.z > 0)
                n.z = -1;
            else
                n.z = 0;
            return intersect.point.clone().add(n).floor();
        }
        else {
            var n = intersect.face.normal.clone();
            if (n.x > 0)
                n.x = 0;
            if (n.y > 0)
                n.y = 0;
            if (n.z > 0)
                n.z = 0;
            return intersect.point.clone().add(n).floor();
        }
    };
    Game.prototype.animate = function () {
        var _this = this;
        if (document.hasFocus() || performance.now() - this.timeLastFrame > 1000 / 8) {
            var timeNow = performance.now();
            this.fps = this.fps / 10 * 9 + 1000 / (timeNow - this.timeLastFrame) / 10 * 1;
            this.timeLastFrame = timeNow;
            var t = this.camera.fov;
            this.camera.fov = this.world.player.fast ? 100 : 90;
            if (t != this.camera.fov)
                this.camera.updateProjectionMatrix();
            this.step();
            // Raycast poiting position
            if (this.pointer.locked) {
                var pos = this.getRayCubePos(this.keyboard.keysDown["AltLeft"]);
                if (pos == null) {
                    if (this.meshShowing) {
                        this.meshShowing = false;
                        this.scene.remove(this.rollOverMesh);
                    }
                }
                else {
                    this.rollOverMesh.position.copy(pos);
                    this.rollOverMesh.position.addScalar(0.5);
                    if (!this.meshShowing) {
                        this.scene.add(this.rollOverMesh);
                        this.meshShowing = true;
                    }
                }
            }
            else {
                this.meshShowing = false;
                this.scene.remove(this.rollOverMesh);
            }
            // Render Scene
            this.renderer.render(this.scene, this.camera);
        }
        // Ask to do it again next Frame
        requestAnimationFrame(function () { return _this.animate(); });
    };
    Game.prototype.step = function () {
        var stepTime = Date.now();
        var deltaTime = (stepTime - this.stepPreviousTime) / 1000;
        this.world.step(deltaTime);
        function f(n) {
            return (n >= 0 ? '+' : '') + n.toFixed(10);
        }
        // Update Log
        this.elDebugInfo.innerHTML =
            "FPS: " + this.fps.toFixed(0) + "<br/>" +
                ("Connection: " + this.connection.readyState() + " " + this.connection.handshake + "<br/>") +
                ("Players: " + (this.world.players.length + 1) + "<br/>") +
                ("Cubes: " + this.world.cubes.length + "<br/>") +
                ("Pointer: " + (this.pointer.locked ? "locked" : "not tracking") + "<br/>") +
                ("Position:<br>&nbsp;\nx " + f(this.world.player.position.x) + "<br>&nbsp;\ny " + f(this.world.player.position.y) + "<br>&nbsp;\nz " + f(this.world.player.position.z) + "<br/>") +
                ("Looking:<br>&nbsp;\nx " + f(this.camera.getWorldDirection().x) + "<br>&nbsp;\ny " + f(this.camera.getWorldDirection().y) + "<br>&nbsp;\nz " + f(this.camera.getWorldDirection().z) + "<br/>") +
                "";
        this.stepPreviousTime = stepTime;
    };
    return Game;
}());
var World = /** @class */ (function () {
    function World() {
        this.cubes = [];
        this.players = [];
        this.lowestPoint = Infinity;
        this.mashup = null;
    }
    World.prototype.init = function () {
        this.player = new Player({ x: 4, y: 2, z: 4 });
        for (var _i = 0, _a = this.cubes; _i < _a.length; _i++) {
            var cube = _a[_i];
            cube.init();
        }
    };
    World.prototype.step = function (deltaTime) {
        this.player.step(deltaTime);
        for (var _i = 0, _a = this.players; _i < _a.length; _i++) {
            var player = _a[_i];
            player.step(deltaTime);
        }
    };
    World.prototype.createMashup = function () {
        console.time("mergeCubesTotal");
        var geom = new THREE.Geometry();
        for (var _i = 0, _a = this.cubes; _i < _a.length; _i++) {
            var cube = _a[_i];
            geom.merge(cube.mesh.geometry, cube.mesh.matrix);
        }
        // Reduce CPU->GPU load
        geom.mergeVertices();
        if (this.mashup)
            game.scene.remove(this.mashup);
        this.mashup = new THREE.Mesh(new THREE.BufferGeometry().fromGeometry(geom), new THREE.MeshLambertMaterial({ color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors }));
        game.scene.add(this.mashup);
        console.timeEnd("mergeCubesTotal");
    };
    return World;
}());
var SpriteObject = /** @class */ (function () {
    function SpriteObject(pos) {
        var spriteMaterial = new THREE.SpriteMaterial({ /*map: spriteMap,*/ color: 0xffffff });
        var sprite = new THREE.Sprite(spriteMaterial);
        this.position = new THREE.Vector3(pos.x, pos.y, pos.z);
        sprite.position.copy(this.position);
        this.velocity = new THREE.Vector3();
        sprite.scale.set(.1, .1, .1);
        game.scene.add(sprite);
    }
    return SpriteObject;
}());
var Cube = /** @class */ (function () {
    function Cube(position) {
        this.position = position;
        if (this.position.y < game.world.lowestPoint)
            game.world.lowestPoint = this.position.y;
    }
    Cube.prototype.init = function (updateNeighbours) {
        if (updateNeighbours === void 0) { updateNeighbours = false; }
        var c = Math.random();
        this.color = new THREE.Color(c, c, c);
        this.checkNeighbours(updateNeighbours);
        this.buildGeometry();
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
        var c1 = new THREE.Color().setRGB(Math.random(), Math.random(), Math.random());
        var c0 = c1.clone().multiplyScalar(0.5);
        var c2 = c1.clone().multiplyScalar(0.8);
        var c3 = c1.clone().multiplyScalar(0.9);
        // Faces
        if (this.neighbours.bottom == null) {
            geom.faces.push(new THREE.Face3(vbfl, vbbr, vbbl, new THREE.Vector3(0, -1, 0), c0));
            geom.faces.push(new THREE.Face3(vbbr, vbfl, vbfr, new THREE.Vector3(0, -1, 0), c0));
        }
        if (this.neighbours.top == null) {
            geom.faces.push(new THREE.Face3(vtbl, vtbr, vtfl, new THREE.Vector3(0, +1, 0), c1));
            geom.faces.push(new THREE.Face3(vtfr, vtfl, vtbr, new THREE.Vector3(0, +1, 0), c1));
        }
        if (this.neighbours.left == null) {
            geom.faces.push(new THREE.Face3(vbbl, vtbl, vbfl, new THREE.Vector3(0, 0, -1), c2));
            geom.faces.push(new THREE.Face3(vtfl, vbfl, vtbl, new THREE.Vector3(0, 0, -1), c2));
        }
        if (this.neighbours.right == null) {
            geom.faces.push(new THREE.Face3(vbfr, vtbr, vbbr, new THREE.Vector3(0, 0, +1), c2));
            geom.faces.push(new THREE.Face3(vtbr, vbfr, vtfr, new THREE.Vector3(0, 0, +1), c2));
        }
        if (this.neighbours.back == null) {
            geom.faces.push(new THREE.Face3(vbbl, vbbr, vtbl, new THREE.Vector3(-1, 0, 0), c3));
            geom.faces.push(new THREE.Face3(vtbr, vtbl, vbbr, new THREE.Vector3(-1, 0, 0), c3));
        }
        if (this.neighbours.front == null) {
            geom.faces.push(new THREE.Face3(vtfl, vbfr, vbfl, new THREE.Vector3(+1, 0, 0), c3));
            geom.faces.push(new THREE.Face3(vbfr, vtfl, vtfr, new THREE.Vector3(+1, 0, 0), c3));
        }
        this.mesh = new THREE.Mesh(geom, new THREE.MeshLambertMaterial({ color: /*0xffffff || */ this.color.getHex(), wireframe: false }));
        this.mesh.position.x = this.position.x;
        this.mesh.position.y = this.position.y;
        this.mesh.position.z = this.position.z;
        this.mesh.updateMatrix();
    };
    Cube.prototype.remove = function () {
        if (this.neighbours.back) {
            this.neighbours.back.neighbours.front = null;
            this.neighbours.back.buildGeometry();
        }
        if (this.neighbours.bottom) {
            this.neighbours.bottom.neighbours.top = null;
            this.neighbours.bottom.buildGeometry();
        }
        if (this.neighbours.front) {
            this.neighbours.front.neighbours.back = null;
            this.neighbours.front.buildGeometry();
        }
        if (this.neighbours.left) {
            this.neighbours.left.neighbours.right = null;
            this.neighbours.left.buildGeometry();
        }
        if (this.neighbours.right) {
            this.neighbours.right.neighbours.left = null;
            this.neighbours.right.buildGeometry();
        }
        if (this.neighbours.top) {
            this.neighbours.top.neighbours.bottom = null;
            this.neighbours.top.buildGeometry();
        }
        if (this.position.y == game.world.lowestPoint) {
            game.world.lowestPoint = Infinity;
            for (var _i = 0, _a = game.world.cubes; _i < _a.length; _i++) {
                var cube = _a[_i];
                if (cube.position.y < game.world.lowestPoint)
                    game.world.lowestPoint = cube.position.y;
            }
        }
    };
    Cube.prototype.checkNeighbours = function (updateOthers) {
        if (updateOthers === void 0) { updateOthers = false; }
        this.neighbours = {
            top: null, bottom: null,
            front: null, back: null,
            left: null, right: null,
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
var Connection = /** @class */ (function () {
    function Connection() {
        this.wasConnected = false;
        this.connectedSinceAttempt = false;
        this.handshake = false;
        this.timeConnectAttempt = 0;
        this.timeOutReconnect = 0;
        this.start();
    }
    Connection.prototype.start = function () {
        var _this = this;
        this.handshake = false;
        this.timeConnectAttempt = Date.now();
        this.ws = new WebSocket((location.protocol == "https:" ? "wss" : "ws") + "://" + location.host + location.pathname);
        this.ws.onopen = function () {
            game.chat.onmessage("connected to server");
            var message1 = {
                type: 0 /* handshake */
            };
            _this.ws.send(JSON.stringify(message1));
            if (_this.wasConnected == false) {
                var message2 = {
                    type: 1 /* getCubes */
                };
                _this.ws.send(JSON.stringify(message2));
                _this.wasConnected = true;
            }
            _this.connectedSinceAttempt = true;
        };
        this.ws.onmessage = function (ev) {
            var message = JSON.parse(ev.data);
            switch (message.type) {
                case 0 /* handshake */:
                    game.world.player.id = message.player.id;
                    _this.handshake = true;
                    break;
                case 5 /* chat */:
                    game.chat.onmessage(message.text);
                    break;
                case 2 /* cubesAdd */:
                    for (var _i = 0, _a = message.cubes; _i < _a.length; _i++) {
                        var cubePosition = _a[_i];
                        var cube = new Cube(cubePosition);
                        game.world.cubes.push(cube);
                        cube.init(true);
                    }
                    game.world.createMashup();
                    break;
                case 3 /* removeCubes */:
                    for (var _b = 0, _c = message.cubes; _b < _c.length; _b++) {
                        var cubePosition = _c[_b];
                        for (var i = 0, max = game.world.cubes.length; i < max; ++i) {
                            if (game.world.cubes[i].position.x == cubePosition.x &&
                                game.world.cubes[i].position.y == cubePosition.y &&
                                game.world.cubes[i].position.z == cubePosition.z) {
                                game.world.cubes[i].remove();
                                game.world.cubes.splice(i, 1);
                                break;
                            }
                        }
                    }
                    game.world.createMashup();
                    break;
                case 4 /* playerUpdate */:
                    if (game.world.players === undefined)
                        break;
                    if (message.player.position == null) {
                        // remove player
                        for (var i = 0; i < game.world.players.length; ++i) {
                            if (game.world.players[i].id == message.player.id) {
                                game.world.players[i].remove();
                                game.world.players.splice(i, 1);
                                game.chat.onmessage("player left");
                                break;
                            }
                        }
                    }
                    else {
                        var found = null;
                        for (var _d = 0, _e = game.world.players; _d < _e.length; _d++) {
                            var player = _e[_d];
                            if (player.id == message.player.id) {
                                found = player;
                                break;
                            }
                        }
                        if (found == null) {
                            // add player
                            game.chat.onmessage("player joined");
                            found = new Player(message.player.position);
                            found.id = message.player.id;
                            game.world.players.push(found);
                        }
                        else {
                            found.position = message.player.position;
                            found.updateMeshPosition();
                        }
                    }
                    break;
            }
        };
        this.ws.onerror = function () { };
        this.ws.onclose = function (ev) {
            if (_this.connectedSinceAttempt)
                game.chat.onmessage("disconnected from server");
            _this.reconnect();
            _this.connectedSinceAttempt = false;
        };
    };
    Connection.prototype.reconnect = function () {
        var _this = this;
        if (Date.now() - this.timeConnectAttempt > 5 * 1000) {
            this.start();
        }
        else {
            this.timeOutReconnect = setTimeout(function () { return _this.start(); }, 1000);
        }
    };
    Connection.prototype.readyState = function () {
        return this.ws.readyState;
    };
    Connection.prototype.sendMessage = function (msg) {
        if (this.ws.readyState != 1 || this.handshake == false)
            return;
        this.ws.send(JSON.stringify(msg));
    };
    return Connection;
}());
function elementFromHTML(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    var el = div.firstElementChild;
    div.removeChild(el);
    return el;
}
var Input;
(function (Input) {
    var Keyboard = /** @class */ (function () {
        function Keyboard() {
            var _this = this;
            this.keysDown = {};
            this.keyOrder = 0;
            window.addEventListener("keydown", function (e) { return _this.keydown(e); });
            window.addEventListener("keyup", function (e) { return _this.keyup(e); });
            window.addEventListener("blur", function () { return _this.blur(); });
        }
        Keyboard.prototype.keydown = function (e) {
            if (document.getElementById("chatInput") !== document.activeElement && e.code !== "Enter") {
                this.keysDown[e.code] = ++this.keyOrder; // overflow after 285M years at 1 hit per seconds
                e.preventDefault();
                if (e.keyCode == 84 /* T */)
                    game.traceOn = !game.traceOn;
                if (e.keyCode == 80 /* P */) {
                    var alt = this.keysDown["AltLeft"] != 0;
                    var pos = game.getRayCubePos(alt);
                    if (pos != null) {
                        pos.x += 0.5;
                        if (alt)
                            pos.y += 1;
                        pos.z += 0.5;
                        game.world.player.teleport(pos);
                    }
                }
            }
            return false;
        };
        Keyboard.prototype.blur = function () {
            // Since any key release will not be registered when the window is out of focus,
            // assume they are released when the window is getting out of focus
            for (var key in this.keysDown) {
                this.keysDown[key] = 0;
            }
        };
        Keyboard.prototype.keyup = function (e) {
            // Key might have been down without this window beeing in focus, 
            // so ignore if it goes without going down while in focus
            this.keysDown[e.code] = 0;
        };
        return Keyboard;
    }());
    Input.Keyboard = Keyboard;
    var PointerLock = /** @class */ (function () {
        function PointerLock(el) {
            var _this = this;
            this.el = el;
            this.locked = false;
            this.lat = 0;
            this.lon = 0;
            this.el.addEventListener("mousedown", this.el.requestPointerLock);
            document.addEventListener('pointerlockchange', function () { return _this.pointerlockchange(); }, false);
            this.callback = function (e) { return _this.mousemove(e); };
        }
        Object.defineProperty(PointerLock, "isSupported", {
            get: function () {
                return 'pointerLockElement' in document;
            },
            enumerable: true,
            configurable: true
        });
        PointerLock.prototype.pointerlockchange = function () {
            if (document.pointerLockElement === this.el && this.locked == false) {
                this.locked = true;
                document.addEventListener("mousemove", this.callback, false);
            }
            else if (document.pointerLockElement !== this.el && this.locked == true) {
                this.locked = false;
                document.removeEventListener("mousemove", this.callback, false);
            }
        };
        PointerLock.prototype.mousemove = function (e) {
            // https://bugs.chromium.org/p/chromium/issues/detail?id=781182
            if (Math.abs(e.movementX) > 200 || Math.abs(e.movementY) > 200)
                return;
            this.moveCamera(e.movementX, e.movementY);
        };
        PointerLock.prototype.moveCamera = function (deltaX, deltaY) {
            var speed = .2;
            this.lon += deltaX * speed;
            this.lat -= deltaY * speed;
            this.lat = Math.max(-89.99999, Math.min(89.99999, this.lat));
            var phi = THREE.Math.degToRad(90 - this.lat);
            var theta = THREE.Math.degToRad(this.lon);
            game.camera.lookAt(new THREE.Vector3(game.camera.position.x + Math.sin(phi) * Math.cos(theta), game.camera.position.y + Math.cos(phi), game.camera.position.z + Math.sin(phi) * Math.sin(theta)));
        };
        return PointerLock;
    }());
    Input.PointerLock = PointerLock;
})(Input || (Input = {}));
/**
 * Check if localStorage is supported                       const isSupported: boolean
 * Check if localStorage has an Item                        function hasItem(key: string): boolean
 * Get the amount of space left in localStorage             function getRemainingSpace(): number
 * Get the maximum amount of space in localStorage          function getMaximumSpace(): number
 * Get the used space in localStorage                       function getUsedSpace(): number
 * Get the used space of an item in localStorage            function getItemUsedSpace(): number
 * Backup Assosiative Array                                 interface Backup
 * Get a Backup of localStorage                             function getBackup(): Backup
 * Apply a Backup to localStorage                           function applyBackup(backup: Backup, fClear: boolean = true, fOverwriteExisting: boolean = true)
 * Dump all information of localStorage in the console      function consoleInfo(fShowMaximumSize: boolean = false)
 */
var LocalStorage;
(function (LocalStorage) {
    /**
     * Flag set true if the Browser supports localStorage, widthout affecting it
     */
    LocalStorage.isSupported = (function () {
        try {
            var itemBackup = localStorage.getItem("");
            localStorage.removeItem("");
            localStorage.setItem("", itemBackup);
            if (itemBackup === null)
                localStorage.removeItem("");
            else
                localStorage.setItem("", itemBackup);
            return true;
        }
        catch (e) {
            return false;
        }
    })();
    /**
     * Check if localStorage has an Item / exists with the give key
     * @param key the key of the Item
     */
    function hasItem(key) {
        return localStorage.getItem(key) !== null;
    }
    LocalStorage.hasItem = hasItem;
    /**
     * This will return the left space in localStorage without affecting it's content
     * Might be slow !!!
     */
    function getRemainingSpace() {
        var itemBackup = localStorage.getItem("");
        var increase = true;
        var data = "1";
        var totalData = "";
        var trytotalData = "";
        while (true) {
            try {
                trytotalData = totalData + data;
                localStorage.setItem("", trytotalData);
                totalData = trytotalData;
                if (increase)
                    data += data;
            }
            catch (e) {
                if (data.length < 2) {
                    break;
                }
                increase = false;
                data = data.substr(data.length / 2);
            }
        }
        if (itemBackup === null)
            localStorage.removeItem("");
        else
            localStorage.setItem("", itemBackup);
        return totalData.length;
    }
    LocalStorage.getRemainingSpace = getRemainingSpace;
    /**
     * This function returns the maximum size of localStorage without affecting it's content
     * Might be slow !!!
     */
    function getMaximumSpace() {
        var backup = getBackup();
        localStorage.clear();
        var max = getRemainingSpace();
        applyBackup(backup);
        return max;
    }
    LocalStorage.getMaximumSpace = getMaximumSpace;
    /**
     * This will return the currently used size of localStorage
     */
    function getUsedSpace() {
        var sum = 0;
        for (var i = 0; i < localStorage.length; ++i) {
            var key = localStorage.key(i);
            var value = localStorage.getItem(key);
            sum += key.length + value.length;
        }
        return sum;
    }
    LocalStorage.getUsedSpace = getUsedSpace;
    /**
     * This will return the currently used size of a given Item, returns NaN if key is not found
     * @param key
     */
    function getItemUsedSpace(key) {
        var value = localStorage.getItem(key);
        if (value === null) {
            return NaN;
        }
        else {
            return key.length + value.length;
        }
    }
    LocalStorage.getItemUsedSpace = getItemUsedSpace;
    /**
     * This will return a localStorage-backup (Associative-Array key->value)
     */
    function getBackup() {
        var backup = {};
        for (var i = 0; i < localStorage.length; ++i) {
            var key = localStorage.key(i);
            var value = localStorage.getItem(key);
            backup[key] = value;
        }
        return backup;
    }
    LocalStorage.getBackup = getBackup;
    /**
     * This will apply a localStorage-Backup (Associative-Array key->value)
     * @param backup            associative-array
     * @param fClear             optional flag to clear all existing storage first. Default: true
     * @param fOverwriteExisting optional flag to replace existing keys. Default: true
     */
    function applyBackup(backup, fClear, fOverwriteExisting) {
        if (fClear === void 0) { fClear = true; }
        if (fOverwriteExisting === void 0) { fOverwriteExisting = true; }
        if (fClear == true) {
            localStorage.clear();
        }
        for (var key in backup) {
            if (fOverwriteExisting === false && backup[key] !== undefined) {
                continue;
            }
            var value = backup[key];
            localStorage.setItem(key, value);
        }
    }
    LocalStorage.applyBackup = applyBackup;
    /**
     * This functions dumps all keys and values of the local Storage to the console,
     * as well as the current size and number of items
     * @param fShowMaximumSize optional, flag show maximum size of localStorage. Default: false
     */
    function consoleInfo(fShowMaximumSize) {
        if (fShowMaximumSize === void 0) { fShowMaximumSize = false; }
        var amount = 0;
        var size = 0;
        for (var i = 0; i < localStorage.length; ++i) {
            var key = localStorage.key(i);
            var value = localStorage.getItem(key);
            console.log(amount, key, value);
            size += key.length + value.length;
            amount++;
        }
        console.log("Total entries:", amount);
        console.log("Total size:", size);
        if (fShowMaximumSize === true) {
            var maxSize = getMaximumSpace();
            console.log("Total size:", maxSize);
        }
    }
    LocalStorage.consoleInfo = consoleInfo;
})(LocalStorage || (LocalStorage = {}));
/*
    // Example

    console.log("LocalStorage supported:", LocalStorage.isSupported)// true - I hope so anyways 😉
    localStorage.setItem("asd", "ASDASD")                           // sets / overwrites the item "asd"
    localStorage.setItem("asd" + Math.random(), "ASDASD")           // set another item each time you refresh the page
    var backup = LocalStorage.getBackup()                           // creates a backup, we will need it later!
    console.log(JSON.stringify(backup))                             // this is how the backup looks like
    var usedSpace = LocalStorage.getUsedSpace()                     // amount of space used right now
    console.log("Used Space:", usedSpace)
    var maxSpace = LocalStorage.getMaximumSpace()                   // amount of maximum space aviable
    console.log("Maximum Space:", maxSpace)
    var remSpace = LocalStorage.getRemainingSpace()                 // amount of remaining space
    console.log("Remaining Space:", remSpace)
    console.log("SpaceCheck", maxSpace === usedSpace + remSpace)    // true
    console.log("hasItem", LocalStorage.hasItem("nothis0ne"))       // we don't have this one in our localStorage
    localStorage.clear()                                            // oops, we deleted the localStorage!
    console.log("has asd",LocalStorage.hasItem("asd"))              // item asd is lost 😒
    LocalStorage.applyBackup(backup)                                // but we have a backup, restore it!
    LocalStorage.consoleInfo()                                      // show all the info we have, see the backup worked 😊

*/ 
var Player = /** @class */ (function () {
    function Player(position) {
        this.fast = false;
        this.velocityY = 0;
        this.prevPosition = { x: 0, y: 0, z: 0 };
        this.position = position;
        var color = new THREE.Color(0xff8800);
        var geometry = new THREE.CylinderGeometry(1 / 2, 1 / 2, 2, 30, 1);
        var material = new THREE.MeshLambertMaterial({ color: color.getHex() });
        this.mesh = new THREE.Mesh(geometry, material);
        game.scene.add(this.mesh);
        this.spawn();
    }
    Player.prototype.updateMeshPosition = function () {
        // Update Object Position
        this.mesh.position.x = this.position.x;
        this.mesh.position.y = this.position.y + 1;
        this.mesh.position.z = this.position.z;
    };
    Player.prototype.spawn = function () {
        //if (this != game.world.player) return
        this.position.x = 4;
        this.position.y = 15;
        this.position.z = 4;
        this.velocityY = 0;
    };
    Player.prototype.remove = function () {
        game.scene.remove(this.mesh);
    };
    Player.prototype.teleport = function (position) {
        this.position.x = position.x;
        this.position.y = position.y;
        this.position.z = position.z;
        this.velocityY = 0;
        this.updateMeshPosition();
        // Update Camera
        game.camera.position.x = this.mesh.position.x;
        game.camera.position.y = this.mesh.position.y + 0.25;
        game.camera.position.z = this.mesh.position.z;
        if (this.prevPosition.x != this.position.x
            || this.prevPosition.y != this.position.y
            || this.prevPosition.z != this.position.z) {
            game.connection.sendMessage({
                type: 4 /* playerUpdate */,
                player: {
                    id: this.id,
                    position: this.position
                }
            });
            if (game.traceOn)
                new SpriteObject(this.position);
            this.prevPosition.x = this.position.x;
            this.prevPosition.y = this.position.y;
            this.prevPosition.z = this.position.z;
        }
    };
    Player.prototype.step = function (deltaTime) {
        if (this == game.world.player) {
            console.time("playerStep");
            var facingDirection = game.camera.rotation.y;
            var walkSpeed = 0;
            var walkSideSpeed = 0;
            this.fast = false;
            // Keyboard Input
            if (game.keyboard.keysDown["KeyW"] > 0 || game.keyboard.keysDown["KeyS"] > 0) {
                walkSpeed = 6 / 3.6 * (game.keyboard.keysDown["KeyW"] < game.keyboard.keysDown["KeyS"] ? -1 : 1);
            }
            if (game.keyboard.keysDown["KeyA"] > 0 || game.keyboard.keysDown["KeyD"] > 0) {
                walkSideSpeed = 6 / 3.6 * (game.keyboard.keysDown["KeyD"] < game.keyboard.keysDown["KeyA"] ? -1 : 1);
            }
            if (game.keyboard.keysDown["Space"] > 0) {
                if (this.velocityY == 0)
                    this.velocityY = 9.81 / 2;
            }
            if (game.keyboard.keysDown["ShiftLeft"] > 0) {
                this.fast = true;
            }
            // Gravity
            this.velocityY += -9.81 * deltaTime;
            // Angle
            game.camera.rotation.order = 'YXZ';
            this.mesh.rotation.order = 'YXZ';
            this.mesh.rotation.y = facingDirection;
            // Adjust Speeds
            var walkingDirection = facingDirection;
            if (this.fast)
                walkSpeed *= 2;
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
            if (this.position.y < game.world.lowestPoint - 20) {
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
                    var a = cube.position.y + 1 > this.position.y;
                    var b = cube.position.y < this.position.y + 2;
                    if (a && b) {
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
            this.updateMeshPosition();
            // Update Camera
            game.camera.position.x = this.mesh.position.x;
            game.camera.position.y = this.mesh.position.y + 0.25;
            game.camera.position.z = this.mesh.position.z;
            //console.timeEnd("playerStep")
        }
        if (this.prevPosition.x != this.position.x
            || this.prevPosition.y != this.position.y
            || this.prevPosition.z != this.position.z) {
            game.connection.sendMessage({
                type: 4 /* playerUpdate */,
                player: {
                    id: this.id,
                    position: this.position
                }
            });
            if (game.traceOn)
                new SpriteObject(this.position);
            this.prevPosition.x = this.position.x;
            this.prevPosition.y = this.position.y;
            this.prevPosition.z = this.position.z;
        }
    };
    return Player;
}());
