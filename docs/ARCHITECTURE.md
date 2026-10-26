# YapinMod Architecture & Reverse Engineering Report

## 1. Executive Summary

YapinMod is a client-side local modification framework for the **Yapin.gg** Windows desktop client (internal package name `yapper-desktop`, executable `Yapper.exe`).

Similar to **Vencord** for Discord, YapinMod augments the desktop client without replacing the core application or requiring custom servers. It provides:
- A modular, isolated plugin architecture with runtime error boundaries.
- Dynamic theme and accent color customizers modifying live CSS custom properties.
- An integrated settings interface styled after Yapin's native aesthetic.
- A secure IPC bridge between the Electron Main process and the isolated Renderer process.
- Developer inspection tools (`Ctrl+Shift+I` / `F12`) previously absent from the client.
- 100% reversible installation with cryptographic backup and rollback verification.

---

## 2. Target Application Inspection

### 2.1 Runtime & Framework Identification
- **Runtime**: Electron 38.8.6
- **Chromium Engine**: 140.0.7339.249
- **Node.js**: v22.22.0
- **Target OS**: Windows x64 (`win32`)
- **Executable Location**: `C:\Users\<user>\AppData\Local\Programs\yapper-desktop\Yapper.exe`
- **Application Archive**: `resources\app.asar` (2,260,815 bytes)
- **Unpacked Modules**: `resources\app.asar.unpacked\node_modules\uiohook-napi`

### 2.2 Package Manifest (`package.json`)
```json
{
  "name": "yapper-desktop",
  "productName": "Yapper",
  "version": "1.1.0",
  "description": "Yapin’ for Windows and Linux",
  "main": "main.js",
  "desktopName": "yapper-desktop.desktop",
  "private": true,
  "author": "Yapper",
  "homepage": "https://www.yapper.website",
  "dependencies": {
    "electron-updater": "^6.6.2",
    "uiohook-napi": "^1.5.5"
  }
}
```

### 2.3 Main Process Architecture (`main.js`)
- Enforces single-instance lock via `app.requestSingleInstanceLock()`.
- Sets default protocol handler for `yapper://`.
- Loads the remote client: `const SITE = 'https://www.yapper.website'; win.loadURL(SITE);`.
- Navigation lockdown: restricts navigation to whitelist `ALLOWED = new Set(['www.yapin.gg', 'yapin.gg', 'www.yapper.website', 'yapper.website', 'rt.yapper.website', 'lk.yapper.website'])`.
- Global hotkey listener: leverages `uiohook-napi` to detect Push-to-Talk and Mute/Deafen key combinations while gaming.
- Process polling: monitors running Windows processes to display "Playing X" rich activity.
- Window management: `closeToTray: true` by default, minimizing to Windows system notification area.
- Disables standard application menus (`Menu.setApplicationMenu(null)`).

### 2.4 Renderer & Security Context
- In `createWindow()`:
  ```js
  webPreferences: {
    preload: path.join(__dirname, 'preload.js'),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    spellcheck: true,
    backgroundThrottling: false,
  }
  ```
- **Security Implications**:
  1. `contextIsolation: true`: Scripts in the preload script execute in a separate JS context from the web page.
  2. `sandbox: true`: Node.js APIs are blocked from the renderer process; only Electron's limited sandboxed preload subset (`contextBridge`, `ipcRenderer`, `webFrame`) is accessible.
  3. Content Security Policy (CSP): The web app is served by Vercel; response headers do not enforce a strict CSP, allowing dynamic CSS injection and DOM extension.
  4. Web Framework: The UI is built with **Next.js (React)** with Turbopack bundling. The design system uses standardized CSS custom properties (`--bg-rail`, `--bg-side`, `--bg-main`, `--bg-elev`, `--accent`, `--radius`, `--text`), making dynamic re-theming seamless.

---

## 3. Modding Architecture & Engineering Strategy

### 3.1 Architecture Evaluation

| Approach | Feasibility | Advantages | Risks / Drawbacks | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **A. Unpacked `resources/app` folder** | Tested | Leaves `app.asar` unmodified | In Electron 38 packaged with electron-builder, ASAR takes priority | Secondary / Fallback |
| **B. Chrome DevTools Protocol (CDP) Remote Injection** | Experimental | No file modifications | Requires launching with `--remote-debugging-port`, fragile, breaks tray autostart | Rejected |
| **C. Patched `app.asar` (Vencord Method)** | **Proven** | 100% reliable, zero external processes, supports both main & renderer hooks | Requires backup and repacking script | **Selected (Primary)** |

### 3.2 Dual-Layer Architecture

YapinMod employs a dual-layer architecture:

```
[ Electron Main Process ] (main.js)
       │
       ├── YapinMod Main Hook (src/main/index.js)
       │     ├── Config Storage (%APPDATA%/YapinMod/config.json)
       │     ├── Plugin Discovery (%APPDATA%/YapinMod/plugins)
       │     ├── Theme Discovery (%APPDATA%/YapinMod/themes)
       │     ├── Diagnostic Logger (yapinmod.log)
       │     ├── Developer Keybindings (Ctrl+Shift+I, F12, F5)
       │     └── IPC Channel Handlers ('yapinmod:*')
       │
[ Chromium Preload Context ] (preload.js)
       │
       └── YapinMod Preload Bridge (src/preload/index.js)
             └── contextBridge.exposeInMainWorld('yapinmodBridge', ...)
                   │ (Channel Whitelisting & IPC Sanitization)
                   ▼
[ Yapin Web Application (Main World) ] (https://www.yapin.gg)
       │
       └── YapinMod Renderer Bundle (src/renderer/index.js)
             ├── Plugin Manager (Lifecycle hooks, error boundaries)
             │     ├── Plugin A: Custom Accent Colors
             │     ├── Plugin B: UI Tweaks & Polish
             │     ├── Plugin C: Quality of Life (QoL)
             │     └── Community Plugins (from disk)
             ├── Theme Manager (CSS stylesheets & variable overrides)
             ├── Settings Modal (Overview, Plugins, Themes, Logs)
             ├── UI Injector (Navigation gear button, Toast alerts)
             └── Global Developer API (window.YapinMod)
```

### 3.3 Security & Sandbox Preservation
- `contextIsolation` and `sandbox` remain enabled.
- Untrusted web content is never given arbitrary Node.js filesystem access.
- All disk access (loading plugins, saving settings, reading themes) is routed through strictly sanitized IPC handlers in the main process with path validation.
- Every plugin runs within a JavaScript `try / catch` error boundary. A faulty plugin records its stack trace in the diagnostic log and is safely disabled without crashing the Yapin client.
