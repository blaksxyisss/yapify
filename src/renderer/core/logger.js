/**
 * Diagnostic Logger for YapinMod Renderer
 * Logs to browser console, keeps an in-memory buffer for the UI log viewer,
 * and synchronizes with the main process log file.
 */

class Logger {
  constructor() {
    this.logs = [];
    this.maxLogs = 300;
  }

  log(level, message, meta = null) {
    const timestamp = new Date().toLocaleTimeString();
    const entry = { timestamp, level, message, meta };
    this.logs.push(entry);
    if (this.logs.length > this.maxLogs) this.logs.shift();

    const prefix = `%c[Yapify]%c [${level.toUpperCase()}]`;
    const style1 = 'color: #ff6b4a; font-weight: bold;';
    const style2 = level === 'error' ? 'color: #f2555a; font-weight: bold;' : level === 'warn' ? 'color: #f5b544; font-weight: bold;' : 'color: #9c9daa;';

    if (level === 'error') {
      console.error(prefix, style1, style2, message, meta || '');
    } else if (level === 'warn') {
      console.warn(prefix, style1, style2, message, meta || '');
    } else {
      console.log(prefix, style1, style2, message, meta || '');
    }

    if (window.yapinmodBridge?.send) {
      window.yapinmodBridge.send('yapinmod:log', level, message, meta);
    }
  }

  info(msg, meta) { this.log('info', msg, meta); }
  warn(msg, meta) { this.log('warn', msg, meta); }
  error(msg, meta) { this.log('error', msg, meta); }
  debug(msg, meta) { this.log('debug', msg, meta); }

  getRecentLogs() {
    return [...this.logs];
  }

  clear() {
    this.logs = [];
  }
}

export const logger = new Logger();
