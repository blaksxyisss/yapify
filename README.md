# Yapify

client mod for [Yapin](https://yapin.gg) / Yapper desktop app. think vencord but for yapin.

patches the electron app to add plugins, themes, accent colors, devtools, and a bunch of QoL stuff. everything is toggleable from a settings panel injected right into the client.

---

## what it does

- **plugins** — toggle on/off without restarting. broken plugins get caught and disabled so they dont crash your client. you can also drop your own plugins into `%APPDATA%\YapinMod\plugins\`
- **themes** — swap CSS themes on the fly. comes with a few built-in ones (Midnight OLED, Nord Frost, Solarized Slate). drop any `.css` file in `%APPDATA%\YapinMod\themes\` and it shows up
- **accent colors** — pick from presets or type in a hex code. updates live
- **devtools** — re-enables Ctrl+Shift+I / F12 since yapin disables them by default
- **safe mode** — if something breaks, flip this on and all plugins are skipped on startup

## built-in plugins

| Plugin | What it does |
|--------|-------------|
| Custom Accent Colors | swap accent color with presets or custom hex |
| UI Tweaks & Polish | corner rounding slider, compact server rail, smooth scrolling, custom scrollbars |
| QoL Features | character counter in chat, quick devtools button |
| Custom Timestamps | example external plugin to show how the plugin system works |

---

## install

**you need:**
- Windows 10/11
- Yapin desktop client installed
- Node.js v20+

```powershell
# clone the repo, cd into it, then:
npm install
npm run install:mod
```

or use the powershell script:
```powershell
.\installer\install.ps1
```

this will:
1. find your yapper install
2. backup the original `app.asar` (so you can always revert)
3. build everything and patch the app
4. set up the plugins/themes folders

if yapper is running it'll close it first.

---

## usage

1. launch yapin/yapper
2. open **Settings** — you'll see a **Yapify** section in the sidebar under Yapin' Plus
3. click any of the tabs to open the Yapify settings window
4. `Alt+Y` also works as a shortcut
5. `Ctrl+Shift+I` / `F12` for devtools
6. `Ctrl+R` / `F5` to reload

---

## uninstall

```powershell
npm run uninstall:mod
```

this restores the original `app.asar` from backup. your client goes back to stock.

to also delete all your settings, plugins, and themes:
```powershell
node installer/uninstall.js --purge
```

---

## project structure

```
yapify/
├── src/
│   ├── main/           # electron main process hook
│   ├── preload/        # preload bridge (IPC stuff)
│   └── renderer/       # the actual UI injection
│       ├── core/       # event bus, logger, storage
│       ├── plugins/    # plugin manager + built-in plugins
│       ├── themes/     # theme loading
│       └── ui/         # settings window, styles, sidebar injection
├── example-plugins/    # template for making your own plugins
├── themes/             # CSS themes that ship with it
├── installer/          # install/uninstall scripts
├── scripts/            # build script (esbuild)
└── tests/              # basic tests
```

---

## testing

```powershell
npm test
```

---

## license

GPL-3.0
