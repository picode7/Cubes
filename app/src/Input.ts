namespace Input {
  interface KeyX {
    pressed: number
    signals: { down: Signal<KeyX>; up: Signal<KeyX> }
  }
  type KeysArray = {
    [index: string]: KeyX
  }

  class Signal<T> {
    callbacks: ((data: T) => any)[] = []
    register(c: (data: T) => any) {
      this.callbacks.push(c)
    }
    send(data: T) {
      for (let i = 0, max = this.callbacks.length; i < max; ++i) {
        this.callbacks[i](data)
      }
    }
  }

  export class Keyboard {
    private _keys: KeysArray = {}
    keyOrder = 0

    key(key: KeyboardEventKeyValue) {
      if (this._keys[key] === undefined) {
        this._keys[key] = {
          pressed: 0,
          signals: {
            down: new Signal(),
            up: new Signal(),
          },
        }
      }
      return this._keys[key]
    }

    constructor() {
      window.addEventListener('keydown', (e) => {
        return this.onkeydown(e)
      })
      window.addEventListener('keyup', (e) => {
        return this.onkeyup(e)
      })
      window.addEventListener('blur', () => this.blur())
    }

    private onkeydown(e: KeyboardEvent) {
      if (
        game.gui.layer == GUI_LAYER.inGame &&
        document.getElementById('chatInput') !== document.activeElement &&
        e.key.toLowerCase() !== 'enter'
      ) {
        let key = this.key(e.key.toLowerCase())
        let t = key.pressed
        key.pressed = ++this.keyOrder // overflow after 285M years at 1 hit per seconds
        if (t == 0) key.signals.down.send(key)

        e.preventDefault()
        if (e.key.toLowerCase() == 't') game.traceOn = !game.traceOn
      }
      return false
    }

    private blur() {
      // Since any key release will not be registered when the window is out of focus,
      // assume they are released when the window is getting out of focus
      for (let _key in this._keys) {
        let key = this.key(_key)
        if (key.pressed > 0) {
          key.pressed = 0
          key.signals.up.send(key)
        }
      }
    }

    private onkeyup(e: KeyboardEvent) {
      // Key might have been down without this window being in focus,
      // so ignore if it goes without going down while in focus
      let key = this.key(e.key.toLowerCase())
      let t = key.pressed
      if (t > 0) {
        key.pressed = 0
        key.signals.up.send(key)
      }
    }
  }

  export class PointerLock {
    locked: boolean = false
    onchange: Signal<boolean> = new Signal()

    constructor(public el: HTMLElement) {
      //this.el.addEventListener("mousedown", this.el.requestPointerLock)
      document.addEventListener('pointerlockchange', () => this.pointerlockchange(), false)
      this.callback = (e) => this.mousemove(e)
    }

    static get isSupported(): boolean {
      return 'pointerLockElement' in document
    }

    callback: (e: MouseEvent) => any
    pointerlockchange() {
      if (document.pointerLockElement === this.el && this.locked == false) {
        this.locked = true
        document.addEventListener('mousemove', this.callback, false)
        this.onchange.send(this.locked)
      } else if (document.pointerLockElement !== this.el && this.locked == true) {
        this.locked = false
        document.removeEventListener('mousemove', this.callback, false)
        this.onchange.send(this.locked)
      }
    }

    mousemove(e: MouseEvent) {
      if (game.gui.layer != GUI_LAYER.inGame) return

      // https://bugs.chromium.org/p/chromium/issues/detail?id=781182
      if (Math.abs(e.movementX) > 200 || Math.abs(e.movementY) > 200) return

      this.moveCamera(e.movementX, e.movementY)
    }

    lat = 0
    lon = 0
    updateLonLat() {
      this.lon = 360 - ((THREE.Math.radToDeg(game.camera.rotation.y) + 180 + 270) % 360)
      this.lat = THREE.Math.radToDeg(Math.asin((game.camera.rotation.x / Math.PI) * 2))
      this.moveCamera(0, 0)
    }
    moveCamera(deltaX, deltaY) {
      let speed = 0.2
      this.lon += deltaX * speed // 0 to 360 roundview
      this.lat -= deltaY * speed // -90 to 90

      this.lat = Math.max(-89.99999, Math.min(89.99999, this.lat))

      let theta = THREE.Math.degToRad(this.lon)
      let phi = THREE.Math.degToRad(90 - this.lat)

      game.camera.lookAt(
        new THREE.Vector3(
          game.camera.position.x + Math.sin(phi) * Math.cos(theta),
          game.camera.position.y + Math.cos(phi),
          game.camera.position.z + Math.sin(phi) * Math.sin(theta)
        )
      )
    }
  }
  document.createElementNS('http://www.w3.org/2000/svg', 'a')

  // MouseEvent.button
  export const enum Button {
    LEFT = 0,
    MIDDLE = 1,
    RIGHT = 2,
  }

  // https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/key/Key_Values 2018-02-05
  type KeyboardEventKeyValue =
    | string
    | 'Unidentified'
    | 'Unidentified'
    | 'Alt'
    | 'AltGraph'
    | 'CapsLock'
    | 'Control'
    | 'Fn'
    | 'FnLock'
    | 'Hyper'
    | 'Meta'
    | 'NumLock'
    | 'ScrollLock'
    | 'Shift'
    | 'Super'
    | 'Symbol'
    | 'SymbolLock'
    | 'Enter'
    | 'Tab'
    | ' '
    | 'ArrowDown'
    | 'ArrowLeft'
    | 'ArrowRight'
    | 'ArrowUp'
    | 'End'
    | 'Home'
    | 'PageDown'
    | 'PageUp'
    | 'Backspace'
    | 'Clear'
    | 'Copy'
    | 'CrSel'
    | 'Cut'
    | 'Delete'
    | 'EraseEof'
    | 'ExSel'
    | 'Insert'
    | 'Paste'
    | 'Redo'
    | 'Undo'
    | 'Accept'
    | 'Again'
    | 'Attn'
    | 'Cancel'
    | 'ContextMenu'
    | 'ContextMenu'
    | 'Escape'
    | 'Execute'
    | 'Find'
    | 'Finish'
    | 'Help'
    | 'Pause'
    | 'Play'
    | 'Props'
    | 'Select'
    | 'ZoomIn'
    | 'ZoomOut'
    | 'BrightnessDown'
    | 'BrightnessUp'
    | 'Eject'
    | 'LogOff'
    | 'Power'
    | 'PowerOff'
    | 'PrintScreen'
    | 'Hibernate'
    | 'Standby'
    | 'WakeUp'
    | 'AllCandidates'
    | 'Alphanumeric'
    | 'CodeInput'
    | 'Compose'
    | 'Convert'
    | 'Dead'
    | 'FinalMode'
    | 'GroupFirst'
    | 'GroupLast'
    | 'GroupNext'
    | 'GroupPrevious'
    | 'ModeChange'
    | 'NextCandidate'
    | 'NonConvert'
    | 'PreviousCandidate'
    | 'Process'
    | 'SingleCandidate'
    | 'HangulMode'
    | 'HanjaMode'
    | 'JunjaMode'
    | 'Eisu'
    | 'Hankaku'
    | 'Hiragana'
    | 'HiraganaKatakana'
    | 'KanaMode'
    | 'KanjiMode'
    | 'Katakana'
    | 'Romaji'
    | 'Zenkaku'
    | 'ZenkakuHanaku'
    | 'F1'
    | 'F2'
    | 'F3'
    | 'F4'
    | 'F5'
    | 'F6'
    | 'F7'
    | 'F8'
    | 'F9'
    | 'F10'
    | 'F11'
    | 'F12'
    | 'F13'
    | 'F14'
    | 'F15'
    | 'F16'
    | 'F17'
    | 'F18'
    | 'F19'
    | 'F20'
    | 'AppSwitch'
    | 'Call'
    | 'Camera'
    | 'CameraFocus'
    | 'EndCall'
    | 'GoBack'
    | 'GoHome'
    | 'HeadsetHook'
    | 'LastNumberRedial'
    | 'Notification'
    | 'MannerMode'
    | 'VoiceDial'
    | 'ChannelDown'
    | 'ChannelUp'
    | 'MediaFastForward'
    | 'MediaPause'
    | 'MediaPlay'
    | 'MediaPlayPause'
    | 'MediaRecord'
    | 'MediaRewind'
    | 'MediaStop'
    | 'MediaTrackNext'
    | 'MediaTrackPrevious'
    | 'AudioBalanceLeft'
    | 'AudioBalanceRight'
    | 'AudioBassDown'
    | 'AudioBassBoostDown'
    | 'AudioBassBoostToggle'
    | 'AudioBassBoostUp'
    | 'AudioBassUp'
    | 'AudioFaderFront'
    | 'AudioFaderRear'
    | 'AudioSurroundModeNext'
    | 'AudioTrebleDown'
    | 'AudioTrebleUp'
    | 'AudioVolumeDown'
    | 'AudioVolumeMute'
    | 'AudioVolumeUp'
    | 'MicrophoneToggle'
    | 'MicrophoneVolumeDown'
    | 'MicrophoneVolumeMute'
    | 'MicrophoneVolumeUp'
    | 'TV'
    | 'TV3DMode'
    | 'TVAntennaCable'
    | 'TVAudioDescription'
    | 'TVAudioDescriptionMixDown'
    | 'TVAudioDescriptionMixUp'
    | 'TVContentsMenu'
    | 'TVDataService'
    | 'TVInput'
    | 'TVInputComponent1'
    | 'TVInputComponent2'
    | 'TVInputComposite1'
    | 'TVInputComposite2'
    | 'TVInputHDMI1'
    | 'TVInputHDMI2'
    | 'TVInputHDMI3'
    | 'TVInputHDMI4'
    | 'TVInputVGA1'
    | 'TVMediaContext'
    | 'TVNetwork'
    | 'TVNumberEntry'
    | 'TVPower'
    | 'TVRadioService'
    | 'TVSatellite'
    | 'TVSatelliteBS'
    | 'TVSatelliteCS'
    | 'TVSatelliteToggle'
    | 'TVTerrestrialAnalog'
    | 'TVTerrestrialDigital'
    | 'TVTimer'
    | 'AVRInput'
    | 'AVRPower'
    | 'ColorF0Red'
    | 'ColorF1Green'
    | 'ColorF2Yellow'
    | 'ColorF3Blue'
    | 'ColorF4Grey'
    | 'ColorF5Brown'
    | 'ClosedCaptionToggle'
    | 'Dimmer'
    | 'DisplaySwap'
    | 'DVR'
    | 'Exit'
    | 'FavoriteClear0'
    | 'FavoriteClear1'
    | 'FavoriteClear2'
    | 'FavoriteClear3'
    | 'FavoriteRecall0'
    | 'FavoriteRecall1'
    | 'FavoriteRecall2'
    | 'FavoriteRecall3'
    | 'FavoriteStore0'
    | 'FavoriteStore1'
    | 'FavoriteStore2'
    | 'FavoriteStore3'
    | 'Guide'
    | 'GuideNextDay'
    | 'GuidePreviousDay'
    | 'Info'
    | 'InstantReplay'
    | 'Link'
    | 'ListProgram'
    | 'LiveContent'
    | 'Lock'
    | 'MediaApps'
    | 'MediaAudioTrack'
    | 'MediaLast'
    | 'MediaSkipBackward'
    | 'MediaSkipForward'
    | 'MediaStepBackward'
    | 'MediaStepForward'
    | 'MediaTopMenu'
    | 'NavigateIn'
    | 'NavigateNext'
    | 'NavigateOut'
    | 'NavigatePrevious'
    | 'NextFavoriteChannel'
    | 'NextUserProfile'
    | 'OnDemand'
    | 'Pairing'
    | 'PinPDown'
    | 'PinPMove'
    | 'PinPToggle'
    | 'PinPUp'
    | 'PlaySpeedDown'
    | 'PlaySpeedReset'
    | 'PlaySpeedUp'
    | 'RandomToggle'
    | 'RcLowBattery'
    | 'RecordSpeedNext'
    | 'RfBypass'
    | 'ScanChannelsToggle'
    | 'ScreenModeNext'
    | 'Settings'
    | 'SplitScreenToggle'
    | 'STBInput'
    | 'STBPower'
    | 'Subtitle'
    | 'Teletext'
    | 'VideoModeNext'
    | 'Wink'
    | 'ZoomToggle'
    | 'SpeechCorrectionList'
    | 'SpeechInputToggle'
    | 'Close'
    | 'New'
    | 'Open'
    | 'Print'
    | 'Save'
    | 'SpellCheck'
    | 'MailForward'
    | 'MailReply'
    | 'MailSend'
    | 'LaunchCalculator'
    | 'LaunchCalendar'
    | 'LaunchContacts'
    | 'LaunchMail'
    | 'LaunchMediaPlayer'
    | 'LaunchMusicPlayer'
    | 'LaunchMyComputer'
    | 'LaunchPhone'
    | 'LaunchScreenSaver'
    | 'LaunchSpreadsheet'
    | 'LaunchWebBrowser'
    | 'LaunchWebCam'
    | 'LaunchWordProcessor'
    | 'LaunchApplication1'
    | 'LaunchApplication2'
    | 'LaunchApplication3'
    | 'LaunchApplication4'
    | 'LaunchApplication5'
    | 'LaunchApplication6'
    | 'LaunchApplication7'
    | 'LaunchApplication8'
    | 'LaunchApplication9'
    | 'LaunchApplication10'
    | 'LaunchApplication11'
    | 'LaunchApplication12'
    | 'LaunchApplication13'
    | 'LaunchApplication14'
    | 'LaunchApplication15'
    | 'LaunchApplication16'
    | 'BrowserBack'
    | 'BrowserFavorites'
    | 'BrowserForward'
    | 'BrowserHome'
    | 'BrowserRefresh'
    | 'BrowserSearch'
    | 'BrowserStop'
    | 'Decimal'
    | 'Key11'
    | 'Key12'
    | 'Multiply'
    | 'Add'
    | 'Clear'
    | 'Divide'
    | 'Subtract'
    | 'Separator'
    | '0'
    | '1'
    | '2'
    | '3'
    | '4'
    | '5'
    | '6'
    | '7'
    | '8'
    | '9'
    | 'a'
    | 'b'
    | 'c'
    | 'd'
    | 'e'
    | 'f'
    | 'g'
    | 'h'
    | 'i'
    | 'j'
    | 'k'
    | 'l'
    | 'm'
    | 'n'
    | 'o'
    | 'p'
    | 'q'
    | 'r'
    | 's'
    | 't'
    | 'u'
    | 'v'
    | 'w'
    | 'x'
    | 'y'
    | 'z'

  // KeyboardEvent.keyCode // deprecated
  export const enum Key {
    BACKSPACE = 8,
    TAB = 9,

    ENTER = 13,

    SHIFT = 16,
    CTRL = 17,
    ALT = 18,
    PAUSE_BREAK = 19,
    CAPS_LOCK = 20,

    ESC = 27,

    SPACE = 32,
    PAGE_UP = 33,
    PAGE_DOWN = 34,
    END = 35,
    HOME = 36,
    LEFT_ARROW = 37,
    UP_ARROW = 38,
    RIGHT_ARROW = 39,
    DOWN_ARROW = 40,

    INSERT = 45,
    DELETE = 46,

    _0 = 48,
    _1 = 49,
    _2 = 50,
    _3 = 51,
    _4 = 52,
    _5 = 53,
    _6 = 54,
    _7 = 55,
    _8 = 56,
    _9 = 57,

    A = 65,
    B = 66,
    C = 67,
    D = 68,
    E = 69,
    F = 70,
    G = 71,
    H = 72,
    I = 73,
    J = 74,
    K = 75,
    L = 76,
    M = 77,
    N = 78,
    O = 79,
    P = 80,
    Q = 81,
    R = 82,
    S = 83,
    T = 84,
    U = 85,
    V = 86,
    W = 87,
    X = 88,
    Y = 89,
    Z = 90,
    LEFT_WINDOW_KEY = 91,
    RIGHT_WINDOW_KEY = 92,
    SELECT_KEY = 93,

    NUMPAD_0 = 96,
    NUMPAD_1 = 97,
    NUMPAD_2 = 98,
    NUMPAD_3 = 99,
    NUMPAD_4 = 100,
    NUMPAD_5 = 101,
    NUMPAD_6 = 102,
    NUMPAD_7 = 103,
    NUMPAD_8 = 104,
    NUMPAD_9 = 105,
    NUMPAD_MULTIPLY = 106,
    NUMPAD_ADD = 107,
    //NUMPAD_ENTER = 108,
    NUMPAD_SUBTRACT = 109,
    NUMPAD_DECIMAL = 110,
    NUMPAD_DIVIDE = 111,
    F1 = 112,
    F2 = 113,
    F3 = 114,
    F4 = 115,
    F5 = 116,
    F6 = 117,
    F7 = 118,
    F8 = 119,
    F9 = 120,
    F10 = 121,
    F11 = 122,
    F12 = 123,
    F13 = 124,
    F14 = 125,
    F15 = 126,

    NUM_LOCK = 144,
    SCROLL_LOCK = 145,

    COLON = 186,
    EQUAL = 187,
    COMMA = 188,
    UNDERSCORE = 189,
    PERIOD = 190,
    FORWARD_SLASH = 191,
    GRAVE_ACCENT = 192,

    OPEN_BRACKET = 219,
    BACK_SLASH = 220,
    CLOSE_BRACKET = 221,
    SINGLE_QUOTE = 222,
  }
}
