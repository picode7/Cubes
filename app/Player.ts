
class Player {

    position: Vector3
    prevPosition: Vector3

    orientation: Vector3
    prevOrientation: Vector3
    id: string

    mesh: THREE.Mesh

    fast = false

    walkSpeed = 0
    walkSideSpeed = 0

    inventory = {
        gold: 0,
    }

    constructor(position: Vector3, readonly controled: boolean) {

        this.position = position
        this.prevPosition = { x: 0, y: 0, z: 0 }
        this.orientation = { x: 0, y: 0, z: 0 }
        this.prevOrientation = { x: 0, y: 0, z: 0 }

        let color = new THREE.Color(0xff8800)
        let geometry = new THREE.CylinderGeometry(1 / 2, 1 / 2, 2, 30, 1)
        let material = new THREE.MeshLambertMaterial({ color: color.getHex() })
        this.mesh = new THREE.Mesh(geometry, material)
        game.scene.add(this.mesh)

        this.spawn()

        if (controled) {

            game.keyboard.key("shift").signals.down.register(() => {
                if (game.gui.layer != GUI_LAYER.ingame) return
                this.fast = !this.fast
            })

            let fb = () => {
                if (game.gui.layer != GUI_LAYER.ingame) return
                if (game.keyboard.key("w").pressed > 0 || game.keyboard.key("s").pressed > 0) {
                    this.walkSpeed = 6 / 3.6 * (game.keyboard.key("w").pressed < game.keyboard.key("s").pressed ? -1 : 1)
                } else {
                    this.walkSpeed = 0
                }
            }
            let lr = () => {
                if (game.gui.layer != GUI_LAYER.ingame) return
                if (game.keyboard.key("a").pressed > 0 || game.keyboard.key("d").pressed > 0) {
                    this.walkSideSpeed = 6 / 3.6 * (game.keyboard.key("d").pressed < game.keyboard.key("a").pressed ? -1 : 1)
                } else {
                    this.walkSideSpeed = 0
                }
            }

            game.keyboard.key("w").signals.down.register(fb)
            game.keyboard.key("w").signals.up.register(fb)
            game.keyboard.key("s").signals.down.register(fb)
            game.keyboard.key("s").signals.up.register(fb)

            game.keyboard.key("d").signals.down.register(lr)
            game.keyboard.key("d").signals.up.register(lr)
            game.keyboard.key("a").signals.down.register(lr)
            game.keyboard.key("a").signals.up.register(lr)
        }
    }

    updatePosition() {
        // Update Object Position
        this.mesh.position.x = this.position.x
        this.mesh.position.y = this.position.y + 1
        this.mesh.position.z = this.position.z

        // Update Camera
        game.camera.position.x = this.mesh.position.x
        game.camera.position.y = this.mesh.position.y + 0.25
        game.camera.position.z = this.mesh.position.z
    }

    spawn() {
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

        this.updatePosition()

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
    step(deltaTime: number) {
        if (this.controled && game.world.cubes.length) {
            framePerformance.start("player step")

            const collisionRadius = Math.sqrt(0.5 * 0.5 / 2)

            this.orientation.x = game.camera.rotation.x
            this.orientation.y = game.camera.rotation.y
            this.orientation.z = game.camera.rotation.z 
            let facingDirection = this.orientation.y

            if (game.gui.layer == GUI_LAYER.ingame) {
                if (game.keyboard.key(" ").pressed > 0) {
                    if (this.velocityY == 0) this.velocityY = 9.81 / 2
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
            let speed = this.walkSpeed
            if (this.fast) speed *= 2
            if (speed == 0) {
                if (this.walkSideSpeed != 0) {
                    walkingDirection -= Math.PI / 2
                    speed = this.walkSideSpeed
                }
            } else if (speed > 0) {
                if (this.walkSideSpeed > 0) walkingDirection -= Math.PI / 4
                if (this.walkSideSpeed < 0) walkingDirection += Math.PI / 4
            } else if (speed < 0) {
                if (this.walkSideSpeed > 0) walkingDirection += Math.PI / 4
                if (this.walkSideSpeed < 0) walkingDirection -= Math.PI / 4
            }
            const radians = walkingDirection > 0 ? walkingDirection : (2 * Math.PI) + walkingDirection;

            // Wanted movement
            let deltaX = speed * Math.sin(-radians) * deltaTime
            let deltaY = this.velocityY * deltaTime
            let deltaZ = speed * -Math.cos(-radians) * deltaTime

            if (this.position.y + deltaY < game.world.lowestPoint - 20) {
                // Respawn
                this.spawn()
            } else {

                // Collisions
                let cubes = game.world.superCluster.getNearbyCubes(this.position)
                for (let cube of cubes) {

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
            this.updatePosition()

            for (let object of game.world.objects) {
                if (object.sprite.position.y >= this.position.y &&
                    object.sprite.position.y <= this.position.y + 2 &&
                    Collision.circle_point(this.position.x, this.position.z, 1, object.sprite.position.x, object.sprite.position.z)) {
                    object.remove()
                    this.inventory.gold++
                }
            }

            framePerformance.stop("player step")
        }

        if (this.prevPosition.x != this.position.x
            || this.prevPosition.y != this.position.y
            || this.prevPosition.z != this.position.z
            || this.prevOrientation.x != this.orientation.x
            || this.prevOrientation.y != this.orientation.y
            || this.prevOrientation.z != this.orientation.z) {

            if (this.controled) {
                game.connection.sendMessage({
                    type: MessageType.playerUpdate,
                    player: {
                        id: this.id,
                        position: this.position,
                        orientation: this.orientation,
                        inventory: this.inventory,
                    }
                })
            }

            if (game.traceOn) new SpriteObject(this.position)

            this.prevPosition.x = this.position.x
            this.prevPosition.y = this.position.y
            this.prevPosition.z = this.position.z

            this.prevOrientation.x = this.orientation.x
            this.prevOrientation.y = this.orientation.y
            this.prevOrientation.z = this.orientation.z
        }

        //console.timeEnd("player step")
    }
}
