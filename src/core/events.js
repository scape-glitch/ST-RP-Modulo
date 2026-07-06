import { eventSource, event_types } from '../../../../../../script.js';
import { renderAllMessages, renderMessageModules } from './renderPipeline.js';

let initialized = false;

export function initEvents(ctx) {
  if (initialized) return;
  initialized = true;
  const $ = ctx.$ || window.jQuery;

  const renderOne = (messageId) => {
    const $mes = messageId !== undefined ? $(`.mes[mesid="${messageId}"], .mes#${messageId}`).first() : $('.mes').last();
    if ($mes.length) renderMessageModules($mes, ctx);
    else renderAllMessages(ctx);
  };

  const safeAll = () => setTimeout(() => renderAllMessages(ctx), 50);
  const safeOne = (id) => setTimeout(() => renderOne(id), 30);

  [event_types.MESSAGE_RENDERED, event_types.MESSAGE_UPDATED, event_types.MESSAGE_SWIPED].filter(Boolean).forEach((type) => {
    eventSource.on(type, safeOne);
  });
  [event_types.CHAT_CHANGED, event_types.MORE_MESSAGES_LOADED].filter(Boolean).forEach((type) => {
    eventSource.on(type, safeAll);
  });
}