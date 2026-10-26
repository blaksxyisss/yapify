/**
 * Lightweight EventBus for YapinMod Renderer
 */
class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event).add(callback);
    return () => this.off(event, callback);
  }

  off(event, callback) {
    const list = this.listeners.get(event);
    if (list) {
      list.delete(callback);
      if (list.size === 0) this.listeners.delete(event);
    }
  }

  emit(event, ...args) {
    const list = this.listeners.get(event);
    if (list) {
      for (const cb of list) {
        try {
          cb(...args);
        } catch (err) {
          console.error(`[YapinMod] Error in event listener for '${event}':`, err);
        }
      }
    }
  }
}

export const events = new EventBus();
