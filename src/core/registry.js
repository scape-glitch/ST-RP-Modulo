import { buildModuleContext, getModuleSettings, isModuleEnabled } from './settings.js';
import { getCurrentChatIdSafe, getModuleState } from './moduleState.js';
import * as metrics from '../modules/metrics/index.js';
import * as tarot from '../modules/tarot/index.js';
import * as comments from '../modules/comments/index.js';
import * as infoblock from '../modules/infoblock/index.js';
import * as wallet from '../modules/wallet/index.js';
import * as htmlCreator from '../modules/html_creator/index.js';

export const RENDER_ORDER = ['metrics', 'tarot', 'comments', 'infoblock'];

export function createRegistry(ctx) {
  const active = new Set();
  const modules = [
    { id: 'metrics', name: 'Metrics', icon: '📊', renderOrder: 10, renderMode: 'message-block', ...metrics },
    { id: 'tarot', name: 'Tarot', icon: '🃏', renderOrder: 20, renderMode: 'message-block', ...tarot },
    { id: 'comments', name: 'Comments', icon: '💬', renderOrder: 30, renderMode: 'message-block', ...comments },
    { id: 'infoblock', name: 'Info Block', icon: 'ℹ️', renderOrder: 40, renderMode: 'message-block', ...infoblock },
    { id: 'wallet', name: 'Wallet', icon: '💰', renderOrder: 999, renderMode: 'floating', floating: true, ...wallet },
    { id: 'html_creator', name: 'HTML Creator', icon: '🧩', renderOrder: 1000, renderMode: 'inline-html-wire', ...htmlCreator },
  ];

  const api = {
    modules,
    getModule(id) { return modules.find((m) => m.id === id); },
    getEnabledModules() { return modules.filter((m) => isModuleEnabled(m.id)); },
    getEnabledRenderableModules() { return modules.filter((m) => isModuleEnabled(m.id) && m.renderMode === 'message-block'); },
    getModuleContext(id) { return buildModuleContext(id, { ...ctx, registry: api, ApiService: ctx.ApiService }); },
    initEnabledModules() {
      for (const mod of modules) {
        if (isModuleEnabled(mod.id) && !active.has(mod.id)) {
          mod.init?.(api.getModuleContext(mod.id));
          active.add(mod.id);
        }
      }
    },
    syncModule(id) {
      const mod = api.getModule(id);
      if (!mod) return;
      if (isModuleEnabled(id) && !active.has(id)) {
        mod.init?.(api.getModuleContext(id));
        active.add(id);
      } else if (!isModuleEnabled(id) && active.has(id)) {
        mod.destroy?.(api.getModuleContext(id));
        active.delete(id);
      }
    },
    syncModules() { modules.forEach((m) => api.syncModule(m.id)); },
    destroyAll() {
      for (const id of [...active]) {
        const mod = api.getModule(id);
        mod?.destroy?.(api.getModuleContext(id));
      }
      active.clear();
    },
    refreshFloatingModules(messageText = '') {
      for (const mod of modules) {
        if (!isModuleEnabled(mod.id) || mod.renderMode !== 'floating') continue;
        const mctx = api.getModuleContext(mod.id);
        const parsed = mod.parse?.(messageText, mctx);
        const chatId = getCurrentChatIdSafe(ctx);
        const state = getModuleState(chatId, mod.id);
        mod.render?.(parsed || state?.current || null, { ...mctx, chatId, previousState: state, moduleState: state, currentState: state });
      }
    },
    getModuleSettings,
  };

  return api;
}