import { isModuleEnabled, MODULE_MAX_TOKENS } from './settings.js';
import { getMessageId, removeModuleResult, renderModuleResults } from './renderPipeline.js';
import { cleanModuleRawResponse } from './jsonRepair.js';
import {
  getCurrentChatIdSafe,
  getMessageRenderKey,
  getModuleMessageData,
  getModuleState,
  setModuleState,
  updateModuleState,
} from './moduleState.js';

const messageStates = new Map();
const RECENT_CONTEXT_LIMIT = 5;
const MODULE_OUTPUT_TAGS = Object.freeze({
  metrics: 'rs_metrics',
  tarot: 'tarot_reading',
  comments: 'social_comments',
  infoblock: 'scene_state',
  wallet: 'wallet_state',
  html_creator: 'rs_art',
});
const MODULE_OUTPUT_EXAMPLES = Object.freeze({
  metrics: '<rs_metrics><!-- JSON --></rs_metrics>',
  tarot: '<tarot_reading><!-- JSON --></tarot_reading>',
  comments: '<social_comments><!-- JSON --></social_comments>',
  infoblock: '<scene_state><!-- JSON --></scene_state>',
  wallet: '<wallet_state><!-- JSON --></wallet_state>',
  html_creator: '<rs_art>RAW_HTML</rs_art>',
});

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
  return `Latest assistant message:\n"""\n${latest}\n"""\n\nRecent context:\n"""\n${recent || 'No recent context available.'}\n"""\n\nChat metadata:\n- Character: ${names.character || 'unknown'}\n- User: ${names.user || 'unknown'}\n- Chat: ${names.chat || 'unknown'}${previous}\n\nDo not continue the RP message. Do not write narrative text. Return only the module block. Generate only the output block required by your system prompt.`;
}

function wrapModuleSystemPrompt(moduleId, systemPrompt) {
  const example = MODULE_OUTPUT_EXAMPLES[moduleId] || 'the required hidden module block';
  return `SYSTEM OVERRIDE FOR MODULE GENERATION:
You are not writing roleplay.
You are not continuing the scene.
You are not speaking as any character.
You are generating machine-readable module data only.
Output exactly one required hidden block and nothing else.
No prose before it.
No prose after it.
No markdown outside the required hidden block.
No explanations.

Output only:
${example}

ORIGINAL MODULE PROMPT (source of truth for module logic):
${systemPrompt}

FINAL OUTPUT CONTRACT:
Return exactly one ${example} block and nothing else.`;
}

function getModuleGenerationSettings(moduleCtx = {}) {
  if (moduleCtx.moduleSettings && moduleCtx.moduleSettings.max_tokens !== undefined && moduleCtx.moduleSettings.max_tokens !== null) return {};
  const max_tokens = MODULE_MAX_TOKENS[moduleCtx.moduleId];
  return max_tokens ? { max_tokens } : {};
}

function hasExpectedModuleTag(raw, expectedTag) {
  if (!expectedTag) return true;
  const tag = String(expectedTag).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*\/\\s*${tag}\\s*>`, 'i').test(String(raw || ''));
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
    messageKey: messageId,
    previousState,
    moduleState: previousState,
  });
  const systemPrompt = mod.buildPrompt?.(moduleCtx);
  if (!systemPrompt) return { id: mod.id, raw: '', parsed: null, html: '' };
  const messages = [
    { role: 'system', content: wrapModuleSystemPrompt(mod.id, systemPrompt) },
    { role: 'user', content: buildModuleUserPayload($mes, moduleCtx) },
  ];

  console.log(`[RP Suite] running module ${mod.id} for message ${messageId}`);
  const result = await ctx.ApiService.generateWithModuleProfile({ moduleId: mod.id, messages, settingsOverride: getModuleGenerationSettings(moduleCtx) });
  const raw = result?.text || '';
  console.log(`[RP Suite] module ${mod.id} raw response:`, raw);
  const expectedTag = MODULE_OUTPUT_TAGS[mod.id];
  const cleanedRaw = cleanModuleRawResponse(raw, expectedTag);
  if (expectedTag && cleanedRaw.trim() !== String(raw || '').trim()) console.warn('[RP Suite] module raw contained extra prose, stripped before parsing', { moduleId: mod.id, expectedTag });
  const missingExpectedTag = expectedTag && !hasExpectedModuleTag(cleanedRaw, expectedTag);
  if (missingExpectedTag) console.error(`[RP Suite] module ${mod.id} missing expected <${expectedTag}> block, not parsing raw prose`);
  const parsed = missingExpectedTag ? null : (mod.parse?.(cleanedRaw, moduleCtx) || null);
  console.log(`[RP Suite] module ${mod.id} parsed:`, parsed);
  let nextState = previousState;
  if (parsed && typeof mod.updateState === 'function') {
    nextState = mod.updateState(clone(previousState), parsed, moduleCtx);
    if (previousState && nextState && typeof nextState === 'object') {
      if (previousState.byMessage && !nextState.byMessage) nextState.byMessage = previousState.byMessage;
      if (previousState.sections && !nextState.sections) nextState.sections = previousState.sections;
      if (previousState.ui && !nextState.ui) nextState.ui = previousState.ui;
    }
    console.log(`[RP Suite] updated state for ${mod.id}:`, nextState);
    setModuleState(chatId, mod.id, nextState);
    persistModuleMessageResult(chatId, mod, messageId, { raw: cleanedRaw, parsed, stateBefore: previousState, stateAfter: nextState });
    console.log(`[RP Suite] saved state for ${mod.id}`);
  } else if (parsed) {
    persistModuleMessageResult(chatId, mod, messageId, { raw: cleanedRaw, parsed, stateBefore: previousState, stateAfter: previousState });
  } else {
    console.error(`[RP Suite] module ${mod.id} parse failed, not caching broken response`);
  }
  const renderCtx = { ...moduleCtx, previousState, moduleState: nextState, currentState: nextState };
  const html = parsed && mod.render && mod.renderMode !== 'floating' ? mod.render(parsed, renderCtx) : '';
  if (html || parsed) console.log(`[RP Suite] module ${mod.id} rendered`);
  return { id: mod.id, order: mod.renderOrder, raw: cleanedRaw, parsed, html, state: nextState, failed: !parsed };
}

function persistModuleMessageResult(chatId, mod, messageKey, entry = {}) {
  updateModuleState(chatId, mod.id, (previous) => {
    const ts = Date.now();
    if (mod.id === 'comments') {
      previous.sections = previous.sections || {};
      previous.sections[messageKey] = {
        ...(previous.sections[messageKey] || {}),
        generatedComments: Array.isArray(entry.parsed) ? entry.parsed : (previous.sections[messageKey]?.generatedComments || []),
        likes: previous.sections[messageKey]?.likes || {},
        replies: previous.sections[messageKey]?.replies || [],
        authorReplies: previous.sections[messageKey]?.authorReplies || [],
        raw: entry.raw || '',
        ts,
      };
      return previous;
    }
    const payload = {
      parsed: entry.parsed || null,
      stateBefore: entry.stateBefore || null,
      stateAfter: entry.stateAfter || null,
      raw: entry.raw || '',
      ts,
    };
    if (mod.id === 'html_creator') {
      payload.rawHtml = extractRsArt(entry.raw || '') || entry.parsed?.raw || '';
      payload.sanitizedHtml = payload.rawHtml;
    }
    previous.byMessage = { ...(previous.byMessage || {}), [messageKey]: payload };
    return previous;
  });
}

function buildCachedRenderItem(mod, $mes, ctx, messageKey, messageText) {
  const chatId = getCurrentChatIdSafe(ctx);
  const storedState = getModuleState(chatId, mod.id) || null;
  const cached = getModuleMessageData(chatId, mod.id, messageKey);
  if (!cached) return null;
  const parsed = mod.id === 'comments' ? (cached.generatedComments || []) : (cached.parsed || cached);
  if (mod.id === 'comments' && !parsed.length) return null;
  const stateAfter = mod.id === 'comments'
    ? { ...(storedState || {}), sections: { ...(storedState?.sections || {}), [messageKey]: cached } }
    : (cached.stateAfter || storedState);
  const moduleCtx = getModuleContext(ctx, mod, $mes, messageKey, messageText, {
    chatId,
    messageKey,
    previousState: storedState,
    moduleState: stateAfter,
    currentState: stateAfter,
  });
  const html = mod.render && mod.renderMode !== 'floating' && mod.renderMode !== 'inline-html-wire'
    ? mod.render(parsed, moduleCtx)
    : '';
  console.log('[RP Suite] render cached module data', { moduleId: mod.id, messageKey });
  return { id: mod.id, order: mod.renderOrder, raw: cached.raw || '', parsed, html, state: stateAfter, cached: true, rawHtml: cached.rawHtml };
}

function getCurrentAssistantMessage(ctx) {
  const $ = get$fromCtx(ctx);
  return $('.mes').filter((_, mes) => isAssistantMessage($(mes))).last();
}

function collectBlockResultsFromCache($mes, ctx, messageKey, messageText) {
  const results = [];
  for (const mod of getEnabledMessageBlockModules(ctx)) {
    const item = buildCachedRenderItem(mod, $mes, ctx, messageKey, messageText);
    if (item?.html) results.push(item);
  }
  return results;
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
    if (!ctx.forceModule && !ctx.forceAll) {
      const cached = buildCachedRenderItem(mod, $mes, ctx, messageId, messageText);
      if (cached?.rawHtml) {
        insertHtmlCreatorRaw($mes, ctx, cached.rawHtml);
        return { ...cached, html: cached.rawHtml };
      }
    }
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
      if (!ctx.forceModule && !ctx.forceAll) {
        const cached = buildCachedRenderItem(mod, $mes, ctx, messageId, messageText);
        if (cached) {
          if (cached.state && mod.render) mod.render(cached.parsed, getModuleContext(ctx, mod, $mes, messageId, messageText, {
            chatId: getCurrentChatIdSafe(ctx),
            messageKey: messageId,
            previousState: cached.state,
            moduleState: cached.state,
            currentState: cached.state,
          }));
          results.push(cached);
          continue;
        }
      }
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
  const messageText = getVisibleMessageText($mes);
  if (!messageText) return [];
  const messageId = getMessageRenderKey($mes, { ...ctx, messageText });
  const forceAll = !!options.force && !options.moduleId;
  const existing = messageStates.get(messageId);
  if (existing?.running && !options.force) return existing.promise;
  if (existing?.generated && !options.force && !options.moduleId) {
    const cachedResults = collectBlockResultsFromCache($mes, ctx, messageId, messageText);
    renderModuleResults($mes, cachedResults, ctx);
    const htmlCreator = ctx.registry.getModule('html_creator');
    if (htmlCreator && isModuleEnabled('html_creator')) {
      if (existing.htmlCreator?.html) insertHtmlCreatorRaw($mes, ctx, existing.htmlCreator.html);
      else htmlCreator.wireMessage?.($mes, ctx.registry.getModuleContext('html_creator'));
    } else {
      removeGeneratedHtml($mes);
    }
    return cachedResults;
  }

  const promise = (async () => {
    if (options.force) removeGeneratedHtml($mes);

    const blockResults = [];
    let hadModuleFailures = false;
    for (const mod of getEnabledMessageBlockModules(ctx)) {
      if (options.moduleId && mod.id !== options.moduleId) {
        const cached = buildCachedRenderItem(mod, $mes, ctx, messageId, messageText);
        if (cached?.html) blockResults.push(cached);
        continue;
      }
      try {
        const cached = !forceAll && !options.forceModule ? buildCachedRenderItem(mod, $mes, ctx, messageId, messageText) : null;
        const item = cached || await runModuleGeneration(mod, $mes, ctx, messageId, messageText);
        if (item?.failed) hadModuleFailures = true;
        if (item.html) blockResults.push(item);
      } catch (error) {
        hadModuleFailures = true;
        console.error(`[RP Suite] module ${mod.id} failed:`, error);
      }
    }

    renderModuleResults($mes, blockResults, ctx);
    const moduleCtxFlags = { ...ctx, forceAll, forceModule: !!options.forceModule };
    const floatingResults = options.moduleId && ctx.registry.getModule(options.moduleId)?.renderMode !== 'floating'
      ? []
      : await runFloatingModulesForMessage($mes, moduleCtxFlags, messageId, messageText);
    const htmlCreator = options.moduleId && options.moduleId !== 'html_creator'
      ? null
      : await runHtmlCreatorForMessage($mes, moduleCtxFlags, messageId, messageText);
    if (floatingResults.some((item) => item?.failed) || htmlCreator?.failed) hadModuleFailures = true;

    messageStates.set(messageId, { generated: !hadModuleFailures, running: false, results: blockResults, floatingResults, htmlCreator });
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

export async function runModuleForCurrentMessage(ctx, moduleId, options = {}) {
  const $mes = getCurrentAssistantMessage(ctx);
  if (!$mes.length) return [];
  const mod = ctx.registry.getModule(moduleId);
  if (!mod) return [];
  if (!isModuleEnabled(moduleId)) {
    removeModuleResult($mes, moduleId, ctx);
    if (moduleId === 'html_creator') removeGeneratedHtml($mes);
    return [];
  }
  return runModulesForMessage($mes, ctx, { moduleId, force: !!options.force, forceModule: !!options.force });
}

export function removeModuleFromCurrentMessage(ctx, moduleId) {
  const $mes = getCurrentAssistantMessage(ctx);
  if (!$mes.length) return;
  removeModuleResult($mes, moduleId, ctx);
  if (moduleId === 'html_creator') removeGeneratedHtml($mes);
}

export function rerenderTarotThemeOnly(ctx) {
  const $mes = getCurrentAssistantMessage(ctx);
  if (!$mes.length) return false;
  const messageText = getVisibleMessageText($mes);
  const messageKey = getMessageRenderKey($mes, { ...ctx, messageText });
  const mod = ctx.registry.getModule('tarot');
  const item = mod && buildCachedRenderItem(mod, $mes, ctx, messageKey, messageText);
  if (!item?.html) return false;
  const existing = collectBlockResultsFromCache($mes, ctx, messageKey, messageText).filter((r) => r.id !== 'tarot');
  renderModuleResults($mes, [...existing, item], ctx);
  console.log('[RP Suite][Tarot] theme changed, rerender only, no generation');
  return true;
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
    const messageText = getVisibleMessageText($mes);
    const messageKey = getMessageRenderKey($mes, { ...ctx, messageText });
    const results = collectBlockResultsFromCache($mes, ctx, messageKey, messageText);
    if (results.length) renderModuleResults($mes, results, ctx);
    const htmlCreator = ctx.registry.getModule('html_creator');
    const htmlCached = htmlCreator && buildCachedRenderItem(htmlCreator, $mes, ctx, messageKey, messageText);
    if (isModuleEnabled('html_creator') && htmlCached?.rawHtml) insertHtmlCreatorRaw($mes, ctx, htmlCached.rawHtml);
  });
}