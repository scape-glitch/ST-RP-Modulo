import { eventSource, event_types } from '../../../../../../script.js';
import { renderAllMessages } from './renderPipeline.js';
import { rerenderCachedModuleResults, resetModuleRunnerState, runAllEnabledPostGenerationModules, runModulesForMessage } from './moduleRunner.js';

let initialized = false;

function isUserMessage($mes) {
  return $mes.hasClass('is_user') || $mes.attr('is_user') === 'true' || $mes.data('is_user') === true;
}

export function initEvents(ctx) {
  if (initialized) return;
  initialized = true;
  const $ = ctx.$ || window.jQuery;

  const getMessageElement = (messageId) => {
    const $mes = messageId !== undefined ? $(`.mes[mesid="${messageId}"], .mes#${messageId}`).first() : $('.mes').last();
    return $mes.length ? $mes : $('.mes').last();
  };

  const runOne = (messageId, force = false) => {
    const $mes = getMessageElement(messageId);
    if (!$mes.length || isUserMessage($mes)) return;
    if (force) resetModuleRunnerState($mes.attr('mesid') || $mes.data('mesid') || $mes.attr('id'));
    runModulesForMessage($mes, ctx, { force }).catch((error) => console.error('[RP Suite] post-generation run failed:', error));
  };

  const safeRunLatest = () => setTimeout(() => runAllEnabledPostGenerationModules(ctx).catch((error) => console.error('[RP Suite] post-generation run failed:', error)), 200);
  const safeRunOne = (id) => setTimeout(() => runOne(id, false), 120);
  const safeRerunOne = (id) => setTimeout(() => runOne(id, true), 120);
  const safeCached = () => setTimeout(() => {
    renderAllMessages(ctx);
    rerenderCachedModuleResults(ctx);
    ctx.registry.getModule('html_creator')?.wireAll?.(ctx.registry.getModuleContext('html_creator'));
  }, 80);

  [event_types.CHARACTER_MESSAGE_RENDERED, event_types.MESSAGE_RENDERED].filter(Boolean).forEach((type) => {
    eventSource.on(type, safeRunOne);
  });
  [event_types.GENERATION_ENDED].filter(Boolean).forEach((type) => {
    eventSource.on(type, safeRunLatest);
  });
  [event_types.MESSAGE_UPDATED, event_types.MESSAGE_SWIPED].filter(Boolean).forEach((type) => {
    eventSource.on(type, safeRunOne);
  });
  [event_types.CHAT_CHANGED, event_types.MORE_MESSAGES_LOADED].filter(Boolean).forEach((type) => {
    eventSource.on(type, safeCached);
  });
}