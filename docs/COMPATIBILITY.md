# Compatibility, Updates & Limitations

## 1. Version Compatibility Matrix

| Component | Target Version | Tested Status | Notes |
| :--- | :--- | :--- | :--- |
| **Yapin / Yapper** | `1.1.0` | **Fully Supported** | Tested on live Windows installation |
| **Electron Runtime**| `38.8.6` | **Fully Supported** | Preserves contextIsolation & sandbox |
| **Chromium Engine** | `140.0.7339.249`| **Fully Supported** | Modern CSS custom properties support |
| **Node.js** | `>= 20.x` | **Fully Supported** | Native Node build tools |
| **Operating System**| Windows 10/11 x64 | **Fully Supported** | Automated PowerShell installer included |

---

## 2. Handling Application Updates

The Yapin client uses `electron-updater` configured to pull releases from `https://www.yapper.website/download`.

### What happens when Yapin updates?
1. `electron-updater` downloads a new version of `app.asar` into the app directory and restarts the client.
2. The auto-update overwrites `resources\app.asar` with the fresh vanilla version.
3. Your custom settings, active themes, and installed community plugins located in `%APPDATA%\YapinMod\` are **never modified or deleted** by Yapin updates.
4. To re-apply YapinMod after an official Yapin client update:
   Simply run the installer once:
   ```powershell
   npm run install:mod
   ```
   Or right-click `installer\install.ps1` and select **Run with PowerShell**.

---

## 3. Security Boundaries & Limitations

Throughout the design and implementation of YapinMod, strict security principles are observed:

- **No Remote Telemetry**: YapinMod does not collect or transmit user information, passwords, authentication tokens, cookies, or chat messages to any remote server.
- **Local-Only Execution**: All plugin manifests, themes, and configuration files reside strictly on your local disk in `%APPDATA%\YapinMod\`.
- **Sandbox Preservation**: Electron's `sandbox: true` and `contextIsolation: true` flags remain active. Privileged Node.js APIs are not exposed to the renderer.
- **Reversible Modifications**: The pristine official `app.asar` is backed up before applying any changes, enabling instant 1-click rollback via `npm run uninstall:mod`.
- **Safe Mode**: In the event that a third-party plugin causes issues, Safe Mode can be toggled in settings (or by launching with `--safe-mode`) to pause all plugins on startup.
