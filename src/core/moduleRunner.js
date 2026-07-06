import { isModuleEnabled } from './settings.js';
import { getMessageId, renderModuleResults } from './renderPipeline.js';
import { getCurrentChatIdSafe, getModuleState, setModuleState } from './moduleState.js';

const messageStates = new Map();
const RECENT_CONTEXT_LIMIT = 5;

function get$fromCtx(ctx) {
  return ctx.$ || window.jQuery;
}

function isUserMessage($mes) {
  return $mes.hasClass('is_user')
    || $mes.attr('is_user') === 'true'
    || $mes.data('is_user') === true
    || $mes.find('.mes_text_user').length > 0;
}

function isAssistantMessage($mes) {
  return !!$mes?.length && !isUserMessage($mes);
}

function getVisibleMessageText($mes) {
  const $text = $mes.find('.mes_text').first();
  const $source = $text.length ? $text.clone() : $mes.clone();
  $source.find('.rpsuite-message-blocks, .rpsuite-html-creator-generated, .rpsuite-hidden-source').remove();
  return $source.text().replace(/\s+/g, ' ').trim();
}

function getMessageRole($mes) {
  return isUserMessage($mes) ? 'user' : 'assistant';
}

function getRecentContext($mes) {
  const rows = [];
  const previous = $mes.prevAll('.mes').toArray().reverse().slice(-RECENT_CONTEXT_LIMIT);
  for (const mes of previous) {
    const $prev = window.jQuery(mes);
    const text = getVisibleMessageText($prev);
    if (!text) continue;
    rows.push(`${getMessageRole($prev)}: ${text}`);
  }
  return rows.join('\n\n');
}

function getNames(ctx) {
  const st = ctx.stContext || window.SillyTavern?.getContext?.() || {};
  return {
    character: st.name2 || st.characterName || st.chat?.[st.chat?.length - 1]?.name || '',
    user: st.name1 || st.userName || '',
    chat: st.chat_metadata?.name || st.chatId || '',
  };
}

function clone(value) {
  if (value === undefined) return undefined;
  try { return JSON.parse(JSON.stringify(value)); } catch (_) { return value; }
}

function isEmptyState(value) {
  return !value || (typeof value === 'object' && !Array.isArray(value) && !Object.keys(value).length);
}

function getPreviousState(mod, chatId) {
  const stored = getModuleState(chatId, mod.id);
  if (!isEmptyState(stored)) return stored;
  return typeof mod.getDefaultState === 'function' ? mod.getDefaultState() : (stored || null);
}

function formatStateForPrompt(state) {
  try { return JSON.stringify(state ?? null, null, 2); } catch (_) { return 'null'; }
}

export function buildModuleUserPayload($mes, moduleCtx = {}) {
  const names = getNames(moduleCtx);
  const latest = moduleCtx.messageText || getVisibleMessageText($mes);
  const recent = getRecentContext($mes);
  const previous = moduleCtx.previousState !== undefined
    ? `\n\nPrevious persistent module state for ${moduleCtx.moduleId || 'module'}:\n\`\`\`json\n${formatStateForPrompt(moduleCtx.previousState)}\n\`\`\``
    : '';
  return `Latest assistant message:\n"""\n${latest}\n"""\n\nRecent context:\n"""\n${recent || 'No recent context available.'}\n"""\n\nChat metadata:\n- Character: ${names.character || 'unknown'}\n- User: ${names.user || 'unknown'}\n- Chat: ${names.chat || 'unknown'}${previous}\n\nGenerate only the output block required by your system prompt.`;
}

function getModuleContext(ctx, mod, $mes, messageId, messageText, extra = {}) {
  return {
    ...ctx.registry.getModuleContext(mod.id),
    $mes,
    messageId,
    messageText,
    latestMessageText: messageText,
    ...extra,
  };
}

async function runModuleGeneration(mod, $mes, ctx, messageId, messageText) {
  const chatId = getCurrentChatIdSafe(ctx);
  const previousState = getPreviousState(mod, chatId);
  console.log(`[RP Suite] previous state for ${mod.id}:`, previousState);
  const moduleCtx = getModuleContext(ctx, mod, $mes, messageId, messageText, {
    chatId,
    previousState,
    moduleState: previousState,
  });
  const systemPrompt = mod.buildPrompt?.(moduleCtx);
  if (!systemPrompt) return { id: mod.id, raw: '', parsed: null, html: '' };
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: buildModuleUserPayload($mes, moduleCtx) },
  ];

  console.log(`[RP Suite] running module ${mod.id} for message ${messageId}`);
  const result = await ctx.ApiService.generateWithModuleProfile({ moduleId: mod.id, messages });
  const raw = result?.text || '';
  console.log(`[RP Suite] module ${mod.id} raw response:`, raw);
  const parsed = mod.parse?.(raw, moduleCtx) || null;
  console.log(`[RP Suite] module ${mod.id} parsed:`, parsed);
  let nextState = previousState;
  if (parsed && typeof mod.updateState === 'function') {
    nextState = mod.updateState(clone(previousState), parsed, moduleCtx);
    console.log(`[RP Suite] updated state for ${mod.id}:`, nextState);
    setModuleState(chatId, mod.id, nextState);
    console.log(`[RP Suite] saved state for ${mod.id}`);
  }
  const renderCtx = { ...moduleCtx, previousState, moduleState: nextState, currentState: nextState };
  const html = parsed && mod.render && mod.renderMode !== 'floating' ? mod.render(parsed, renderCtx) : '';
  if (html || parsed) console.log(`[RP Suite] module ${mod.id} rendered`);
  return { id: mod.id, order: mod.renderOrder, raw, parsed, html, state: nextState };
}

function getEnabledMessageBlockModules(ctx) {
  return ctx.registry.getEnabledModules()
    .filter((mod) => mod.renderMode === 'message-block')
    .sort((a, b) => (a.renderOrder || 0) - (b.renderOrder || 0));
}

function getGeneratedHtmlContainer($mes, ctx) {
  const $ = get$fromCtx(ctx);
  const id = getMessageId($mes);
  const $text = $mes.find('.mes_text').first();
  const $host = $text.length ? $text : $mes;
  $host.find(`.rpsuite-html-creator-generated[data-rpsuite-message-id="${id}"]`).remove();
  return $(`<div class="rpsuite-html-creator-generated" data-rpsuite-message-id="${id}" data-rpsuite-module="html_creator"></div>`).appendTo($host);
}

function removeGeneratedHtml($mes) {
  $mes.find('.rpsuite-html-creator-generated').remove();
}

function insertHtmlCreatorRaw($mes, ctx, rawHtml) {
  if (!rawHtml) return null;
  const $container = getGeneratedHtmlContainer($mes, ctx);
  $container.html(rawHtml);
  ctx.registry.getModule('html_creator')?.wireMessage?.($mes, ctx.registry.getModuleContext('html_creator'));
  console.log('[RP Suite] module html_creator rendered');
  return $container;
}

function extractRsArt(raw) {
  return String(raw || '').match(/<rs_art\b[^>]*>[\s\S]*?<\/rs_art>/i)?.[0] || '';
}

async function runHtmlCreatorForMessage($mes, ctx, messageId, messageText) {
  const mod = ctx.registry.getModule('html_creator');
  if (!mod || !isModuleEnabled('html_creator') || typeof mod.buildPrompt !== 'function') return null;
  try {
    const item = await runModuleGeneration(mod, $mes, ctx, messageId, messageText);
    const rawHtml = extractRsArt(item.raw);
    if (!rawHtml) return item;
    insertHtmlCreatorRaw($mes, ctx, rawHtml);
    return { ...item, html: rawHtml };
  } catch (error) {
    console.error(`[RP Suite] module html_creator failed:`, error);
    return null;
  }
}

async function runFloatingModulesForMessage($mes, ctx, messageId, messageText) {
  const floating = ctx.registry.getEnabledModules().filter((mod) => mod.renderMode === 'floating');
  const results = [];
  for (const mod of floating) {
    try {
      const item = await runModuleGeneration(mod, $mes, ctx, messageId, messageText);
      if (item.parsed && mod.render) {
        mod.render(item.parsed, getModuleContext(ctx, mod, $mes, messageId, messageText, {
          chatId: getCurrentChatIdSafe(ctx),
          previousState: item.state,
          moduleState: item.state,
          currentState: item.state,
        }));
      }
      results.push(item);
    } catch (error) {
      console.error(`[RP Suite] module ${mod.id} failed:`, error);
    }
  }
  return results;
}

export function resetModuleRunnerState(messageId = null) {
  if (messageId === null || messageId === undefined) {
    messageStates.clear();
    window.jQuery?.('.rpsuite-html-creator-generated').remove();
  } else {
    messageStates.delete(String(messageId));
  }
}

export async function runModulesForMessage($mes, ctx, options = {}) {
  if (!$mes?.length || !ctx?.registry || !isAssistantMessage($mes)) return [];
  const messageId = String(getMessageId($mes));
  const existing = messageStates.get(messageId);
  if (existing?.running && !options.force) return existing.promise;
  if (existing?.generated && !options.force) {
    renderModuleResults($mes, existing.results || [], ctx);
    const htmlCreator = ctx.registry.getModule('html_creator');
    if (htmlCreator && isModuleEnabled('html_creator')) {
      if (existing.htmlCreator?.html) insertHtmlCreatorRaw($mes, ctx, existing.htmlCreator.html);
      else htmlCreator.wireMessage?.($mes, ctx.registry.getModuleContext('html_creator'));
    } else {
      removeGeneratedHtml($mes);
    }
    return existing.results || [];
  }

  const promise = (async () => {
    const messageText = getVisibleMessageText($mes);
    if (!messageText) return [];
    if (options.force) removeGeneratedHtml($mes);

    const blockResults = [];
    for (const mod of getEnabledMessageBlockModules(ctx)) {
      try {
        const item = await runModuleGeneration(mod, $mes, ctx, messageId, messageText);
        if (item.html) blockResults.push(item);
      } catch (error) {
        console.error(`[RP Suite] module ${mod.id} failed:`, error);
      }
    }

    renderModuleResults($mes, blockResults, ctx);
    const floatingResults = await runFloatingModulesForMessage($mes, ctx, messageId, messageText);
    const htmlCreator = await runHtmlCreatorForMessage($mes, ctx, messageId, messageText);

    messageStates.set(messageId, { generated: true, running: false, results: blockResults, floatingResults, htmlCreator });
    return blockResults;
  })();

  messageStates.set(messageId, { generated: false, running: true, promise, results: [] });
  try {
    return await promise;
  } catch (error) {
    messageStates.delete(messageId);
    throw error;
  }
}

export async function runAllEnabledPostGenerationModules(ctx) {
  const $ = get$fromCtx(ctx);
  const $messages = $('.mes').filter((_, mes) => isAssistantMessage($(mes)));
  const $last = $messages.last();
  if (!$last.length) return [];
  return runModulesForMessage($last, ctx);
}

export function rerenderCachedModuleResults(ctx) {
  const $ = get$fromCtx(ctx);
  $('.mes').each((_, mes) => {
    const $mes = $(mes);
    const state = messageStates.get(String(getMessageId($mes)));
    if (state?.generated) {
      renderModuleResults($mes, state.results || [], ctx);
      if (isModuleEnabled('html_creator') && state.htmlCreator?.html) insertHtmlCreatorRaw($mes, ctx, state.htmlCreator.html);
    }
  });
}