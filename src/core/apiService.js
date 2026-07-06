import { proxies, chat_completion_sources } from '../../../../../openai.js';
import { getEventSourceStream } from '../../../../../sse-stream.js';
import { getModuleSettings } from './settings.js';

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

  getChatCompletionSource(apiName) {
    const raw = String(apiName || '').trim();
    if (!raw) return getContext().chatCompletionSettings?.chat_completion_source;
    const key = raw.toUpperCase() === 'GOOGLE' ? 'MAKERSUITE' : raw.toUpperCase();
    return chat_completion_sources?.[key] || raw;
  },

  applyConnectionProfileData(generateData, connectionProfile, ccSource) {
    if (!connectionProfile) return generateData;
    generateData.chat_completion_source = ccSource;
    generateData.model = connectionProfile.model || generateData.model;
    generateData.api = connectionProfile.api || generateData.api;

    if (connectionProfile['secret-id']) generateData.secret_id = connectionProfile['secret-id'];

    if (ccSource === chat_completion_sources?.CUSTOM || String(connectionProfile.api).toUpperCase() === 'CUSTOM') {
      generateData.custom_url = this.normalizeApiUrl(connectionProfile.custom_url || connectionProfile.api_url || '');
      generateData.custom_prompt_post_processing = connectionProfile.custom_prompt_post_processing;
      generateData.custom_include_body = connectionProfile.custom_include_body;
      generateData.custom_exclude_body = connectionProfile.custom_exclude_body;
      generateData.custom_include_headers = connectionProfile.custom_include_headers;
    }

    if (ccSource === chat_completion_sources?.VERTEXAI || String(connectionProfile.api).toUpperCase() === 'VERTEXAI') {
      generateData.vertexai_region = connectionProfile.vertexai_region;
      generateData.vertexai_auth_mode = connectionProfile.vertexai_auth_mode;
      generateData.vertexai_express_project_id = connectionProfile.vertexai_express_project_id;
    }

    if (ccSource === chat_completion_sources?.ZAI || String(connectionProfile.api).toUpperCase() === 'ZAI') {
      generateData.zai_endpoint = connectionProfile.zai_endpoint;
    }

    if (connectionProfile.proxy && ccSource !== chat_completion_sources?.OPENROUTER) {
      const proxy = proxies?.find?.((p) => p.name === connectionProfile.proxy);
      if (proxy) {
        generateData.reverse_proxy = proxy.url;
        generateData.proxy_password = proxy.password;
      }
    }

    return generateData;
  },

  async getStreamingReply(response, ccSource) {
    let text = '';
    for await (const event of getEventSourceStream(response)) {
      const data = typeof event === 'string' ? JSON.parse(event) : event?.data ? JSON.parse(event.data) : event;
      text += this.extractMessageFromData(data, { chat_completion_source: ccSource });
    }
    return text;
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
    const { getRequestHeaders, chatCompletionSettings = {} } = ctx;
    const moduleSettings = { ...(getModuleSettings(moduleId) || {}), ...settingsOverride };
    const profile = this.getConnectionProfile(moduleSettings.connectionProfile);
    const ccSource = this.getChatCompletionSource(profile?.api || chatCompletionSettings.chat_completion_source);
    const stream = settingsOverride.stream ?? false;

    this.abortGeneration(moduleId);
    const controller = new AbortController();
    abortControllers.set(moduleId, controller);

    const generateData = this.applyConnectionProfileData({
      messages,
      stream,
      temperature: settingsOverride.temperature ?? 0.7,
      top_p: settingsOverride.top_p ?? 1.0,
      max_tokens: settingsOverride.max_tokens ?? 1000,
      reasoning_effort: settingsOverride.reasoning_effort,
    }, profile, ccSource);

    const response = await fetch('/api/backends/chat-completions/generate', {
      method: 'POST',
      headers: getRequestHeaders ? getRequestHeaders() : { 'Content-Type': 'application/json' },
      body: JSON.stringify(generateData),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(await this.readResponseError(response));
    if (stream) return { text: await this.getStreamingReply(response, ccSource), profile, model: profile?.model || '' };
    const data = await response.json();
    return { data, text: this.extractMessageFromData(data, { chat_completion_source: ccSource }), profile, model: profile?.model || '' };
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