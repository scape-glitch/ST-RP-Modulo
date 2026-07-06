import { cleanHiddenJSONText } from './jsonRepair.js';

function getMessageId($mes) {
  return $mes.attr('mesid') || $mes.data('mesid') || $mes.attr('id') || String($mes.index());
}

function getMessageText($mes) {
  const $text = $mes.find('.mes_text').first();
  const html = $text.length ? $text.html() : $mes.html();
  const text = $text.length ? $text.text() : $mes.text();
  return `${html || ''}\n${text || ''}`;
}

function ensureSuiteContainer(ctx, $mes) {
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

export function renderMessageModules($mes, ctx) {
  const $ = ctx.$ || window.jQuery;
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

  results.sort((a, b) => a.order - b.order);
  const $container = ensureSuiteContainer(ctx, $mes);
  $container.empty();
  for (const item of results) $container.append($(item.html));
  if (!results.length) $container.remove();

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