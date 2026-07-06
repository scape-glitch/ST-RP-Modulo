import {
  eventSource,
  event_types,
  extension_prompt_roles,
  extension_prompt_types,
  setExtensionPrompt,
  substituteParams,
} from '../../../../../../script.js';
import { EXTENSION_NAME } from './settings.js';

const PROMPT_ID = `${EXTENSION_NAME}_modules_prompt`;
let initialized = false;
let lastContent = null;

export function buildCombinedPrompt(ctx) {
  const prompt = '';
  return substituteParams ? substituteParams(prompt) : prompt;
}

export function updateExtensionPrompt(ctx) {
  const content = buildCombinedPrompt(ctx);
  if (content === lastContent) return;
  lastContent = content;
  try {
    setExtensionPrompt(PROMPT_ID, content, extension_prompt_types.IN_PROMPT, 0, true, extension_prompt_roles.SYSTEM);
  } catch (error) {
    console.warn('[RP Suite] setExtensionPrompt failed:', error);
  }
}

export function initPromptInjection(ctx) {
  if (initialized) return;
  initialized = true;
  const update = () => updateExtensionPrompt(ctx);
  [
    event_types.GENERATION_STARTED,
    event_types.GENERATION_AFTER_COMMANDS,
    event_types.GENERATE_BEFORE_COMBINE_PROMPTS,
    event_types.GENERATE_AFTER_COMBINE_PROMPTS,
    event_types.CHAT_COMPLETION_PROMPT_READY,
    event_types.CHAT_CHANGED,
  ].filter(Boolean).forEach((type) => eventSource.on(type, update));
  update();
}