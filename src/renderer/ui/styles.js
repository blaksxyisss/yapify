/**
 * Yapify Core CSS Stylesheet
 * Styles for sidebar injection, inline settings panels, and all components.
 * Uses Yapin's native CSS variables for seamless integration.
 */

export const CORE_STYLES = `
/* ============================================================
   SIDEBAR INJECTION — Divider & Tab Buttons
   ============================================================ */

.settings-nav {
  scrollbar-width: thin !important;
  scrollbar-color: rgba(255, 255, 255, 0.25) transparent !important;
}

.settings-nav::-webkit-scrollbar {
  display: block !important;
  width: 5px !important;
}

.settings-nav::-webkit-scrollbar-track {
  background: transparent !important;
}

.settings-nav::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.25) !important;
  border-radius: 4px !important;
}

.yf-sidebar-divider {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 10px 4px;
  margin-top: 2px;
  user-select: none;
}

.yf-divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    var(--border, rgba(255, 255, 255, 0.15)),
    transparent
  );
}

.yf-divider-label {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 1.2px;
  text-transform: uppercase;
  color: var(--accent, #ff6b4a);
  white-space: nowrap;
  text-shadow: 0 0 12px var(--accent-soft, rgba(255, 107, 74, 0.3));
}

.yf-settings-tab {
  display: flex;
  align-items: center;
  gap: 9px;
  width: 100%;
  padding: 6px 10px;
  margin: 1px 0;
  border: none;
  border-radius: var(--radius, 6px);
  background: transparent;
  color: var(--text-muted, #9c9daa);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
  position: relative;
  overflow: hidden;
}

.yf-settings-tab::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 3px;
  height: 60%;
  border-radius: 0 3px 3px 0;
  background: var(--accent, #ff6b4a);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

.yf-settings-tab:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  color: var(--text, #ececf1);
}

.yf-settings-tab.active {
  background: var(--bg-active, rgba(255, 255, 255, 0.1));
  color: var(--text, #ececf1);
  font-weight: 600;
}

.yf-settings-tab.active::before {
  transform: translateY(-50%) scaleY(1);
}

.yf-tab-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.7;
  transition: opacity 0.15s ease;
}

.yf-settings-tab:hover .yf-tab-icon,
.yf-settings-tab.active .yf-tab-icon {
  opacity: 1;
}

/* ============================================================
   CONTENT PANEL — Inline Settings Area
   ============================================================ */

.yf-content-panel {
  width: 100%;
  height: 100%;
  overflow-y: auto;
  animation: yfFadeIn 0.2s ease;
}

.yf-panel-wrapper {
  padding: 32px 40px;
  max-width: 1100px;
  box-sizing: border-box;
}

@keyframes yfFadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: translateY(0); }
}

/* ============================================================
   TYPOGRAPHY
   ============================================================ */

.yf-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--text, #ececf1);
  margin: 0 0 4px 0;
  letter-spacing: -0.2px;
}

.yf-subtitle {
  font-size: 13px;
  color: var(--text-muted, #9c9daa);
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.yf-section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

/* ============================================================
   CARDS
   ============================================================ */

.yf-card {
  background: var(--bg-elev, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius, 10px);
  padding: 20px 24px;
  margin-bottom: 18px;
  transition: border-color 0.15s ease;
}

.yf-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.yf-card-danger {
  border-color: rgba(242, 85, 90, 0.2);
}

.yf-card-danger:hover {
  border-color: rgba(242, 85, 90, 0.35);
}

.yf-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text, #ececf1);
  margin: 0 0 6px 0;
}

.yf-card-title.danger {
  color: var(--danger, #f2555a);
}

.yf-card-desc {
  font-size: 12.5px;
  color: var(--text-muted, #9c9daa);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

/* ============================================================
   SETTING ROWS
   ============================================================ */

.yf-setting-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
}

.yf-setting-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.yf-setting-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-width: 75%;
}

.yf-setting-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text, #ececf1);
}

.yf-setting-hint {
  font-size: 12px;
  color: var(--text-muted, #9c9daa);
  line-height: 1.4;
}

/* ============================================================
   FORM CONTROLS
   ============================================================ */

/* Toggle Switch */
.yf-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.yf-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.yf-switch-track {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-active, #383944);
  transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 24px;
}

.yf-switch-track::before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
}

.yf-switch input:checked + .yf-switch-track {
  background-color: var(--accent, #ff6b4a);
}

.yf-switch input:checked + .yf-switch-track::before {
  transform: translateX(20px);
}

/* Buttons */
.yf-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 7px 14px;
  font-size: 13px;
  font-weight: 600;
  border-radius: var(--radius, 6px);
  cursor: pointer;
  border: none;
  transition: all 0.15s ease;
  background: var(--accent, #ff6b4a);
  color: white;
  white-space: nowrap;
}

.yf-btn:hover {
  filter: brightness(1.12);
  transform: translateY(-1px);
}

.yf-btn:active {
  transform: translateY(0);
}

.yf-btn.secondary {
  background: var(--bg-elev, rgba(255, 255, 255, 0.06));
  color: var(--text, #ececf1);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
}

.yf-btn.secondary:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.1));
  border-color: rgba(255, 255, 255, 0.18);
}

.yf-btn.ghost {
  background: transparent;
  color: var(--text-muted, #9c9daa);
}

.yf-btn.ghost:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  color: var(--text, #ececf1);
}

.yf-btn.danger {
  background: var(--danger, #f2555a);
  color: white;
}

.yf-btn.active {
  background: var(--accent, #ff6b4a);
  color: white;
  pointer-events: none;
  opacity: 0.9;
}

.yf-actions-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

/* Input */
.yf-input {
  background: var(--bg-input, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  color: var(--text, #ececf1);
  padding: 7px 12px;
  border-radius: var(--radius, 6px);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s ease;
}

.yf-input:focus {
  border-color: var(--accent, #ff6b4a);
}

/* Slider */
.yf-slider {
  -webkit-appearance: none;
  height: 6px;
  background: var(--bg-active, #383944);
  border-radius: 3px;
  outline: none;
}

.yf-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--accent, #ff6b4a);
  cursor: pointer;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}

/* ============================================================
   PLUGIN CARDS (2 Plugins Per Row)
   ============================================================ */

#yf-plugins-list,
#ym-plugins-list-container {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
  align-items: start;
}

@media (max-width: 768px) {
  #yf-plugins-list,
  #ym-plugins-list-container {
    grid-template-columns: 1fr;
  }
}

.yf-plugin-card {
  background: var(--bg-elev, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius, 10px);
  padding: 16px 18px;
  margin-bottom: 0;
  transition: all 0.15s ease;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.yf-plugin-card:hover {
  border-color: rgba(255, 255, 255, 0.14);
}

.yf-plugin-card.enabled {
  border-color: var(--accent-soft, rgba(255, 107, 74, 0.25));
}

.yf-plugin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
  gap: 8px;
}

.yf-plugin-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-width: 0;
}

.yf-plugin-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text, #ececf1);
  word-break: break-word;
}

.yf-chip {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  color: var(--text-muted, #9c9daa);
  font-weight: 600;
  letter-spacing: 0.3px;
}

.yf-chip.status-active {
  background: rgba(63, 207, 130, 0.12);
  color: #3fcf82;
}

.yf-chip.status-error {
  background: rgba(242, 85, 90, 0.12);
  color: #f2555a;
}

.yf-plugin-desc {
  font-size: 12.5px;
  color: var(--text-muted, #9c9daa);
  margin: 0 0 8px 0;
  line-height: 1.45;
  word-break: break-word;
}

.yf-plugin-author {
  font-size: 11.5px;
  color: var(--text-faint, rgba(255, 255, 255, 0.35));
}

.yf-plugin-error {
  color: var(--danger, #f2555a);
  font-size: 12px;
  margin-top: 8px;
  padding: 6px 8px;
  background: rgba(242, 85, 90, 0.08);
  border-radius: 4px;
  word-break: break-word;
}

.yf-plugin-settings {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

/* ============================================================
   SWATCH GRID (Accent Color Picker)
   ============================================================ */

.yf-swatch-grid, .ym-swatch-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(115px, 1fr));
  gap: 8px;
  margin-top: 10px;
}

.yf-swatch-btn, .ym-swatch-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  background: var(--bg-elev, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius, 8px);
  cursor: pointer;
  transition: all 0.15s ease;
  color: var(--text, #ececf1);
  min-width: 0;
  box-sizing: border-box;
}

.yf-swatch-name, .ym-swatch-name {
  font-size: 11px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.yf-field-row, .ym-field-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.yf-swatch-btn:hover, .ym-swatch-btn:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  border-color: rgba(255, 255, 255, 0.15);
}

.yf-swatch-btn.active, .ym-swatch-btn.active {
  border-color: var(--accent, #ff6b4a);
  background: var(--bg-active, rgba(255, 255, 255, 0.1));
  box-shadow: 0 0 0 1px var(--accent, #ff6b4a);
}

.yf-swatch-color, .ym-swatch-color {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

.yf-swatch-name, .ym-swatch-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text, #ececf1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Backwards compat for plugin renderSettings using ym- classes */
.ym-setting-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid rgba(255, 255, 255, 0.04); }
.ym-setting-row:last-child { border-bottom: none; padding-bottom: 0; }
.ym-setting-info { display: flex; flex-direction: column; gap: 2px; max-width: 75%; }
.ym-setting-title { font-size: 14px; font-weight: 500; color: var(--text, #ececf1); }
.ym-setting-desc { font-size: 12px; color: var(--text-muted, #9c9daa); line-height: 1.4; }
.ym-setting-control { flex-shrink: 0; }
.ym-switch { position: relative; display: inline-block; width: 44px; height: 24px; flex-shrink: 0; }
.ym-switch input { opacity: 0; width: 0; height: 0; }
.ym-switch-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: var(--bg-active, #383944); transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1); border-radius: 24px; }
.ym-switch-slider:before { position: absolute; content: ""; height: 18px; width: 18px; left: 3px; bottom: 3px; background-color: white; transition: 0.25s cubic-bezier(0.16, 1, 0.3, 1); border-radius: 50%; box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
.ym-switch input:checked + .ym-switch-slider { background-color: var(--accent, #ff6b4a); }
.ym-switch input:checked + .ym-switch-slider:before { transform: translateX(20px); }
.ym-input { background: var(--bg-input, rgba(255,255,255,0.06)); border: 1px solid var(--border, rgba(255,255,255,0.1)); color: var(--text, #ececf1); padding: 7px 12px; border-radius: var(--radius, 6px); font-size: 13px; outline: none; transition: border-color 0.15s ease; }
.ym-input:focus { border-color: var(--accent, #ff6b4a); }
.ym-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 7px 14px; font-size: 13px; font-weight: 600; border-radius: var(--radius, 6px); cursor: pointer; border: none; transition: all 0.15s ease; background: var(--accent, #ff6b4a); color: white; white-space: nowrap; }
.ym-btn:hover { filter: brightness(1.12); }
.ym-btn.secondary { background: var(--bg-elev, rgba(255,255,255,0.06)); color: var(--text, #ececf1); border: 1px solid var(--border, rgba(255,255,255,0.1)); }
.ym-btn.secondary:hover { background: var(--bg-hover, rgba(255,255,255,0.1)); }
.ym-btn.ghost { background: transparent; color: var(--text-muted, #9c9daa); }
.ym-btn.ghost:hover { background: var(--bg-hover, rgba(255,255,255,0.06)); color: var(--text, #ececf1); }
.ym-btn.danger { background: var(--danger, #f2555a); color: white; }
.ym-label { font-size: 13px; font-weight: 600; color: var(--text, #ececf1); margin-bottom: 6px; display: block; }
.ym-desc { font-size: 12px; color: var(--text-muted, #9c9daa); margin: 0 0 10px 0; line-height: 1.4; }
.ym-slider { -webkit-appearance: none; height: 6px; background: var(--bg-active, #383944); border-radius: 3px; outline: none; }
.ym-slider::-webkit-slider-thumb { -webkit-appearance: none; width: 16px; height: 16px; border-radius: 50%; background: var(--accent, #ff6b4a); cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.3); }
.ym-field-row { display: flex; align-items: center; gap: 10px; }
.ym-plugin-settings-block { padding: 4px 0; }

/* ============================================================
   LOG TERMINAL
   ============================================================ */

.yf-log-terminal {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: var(--radius, 8px);
  padding: 16px;
  font-family: 'Consolas', 'SF Mono', 'Courier New', monospace;
  font-size: 12px;
  height: 420px;
  overflow-y: auto;
  color: var(--text-muted, #c9cdd4);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}

/* ============================================================
   EMPTY STATES
   ============================================================ */

.yf-empty-state {
  text-align: center;
  padding: 48px 24px;
  color: var(--text-muted, #9c9daa);
}

.yf-empty-state p {
  margin: 12px 0 18px;
  font-size: 14px;
}

.yf-empty-hint {
  padding: 16px 0;
  color: var(--text-muted, #9c9daa);
  font-size: 13px;
  line-height: 1.5;
}

.yf-empty-hint code {
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
  font-family: 'Consolas', 'SF Mono', monospace;
}

/* ============================================================
   VERSION FOOTER
   ============================================================ */

.yf-version-footer {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  font-size: 11px;
  color: var(--text-faint, rgba(255, 255, 255, 0.25));
  text-align: center;
}

/* ============================================================
   TOAST SYSTEM
   ============================================================ */

.yf-toast-container {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 200000;
  display: flex;
  flex-direction: column;
  gap: 8px;
  pointer-events: none;
}

.yf-toast {
  padding: 10px 18px;
  background: var(--bg-rail, rgba(20, 21, 25, 0.95));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 8px;
  color: var(--text, #ececf1);
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
  animation: yfToastIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  pointer-events: auto;
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}

.yf-toast.success {
  border-left: 3px solid #3fcf82;
}

.yf-toast.error {
  border-left: 3px solid #f2555a;
}

.yf-toast.warning {
  border-left: 3px solid #f5b544;
}

@keyframes yfToastIn {
  from { opacity: 0; transform: translateY(12px) scale(0.96); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

/* ============================================================
   SETTINGS MODAL — Standalone Overlay Window
   ============================================================ */

.ym-modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.25s ease;
}

.ym-modal-overlay.open {
  opacity: 1;
  pointer-events: auto;
}

.ym-modal-container {
  width: min(94vw, 1060px);
  height: min(88vh, 680px);
  background: var(--bg-base, #1a1b1f);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.1));
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.04);
  transform: scale(0.96) translateY(8px);
  transition: transform 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.ym-modal-overlay.open .ym-modal-container {
  transform: scale(1) translateY(0);
}

/* Header */
.ym-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  background: var(--bg-elev, rgba(255, 255, 255, 0.02));
  flex-shrink: 0;
}

.ym-header-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.ym-logo-badge {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.8px;
  text-transform: uppercase;
  color: #fff;
  background: linear-gradient(135deg, var(--accent, #ff6b4a), #c850c0);
  padding: 4px 10px;
  border-radius: 6px;
}

.ym-header-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text, #ececf1);
  margin: 0;
}

.ym-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted, #9c9daa);
  cursor: pointer;
  transition: all 0.15s ease;
}

.ym-close-btn:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.08));
  color: var(--text, #ececf1);
}

/* Body — sidebar + content */
.ym-modal-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}

/* Sidebar Nav */
.ym-modal-nav {
  width: 180px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  padding: 12px;
  gap: 2px;
  border-right: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  background: var(--bg-elev, rgba(255, 255, 255, 0.015));
  overflow-y: auto;
}

.ym-nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 9px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-muted, #9c9daa);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.ym-nav-item svg {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  opacity: 0.6;
  transition: opacity 0.15s ease;
}

.ym-nav-item:hover {
  background: var(--bg-hover, rgba(255, 255, 255, 0.06));
  color: var(--text, #ececf1);
}

.ym-nav-item:hover svg {
  opacity: 0.9;
}

.ym-nav-item.active {
  background: var(--bg-active, rgba(255, 255, 255, 0.1));
  color: var(--text, #ececf1);
  font-weight: 600;
}

.ym-nav-item.active svg {
  opacity: 1;
}

.ym-nav-footer {
  margin-top: auto;
  padding: 12px;
  font-size: 10px;
  color: var(--text-faint, rgba(255, 255, 255, 0.2));
  line-height: 1.5;
}

/* Content area */
.ym-modal-content {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px;
}

/* Tab Panes */
.ym-tab-pane {
  display: none;
}

.ym-tab-pane.active {
  display: block;
  animation: yfFadeIn 0.2s ease;
}

/* Typography */
.ym-pane-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text, #ececf1);
  margin: 0 0 4px 0;
  letter-spacing: -0.2px;
}

.ym-pane-subtitle {
  font-size: 13px;
  color: var(--text-muted, #9c9daa);
  margin: 0 0 24px 0;
  line-height: 1.5;
}

/* Cards */
.ym-card {
  background: var(--bg-elev, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  padding: 20px 24px;
  margin-bottom: 18px;
  transition: border-color 0.15s ease;
}

.ym-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
}

.ym-card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text, #ececf1);
  margin: 0 0 6px 0;
}

.ym-card-desc {
  font-size: 12.5px;
  color: var(--text-muted, #9c9daa);
  margin: 0 0 16px 0;
  line-height: 1.5;
}

/* Plugin Cards */
.ym-plugin-card {
  background: var(--bg-elev, rgba(255, 255, 255, 0.03));
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 10px;
  padding: 16px 18px;
  margin-bottom: 0;
  transition: all 0.15s ease;
  min-width: 0;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.ym-plugin-card:hover {
  border-color: rgba(255, 255, 255, 0.14);
}

.ym-plugin-card.active {
  border-color: var(--accent-soft, rgba(255, 107, 74, 0.25));
}

.ym-plugin-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.ym-plugin-title-wrap {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.ym-plugin-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text, #ececf1);
}

.ym-plugin-chip {
  font-size: 10px;
  padding: 2px 6px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  color: var(--text-muted, #9c9daa);
  font-weight: 600;
  letter-spacing: 0.3px;
}

.ym-plugin-chip.status-active {
  background: rgba(63, 207, 130, 0.12);
  color: #3fcf82;
}

.ym-plugin-chip.status-error {
  background: rgba(242, 85, 90, 0.12);
  color: #f2555a;
}

.ym-plugin-desc {
  font-size: 13px;
  color: var(--text-muted, #9c9daa);
  margin: 0 0 8px 0;
  line-height: 1.45;
}

.ym-plugin-author {
  font-size: 11.5px;
  color: var(--text-faint, rgba(255, 255, 255, 0.35));
}

.ym-plugin-settings-toggle {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

/* Log terminal */
.ym-log-terminal {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid var(--border, rgba(255, 255, 255, 0.08));
  border-radius: 8px;
  padding: 16px;
  font-family: 'Consolas', 'SF Mono', 'Courier New', monospace;
  font-size: 12px;
  height: 380px;
  overflow-y: auto;
  color: var(--text-muted, #c9cdd4);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.6;
}

/* ============================================================
   CUSTOM DROPDOWN COMPONENT
   ============================================================ */

.yf-custom-dropdown {
  position: relative;
  display: inline-block;
  user-select: none;
  font-family: inherit;
}

.yf-dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text, #f4f4f7);
  cursor: pointer;
  outline: none;
  transition: all 0.15s ease;
  box-sizing: border-box;
}

.yf-dropdown-trigger:hover {
  background: rgba(255, 255, 255, 0.11);
  border-color: rgba(255, 255, 255, 0.22);
}

.yf-custom-dropdown.is-open .yf-dropdown-trigger {
  border-color: var(--accent, #5865f2);
  background: rgba(255, 255, 255, 0.12);
  box-shadow: 0 0 0 2px rgba(88, 101, 242, 0.25);
}

.yf-dropdown-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: left;
}

.yf-dropdown-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted, #9294a1);
  transition: transform 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  flex-shrink: 0;
}

.yf-custom-dropdown.is-open .yf-dropdown-arrow {
  transform: rotate(180deg);
  color: var(--accent, #5865f2);
}

.yf-dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: #18191e;
  border: 1px solid rgba(255, 255, 255, 0.14);
  border-radius: 8px;
  padding: 5px;
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.65), 0 2px 8px rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  z-index: 999999;
  opacity: 0;
  visibility: hidden;
  transform: translateY(-6px) scale(0.98);
  transition: opacity 0.15s cubic-bezier(0.16, 1, 0.3, 1), transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.15s;
  box-sizing: border-box;
}

.yf-dropdown-menu.is-open {
  opacity: 1;
  visibility: visible;
  transform: translateY(0) scale(1);
}

.yf-dropdown-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  color: var(--text-muted, #b5b7c2);
  cursor: pointer;
  transition: all 0.12s ease;
}

.yf-dropdown-item:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text, #ffffff);
}

.yf-dropdown-item.is-selected {
  background: rgba(88, 101, 242, 0.16);
  color: var(--accent, #7289da);
  font-weight: 600;
}

.yf-dropdown-check {
  display: none;
  color: var(--accent, #5865f2);
  flex-shrink: 0;
}

.yf-dropdown-item.is-selected .yf-dropdown-check {
  display: flex;
}
`;
