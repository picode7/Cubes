
class Player {

    position: Vector3
    id: string

    mesh: THREE.Mesh

    constructor(position: Vector3) {

        this.position = position

        let color = new THREE.Color(0xff8800)
        let geometry = new THREE.CylinderGeometry(1 / 2, 1 / 2, 2, 30, 1)
        let material = new THREE.MeshLambertMaterial({ color: color.getHex() })
        this.mesh = new THREE.Mesh(geometry, material)
        game.scene.add(this.mesh)

        this.spawn()
    }

    updateMeshPosition() {
        // Update Object Position
        this.mesh.position.x = this.position.x
        this.mesh.position.y = this.position.y + 1
        this.mesh.position.z = this.position.z
    }

    spawn() {
        //if (this != game.world.player) return

        this.position.x = 4
        this.position.y = 15
        this.position.z = 4
        this.velocityY = 0
    }

    remove() {
        game.scene.remove(this.mesh)
    }

    velocityY = 0
    step(deltaTime: number) {
        if (this != game.world.player) return

        let facingDirection = game.camera.rotation.y
        let walkSpeed = 0
        let walkSideSpeed = 0
        let fast = false

        // Keyboard Input
        for (let i = game.keysDown.length - 1; i >= 0; --i) {
            switch (game.keysDown[i]) {
                case Input.KEY.W: if (walkSpeed == 0) walkSpeed = 6 / 3.6; break
                case Input.KEY.S: if (walkSpeed == 0) walkSpeed = -6 / 3.6; break
                case Input.KEY.A: if (walkSideSpeed == 0) walkSideSpeed = -6 / 3.6; break
                case Input.KEY.D: if (walkSideSpeed == 0) walkSideSpeed = 6 / 3.6; break
                case Input.KEY.SPACE: if (this.velocityY == 0) this.velocityY = 9.81 / 2; break
                case Input.KEY.SHIFT: fast = true; break
            }
        }

        // Gravity
        this.velocityY += -9.81 * deltaTime

        // Angle
        game.camera.rotation.order = 'YXZ';
        this.mesh.rotation.order = 'YXZ';
        this.mesh.rotation.y = facingDirection

        // Adjust Speeds
        let walkingDirection = facingDirection
        if (fast) walkSpeed *= 2
        let speed = walkSpeed
        if (speed == 0) {
            if (walkSideSpeed != 0) {
                walkingDirection -= Math.PI / 2
                speed = walkSideSpeed
            }
        } else if (speed > 0) {
            if (walkSideSpeed > 0) walkingDirection -= Math.PI / 4
            if (walkSideSpeed < 0) walkingDirection += Math.PI / 4
        } else if (speed < 0) {
            if (walkSideSpeed > 0) walkingDirection += Math.PI / 4
            if (walkSideSpeed < 0) walkingDirection -= Math.PI / 4
        }
        const radians = walkingDirection > 0 ? walkingDirection : (2 * Math.PI) + walkingDirection;

        // Wanted movement
        let deltaX = speed * Math.sin(-radians) * deltaTime
        let deltaY = this.velocityY * deltaTime
        let deltaZ = speed * -Math.cos(-radians) * deltaTime

        if (this.position.y < -50) {

            // Respawn
            this.spawn()
        } else {

            // Collisions
            let collisionRadius = Math.sqrt(0.5 * 0.5 / 2)

            for (let cube of game.world.cubes) {

                // Ignore if not colliding
                if (!Collision.circle_rect(
                    this.position.x + deltaX, this.position.z + deltaZ, collisionRadius,
                    cube.position.x, cube.position.z, cube.position.x + 1, cube.position.z + 1,
                )) continue

                // Check side collisions

                let a = cube.position.y + 1 > this.position.y
                let b = cube.position.y < this.position.y + 2
                if (a && b) {
                    // only collide if it wasn't allready colliding previously
                    if (!Collision.circle_rect(
                        this.position.x, this.position.z, collisionRadius,
                        cube.position.x, cube.position.z, cube.position.x + 1, cube.position.z + 1,
                    )) {
                        deltaX = 0
                        deltaZ = 0
                    }
                }

                // Check from top down
                if (this.position.y >= cube.position.y + 1 && this.position.y + deltaY < cube.position.y + 1) {
                    deltaY = (cube.position.y + 1) - this.position.y
                    this.velocityY = 0
                }
            }

            // Finally update position
            this.position.x += deltaX
            this.position.y += deltaY
            this.position.z += deltaZ

            let message = {
                type: MessageType.playerUpdate,
                player: {
                    id: this.id,
                    position: this.position
                }
            }
            game.connection.ws.send(JSON.stringify(message))
        }

        this.updateMeshPosition()

        // Update Camera
        let camX = 0//0.5 * Math.sin(-radians)
        let camZ = 0//0.5 * -Math.cos(-radians)
        game.camera.position.x = this.mesh.position.x
        game.camera.position.y = this.mesh.position.y + 0.25
        game.camera.position.z = this.mesh.position.z
    }
}
