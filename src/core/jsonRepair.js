export function sanitizeForJSON(str) {
  return String(str || '')
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '')
    .replace(/[\u00A0\u1680\u180E\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\u3164]/g, ' ')
    .trim();
}

export function extractJSON(text) {
  const value = sanitizeForJSON(text);
  const start = value.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < value.length; i += 1) {
    const ch = value[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) return value.slice(start, i + 1);
    }
  }
  return null;
}

export function parseJSONSafe(raw, fallback = null) {
  if (raw && typeof raw === 'object') return raw;
  const value = sanitizeForJSON(raw);
  if (!value) return fallback;
  try { return JSON.parse(value); } catch (_) {}
  const extracted = extractJSON(value);
  if (!extracted) return fallback;
  try { return JSON.parse(extracted); } catch (error) {
    console.warn('[RP Suite] JSON parse failed:', error, { raw: value.slice(0, 500) });
    return fallback;
  }
}

export function parseTaggedJSON(text, tagName, fallback = null) {
  const value = sanitizeForJSON(text);
  const tag = String(tagName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = value.match(re);
  if (!match) return fallback;
  const inner = match[1].replace(/^\s*<!--\s*/, '').replace(/\s*-->\s*$/, '');
  return parseJSONSafe(inner, fallback);
}

export function cleanHiddenJSONText(text, tagName) {
  const tag = String(tagName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return String(text || '').replace(new RegExp(`\\s*<${tag}[^>]*>[\\s\\S]*?<\\/${tag}>\\s*`, 'gi'), '');
}