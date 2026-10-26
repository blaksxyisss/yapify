/**
 * YapinMod - Preload Script Bridge (IIFE Scoped)
 * Safely exposes the `yapinmodBridge` API into the page's main world via `contextBridge`.
 * Maintains strict channel filtering to prevent unauthorized IPC access.
 */

(() => {
  const { contextBridge, ipcRenderer } = require('electron');

  const ALLOWED_CHANNELS = new Set([
    'yapinmod:get-config',
    'yapinmod:save-config',
    'yapinmod:list-plugins',
    'yapinmod:load-plugin-code',
    'yapinmod:list-themes',
    'yapinmod:get-theme-css',
    'yapinmod:open-folder',
    'yapinmod:get-logs',
    'yapinmod:toggle-devtools',
    'yapinmod:reload-renderer',
    'yapinmod:log',
    'yapinmod:toggle-settings',
    'yapinmod:window-action',
    'yapinmod:set-window-mode',
    'yapinmod:get-window-mode'
  ]);

  function isAllowed(channel) {
    return typeof channel === 'string' && (channel.startsWith('yapinmod:') && ALLOWED_CHANNELS.has(channel));
  }

  try {
    contextBridge.exposeInMainWorld('yapinmodBridge', {
      version: '1.0.0',
      platform: process.platform,

      /**
       * Send an asynchronous message to the main process and receive a Promise response
       */
      invoke: (channel, ...args) => {
        if (!isAllowed(channel)) {
          return Promise.reject(new Error(`[YapinMod] Unauthorized IPC channel: ${channel}`));
        }
        return ipcRenderer.invoke(channel, ...args);
      },

      /**
       * Send a one-way message to the main process
       */
      send: (channel, ...args) => {
        if (!isAllowed(channel)) {
          console.warn(`[YapinMod] Blocked unauthorized send: ${channel}`);
          return;
        }
        ipcRenderer.send(channel, ...args);
      },

      /**
       * Listen for events from the main process
       */
      on: (channel, callback) => {
        if (!isAllowed(channel) || typeof callback !== 'function') return () => {};
        const subscription = (_event, ...args) => callback(...args);
        ipcRenderer.on(channel, subscription);
        return () => ipcRenderer.removeListener(channel, subscription);
      }
    });

    console.log('[YapinMod] Preload bridge successfully initialized');
  } catch (err) {
    console.error('[YapinMod] Failed to expose preload bridge:', err);
  }
})();
