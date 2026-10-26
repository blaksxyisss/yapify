/**
 * Example External Plugin: Custom Timestamps
 */

module.exports = {
  id: 'custom-timestamp',
  name: 'Custom Timestamps',
  version: '1.0.0',
  author: 'Community Modder',
  description: 'Enhances chat message timestamps with customizable 24-hour format and exact relative times.',

  onStart(api) {
    api.logger.info('Custom Timestamps plugin loaded successfully!');
    api.ui.injectStyle('ts-badge', `
      time, [class*="timestamp"] {
        font-feature-settings: "tnum";
        font-variant-numeric: tabular-nums;
        opacity: 0.85;
      }
    `);
    api.ui.showToast('Custom Timestamps activated', 'info');
  },

  onStop(api) {
    api.logger.info('Custom Timestamps plugin stopped');
    api.ui.removeStyle('ts-badge');
  }
};
