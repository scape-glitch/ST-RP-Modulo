import { cleanHiddenJSONText } from './jsonRepair.js';
import { getCurrentChatIdSafe, getMessageRenderKey, getModuleState } from './moduleState.js';

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

export function removeModuleResult($mes, moduleId, ctx = {}) {
  const $ = ctx.$ || window.jQuery;
  if (!$mes?.length) return;
  $mes.find(`.rpsuite-message-blocks [data-rpsuite-module="${moduleId}"]`).remove();
  $mes.find(`.rpsuite-html-creator-generated[data-rpsuite-module="${moduleId}"]`).remove();
  const $container = $mes.find('.rpsuite-message-blocks').first();
  if ($container.length && !$container.children().length) $container.remove();
}

function getStateForMessage(storedState, moduleId, messageId) {
  if (!storedState) return null;
  if (moduleId === 'comments') return storedState.sections?.[String(messageId)] ? storedState : null;
  const byMessage = storedState.byMessage?.[String(messageId)];
  if (byMessage) return byMessage.stateAfter || { ...storedState, current: byMessage.parsed || byMessage };
  const entry = Array.isArray(storedState.history)
    ? storedState.history.find((item) => String(item.messageId) === String(messageId))
    : null;
  if (!entry) return null;
  const { messageId: _messageId, ts: _ts, ...current } = entry;
  return { ...storedState, current };
}

export function renderMessageModules($mes, ctx) {
  if (!$mes?.length || !ctx.registry) return;
  const messageText = getMessageText($mes);
  const results = [];

  for (const mod of ctx.registry.getEnabledRenderableModules()) {
    if (mod.renderMode !== 'message-block') continue;
    const mctx = ctx.registry.getModuleContext(mod.id);
    const parsed = mod.parse?.(messageText, mctx);
    const messageId = getMessageRenderKey($mes, { ...ctx, messageText });
    const chatId = getCurrentChatIdSafe(ctx);
    const storedState = getModuleState(chatId, mod.id);
    const stateForMessage = getStateForMessage(storedState, mod.id, messageId);
    const cached = mod.id === 'comments' ? storedState?.sections?.[messageId] : storedState?.byMessage?.[messageId];
    const cachedParsed = mod.id === 'comments' ? cached?.generatedComments : cached?.parsed;
    const renderCtx = { ...mctx, chatId, messageId, previousState: storedState, moduleState: stateForMessage || storedState, currentState: stateForMessage };
    if (!parsed && !stateForMessage) continue;
    const html = mod.render?.(parsed || cachedParsed, renderCtx);
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