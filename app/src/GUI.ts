interface Changelog {
  'known issues': string[]
  'work in progress': string[]
  versions: {
    version: string
    changes: string[]
  }[]
}

class Info {
  constructor() {
    let req = new XMLHttpRequest()
    req.open('GET', 'changelog.json')
    req.onreadystatechange = () => {
      if (req.readyState == 4 && req.status == 200) {
        this.changelog(JSON.parse(req.responseText))
      }
    }
    req.send()
  }

  private changelog(logs: Changelog) {
    let oldVersion = localStorage.getItem('version')

    let oldKnownIssues = localStorage.getItem('knownIssues')
    let knownIssues = JSON.stringify(logs['known issues'])

    let oldWorkInProgress = localStorage.getItem('workInProgress')
    let workInProgress = JSON.stringify(logs['work in progress'])

    logs.versions.sort((a, b) => {
      return a.version > b.version ? -1 : 1
    })

    if (
      oldVersion == null ||
      oldVersion < logs.versions[0].version ||
      oldKnownIssues != knownIssues ||
      oldWorkInProgress != workInProgress
    ) {
      document.getElementById('info').style.display = 'block'
      localStorage.setItem('version', logs.versions[0].version)
      localStorage.setItem('knownIssues', knownIssues)
      localStorage.setItem('workInProgress', workInProgress)
    }

    let elVersionLog = document.getElementById('versionLog')
    let putContentInto = elVersionLog
    let elSpoilerContent = document.createElement('div')

    document.getElementById('version').innerText = `Version ${logs.versions[0].version}${
      workInProgress.length > 0 ? ' work in progress' : ''
    }`

    headList(oldKnownIssues != knownIssues ? elVersionLog : elSpoilerContent, 'known issues', logs['known issues'])

    headList(
      oldWorkInProgress != workInProgress ? elVersionLog : elSpoilerContent,
      'work in progress',
      logs['work in progress']
    )

    for (let version of logs.versions) {
      // put content into spoiler if it's not new
      if (oldVersion >= version.version) {
        putContentInto = elSpoilerContent
      }
      headList(putContentInto, version.version, version.changes)
    }

    if (elSpoilerContent.childElementCount) {
      let spoiler = elementFromHTML(`<div style="cursor:pointer;color:lightblue">Show Update Log</div>`)
      spoiler.onclick = () => {
        elSpoilerContent.style.display = 'block'
        spoiler.style.display = 'none'
      }
      elVersionLog.appendChild(spoiler)

      elSpoilerContent.style.display = 'none'
      elVersionLog.appendChild(elSpoilerContent)
    }

    function headList(parent: typeof elVersionLog, title: string, list: string[]) {
      let elTitle = document.createElement('h3')
      elTitle.innerText = title
      parent.appendChild(elTitle)
      let elList = document.createElement('ul')
      parent.appendChild(elList)
      for (let log of list) {
        let elItem = document.createElement('li')
        elItem.innerText = log
        elList.appendChild(elItem)
      }
    }
  }
}

class FPS {
  fps = 0
  timeLastFrame = 0
  addFrame() {
    let timeNow = performance.now()
    this.fps = (this.fps / 10) * 9 + (1000 / (timeNow - this.timeLastFrame) / 10) * 1
    this.timeLastFrame = timeNow
  }
}

class Chat {
  elC = document.getElementById('chat')
  elCL = document.getElementById('chatLog')
  elCI = <HTMLInputElement>document.getElementById('chatInput')
  elCS = <HTMLInputElement>document.getElementById('chatSend')

  constructor() {
    this.elCS.onclick = () => this.send()
    this.elCI.onblur = () => this.show()

    window.addEventListener('keydown', (e) => {
      if (e.keyCode == Input.Key.ENTER) {
        if (this.elCI !== document.activeElement) {
          this.show()
          this.elCI.focus()
        } else {
          this.send()
          this.elCI.blur()
        }
      }
    })
  }

  hideTimeout: number
  show() {
    this.elC.style.display = 'block'

    clearTimeout(this.hideTimeout)
    this.hideTimeout = setTimeout(() => this.hide(), 5000)
  }

  hide() {
    if (this.elCI == document.activeElement) return

    this.elC.style.display = 'none'
    this.elCI.blur()
  }

  getCurrentInput() {
    let text = this.elCI.value.trim()
    this.elCI.value = ''
    return text
  }

  send() {
    let txt = this.getCurrentInput()

    if (txt == '') return

    this.onmessage(txt, true)
  }

  onmessage(text, self = false) {
    this.show()

    // append messages
    this.elCL.appendChild(
      elementFromHTML(`<div${self ? ` style="color:#ccc"` : ''}>[${new Date().toLocaleTimeString()}] ${text}</div>`)
    )

    // scroll down
    this.elCL.scrollTop = this.elCL.scrollHeight

    if (self) {
      game.connection.sendMessage({
        type: MessageType.chat,
        text: text,
      })
    }
  }
}

const enum GUI_LAYER {
  none,
  menu,
  inGame,
  chat,
}

class GUI {
  layer: GUI_LAYER = GUI_LAYER.none

  private selectActionsText = ['Stone', 'Mono', 'Glass', 'Remove Block', 'Pick Color', 'Teleport']
  private selectBlockElement: HTMLElement[] = []
  private selectedBlockIndex = 0

  private selectedColor: THREE.Color = null

  elDebugInfo: HTMLElement
  elPointer: HTMLElement
  elMenu: HTMLElement

  constructor() {
    this.elMenu = document.getElementById('menu')

    // Pointer
    this.elPointer = elementFromHTML(
      `<div style="position:absolute; left:50%; top:50%; height:2px; width:2px; background:red; pointer-events:none"></div>`
    )
    document.body.appendChild(this.elPointer)
    game.pointer.onchange.register((locked) => {
      if (locked == false && this.layer == GUI_LAYER.inGame) this.setLayer(GUI_LAYER.menu)
    })

    // Debug Info
    this.elDebugInfo = document.body.appendChild(
      elementFromHTML(
        `<div style="position:absolute; left:0; top:0; width:200px; color: white; font-size:10pt;font-family: Consolas;pointer-events:none"></div>`
      )
    )
    this.elDebugInfo.style.display = game.options.debugInfo ? 'block' : 'none'

    // Selector
    let el = document.getElementById('guiBlocks')
    for (let i = 0, max = this.selectActionsText.length; i < max; ++i) {
      let el2 = document.createElement('div')
      el2.textContent = this.selectActionsText[i].toString()
      el.appendChild(el2)
      this.selectBlockElement[i] = el2
    }
    this.setAction(0)
    this.setColor(null)

    // Options
    this.updateOptionsGUI()

    this.setLayer(GUI_LAYER.menu)
    document.getElementById('continue').onclick = () => {
      this.setLayer(GUI_LAYER.inGame)
      game.pointer.el.requestPointerLock()
    }

    // Input
    let lastWheely = 0
    window.addEventListener('wheel', (event) => {
      if (event.timeStamp - lastWheely > 50) {
        this.mousewheel(event)
        lastWheely = event.timeStamp
      }
    })
    for (let i = 1; i <= 9; ++i) {
      game.keyboard.key(i.toString()).signals.down.register((key) => {
        if (this.layer != GUI_LAYER.inGame) return
        this.setAction(i - 1)
      })
    }
    game.keyboard.key('0').signals.down.register((key) => {
      if (this.layer != GUI_LAYER.inGame) return
      this.setAction(10 - 1)
    })
    game.keyboard.key('escape').signals.down.register(() => {
      //if (this.layer == GUI_LAYER.menu) this.setLayer(GUI_LAYER.inGame)
      //else if (this.layer == GUI_LAYER.inGame) this.setLayer(GUI_LAYER.menu)
    })
  }

  setLayer(layer: GUI_LAYER) {
    switch (this.layer) {
      case GUI_LAYER.inGame:
        {
          switch (layer) {
            case GUI_LAYER.menu:
              {
                // show menu
                this.elMenu.style.display = 'block'
                this.elPointer.style.display = 'none'
                this.layer = layer
              }
              break
          }
        }
        break

      case GUI_LAYER.menu:
        {
          switch (layer) {
            case GUI_LAYER.inGame:
              {
                // hide menu
                this.elMenu.style.display = 'none'
                this.elPointer.style.display = 'block'
                this.layer = layer
              }
              break
          }
        }
        break

      case GUI_LAYER.none:
        {
          switch (layer) {
            case GUI_LAYER.menu:
              {
                // show menu
                this.elMenu.style.display = 'block'
                this.elPointer.style.display = 'none'
                this.layer = layer
              }
              break
          }
        }
        break
    }
  }

  updateOptionsGUI() {
    ;(<HTMLInputElement>document.getElementById('settings_aa')).checked = game.options.antialias
    ;(<HTMLInputElement>document.getElementById('settings_debug')).checked = game.options.debugInfo
    ;(<HTMLInputElement>document.getElementById('settings_fog')).checked = game.options.fog
    ;(<HTMLInputElement>document.getElementById('settings_wireframe')).checked = game.options.wireframe
    ;(<HTMLSelectElement>document.getElementById('settings_renderScale')).selectedIndex = [
      25,
      50,
      75,
      100,
      150,
      200,
    ].indexOf(game.options.renderScale)
  }

  updateOptions(reload = false) {
    game.options.antialias = (<HTMLInputElement>document.getElementById('settings_aa')).checked
    game.options.debugInfo = (<HTMLInputElement>document.getElementById('settings_debug')).checked
    game.options.fog = (<HTMLInputElement>document.getElementById('settings_fog')).checked
    game.options.wireframe = (<HTMLInputElement>document.getElementById('settings_wireframe')).checked
    game.options.renderScale = [25, 50, 75, 100, 150, 200][
      (<HTMLSelectElement>document.getElementById('settings_renderScale')).selectedIndex
    ]

    localStorage.setItem('options', JSON.stringify(game.options))

    // Debug Info
    this.elDebugInfo.style.display = game.options.debugInfo ? 'block' : 'none'

    // Wireframe
    game.world.superCluster.showWireGeom(game.options.debugInfo)
    game.world.createMashup()

    // Fog
    if (game.options.fog) {
      game.scene.fog = game.fog
    } else {
      game.scene.fog = null
    }

    // Render Scale
    game.renderer.setPixelRatio((game.options.renderScale / 100) * window.devicePixelRatio)

    if (reload) location.reload()
  }

  mousewheel(e: WheelEvent) {
    if (this.layer != GUI_LAYER.inGame) return

    if (e.deltaY > 0) {
      // down
      this.selectNextAction(false)
    } else if (e.deltaY < 0) {
      // up
      this.selectNextAction(true)
    }
  }

  setAction(i: number) {
    if (!(i >= 0 && i < this.selectBlockElement.length)) return

    this.selectBlockElement[this.selectedBlockIndex].textContent = this.selectActionsText[
      this.selectedBlockIndex
    ].toString()
    this.selectedBlockIndex = i
    this.selectBlockElement[this.selectedBlockIndex].textContent =
      this.selectActionsText[this.selectedBlockIndex].toString() + ' <'
  }

  selectNextAction(directionUp?: boolean) {
    let i: number
    if (directionUp) {
      i = this.selectedBlockIndex - 1
      if (i < 0) i = this.selectActionsText.length + i
    } else {
      i = (this.selectedBlockIndex + 1) % this.selectActionsText.length
    }
    this.setAction(i)
  }

  getSelectedAction() {
    return this.selectActionsText[this.selectedBlockIndex]
  }

  setColor(color: THREE.Color = null) {
    this.selectedColor = color

    let el = document.getElementById('guiColor')
    if (this.selectedColor == null) {
      el.style.backgroundColor = ``
      el.textContent = `random`
      el.style.color = 'white'
    } else {
      el.style.backgroundColor = `#${this.selectedColor.getHexString()}`
      el.textContent = `#${this.selectedColor.getHexString()}`
      el.style.color = this.selectedColor.getHSL().l > 0.6 ? 'black' : 'white'
    }
  }

  getSelectedColor() {
    return this.selectedColor
  }

  animate() {
    document.getElementById('guiOther').innerHTML = `Gold: ${game.world.player.inventory.gold}`

    function f(n: number) {
      return (n >= 0 ? '+' : '') + n.toFixed(10)
    }
    // Update Log
    this.elDebugInfo.innerHTML =
      `FPS: ${Math.round(game.fps.fps)}<br/>` +
      `Connection: ${game.connection.readyState()} ${game.connection.handshake}<br/>` +
      `Players: ${game.world.players.length + 1}<br/>` +
      `Cubes: ${game.world.cubes.length}<br/>` +
      `Clusters: ${game.world.superCluster.clusters.length}<br/>` +
      `Pointer: ${game.pointer.locked ? 'locked' : 'not tracking'}<br/>` +
      `Position:<br>&nbsp;
x ${f(game.world.player.position.x)}<br>&nbsp;
y ${f(game.world.player.position.y)}<br>&nbsp;
z ${f(game.world.player.position.z)}<br/>` +
      `Looking:<br>&nbsp;
x ${f(game.camera.getWorldDirection().x)}<br>&nbsp;
y ${f(game.camera.getWorldDirection().y)}<br>&nbsp;
z ${f(game.camera.getWorldDirection().z)}<br/>` +
      ''
  }
}
