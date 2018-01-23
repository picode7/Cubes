
class Player {

    position: Vector3
    id: string

    mesh: THREE.Mesh

    fast = false

    constructor(position: Vector3, readonly controled: boolean) {

        this.position = position

        let color = new THREE.Color(0xff8800)
        let geometry = new THREE.CylinderGeometry(1 / 2, 1 / 2, 2, 30, 1)
        let material = new THREE.MeshLambertMaterial({ color: color.getHex() })
        this.mesh = new THREE.Mesh(geometry, material)
        game.scene.add(this.mesh)

        this.spawn()

        if (controled) {
            let key = game.keyboard.key("ShiftLeft")
            key.signals.down.register(() => {
                this.fast = !this.fast
            })
        }
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

    teleport(position: Vector3) {

        this.position.x = position.x
        this.position.y = position.y
        this.position.z = position.z

        this.velocityY = 0

        this.updateMeshPosition()

        // Update Camera
        game.camera.position.x = this.mesh.position.x
        game.camera.position.y = this.mesh.position.y + 0.25
        game.camera.position.z = this.mesh.position.z

        if (this.prevPosition.x != this.position.x
            || this.prevPosition.y != this.position.y
            || this.prevPosition.z != this.position.z) {

            game.connection.sendMessage({
                type: MessageType.playerUpdate,
                player: {
                    id: this.id,
                    position: this.position
                }
            })

            if (game.traceOn) new SpriteObject(this.position)

            this.prevPosition.x = this.position.x
            this.prevPosition.y = this.position.y
            this.prevPosition.z = this.position.z
        }
    }

    velocityY = 0
    prevPosition: Vector3 = { x: 0, y: 0, z: 0 }
    step(deltaTime: number) {
        if (this.controled) {
            let facingDirection = game.camera.rotation.y
            let walkSpeed = 0
            let walkSideSpeed = 0

            // Keyboard Input
            if (game.keyboard.key("KeyW").pressed > 0 || game.keyboard.key("KeyS").pressed > 0) {
                walkSpeed = 6 / 3.6 * (game.keyboard.key("KeyW").pressed < game.keyboard.key("KeyS").pressed ? -1 : 1)
            }
            if (game.keyboard.key("KeyA").pressed > 0 || game.keyboard.key("KeyD").pressed > 0) {
                walkSideSpeed = 6 / 3.6 * (game.keyboard.key("KeyD").pressed < game.keyboard.key("KeyA").pressed ? -1 : 1)
            }
            if (game.keyboard.key("Space").pressed > 0) {
                if (this.velocityY == 0) this.velocityY = 9.81 / 2
            }

            // Gravity
            this.velocityY += -9.81 * deltaTime

            // Angle
            game.camera.rotation.order = 'YXZ';
            this.mesh.rotation.order = 'YXZ';
            this.mesh.rotation.y = facingDirection

            // Adjust Speeds
            let walkingDirection = facingDirection
            if (this.fast) walkSpeed *= 2
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

            if (this.position.y < game.world.lowestPoint - 20) {
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
            }

            this.updateMeshPosition()

            // Update Camera
            game.camera.position.x = this.mesh.position.x
            game.camera.position.y = this.mesh.position.y + 0.25
            game.camera.position.z = this.mesh.position.z
            //console.timeEnd("playerStep")
        }

        if (this.prevPosition.x != this.position.x
            || this.prevPosition.y != this.position.y
            || this.prevPosition.z != this.position.z) {

            game.connection.sendMessage({
                type: MessageType.playerUpdate,
                player: {
                    id: this.id,
                    position: this.position
                }
            })

            if (game.traceOn) new SpriteObject(this.position)

            this.prevPosition.x = this.position.x
            this.prevPosition.y = this.position.y
            this.prevPosition.z = this.position.z
        }
    }
}
