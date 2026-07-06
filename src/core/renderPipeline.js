import { cleanHiddenJSONText } from './jsonRepair.js';

export function getMessageId($mes) {
  return $mes.attr('mesid') || $mes.data('mesid') || $mes.attr('id') || String($mes.index());
}

export function getMessageText($mes) {
  const $text = $mes.find('.mes_text').first();
  const $clone = ($text.length ? $text : $mes).clone();
  $clone.find('.rpsuite-message-blocks, .rpsuite-html-creator-generated').remove();
  const html = $text.length ? $text.html() : $mes.html();
  return `${html || ''}\n${$clone.text() || ''}`;
}

export function ensureSuiteContainer($mes, ctx = {}) {
  const $ = ctx.$ || window.jQuery;
  const id = getMessageId($mes);
  let $container = $mes.find(`.rpsuite-message-blocks[data-rpsuite-message-id="${id}"]`).first();
  if (!$container.length) {
    $container = $(`<div class="rpsuite-message-blocks" data-rpsuite-message-id="${id}"></div>`);
    const $text = $mes.find('.mes_text').first();
    if ($text.length) $text.after($container);
    else $mes.append($container);
  }
  return $container;
}

export function removeSuiteContainer($mes) {
  $mes.find('.rpsuite-message-blocks').remove();
}

export function renderModuleResults($mes, results = [], ctx = {}) {
  const $ = ctx.$ || window.jQuery;
  const sorted = [...results].filter((item) => item?.html).sort((a, b) => (a.order || 0) - (b.order || 0));
  if (!sorted.length) {
    removeSuiteContainer($mes);
    return null;
  }
  const $container = ensureSuiteContainer($mes, ctx);
  $container.empty().attr('data-rpsuite-generated', '1');
  for (const item of sorted) $container.append($(item.html).attr('data-rpsuite-module', item.id));
  return $container;
}

export function renderMessageModules($mes, ctx) {
  if (!$mes?.length || !ctx.registry) return;
  const messageText = getMessageText($mes);
  const results = [];

  for (const mod of ctx.registry.getEnabledRenderableModules()) {
    if (mod.renderMode !== 'message-block') continue;
    const mctx = ctx.registry.getModuleContext(mod.id);
    const parsed = mod.parse?.(messageText, mctx);
    if (!parsed) continue;
    const html = mod.render?.(parsed, mctx);
    if (!html) continue;
    results.push({ id: mod.id, order: mod.renderOrder, html });
  }

  renderModuleResults($mes, results, ctx);

  const htmlCreator = ctx.registry.getModule('html_creator');
  if (htmlCreator && ctx.registry.getEnabledModules().some((m) => m.id === 'html_creator')) {
    htmlCreator.wireMessage?.($mes, ctx.registry.getModuleContext('html_creator'));
  }
}

export function renderAllMessages(ctx) {
  const $ = ctx.$ || window.jQuery;
  $('.mes').each((_, mes) => renderMessageModules($(mes), ctx));
  const latestText = $('.mes').last().length ? getMessageText($('.mes').last()) : '';
  ctx.registry?.refreshFloatingModules?.(latestText);
}

export function cleanSuiteHiddenTags(text) {
  return ['rs_metrics', 'tarot_reading', 'social_comments', 'scene_state', 'wallet_state'].reduce((acc, tag) => cleanHiddenJSONText(acc, tag), text);
}