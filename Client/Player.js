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
    Player.prototype.updateMeshPosition = function () {
        // Update Object Position
        this.mesh.position.x = this.position.x;
        this.mesh.position.y = this.position.y + 1;
        this.mesh.position.z = this.position.z;
    };
    Player.prototype.spawn = function () {
        if (this != game.world.player)
            return;
        this.position.x = 4;
        this.position.y = 1;
        this.position.z = 4;
        this.velocityY = 0;
    };
    Player.prototype.remove = function () {
        game.scene.remove(this.mesh);
    };
    Player.prototype.step = function (deltaTime) {
        if (this != game.world.player)
            return;
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
            var message = {
                type: 3 /* playerUpdate */,
                player: {
                    id: this.id,
                    position: this.position
                }
            };
            game.connection.ws.send(JSON.stringify(message));
        }
        this.updateMeshPosition();
        // Update Camera
        var camX = 0; //0.5 * Math.sin(-radians)
        var camZ = 0; //0.5 * -Math.cos(-radians)
        game.camera.position.x = this.mesh.position.x;
        game.camera.position.y = this.mesh.position.y + 0.25;
        game.camera.position.z = this.mesh.position.z;
    };
    return Player;
}());
//# sourceMappingURL=Player.js.map