var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
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
            var playerId = localStorage.getItem("playerId");
            if (playerId != null)
                message1.player = { id: playerId };
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
                    document.getElementById("playerId").value = game.world.player.id;
                    localStorage.setItem("playerId", game.world.player.id);
                    if (message.player.position) {
                        game.world.player.position = message.player.position;
                    }
                    if (message.player.orientation) {
                        game.world.player.orientation = message.player.orientation;
                    }
                    if (message.player.inventory) {
                        game.world.player.inventory = message.player.inventory;
                    }
                    game.world.player.updatePosition();
                    game.camera.rotation.order = 'YXZ';
                    game.camera.rotation.x = game.world.player.orientation.x;
                    game.camera.rotation.y = game.world.player.orientation.y;
                    game.camera.rotation.z = game.world.player.orientation.z;
                    game.pointer.updateLonLat();
                    _this.handshake = true;
                    break;
                case 5 /* chat */:
                    game.chat.onmessage(message.text);
                    break;
                case 2 /* cubesAdd */:
                    var newCubes = [];
                    for (var _i = 0, _a = message.cubes; _i < _a.length; _i++) {
                        var cubeData = _a[_i];
                        var cube = new Cube(cubeData);
                        newCubes.push(cube);
                        game.world.cubes.push(cube);
                    }
                    for (var _b = 0, newCubes_1 = newCubes; _b < newCubes_1.length; _b++) {
                        var cube = newCubes_1[_b];
                        cube.init(true);
                    }
                    game.world.superCluster.addCubes(newCubes);
                    //game.world.createMashup()
                    break;
                case 3 /* removeCubes */:
                    for (var _c = 0, _d = message.cubes; _c < _d.length; _c++) {
                        var cubeData = _d[_c];
                        for (var i = 0, max = game.world.cubes.length; i < max; ++i) {
                            if (game.world.cubes[i].position.x == cubeData.position.x &&
                                game.world.cubes[i].position.y == cubeData.position.y &&
                                game.world.cubes[i].position.z == cubeData.position.z) {
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
                        for (var _e = 0, _f = game.world.players; _e < _f.length; _e++) {
                            var player = _f[_e];
                            if (player.id == message.player.id) {
                                found = player;
                                break;
                            }
                        }
                        if (found == null) {
                            // add player
                            game.chat.onmessage("player joined");
                            found = new Player(message.player.position, false);
                            found.id = message.player.id;
                            game.world.players.push(found);
                        }
                        else {
                            found.position = message.player.position;
                            found.updatePosition();
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
        document.getElementById("version").innerText = "Version " + logs.versions[0].version + (workInProgress.length > 0 ? " work in progress" : "");
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
            var spoiler_1 = elementFromHTML("<div style=\"cursor:pointer;color:lightblue\">Show Updatelog</div>");
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
var FPS = /** @class */ (function () {
    function FPS() {
        this.fps = 0;
        this.timeLastFrame = 0;
    }
    FPS.prototype.addFrame = function () {
        var timeNow = performance.now();
        this.fps = this.fps / 10 * 9 + 1000 / (timeNow - this.timeLastFrame) / 10 * 1;
        this.timeLastFrame = timeNow;
    };
    return FPS;
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
    Chat.prototype.getCurrentInput = function () {
        var text = this.elCI.value.trim();
        this.elCI.value = "";
        return text;
    };
    Chat.prototype.send = function () {
        var txt = this.getCurrentInput();
        if (txt == "")
            return;
        this.onmessage(txt, true);
    };
    Chat.prototype.onmessage = function (text, self) {
        if (self === void 0) { self = false; }
        this.show();
        // append messages
        this.elCL.appendChild(elementFromHTML("<div" + (self ? " style=\"color:#ccc\"" : "") + ">[" + new Date().toLocaleTimeString() + "] " + text + "</div>"));
        // scroll down
        this.elCL.scrollTop = this.elCL.scrollHeight;
        if (self) {
            game.connection.sendMessage({
                type: 5 /* chat */,
                text: text
            });
        }
    };
    return Chat;
}());
var GUI = /** @class */ (function () {
    function GUI() {
        var _this = this;
        this.layer = 0 /* none */;
        this.selectActionsText = [
            "Stone",
            "Mono",
            "Glas",
            "Remove Block",
            "Pick Color",
            "Teleport",
        ];
        this.selectBlockElement = [];
        this.selectedBlockIndex = 0;
        this.selectedColor = null;
        this.elMenu = document.getElementById("menu");
        // Pointer
        this.elPointer = elementFromHTML("<div style=\"position:absolute; left:50%; top:50%; height:2px; width:2px; background:red; pointer-events:none\"></div>");
        document.body.appendChild(this.elPointer);
        game.pointer.onchange.register(function (locked) {
            if (locked == false && _this.layer == 2 /* ingame */)
                _this.setLayer(1 /* menu */);
        });
        // Debug Info
        this.elDebugInfo = document.body.appendChild(elementFromHTML("<div style=\"position:absolute; left:0; top:0; width:200px; color: white; font-size:10pt;font-family: Consolas;pointer-events:none\"></div>"));
        this.elDebugInfo.style.display = game.options.debugInfo ? "block" : "none";
        // Selector
        var el = document.getElementById("guiBlocks");
        for (var i = 0, max = this.selectActionsText.length; i < max; ++i) {
            var el2 = document.createElement("div");
            el2.textContent = this.selectActionsText[i].toString();
            el.appendChild(el2);
            this.selectBlockElement[i] = el2;
        }
        this.setAction(0);
        this.setColor(null);
        // Options
        this.updateOptionsGUI();
        this.setLayer(1 /* menu */);
        document.getElementById("continue").onclick = function () {
            _this.setLayer(2 /* ingame */);
            game.pointer.el.requestPointerLock();
        };
        // Input
        var lastWheeley = 0;
        window.addEventListener("wheel", function (event) {
            if (event.timeStamp - lastWheeley > 50) {
                _this.mousewheel(event);
                lastWheeley = event.timeStamp;
            }
        });
        var _loop_1 = function (i) {
            game.keyboard.key(i.toString()).signals.down.register(function (key) {
                if (_this.layer != 2 /* ingame */)
                    return;
                _this.setAction(i - 1);
            });
        };
        for (var i = 1; i <= 9; ++i) {
            _loop_1(i);
        }
        game.keyboard.key("0").signals.down.register(function (key) {
            if (_this.layer != 2 /* ingame */)
                return;
            _this.setAction(10 - 1);
        });
        game.keyboard.key("escape").signals.down.register(function () {
            //if (this.layer == GUI_LAYER.menu) this.setLayer(GUI_LAYER.ingame)
            //else if (this.layer == GUI_LAYER.ingame) this.setLayer(GUI_LAYER.menu)
        });
    }
    GUI.prototype.setLayer = function (layer) {
        switch (this.layer) {
            case 2 /* ingame */:
                {
                    switch (layer) {
                        case 1 /* menu */:
                            {
                                // show menu
                                this.elMenu.style.display = "block";
                                this.elPointer.style.display = "none";
                                this.layer = layer;
                            }
                            break;
                    }
                }
                break;
            case 1 /* menu */:
                {
                    switch (layer) {
                        case 2 /* ingame */:
                            {
                                // hide menu
                                this.elMenu.style.display = "none";
                                this.elPointer.style.display = "block";
                                this.layer = layer;
                            }
                            break;
                    }
                }
                break;
            case 0 /* none */:
                {
                    switch (layer) {
                        case 1 /* menu */:
                            {
                                // show menu
                                this.elMenu.style.display = "block";
                                this.elPointer.style.display = "none";
                                this.layer = layer;
                            }
                            break;
                    }
                }
                break;
        }
    };
    GUI.prototype.updateOptionsGUI = function () {
        document.getElementById("settings_aa").checked = game.options.antialias;
        document.getElementById("settings_debug").checked = game.options.debugInfo;
        document.getElementById("settings_fog").checked = game.options.fog;
        document.getElementById("settings_wireframe").checked = game.options.wireframe;
        document.getElementById("settings_renderScale").selectedIndex = [25, 50, 75, 100, 150, 200].indexOf(game.options.renderScale);
    };
    GUI.prototype.updateOptions = function (reload) {
        if (reload === void 0) { reload = false; }
        game.options.antialias = document.getElementById("settings_aa").checked;
        game.options.debugInfo = document.getElementById("settings_debug").checked;
        game.options.fog = document.getElementById("settings_fog").checked;
        game.options.wireframe = document.getElementById("settings_wireframe").checked;
        game.options.renderScale = [25, 50, 75, 100, 150, 200][document.getElementById("settings_renderScale").selectedIndex];
        localStorage.setItem("options", JSON.stringify(game.options));
        // Debug Info
        this.elDebugInfo.style.display = game.options.debugInfo ? "block" : "none";
        // Wireframe
        game.world.superCluster.showWireGeom(game.options.debugInfo);
        game.world.createMashup();
        // Fog
        if (game.options.fog) {
            game.scene.fog = game.fog;
        }
        else {
            game.scene.fog = null;
        }
        // Render Scale
        game.renderer.setPixelRatio(game.options.renderScale / 100 * window.devicePixelRatio);
        if (reload)
            location.reload();
    };
    GUI.prototype.mousewheel = function (e) {
        if (this.layer != 2 /* ingame */)
            return;
        if (e.deltaY > 0) { // down
            this.selectNextAction(false);
        }
        else if (e.deltaY < 0) { // up
            this.selectNextAction(true);
        }
    };
    GUI.prototype.setAction = function (i) {
        if (!(i >= 0 && i < this.selectBlockElement.length))
            return;
        this.selectBlockElement[this.selectedBlockIndex].textContent = this.selectActionsText[this.selectedBlockIndex].toString();
        this.selectedBlockIndex = i;
        this.selectBlockElement[this.selectedBlockIndex].textContent = this.selectActionsText[this.selectedBlockIndex].toString() + " <";
    };
    GUI.prototype.selectNextAction = function (directionUp) {
        var i;
        if (directionUp) {
            i = this.selectedBlockIndex - 1;
            if (i < 0)
                i = this.selectActionsText.length + i;
        }
        else {
            i = (this.selectedBlockIndex + 1) % this.selectActionsText.length;
        }
        this.setAction(i);
    };
    GUI.prototype.getSelectedAction = function () {
        return this.selectActionsText[this.selectedBlockIndex];
    };
    GUI.prototype.setColor = function (color) {
        if (color === void 0) { color = null; }
        this.selectedColor = color;
        var el = document.getElementById("guiColor");
        if (this.selectedColor == null) {
            el.style.backgroundColor = "";
            el.textContent = "random";
            el.style.color = "white";
        }
        else {
            el.style.backgroundColor = "#" + this.selectedColor.getHexString();
            el.textContent = "#" + this.selectedColor.getHexString();
            el.style.color = this.selectedColor.getHSL().l > 0.6 ? "black" : "white";
        }
    };
    GUI.prototype.getSelectedColor = function () {
        return this.selectedColor;
    };
    GUI.prototype.animate = function () {
        document.getElementById("guiOther").innerHTML = "Gold: " + game.world.player.inventory.gold;
        function f(n) {
            return (n >= 0 ? '+' : '') + n.toFixed(10);
        }
        // Update Log
        this.elDebugInfo.innerHTML =
            "FPS: " + Math.round(game.fps.fps) + "<br/>" +
                ("Connection: " + game.connection.readyState() + " " + game.connection.handshake + "<br/>") +
                ("Players: " + (game.world.players.length + 1) + "<br/>") +
                ("Cubes: " + game.world.cubes.length + "<br/>") +
                ("Clusters: " + game.world.superCluster.clusters.length + "<br/>") +
                ("Pointer: " + (game.pointer.locked ? "locked" : "not tracking") + "<br/>") +
                ("Position:<br>&nbsp;\nx " + f(game.world.player.position.x) + "<br>&nbsp;\ny " + f(game.world.player.position.y) + "<br>&nbsp;\nz " + f(game.world.player.position.z) + "<br/>") +
                ("Looking:<br>&nbsp;\nx " + f(game.camera.getWorldDirection().x) + "<br>&nbsp;\ny " + f(game.camera.getWorldDirection().y) + "<br>&nbsp;\nz " + f(game.camera.getWorldDirection().z) + "<br/>") +
                "";
    };
    return GUI;
}());
var Input;
(function (Input) {
    var Signal = /** @class */ (function () {
        function Signal() {
            this.callbacks = [];
        }
        Signal.prototype.register = function (c) {
            this.callbacks.push(c);
        };
        Signal.prototype.send = function (data) {
            for (var i = 0, max = this.callbacks.length; i < max; ++i) {
                this.callbacks[i](data);
            }
        };
        return Signal;
    }());
    var Keyboard = /** @class */ (function () {
        function Keyboard() {
            var _this = this;
            this._keys = {};
            this.keyOrder = 0;
            window.addEventListener("keydown", function (e) { return _this.onkeydown(e); });
            window.addEventListener("keyup", function (e) { return _this.onkeyup(e); });
            window.addEventListener("blur", function () { return _this.blur(); });
        }
        Keyboard.prototype.key = function (key) {
            if (this._keys[key] === undefined) {
                this._keys[key] = {
                    pressed: 0,
                    signals: {
                        down: new Signal(),
                        up: new Signal(),
                    }
                };
            }
            return this._keys[key];
        };
        Keyboard.prototype.onkeydown = function (e) {
            if (game.gui.layer == 2 /* ingame */ &&
                document.getElementById("chatInput") !== document.activeElement && e.key.toLowerCase() !== "enter") {
                var key = this.key(e.key.toLowerCase());
                var t = key.pressed;
                key.pressed = ++this.keyOrder; // overflow after 285M years at 1 hit per seconds
                if (t == 0)
                    key.signals.down.send(key);
                e.preventDefault();
                if (e.key.toLowerCase() == "t")
                    game.traceOn = !game.traceOn;
            }
            return false;
        };
        Keyboard.prototype.blur = function () {
            // Since any key release will not be registered when the window is out of focus,
            // assume they are released when the window is getting out of focus
            for (var _key in this._keys) {
                var key = this.key(_key);
                if (key.pressed > 0) {
                    key.pressed = 0;
                    key.signals.up.send(key);
                }
            }
        };
        Keyboard.prototype.onkeyup = function (e) {
            // Key might have been down without this window beeing in focus, 
            // so ignore if it goes without going down while in focus
            var key = this.key(e.key.toLowerCase());
            var t = key.pressed;
            if (t > 0) {
                key.pressed = 0;
                key.signals.up.send(key);
            }
        };
        return Keyboard;
    }());
    Input.Keyboard = Keyboard;
    var PointerLock = /** @class */ (function () {
        function PointerLock(el) {
            var _this = this;
            this.el = el;
            this.locked = false;
            this.onchange = new Signal();
            this.lat = 0;
            this.lon = 0;
            //this.el.addEventListener("mousedown", this.el.requestPointerLock)
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
                this.onchange.send(this.locked);
            }
            else if (document.pointerLockElement !== this.el && this.locked == true) {
                this.locked = false;
                document.removeEventListener("mousemove", this.callback, false);
                this.onchange.send(this.locked);
            }
        };
        PointerLock.prototype.mousemove = function (e) {
            if (game.gui.layer != 2 /* ingame */)
                return;
            // https://bugs.chromium.org/p/chromium/issues/detail?id=781182
            if (Math.abs(e.movementX) > 200 || Math.abs(e.movementY) > 200)
                return;
            this.moveCamera(e.movementX, e.movementY);
        };
        PointerLock.prototype.updateLonLat = function () {
            this.lon = 360 - (THREE.Math.radToDeg(game.camera.rotation.y) + 180 + 270) % 360;
            this.lat = THREE.Math.radToDeg(Math.asin(game.camera.rotation.x / Math.PI * 2));
            this.moveCamera(0, 0);
        };
        PointerLock.prototype.moveCamera = function (deltaX, deltaY) {
            var speed = .2;
            this.lon += deltaX * speed; // 0 to 360 roundview
            this.lat -= deltaY * speed; // -90 to 90
            this.lat = Math.max(-89.99999, Math.min(89.99999, this.lat));
            var theta = THREE.Math.degToRad(this.lon);
            var phi = THREE.Math.degToRad(90 - this.lat);
            game.camera.lookAt(new THREE.Vector3(game.camera.position.x + Math.sin(phi) * Math.cos(theta), game.camera.position.y + Math.cos(phi), game.camera.position.z + Math.sin(phi) * Math.sin(theta)));
        };
        return PointerLock;
    }());
    Input.PointerLock = PointerLock;
    document.createElementNS("http://www.w3.org/2000/svg", "a");
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
    function Player(position, controled) {
        var _this = this;
        this.controled = controled;
        this.fast = false;
        this.walkSpeed = 0;
        this.walkSideSpeed = 0;
        this.inventory = {
            gold: 0,
        };
        this.velocityY = 0;
        this.position = position;
        this.prevPosition = { x: 0, y: 0, z: 0 };
        this.orientation = { x: 0, y: 0, z: 0 };
        this.prevOrientation = { x: 0, y: 0, z: 0 };
        var color = new THREE.Color(0xff8800);
        var geometry = new THREE.CylinderGeometry(1 / 2, 1 / 2, 2, 30, 1);
        var material = new THREE.MeshLambertMaterial({ color: color.getHex() });
        this.mesh = new THREE.Mesh(geometry, material);
        game.scene.add(this.mesh);
        this.spawn();
        if (controled) {
            game.keyboard.key("shift").signals.down.register(function () {
                if (game.gui.layer != 2 /* ingame */)
                    return;
                _this.fast = !_this.fast;
            });
            var fb = function () {
                if (game.gui.layer != 2 /* ingame */)
                    return;
                if (game.keyboard.key("w").pressed > 0 || game.keyboard.key("s").pressed > 0) {
                    _this.walkSpeed = 6 / 3.6 * (game.keyboard.key("w").pressed < game.keyboard.key("s").pressed ? -1 : 1);
                }
                else {
                    _this.walkSpeed = 0;
                }
            };
            var lr = function () {
                if (game.gui.layer != 2 /* ingame */)
                    return;
                if (game.keyboard.key("a").pressed > 0 || game.keyboard.key("d").pressed > 0) {
                    _this.walkSideSpeed = 6 / 3.6 * (game.keyboard.key("d").pressed < game.keyboard.key("a").pressed ? -1 : 1);
                }
                else {
                    _this.walkSideSpeed = 0;
                }
            };
            game.keyboard.key("w").signals.down.register(fb);
            game.keyboard.key("w").signals.up.register(fb);
            game.keyboard.key("s").signals.down.register(fb);
            game.keyboard.key("s").signals.up.register(fb);
            game.keyboard.key("d").signals.down.register(lr);
            game.keyboard.key("d").signals.up.register(lr);
            game.keyboard.key("a").signals.down.register(lr);
            game.keyboard.key("a").signals.up.register(lr);
        }
    }
    Player.prototype.updatePosition = function () {
        // Update Object Position
        this.mesh.position.x = this.position.x;
        this.mesh.position.y = this.position.y + 1;
        this.mesh.position.z = this.position.z;
        // Update Camera
        game.camera.position.x = this.mesh.position.x;
        game.camera.position.y = this.mesh.position.y + 0.25;
        game.camera.position.z = this.mesh.position.z;
    };
    Player.prototype.spawn = function () {
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
        this.updatePosition();
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
        if (this.controled && game.world.cubes.length) {
            framePerformance.start("player step");
            var collisionRadius = Math.sqrt(0.5 * 0.5 / 2);
            this.orientation.x = game.camera.rotation.x;
            this.orientation.y = game.camera.rotation.y;
            this.orientation.z = game.camera.rotation.z;
            var facingDirection = this.orientation.y;
            if (game.gui.layer == 2 /* ingame */) {
                if (game.keyboard.key(" ").pressed > 0) {
                    if (this.velocityY == 0)
                        this.velocityY = 9.81 / 2;
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
            var speed = this.walkSpeed;
            if (this.fast)
                speed *= 2;
            if (speed == 0) {
                if (this.walkSideSpeed != 0) {
                    walkingDirection -= Math.PI / 2;
                    speed = this.walkSideSpeed;
                }
            }
            else if (speed > 0) {
                if (this.walkSideSpeed > 0)
                    walkingDirection -= Math.PI / 4;
                if (this.walkSideSpeed < 0)
                    walkingDirection += Math.PI / 4;
            }
            else if (speed < 0) {
                if (this.walkSideSpeed > 0)
                    walkingDirection += Math.PI / 4;
                if (this.walkSideSpeed < 0)
                    walkingDirection -= Math.PI / 4;
            }
            var radians = walkingDirection > 0 ? walkingDirection : (2 * Math.PI) + walkingDirection;
            // Wanted movement
            var deltaX = speed * Math.sin(-radians) * deltaTime;
            var deltaY = this.velocityY * deltaTime;
            var deltaZ = speed * -Math.cos(-radians) * deltaTime;
            if (this.position.y + deltaY < game.world.lowestPoint - 20) {
                // Respawn
                this.spawn();
            }
            else {
                // Collisions
                var cubes = game.world.superCluster.getNearbyCubes(this.position);
                for (var _i = 0, cubes_1 = cubes; _i < cubes_1.length; _i++) {
                    var cube = cubes_1[_i];
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
            this.updatePosition();
            for (var _a = 0, _b = game.world.objects; _a < _b.length; _a++) {
                var object = _b[_a];
                if (object.sprite.position.y >= this.position.y &&
                    object.sprite.position.y <= this.position.y + 2 &&
                    Collision.circle_point(this.position.x, this.position.z, 1, object.sprite.position.x, object.sprite.position.z)) {
                    object.remove();
                    this.inventory.gold++;
                }
            }
            framePerformance.stop("player step");
        }
        if (this.prevPosition.x != this.position.x
            || this.prevPosition.y != this.position.y
            || this.prevPosition.z != this.position.z
            || this.prevOrientation.x != this.orientation.x
            || this.prevOrientation.y != this.orientation.y
            || this.prevOrientation.z != this.orientation.z) {
            if (this.controled) {
                game.connection.sendMessage({
                    type: 4 /* playerUpdate */,
                    player: {
                        id: this.id,
                        position: this.position,
                        orientation: this.orientation,
                        inventory: this.inventory,
                    }
                });
            }
            if (game.traceOn)
                new SpriteObject(this.position);
            this.prevPosition.x = this.position.x;
            this.prevPosition.y = this.position.y;
            this.prevPosition.z = this.position.z;
            this.prevOrientation.x = this.orientation.x;
            this.prevOrientation.y = this.orientation.y;
            this.prevOrientation.z = this.orientation.z;
        }
        //console.timeEnd("player step")
    };
    return Player;
}());
/// <reference path='types/three.d.ts' />
/// <reference path='../server/Message.d.ts' />
var FramePerformance = /** @class */ (function () {
    function FramePerformance() {
        this._timers = {};
    }
    FramePerformance.prototype.frameStart = function () {
        this._startTime = performance.now();
        this._timers = {};
    };
    FramePerformance.prototype.start = function (id) {
        this._timers[id] = performance.now();
    };
    FramePerformance.prototype.stop = function (id) {
        this._timers[id] = performance.now() - this._timers[id];
    };
    FramePerformance.prototype.frameEnd = function () {
        var duration = performance.now() - this._startTime;
        //console.log(duration, this._timers, )
    };
    return FramePerformance;
}());
var framePerformance = new FramePerformance();
var game;
window.onload = function () {
    game = new Game();
    new Info();
};
var Game = /** @class */ (function () {
    function Game() {
        var _this = this;
        this.chat = new Chat();
        this.keyboard = new Input.Keyboard();
        this.raycaster = new THREE.Raycaster();
        this.fps = new FPS();
        this.options = {
            wireframe: false,
            antialias: false,
            fog: false,
            debugInfo: false,
            renderScale: 100,
        };
        this.fog = new THREE.Fog(0xc9e2ff, 50, 1000);
        this.traceOn = false;
        this.meshShowing = false;
        this.stepPreviousTime = 0;
        game = this;
        var lsStringOptions = localStorage.getItem("options");
        if (lsStringOptions !== null) {
            var lsOptions = JSON.parse(lsStringOptions);
            this.options = lsOptions;
        }
        if (Input.PointerLock.isSupported == false)
            alert("Browser not supported!");
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0xc9e2ff);
        if (this.options.fog)
            this.scene.fog = this.fog;
        // Camera
        this.camera = new THREE.PerspectiveCamera(90, 1, 0.1, 10000);
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            antialias: this.options.antialias,
        });
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
        //window.onbeforeunload = function () { // Prevent Ctrl+W ... Chrome!
        //    return "Really want to quit the game?"
        //}
        // Network
        this.connection = new Connection();
        // GUI
        this.gui = new GUI();
        var rollOverGeo = new THREE.BoxGeometry(1, 1, 1);
        var rollOverMaterial = new THREE.MeshBasicMaterial({
            color: 0x3966a2,
            transparent: true,
            opacity: 0.75,
        });
        this.rollOverMesh = new THREE.Mesh(rollOverGeo, rollOverMaterial);
        this.rollOverMesh2 = new THREE.LineSegments(new THREE.EdgesGeometry(rollOverGeo, undefined), new THREE.LineBasicMaterial({ color: 0xffffff }));
        // Start rendering
        this.stepPreviousTime = Date.now();
        this.animate();
    }
    Game.prototype.onResize = function () {
        // Update render size
        this.renderer.setPixelRatio((this.options.renderScale / 100) * window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        // Update camera aspect ratio
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
    };
    Game.prototype.mouseup = function (e) { };
    Game.prototype.copyColor = function () {
        var pos = this.getRayCubePos(true);
        if (pos == null) {
            this.gui.setColor(null);
        }
        else {
            for (var i = 0, max = this.world.cubes.length; i < max; ++i) {
                if (this.world.cubes[i].position.x == pos.x &&
                    this.world.cubes[i].position.y == pos.y &&
                    this.world.cubes[i].position.z == pos.z) {
                    this.gui.setColor(this.world.cubes[i].color.clone());
                    break;
                }
            }
        }
    };
    Game.prototype.onclick = function (e) {
        if (this.gui.layer != 2 /* ingame */)
            return;
        if (e.button != 0)
            return;
        new TextCanvasObject();
        var action = this.gui.getSelectedAction();
        switch (action) {
            case "Pick Color":
                {
                    this.copyColor();
                }
                break;
            case "Teleport":
                {
                    var pos = game.getRayCubePos(true);
                    if (pos == null)
                        break;
                    pos.x += 0.5;
                    pos.y += 1; // go on top
                    pos.z += 0.5;
                    game.world.player.teleport(pos);
                }
                break;
            case "Remove Block":
                {
                    var pos = this.getRayCubePos(true);
                    if (pos == null)
                        break;
                    for (var i = 0, max = this.world.cubes.length; i < max; ++i) {
                        if (this.world.cubes[i].position.x == pos.x &&
                            this.world.cubes[i].position.y == pos.y &&
                            this.world.cubes[i].position.z == pos.z) {
                            //this.connection.sendMessage({
                            //    type: MessageType.removeCubes,
                            //    cubes: [{ position: this.world.cubes[i].position, type: undefined, color: undefined }]
                            //})
                            //this.world.cubes[i].remove()
                            this.world.cubes.splice(i, 1);
                            this.world.createMashup();
                            break;
                        }
                    }
                    this.world.superCluster.removeCubeAt(pos);
                }
                break;
            default:
                {
                    // Block
                    var blockType = void 0;
                    switch (action) {
                        case "Stone":
                            blockType = 0 /* stone */;
                            break;
                        case "Mono":
                            blockType = 2 /* mono */;
                            break;
                        case "Glas":
                            blockType = 1 /* glas */;
                            break;
                    }
                    var pos = this.getRayCubePos(false);
                    if (pos == null)
                        break;
                    var cube = new Cube({
                        position: { x: pos.x, y: pos.y, z: pos.z },
                        type: blockType,
                        color: this.gui.getSelectedColor() || undefined,
                    });
                    this.world.cubes.push(cube);
                    cube.init(true);
                    this.world.superCluster.addCube(cube);
                    this.world.createMashup();
                    this.connection.sendMessage({
                        type: 2 /* cubesAdd */,
                        cubes: [
                            {
                                position: cube.position,
                                type: cube.type,
                                color: { r: cube.color.r, g: cube.color.g, b: cube.color.b },
                            },
                        ],
                    });
                }
                break;
        }
    };
    Game.prototype.getRayCubePos = function (alt) {
        var maxDistance = 20;
        framePerformance.start("raytrace");
        this.raycaster.set(this.camera.position, this.camera.getWorldDirection());
        var meshes = [];
        for (var _i = 0, _a = this.world.superCluster.clusters; _i < _a.length; _i++) {
            var cluster = _a[_i];
            meshes.push(cluster.mashup);
        }
        if (meshes.length == 0) {
            framePerformance.stop("raytrace");
            return null;
        }
        var intersects = this.raycaster.intersectObjects(meshes);
        if (intersects.length == 0) {
            framePerformance.stop("raytrace");
            return null;
        }
        var intersect = intersects[0];
        var n = intersect.face.normal.clone();
        if (alt) {
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
        }
        else {
            if (n.x > 0)
                n.x = 0;
            if (n.y > 0)
                n.y = 0;
            if (n.z > 0)
                n.z = 0;
        }
        var v = intersect.point.clone().add(n);
        var cutoff = function (n) {
            return Math.round(n * 100000000) / 100000000;
        }; // floating point pression fix for flooring
        v.x = cutoff(v.x);
        v.y = cutoff(v.y);
        v.z = cutoff(v.z);
        var result = v.floor();
        if (this.camera.position.distanceTo(result) > maxDistance) {
            framePerformance.stop("raytrace");
            return null;
        }
        framePerformance.stop("raytrace");
        return result;
    };
    Game.prototype.animate = function () {
        var _this = this;
        if (document.hasFocus() ||
            performance.now() - this.fps.timeLastFrame > 1000 / 8) {
            framePerformance.frameStart();
            var t = this.camera.fov;
            this.camera.fov = this.world.player.fast ? 100 : 90;
            if (t != this.camera.fov)
                this.camera.updateProjectionMatrix();
            framePerformance.start("step");
            this.step();
            framePerformance.stop("step");
            if (this.gui.layer == 2 /* ingame */) {
                var onFace = void 0;
                switch (this.gui.getSelectedAction()) {
                    case "Teleport":
                    case "Remove Block":
                    case "Pick Color":
                        onFace = false;
                        break;
                    default:
                        onFace = true;
                }
                var pos = this.getRayCubePos(!onFace);
                if (pos == null) {
                    if (this.meshShowing) {
                        this.meshShowing = false;
                        this.scene.remove(this.rollOverMesh);
                        this.scene.remove(this.rollOverMesh2);
                    }
                }
                else {
                    this.rollOverMesh.position.copy(pos);
                    this.rollOverMesh.position.addScalar(0.5);
                    this.rollOverMesh2.position.copy(pos);
                    this.rollOverMesh2.position.addScalar(0.5);
                    if (!this.meshShowing) {
                        this.scene.add(this.rollOverMesh);
                        this.scene.add(this.rollOverMesh2);
                        this.meshShowing = true;
                    }
                }
            }
            else {
                this.meshShowing = false;
                this.scene.remove(this.rollOverMesh);
                this.scene.remove(this.rollOverMesh2);
            }
            // Render Scene
            framePerformance.start("render");
            this.renderer.render(this.scene, this.camera);
            framePerformance.stop("render");
            // GUI
            this.gui.animate();
            this.fps.addFrame();
            framePerformance.frameEnd();
        }
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
        this.players = [];
        this.objects = [];
        this.superCluster = new SuperCluster();
        this.lowestPoint = Infinity;
        this.mashup = null;
    }
    World.prototype.init = function () {
        this.player = new Player({ x: 4, y: 2, z: 4 }, true);
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
        for (var _b = 0, _c = this.objects; _b < _c.length; _b++) {
            var object = _c[_b];
            object.step(deltaTime);
        }
    };
    World.prototype.createMashup = function () {
        //console.time("mergeCubesTotal")
        //let geom = new THREE.Geometry()
        //for (let cube of this.cubes) {
        //    geom.merge(cube.geom, new THREE.Matrix4().setPosition(new THREE.Vector3(cube.position.x, cube.position.y, cube.position.z)))
        //}
        //// Reduce CPU->GPU load
        //geom.mergeVertices()
        //if (this.mashup) game.scene.remove(this.mashup)
        //Cube.texture.magFilter = THREE.NearestFilter
        //this.mashup = new THREE.Mesh(
        //    new THREE.BufferGeometry().fromGeometry(geom),
        //    <any>[
        //        new THREE.MeshLambertMaterial( // stone
        //            { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, map: Cube.texture, }),
        //        new THREE.MeshLambertMaterial( // glas
        //            { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, opacity: 0.45, transparent: true }),
        //        new THREE.MeshLambertMaterial( // mono
        //            { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, }),
        //    ])
        ////this.mashup = <any>THREE.SceneUtils.createMultiMaterialObject(geom, [
        ////    new THREE.MeshLambertMaterial({ color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, map: Cube.texture }),
        ////    new THREE.MeshLambertMaterial({ color: 0x888888, wireframe: true }),
        ////])
        ////game.scene.add(this.mashup)
        //console.timeEnd("mergeCubesTotal")
    };
    return World;
}());
var SpriteObject = /** @class */ (function () {
    function SpriteObject(pos, color) {
        if (color === void 0) { color = 0xffffff; }
        this.velocity = { x: 0, y: 0, z: 0 };
        var spriteMaterial = new THREE.SpriteMaterial({
            /*map: spriteMap,*/ color: color,
        });
        this.sprite = new THREE.Sprite(spriteMaterial);
        this.sprite.position.set(pos.x, pos.y, pos.z);
        this.velocity = new THREE.Vector3();
        this.sprite.scale.set(0.1, 0.1, 0.1);
        game.scene.add(this.sprite);
    }
    return SpriteObject;
}());
var GoldNugget = /** @class */ (function (_super) {
    __extends(GoldNugget, _super);
    function GoldNugget(pos) {
        var _this = _super.call(this, pos, 0xffd700) || this;
        game.world.objects.push(_this);
        return _this;
    }
    GoldNugget.prototype.step = function (deltaTime) {
        var collisionRadius = 0.1 / 2;
        // Gravity
        this.velocity.y += -9.81 * deltaTime;
        // Movement
        var deltaX = this.velocity.x * deltaTime;
        var deltaY = this.velocity.y * deltaTime;
        var deltaZ = this.velocity.z * deltaTime;
        // Validate Movement
        if (this.sprite.position.y + deltaY < game.world.lowestPoint - 20) {
            this.remove();
        }
        else {
            var cubes = game.world.superCluster.getNearbyCubes(this.sprite.position);
            for (var _i = 0, cubes_2 = cubes; _i < cubes_2.length; _i++) {
                var cube = cubes_2[_i];
                // Ignore if not colliding
                if (!Collision.circle_rect(this.sprite.position.x + deltaX, this.sprite.position.z + deltaZ, collisionRadius, cube.position.x, cube.position.z, cube.position.x + 1, cube.position.z + 1))
                    continue;
                var cutoff = function (n) {
                    return Math.round(n * 100000000) / 100000000;
                }; // floating point precision fix for flooring
                var a = cutoff(this.sprite.position.y - collisionRadius) >=
                    cutoff(cube.position.y + 1);
                var b = this.sprite.position.y - collisionRadius + deltaY <
                    cube.position.y + 1;
                // Check from top down
                if (a && b) {
                    deltaY =
                        cube.position.y + collisionRadius + 1 - this.sprite.position.y;
                    this.velocity.y = 0;
                }
            }
            // TODO: what is this old code..
            //   let position = new THREE.Vector3(pos.x, pos.y, pos.z);
            //   sprite.position.copy(position);
            //   this.velocity = new THREE.Vector3();
            //   sprite.scale.set(0.1, 0.1, 0.1);
            //   game.scene.add(sprite);
            // Finally update position
            this.sprite.position.x += deltaX;
            this.sprite.position.y += deltaY;
            this.sprite.position.z += deltaZ;
        }
    };
    GoldNugget.prototype.remove = function () {
        game.scene.remove(this.sprite);
        for (var i = 0; i < game.world.objects.length; ++i) {
            if (game.world.objects[i] == this) {
                game.world.objects.splice(i, 1);
            }
        }
    };
    return GoldNugget;
}(SpriteObject));
var TextCanvasObject = /** @class */ (function () {
    function TextCanvasObject() {
        var text = game.chat.getCurrentInput();
        var width = 0.9;
        var height = 0.9;
        var geometry = new THREE.PlaneGeometry(width, height);
        var canvas = document.createElement("canvas");
        canvas.width = 200;
        canvas.height = 200;
        var context = canvas.getContext("2d");
        context.fillStyle = "#fff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        //var textWidth = context.measureText(text).width;
        context.font = 20 + "px Consolas";
        context.textAlign = "center";
        context.textBaseline = "middle";
        context.fillStyle = "#000";
        context.fillText(text, Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 200);
        var texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        texture.magFilter = THREE.NearestFilter;
        var material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            map: texture,
        });
        var mesh = new THREE.Mesh(geometry, material);
        //mesh.doubleSided = true
        mesh.position.set(1 - 0.5, 2 - 0.5, 1 + 0.005);
        game.scene.add(mesh);
    }
    return TextCanvasObject;
}());
var SuperCluster = /** @class */ (function () {
    function SuperCluster() {
        this.clusters = [];
        this.mashup = null;
        this.wireMashup = null;
        this._showWireGrom = game.options.debugInfo;
    }
    SuperCluster.prototype.getNearbyCubes = function (position) {
        var clusterX = position.x >> 3;
        var clusterY = position.y >> 3;
        var clusterZ = position.z >> 3;
        var clusters = [
            this.getClusterAt({ x: clusterX - 1, y: clusterY - 1, z: clusterZ - 1 }),
            this.getClusterAt({ x: clusterX - 1, y: clusterY - 1, z: clusterZ - 0 }),
            this.getClusterAt({ x: clusterX - 1, y: clusterY - 1, z: clusterZ + 1 }),
            this.getClusterAt({ x: clusterX - 1, y: clusterY - 0, z: clusterZ - 1 }),
            this.getClusterAt({ x: clusterX - 1, y: clusterY - 0, z: clusterZ - 0 }),
            this.getClusterAt({ x: clusterX - 1, y: clusterY - 0, z: clusterZ + 1 }),
            this.getClusterAt({ x: clusterX - 1, y: clusterY + 1, z: clusterZ - 1 }),
            this.getClusterAt({ x: clusterX - 1, y: clusterY + 1, z: clusterZ - 0 }),
            this.getClusterAt({ x: clusterX - 1, y: clusterY + 1, z: clusterZ + 1 }),
            this.getClusterAt({ x: clusterX - 0, y: clusterY - 1, z: clusterZ - 1 }),
            this.getClusterAt({ x: clusterX - 0, y: clusterY - 1, z: clusterZ - 0 }),
            this.getClusterAt({ x: clusterX - 0, y: clusterY - 1, z: clusterZ + 1 }),
            this.getClusterAt({ x: clusterX - 0, y: clusterY - 0, z: clusterZ - 1 }),
            this.getClusterAt({ x: clusterX - 0, y: clusterY - 0, z: clusterZ - 0 }),
            this.getClusterAt({ x: clusterX - 0, y: clusterY - 0, z: clusterZ + 1 }),
            this.getClusterAt({ x: clusterX - 0, y: clusterY + 1, z: clusterZ - 1 }),
            this.getClusterAt({ x: clusterX - 0, y: clusterY + 1, z: clusterZ - 0 }),
            this.getClusterAt({ x: clusterX - 0, y: clusterY + 1, z: clusterZ + 1 }),
            this.getClusterAt({ x: clusterX + 1, y: clusterY - 1, z: clusterZ - 1 }),
            this.getClusterAt({ x: clusterX + 1, y: clusterY - 1, z: clusterZ - 0 }),
            this.getClusterAt({ x: clusterX + 1, y: clusterY - 1, z: clusterZ + 1 }),
            this.getClusterAt({ x: clusterX + 1, y: clusterY - 0, z: clusterZ - 1 }),
            this.getClusterAt({ x: clusterX + 1, y: clusterY - 0, z: clusterZ - 0 }),
            this.getClusterAt({ x: clusterX + 1, y: clusterY - 0, z: clusterZ + 1 }),
            this.getClusterAt({ x: clusterX + 1, y: clusterY + 1, z: clusterZ - 1 }),
            this.getClusterAt({ x: clusterX + 1, y: clusterY + 1, z: clusterZ - 0 }),
            this.getClusterAt({ x: clusterX + 1, y: clusterY + 1, z: clusterZ + 1 }),
        ];
        var cubes = [];
        for (var _i = 0, clusters_1 = clusters; _i < clusters_1.length; _i++) {
            var cluster = clusters_1[_i];
            if (!cluster)
                continue;
            for (var x = 0; x < 8; ++x) {
                for (var y = 0; y < 8; ++y) {
                    for (var z = 0; z < 8; ++z) {
                        var cube = cluster.subs[x][y][z];
                        if (cube == null)
                            continue;
                        cubes.push(cube);
                    }
                }
            }
        }
        return cubes;
    };
    SuperCluster.prototype.addCubes = function (cubes) {
        for (var _i = 0, cubes_3 = cubes; _i < cubes_3.length; _i++) {
            var cube = cubes_3[_i];
            this.addCube(cube, false);
        }
        this.createMashup();
    };
    SuperCluster.prototype.getClusterAt = function (position) {
        for (var _i = 0, _a = this.clusters; _i < _a.length; _i++) {
            var cluster = _a[_i];
            if (position.x == cluster.position.x &&
                position.y == cluster.position.y &&
                position.z == cluster.position.z) {
                return cluster;
            }
        }
    };
    SuperCluster.prototype.addCube = function (cube, updateMesh) {
        if (updateMesh === void 0) { updateMesh = true; }
        var clusterX = cube.position.x >> 3;
        var clusterY = cube.position.y >> 3;
        var clusterZ = cube.position.z >> 3;
        // Get Cluster
        var cluster = null;
        for (var _i = 0, _a = this.clusters; _i < _a.length; _i++) {
            var _cluster = _a[_i];
            if (clusterX == _cluster.position.x &&
                clusterY == _cluster.position.y &&
                clusterZ == _cluster.position.z) {
                cluster = _cluster;
                break;
            }
        }
        if (cluster == null) {
            cluster = new Cluster({ x: clusterX, y: clusterY, z: clusterZ });
            this.clusters.push(cluster);
        }
        cluster.addCube(cube, {
            x: cube.position.x - (clusterX << 3),
            y: cube.position.y - (clusterY << 3),
            z: cube.position.z - (clusterZ << 3),
        });
        if (updateMesh) {
            cluster.createMashup();
            this.createMashup();
        }
    };
    SuperCluster.prototype.removeCubeAt = function (cubePosition, updateMesh) {
        if (updateMesh === void 0) { updateMesh = true; }
        var clusterX = cubePosition.x >> 3;
        var clusterY = cubePosition.y >> 3;
        var clusterZ = cubePosition.z >> 3;
        // Get Cluster
        var cluster = null;
        for (var _i = 0, _a = this.clusters; _i < _a.length; _i++) {
            var _cluster = _a[_i];
            if (clusterX == _cluster.position.x &&
                clusterY == _cluster.position.y &&
                clusterZ == _cluster.position.z) {
                cluster = _cluster;
                break;
            }
        }
        if (cluster == null) {
            return;
        }
        cluster.removeCubeAt({
            x: cubePosition.x - (clusterX << 3),
            y: cubePosition.y - (clusterY << 3),
            z: cubePosition.z - (clusterZ << 3),
        });
        if (updateMesh) {
            cluster.createMashup();
            this.createMashup();
        }
    };
    SuperCluster.prototype.createMashup = function () {
        console.time("mergeCubesTotal - CLUSTERS");
        for (var _i = 0, _a = this.clusters; _i < _a.length; _i++) {
            var cluster = _a[_i];
            if (cluster.geom == null)
                cluster.createMashup();
        }
        console.timeEnd("mergeCubesTotal - CLUSTERS");
        //console.time("mergeCubesTotal - SUPER CLUSTER")
        //let geom = new THREE.Geometry()
        //for (let cluster of this.clusters) {
        //    geom.merge(<THREE.Geometry>cluster.geom, new THREE.Matrix4())
        //}
        //// Reduce CPU->GPU load
        //geom.mergeVertices()
        //if (this.mashup) game.scene.remove(this.mashup)
        //Cube.texture.magFilter = THREE.NearestFilter
        //this.mashup = new THREE.Mesh(
        //    geom,//new THREE.BufferGeometry().fromGeometry(geom),
        //    <any>[
        //        new THREE.MeshLambertMaterial( // stone
        //            { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, map: Cube.texture, }),
        //        new THREE.MeshLambertMaterial( // glas
        //            { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, opacity: 0.45, transparent: true }),
        //        new THREE.MeshLambertMaterial( // mono
        //            { color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, }),
        //    ])
        //this.mashup = <any>THREE.SceneUtils.createMultiMaterialObject(geom, [
        //    new THREE.MeshLambertMaterial({ color: 0xffffff, wireframe: game.options.wireframe, vertexColors: THREE.FaceColors, map: Cube.texture }),
        //    new THREE.MeshLambertMaterial({ color: 0x888888, wireframe: true }),
        //])
        //game.scene.add(this.mashup)
        //console.timeEnd("mergeCubesTotal - SUPER CLUSTER")
        var wireGeom = new THREE.Geometry();
        for (var _b = 0, _c = this.clusters; _b < _c.length; _b++) {
            var cluster = _c[_b];
            wireGeom.merge(cluster.wireGeom, new THREE.Matrix4());
        }
        if (this.wireMashup)
            game.scene.remove(this.wireMashup);
        this.wireMashup = new THREE.LineSegments(new THREE.EdgesGeometry(wireGeom, undefined), new THREE.LineBasicMaterial({ color: 0xffff00 }));
        this.showWireGeom(this._showWireGrom);
    };
    SuperCluster.prototype.showWireGeom = function (show) {
        this._showWireGrom = show;
        if (this.wireMashup == null)
            return;
        if (show) {
            game.scene.add(this.wireMashup);
        }
        else {
            game.scene.remove(this.wireMashup);
        }
    };
    return SuperCluster;
}());
var Cluster = /** @class */ (function () {
    function Cluster(position) {
        this.geom = null;
        this.wireGeom = null;
        this.position = position;
        this.level = 1;
        this.subs = [];
        for (var x = 0; x < 8; ++x) {
            this.subs[x] = [];
            for (var y = 0; y < 8; ++y) {
                this.subs[x][y] = [];
                for (var z = 0; z < 8; ++z) {
                    this.subs[x][y][z] = null;
                }
            }
        }
        this.wireGeom = new THREE.CubeGeometry(8, 8, 8);
        this.wireGeom.applyMatrix(new THREE.Matrix4().setPosition(new THREE.Vector3((this.position.x << 3) + 4, (this.position.y << 3) + 4, (this.position.z << 3) + 4)));
    }
    Cluster.prototype.addCube = function (cube, pos) {
        this.subs[pos.x][pos.y][pos.z] = cube;
    };
    Cluster.prototype.removeCubeAt = function (cubePosition) {
        if (this.level == 1) {
            var pos = this.subs[cubePosition.x][cubePosition.y][cubePosition.z]
                .position;
            (this.subs[cubePosition.x][cubePosition.y][cubePosition.z]).remove();
            this.subs[cubePosition.x][cubePosition.y][cubePosition.z] = null;
            game.connection.sendMessage({
                type: 3 /* removeCubes */,
                cubes: [{ position: pos, type: undefined, color: undefined }],
            });
        }
    };
    Cluster.prototype.createMashup = function () {
        console.time("mashup cluster l" + this.level);
        this.geom = new THREE.Geometry();
        for (var _i = 0, _a = this.subs; _i < _a.length; _i++) {
            var sx = _a[_i];
            for (var _b = 0, sx_1 = sx; _b < sx_1.length; _b++) {
                var sy = sx_1[_b];
                for (var _c = 0, sy_1 = sy; _c < sy_1.length; _c++) {
                    var sub = sy_1[_c];
                    if (sub != null) {
                        this.geom.merge(sub.geom, new THREE.Matrix4().setPosition(new THREE.Vector3(sub.position.x, sub.position.y, sub.position.z)));
                    }
                }
            }
        }
        Cube.texture.magFilter = THREE.NearestFilter;
        if (this.mashup)
            game.scene.remove(this.mashup);
        this.mashup = new THREE.Mesh(this.geom, //new THREE.BufferGeometry().fromGeometry(geom),
        [
            new THREE.MeshLambertMaterial({
                // stone
                color: 0xffffff,
                wireframe: game.options.wireframe,
                vertexColors: THREE.FaceColors,
                map: Cube.texture,
            }),
            new THREE.MeshLambertMaterial({
                // glas
                color: 0xffffff,
                wireframe: game.options.wireframe,
                vertexColors: THREE.FaceColors,
                opacity: 0.45,
                transparent: true,
            }),
            new THREE.MeshLambertMaterial({
                // mono
                color: 0xffffff,
                wireframe: game.options.wireframe,
                vertexColors: THREE.FaceColors,
            }),
        ]);
        game.scene.add(this.mashup);
        console.timeEnd("mashup cluster l" + this.level);
    };
    return Cluster;
}());
var Cube = /** @class */ (function () {
    function Cube(cubeData) {
        this.neighbours = {
            top: null,
            bottom: null,
            front: null,
            back: null,
            left: null,
            right: null,
        };
        this.position = cubeData.position;
        if (cubeData.type == undefined)
            this.type = Math.floor(Math.random() * 3);
        else
            this.type = cubeData.type;
        if (cubeData.color == undefined)
            this.color = new THREE.Color(Math.random(), Math.random(), Math.random());
        else
            this.color = new THREE.Color(cubeData.color.r, cubeData.color.g, cubeData.color.b);
        if (this.type == 0 /* stone */)
            this.color = new THREE.Color(0x888888);
        if (this.position.y < game.world.lowestPoint)
            game.world.lowestPoint = this.position.y;
        if (Cube.texture == null)
            Cube.texture = new THREE.TextureLoader().load("cube.png");
    }
    Cube.prototype.init = function (updateNeighbours) {
        if (updateNeighbours === void 0) { updateNeighbours = false; }
        this.checkNeighbours(updateNeighbours);
        this.buildGeometry();
    };
    Cube.prototype.buildGeometry = function () {
        var _this = this;
        var c0, c1, c2, c3;
        if (this.type != 1 /* glas */) {
            c0 = this.color.clone().multiplyScalar(0.5);
            c1 = this.color;
            c2 = this.color.clone().multiplyScalar(0.8);
            c3 = this.color.clone().multiplyScalar(0.9);
        }
        else {
            c0 = this.color;
            c1 = this.color;
            c2 = this.color;
            c3 = this.color;
        }
        this.geom = new THREE.Geometry();
        var face = function (neighbour) {
            return (neighbour == null ||
                (neighbour.type == 1 /* glas */ && _this.type != 1 /* glas */));
        };
        var faces = {
            top: face(this.neighbours.top),
            bottom: face(this.neighbours.bottom),
            left: face(this.neighbours.left),
            right: face(this.neighbours.right),
            front: face(this.neighbours.front),
            back: face(this.neighbours.back),
        };
        // Vertices
        var vbbl, vbfl, vbfr, vbbr, vtbl, vtfl, vtfr, vtbr;
        if (faces.bottom || faces.back || faces.left) {
            vbbl = this.geom.vertices.push(new THREE.Vector3(0, 0, 0)) - 1;
        }
        if (faces.bottom || faces.front || faces.left) {
            vbfl = this.geom.vertices.push(new THREE.Vector3(1, 0, 0)) - 1;
        }
        if (faces.bottom || faces.front || faces.right) {
            vbfr = this.geom.vertices.push(new THREE.Vector3(1, 0, 1)) - 1;
        }
        if (faces.bottom || faces.back || faces.right) {
            vbbr = this.geom.vertices.push(new THREE.Vector3(0, 0, 1)) - 1;
        }
        if (faces.top || faces.back || faces.left) {
            vtbl = this.geom.vertices.push(new THREE.Vector3(0, 1, 0)) - 1;
        }
        if (faces.top || faces.front || faces.left) {
            vtfl = this.geom.vertices.push(new THREE.Vector3(1, 1, 0)) - 1;
        }
        if (faces.top || faces.front || faces.right) {
            vtfr = this.geom.vertices.push(new THREE.Vector3(1, 1, 1)) - 1;
        }
        if (faces.top || faces.back || faces.right) {
            vtbr = this.geom.vertices.push(new THREE.Vector3(0, 1, 1)) - 1;
        }
        // Faces
        this.geom.faceVertexUvs[0] = [];
        if (faces.bottom) {
            this.geom.faces.push(new THREE.Face3(vbfl, vbbr, vbbl, new THREE.Vector3(0, -1, 0), c0, this.type));
            this.geom.faces.push(new THREE.Face3(vbbr, vbfl, vbfr, new THREE.Vector3(0, -1, 0), c0, this.type));
            var offsetx = 1 / 4;
            var offsety = 2 / 4;
            var d = 1 / 4;
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(1, 3 / 4),
                new THREE.Vector2(3 / 4, 2 / 4),
                new THREE.Vector2(1, 2 / 4),
            ]);
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(3 / 4, 2 / 4),
                new THREE.Vector2(1, 3 / 4),
                new THREE.Vector2(3 / 4, 3 / 4),
            ]);
        }
        if (faces.top) {
            this.geom.faces.push(new THREE.Face3(vtbl, vtbr, vtfl, new THREE.Vector3(0, +1, 0), c1, this.type));
            this.geom.faces.push(new THREE.Face3(vtfr, vtfl, vtbr, new THREE.Vector3(0, +1, 0), c1, this.type));
            var offsetx = 1 / 4;
            var offsety = 2 / 4;
            var d = 1 / 4;
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(offsetx + d * 0, offsety + d * 0),
                new THREE.Vector2(offsetx + d * 1, offsety + d * 0),
                new THREE.Vector2(offsetx + d * 0, offsety + d * 1),
            ]);
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(offsetx + d * 1, offsety + d * 1),
                new THREE.Vector2(offsetx + d * 0, offsety + d * 1),
                new THREE.Vector2(offsetx + d * 1, offsety + d * 0),
            ]);
        }
        if (faces.left) {
            this.geom.faces.push(new THREE.Face3(vbbl, vtbl, vbfl, new THREE.Vector3(0, 0, -1), c2, this.type));
            this.geom.faces.push(new THREE.Face3(vtfl, vbfl, vtbl, new THREE.Vector3(0, 0, -1), c2, this.type));
            var offsetx = 1 / 4;
            var offsety = 2 / 4;
            var d = 1 / 4;
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(0, 2 / 4),
                new THREE.Vector2(1 / 4, 2 / 4),
                new THREE.Vector2(0, 3 / 4),
            ]);
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(1 / 4, 3 / 4),
                new THREE.Vector2(0, 3 / 4),
                new THREE.Vector2(1 / 4, 2 / 4),
            ]);
        }
        if (faces.right) {
            this.geom.faces.push(new THREE.Face3(vbfr, vtbr, vbbr, new THREE.Vector3(0, 0, +1), c2, this.type));
            this.geom.faces.push(new THREE.Face3(vtbr, vbfr, vtfr, new THREE.Vector3(0, 0, +1), c2, this.type));
            var offsetx = 2 / 4;
            var offsety = 2 / 4;
            var d = 1 / 4;
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(3 / 4, 3 / 4),
                new THREE.Vector2(2 / 4, 2 / 4),
                new THREE.Vector2(3 / 4, 2 / 4),
            ]);
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(2 / 4, 2 / 4),
                new THREE.Vector2(3 / 4, 3 / 4),
                new THREE.Vector2(2 / 4, 3 / 4),
            ]);
        }
        if (faces.back) {
            this.geom.faces.push(new THREE.Face3(vbbl, vbbr, vtbl, new THREE.Vector3(-1, 0, 0), c3, this.type));
            this.geom.faces.push(new THREE.Face3(vtbr, vtbl, vbbr, new THREE.Vector3(-1, 0, 0), c3, this.type));
            var offsetx = 1 / 4;
            var offsety = 1 / 4;
            var d = 1 / 4;
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(offsetx + d * 0, offsety + d * 0),
                new THREE.Vector2(offsetx + d * 1, offsety + d * 0),
                new THREE.Vector2(offsetx + d * 0, offsety + d * 1),
            ]);
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(offsetx + d * 1, offsety + d * 1),
                new THREE.Vector2(offsetx + d * 0, offsety + d * 1),
                new THREE.Vector2(offsetx + d * 1, offsety + d * 0),
            ]);
        }
        if (faces.front) {
            this.geom.faces.push(new THREE.Face3(vtfl, vbfr, vbfl, new THREE.Vector3(+1, 0, 0), c3, this.type));
            this.geom.faces.push(new THREE.Face3(vbfr, vtfl, vtfr, new THREE.Vector3(+1, 0, 0), c3, this.type));
            var offsetx = 1 / 4;
            var offsety = 3 / 4;
            var d = 1 / 4;
            var mirror = true;
            var a = mirror ? 0 : 1;
            var b = mirror ? 1 : 0;
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(offsetx + d * a, offsety + d * a),
                new THREE.Vector2(offsetx + d * b, offsety + d * b),
                new THREE.Vector2(offsetx + d * a, offsety + d * b),
            ]);
            this.geom.faceVertexUvs[0].push([
                new THREE.Vector2(offsetx + d * b, offsety + d * b),
                new THREE.Vector2(offsetx + d * a, offsety + d * a),
                new THREE.Vector2(offsetx + d * b, offsety + d * a),
            ]);
        }
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
        if (this.type == 0 /* stone */) {
            while (true) {
                if (Math.floor(Math.random() * 2) == 0)
                    break;
                new GoldNugget(new THREE.Vector3(this.position.x + Math.random(), this.position.y + Math.random(), this.position.z + Math.random()));
            }
        }
    };
    Cube.prototype.checkNeighbours = function (updateOthers) {
        // TODO also update parent cluster(s)
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
            else if (cube.position.x == this.position.x &&
                cube.position.z == this.position.z) {
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
    Cube.texture = null;
    return Cube;
}());
function elementFromHTML(html) {
    var div = document.createElement('div');
    div.innerHTML = html;
    var el = div.firstElementChild;
    div.removeChild(el);
    return el;
}
