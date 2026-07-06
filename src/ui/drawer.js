import { LANGS, t, moduleDisplayName } from '../core/i18n.js';
import { getSettings, updateModuleSettings, normalizeConnectionProfiles } from '../core/settings.js';
import { renderAllMessages } from '../core/renderPipeline.js';
import { removeModuleFromCurrentMessage, rerenderTarotThemeOnly, runModuleForCurrentMessage } from '../core/moduleRunner.js';
import { updateExtensionPrompt } from '../core/promptInjection.js';
import { option, escapeHtml } from './controls.js';

function getUiLang() {
  return getSettings().modules?.metrics?.lang || 'ru';
}

function renderModuleCard(mod, ctx) {
  const lang = getUiLang();
  const settings = getSettings().modules[mod.id];
  const profiles = ctx.ApiService.getConnectionProfiles();
  const selectedProfile = ctx.ApiService.getConnectionProfile(settings.connectionProfile);
  const profileOptions = profiles.length
    ? profiles.map((profile) => option(profile.name, `${profile.name} · ${profile.model || t('unknownModel', lang)}`, selectedProfile?.name || '')).join('')
    : `<option>${escapeHtml(t('noProfiles', lang))}</option>`;
  const deck = mod.id === 'tarot'
    ? `<div class="rpsuite-field"><label>${escapeHtml(t('deckStyle', lang))}</label><select class="rpsuite-deck-select" data-module-id="tarot">${option('classic', 'Black', settings.deckStyle)}${option('alternate', 'Pink', settings.deckStyle)}</select></div>`
    : '';

  return `<section class="rpsuite-module" data-module-id="${escapeHtml(mod.id)}">
    <div class="rpsuite-module-head">
      <div class="rpsuite-module-name"><span class="rpsuite-module-icon">${mod.icon}</span><span>${escapeHtml(moduleDisplayName(mod.id, lang))}</span></div>
      <label><input type="checkbox" class="rpsuite-enabled-toggle" data-module-id="${escapeHtml(mod.id)}" ${settings.enabled ? 'checked' : ''}> ${escapeHtml(t('enabled', lang))}</label>
    </div>
    <div class="rpsuite-grid">
      <div class="rpsuite-field"><label>${escapeHtml(t('language', lang))}</label><select class="rpsuite-lang-select" data-module-id="${escapeHtml(mod.id)}">${LANGS.map((item) => option(item.value, item.label, settings.lang)).join('')}</select></div>
      <div class="rpsuite-field"><label>${escapeHtml(t('profile', lang))}</label><select class="rpsuite-profile-select" data-module-id="${escapeHtml(mod.id)}" ${profiles.length ? '' : 'disabled'}>${profileOptions}</select><span class="rpsuite-profile-model">${escapeHtml(t('model', lang))}: ${escapeHtml(selectedProfile?.model || t('unknownModel', lang))}</span></div>
      ${deck}
    </div>
  </section>`;
}

export async function initDrawer(ctx) {
  const $ = ctx.$ || window.jQuery;
  if (!$('#rpsuite-root').length) {
    const settingsHtml = await $.get(`${ctx.extensionFolderPath}/index.html`);
    if ($('#extensions_settings2').length) $('#extensions_settings2').append(settingsHtml);
    else $('#extensions_settings').append(settingsHtml);
  }
  renderDrawer(ctx);
  bindDrawer(ctx);
}

export function renderDrawer(ctx) {
  const $ = ctx.$ || window.jQuery;
  normalizeConnectionProfiles();
  const lang = getUiLang();
  const profiles = ctx.ApiService.getConnectionProfiles();
  $('#rpsuite-root [data-i18n="subtitle"]').text(t('subtitle', lang));
  $('#rpsuite-profile-warning').prop('hidden', !!profiles.length).text(t('noProfiles', lang));
  $('#rpsuite-modules').html(ctx.registry.modules.map((mod) => renderModuleCard(mod, ctx)).join(''));
}

function bindDrawer(ctx) {
  const $ = ctx.$ || window.jQuery;
  const refreshModulePrompt = () => {
    updateExtensionPrompt(ctx);
  };
  $('#rpsuite-root').off('.rpsuite');
  $('#rpsuite-root').on('change.rpsuite', '.rpsuite-enabled-toggle', function () {
    const moduleId = this.dataset.moduleId;
    updateModuleSettings(moduleId, { enabled: this.checked });
    ctx.registry.syncModule(moduleId);
    refreshModulePrompt();
    if (this.checked) {
      runModuleForCurrentMessage(ctx, moduleId, { force: false }).catch((error) => console.error('[RP Suite] module enable render/generate failed:', error));
      if (moduleId === 'html_creator') ctx.registry.getModule('html_creator')?.wireAll?.(ctx.registry.getModuleContext('html_creator'));
    } else {
      removeModuleFromCurrentMessage(ctx, moduleId);
    }
    renderDrawer(ctx);
  });
  $('#rpsuite-root').on('change.rpsuite', '.rpsuite-lang-select', function () {
    const moduleId = this.dataset.moduleId;
    updateModuleSettings(moduleId, { lang: this.value });
    refreshModulePrompt();
    runModuleForCurrentMessage(ctx, moduleId, { force: true }).catch((error) => console.error('[RP Suite] language-triggered module rerun failed:', error));
    renderDrawer(ctx);
  });
  $('#rpsuite-root').on('change.rpsuite', '.rpsuite-profile-select', function () {
    const moduleId = this.dataset.moduleId;
    updateModuleSettings(moduleId, { connectionProfile: this.value });
    refreshModulePrompt();
    runModuleForCurrentMessage(ctx, moduleId, { force: true }).catch((error) => console.error('[RP Suite] profile-triggered module rerun failed:', error));
    renderDrawer(ctx);
  });
  $('#rpsuite-root').on('change.rpsuite', '.rpsuite-deck-select', function () {
    updateModuleSettings('tarot', { deckStyle: this.value });
    refreshModulePrompt();
    if (!rerenderTarotThemeOnly(ctx)) {
      runModuleForCurrentMessage(ctx, 'tarot', { force: false }).catch((error) => console.error('[RP Suite] tarot cached render/generate failed:', error));
    }
    renderDrawer(ctx);
  });
}