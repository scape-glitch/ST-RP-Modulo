import { EXTENSION_NAME, initSettings } from './src/core/settings.js';
import { ApiService } from './src/core/apiService.js';
import { createRegistry } from './src/core/registry.js';
import { initDrawer } from './src/ui/drawer.js';
import { initEvents } from './src/core/events.js';
import { initPromptInjection, updateExtensionPrompt } from './src/core/promptInjection.js';
import { renderAllMessages } from './src/core/renderPipeline.js';
import { loadSuiteStyles } from './src/core/storage.js';

function getExtensionFolderPath() {
  const url = new URL(import.meta.url);
  return url.href.replace(/\/index\.js(?:\?.*)?$/, '');
}

async function initRpSuite() {
  const $ = window.jQuery;
  if (!$ || !window.SillyTavern?.getContext) {
    setTimeout(initRpSuite, 250);
    return;
  }
  const ctx = {
    $,
    extensionName: EXTENSION_NAME,
    extensionFolderPath: getExtensionFolderPath(),
    ApiService,
    get stContext() { return window.SillyTavern.getContext(); },
  };
  initSettings();
  loadSuiteStyles(ctx);
  ctx.registry = createRegistry(ctx);
  await initDrawer(ctx);
  ctx.registry.initEnabledModules();
  initPromptInjection(ctx);
  initEvents(ctx);
  updateExtensionPrompt(ctx);
  renderAllMessages(ctx);
  console.info('[RP Suite] initialized');
}

jQuery(initRpSuite);
