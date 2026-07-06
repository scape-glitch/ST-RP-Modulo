import { ALLOW_MODULE_FALLBACK, getModuleSettings, MODULE_MAX_TOKENS } from './settings.js';

const abortControllers = new Map();

function getContext() {
  return window.SillyTavern?.getContext?.() || {};
}

function getFirstText(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => item?.text || item?.content || '').join('');
  return value.text || value.content || '';
}

function messagesToPrompt(messages = []) {
  return messages.map((message) => {
    const role = String(message?.role || 'user').toUpperCase();
    return `[${role}]\n${getFirstText(message?.content)}`;
  }).join('\n\n');
}

function extractText(response) {
  if (typeof response === 'string') return response;
  if (response && typeof response.content === 'string') return response.content;
  if (response?.choices?.[0]?.message?.content) return getFirstText(response.choices[0].message.content);
  if (response?.choices?.[0]?.text) return response.choices[0].text;
  if (response?.text) return getFirstText(response.text);
  return '';
}

function getProfileId(profile) {
  return profile?.id || profile?.identifier || profile?.name || '';
}

function findConnectionProfile(profiles = [], selected = '') {
  const value = String(selected || '').trim();
  if (!value || value === '__current__') return null;
  return profiles.find((profile) => String(profile?.id || '') === value || String(profile?.identifier || '') === value || profile?.name === value) || null;
}

export const ApiService = {
  normalizeApiUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
  },

  getConnectionProfiles() {
    return getContext().extensionSettings?.connectionManager?.profiles || [];
  },

  getConnectionProfile(profileName) {
    const profiles = this.getConnectionProfiles();
    return profiles.find((p) => p.name === profileName) || profiles[0] || null;
  },

  getConnectionProfileModel(profileName) {
    return this.getConnectionProfile(profileName)?.model || '';
  },

  async readResponseError(response) {
    try {
      const data = await response.json();
      return data?.error?.message || data?.message || JSON.stringify(data);
    } catch (_) {
      try { return await response.text(); } catch (e) { return String(e); }
    }
  },

  async generateWithModuleProfile({ messages, moduleId, settingsOverride = {} }) {
    const ctx = getContext();
    const moduleSettings = { ...(getModuleSettings(moduleId) || {}), ...settingsOverride };
    const profiles = ctx.extensionSettings?.connectionManager?.profiles || [];
    const selectedProfile = findConnectionProfile(profiles, moduleSettings.connectionProfile);
    const selectedProfileId = getProfileId(selectedProfile);
    const profileName = selectedProfile?.name || '';
    const model = selectedProfile?.model || '';
    const maxTokens = settingsOverride.max_tokens ?? moduleSettings.max_tokens ?? MODULE_MAX_TOKENS[moduleId] ?? 1000;
    const prompt = messagesToPrompt(messages);

    console.log('[RP Suite][Cost] API call', { moduleId, maxTokens, inputChars: prompt.length });
    console.log('[RP Suite] API via ConnectionManagerRequestService', {
      moduleId,
      profileId: selectedProfileId,
      profileName,
      model,
      maxTokens,
    });

    const runFallback = async () => {
      if (!ctx.generateQuietPrompt) throw new Error('No SillyTavern generation method available');
      const fallbackPrompt = `${prompt}\n\n[CRITICAL FALLBACK MODE: Return ONLY the hidden module block required by the SYSTEM prompt. Do not write prose, markdown explanations, or any extra text. Preserve the exact wrapper tag and JSON/HTML format.]`;
      const fallbackResponse = await ctx.generateQuietPrompt({
        quietPrompt: fallbackPrompt,
        prompt: fallbackPrompt,
        quietToLoud: false,
        skipWIAN: false,
      });
      return { response: fallbackResponse, text: extractText(fallbackResponse) };
    };

    let response;
    let text;
    if (selectedProfileId && ctx.ConnectionManagerRequestService?.sendRequest) {
      try {
        response = await ctx.ConnectionManagerRequestService.sendRequest(selectedProfileId, prompt, maxTokens);
        text = extractText(response);
      } catch (error) {
        // Token economy: do NOT chain another (potentially expensive/main-model)
        // generation on quota/API failure unless fallback is explicitly enabled.
        if (!ALLOW_MODULE_FALLBACK) {
          console.error('[RP Suite][Cost] module API failed, fallback disabled', { moduleId, error: String(error?.message || error) });
          throw error;
        }
        console.warn('[RP Suite] Connection profile failed, fallback to generateQuietPrompt', error);
        const fallback = await runFallback();
        response = fallback.response;
        text = fallback.text;
      }
    } else if (ALLOW_MODULE_FALLBACK) {
      if (moduleSettings.connectionProfile && moduleSettings.connectionProfile !== '__current__') {
        console.warn('[RP Suite] Connection profile not found, fallback to generateQuietPrompt', moduleSettings.connectionProfile);
      }
      const fallback = await runFallback();
      response = fallback.response;
      text = fallback.text;
    } else {
      console.error('[RP Suite][Cost] no connection profile available and fallback disabled', { moduleId, connectionProfile: moduleSettings.connectionProfile || '' });
      throw new Error(`RP Suite: no connection profile for module ${moduleId} and fallback is disabled`);
    }

    console.log('[RP Suite][Cost] response received', { moduleId, outputChars: String(text || '').length });
    return {
      text,
      raw: response,
      profileName,
      model,
    };
  },

  extractMessageFromData(data) {
    if (!data) return '';
    if (typeof data === 'string') return data;
    if (data?.choices?.[0]?.message?.content) return getFirstText(data.choices[0].message.content);
    if (data?.choices?.[0]?.delta?.content) return getFirstText(data.choices[0].delta.content);
    if (data?.content) return getFirstText(data.content);
    if (data?.completion) return data.completion;
    if (data?.candidates?.[0]?.content?.parts) return data.candidates[0].content.parts.map((p) => p.text || '').join('');
    if (data?.candidates?.[0]?.text) return data.candidates[0].text;
    return '';
  },

  abortGeneration(moduleId) {
    const controller = abortControllers.get(moduleId);
    if (controller) controller.abort();
    abortControllers.delete(moduleId);
  },
};