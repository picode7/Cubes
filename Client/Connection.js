var Connection = /** @class */ (function () {
    function Connection() {
        var _this = this;
        this.ws = new WebSocket((location.protocol == "https:" ? "wss" : "ws") + "://" + location.host + location.pathname);
        this.ws.onopen = function () {
            var message1 = {
                type: 0 /* handshake */
            };
            _this.ws.send(JSON.stringify(message1));
            var message2 = {
                type: 1 /* getCubes */
            };
            _this.ws.send(JSON.stringify(message2));
        };
        this.ws.onmessage = function (ev) {
            var message = JSON.parse(ev.data);
            switch (message.type) {
                case 0 /* handshake */:
                    game.world.player.id = message.player.id;
                    break;
                case 2 /* cubesAdd */:
                    for (var _i = 0, _a = message.cubes; _i < _a.length; _i++) {
                        var cubePosition = _a[_i];
                        var cube = new Cube(cubePosition);
                        game.world.cubes.push(cube);
                        cube.init(true);
                    }
                    //setTimeout(() => game.world.createMashup(), 1000)
                    break;
                case 3 /* playerUpdate */:
                    if (game.world.players === undefined)
                        break;
                    if (message.player.position == null) {
                        // remove player
                        console.log(game.world.players);
                        for (var i = 0; i < game.world.players.length; ++i) {
                            if (game.world.players[i].id == message.player.id) {
                                game.world.players[i].remove();
                                game.world.players.splice(i, 1);
                                break;
                            }
                        }
                        console.log(game.world.players);
                    }
                    else {
                        var found = null;
                        for (var _b = 0, _c = game.world.players; _b < _c.length; _b++) {
                            var player = _c[_b];
                            if (player.id == message.player.id) {
                                found = player;
                                break;
                            }
                        }
                        if (found == null) {
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
    }
    return Connection;
}());
//# sourceMappingURL=Connection.js.map