export function sanitizeForJSON(str) {
  return String(str || '')
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, '')
    .replace(/[\u00A0\u1680\u180E\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\u3164]/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
}

export function stripMarkdownFences(text) {
  return sanitizeForJSON(text)
    .replace(/^```(?:json|html|xml|javascript|js)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function escRe(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeHiddenTagName(text, expectedTagName) {
  const tag = escRe(expectedTagName);
  return String(text || '')
    .replace(new RegExp(`<\\s*${tag}\\b([^>]*)>`, 'ig'), `<${expectedTagName}$1>`)
    .replace(new RegExp(`<\\s*\/\\s*${tag}\\s*>`, 'ig'), `</${expectedTagName}>`);
}

export function cleanModuleRawResponse(raw, expectedTagName) {
  const value = String(raw || '');
  if (!expectedTagName || !value) return value;
  const tag = escRe(expectedTagName);
  const openRe = new RegExp(`<\\s*${tag}\\b[^>]*>`, 'i');
  const open = openRe.exec(value);
  if (!open) return value;
  const closeRe = new RegExp(`<\\s*\/\\s*${tag}\\s*>`, 'ig');
  closeRe.lastIndex = open.index + open[0].length;
  const close = closeRe.exec(value);
  if (!close) return value;
  return normalizeHiddenTagName(value.slice(open.index, close.index + close[0].length), expectedTagName).trim();
}

export function repairCommonJsonMistakes(text) {
  let fixed = stripMarkdownFences(text)
    .replace(/^\s*<!--\s*/g, '')
    .replace(/\s*-->\s*$/g, '')
    .replace(/<!--\s*/g, '')
    .replace(/\s*-->/g, '')
    .replace(/,\s*([}\]])/g, '$1')
    .replace(/}\s*}\s*,\s*{/g, '}, {')
    .replace(/}\s*}\s*]/g, '}]');

  const openBrace = (fixed.match(/{/g) || []).length;
  let closeBrace = (fixed.match(/}/g) || []).length;
  while (closeBrace > openBrace) {
    fixed = fixed.replace(/}\s*$/, '');
    closeBrace -= 1;
  }
  while (closeBrace < openBrace) {
    fixed += '}';
    closeBrace += 1;
  }
  const openBracket = (fixed.match(/\[/g) || []).length;
  let closeBracket = (fixed.match(/]/g) || []).length;
  while (closeBracket < openBracket) {
    fixed += ']';
    closeBracket += 1;
  }
  return fixed.trim();
}

export function extractFirstBalancedObject(text) {
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
  return value.slice(start);
}

export function extractTaggedBlock(text, tagName) {
  const value = normalizeHiddenTagName(stripMarkdownFences(text), tagName);
  const tag = escRe(tagName);
  const re = new RegExp(`(?:` + '```' + `(?:json|html|xml)?\\s*)?<\\s*${tag}\\b[^>]*>([\\s\\S]*?)<\\s*\\/\\s*${tag}\\s*>(?:\\s*` + '```' + `)?`, 'i');
  const match = value.match(re);
  if (match) return match[1].trim();
  return null;
}

export function extractJSON(text, preferredKey = '') {
  const value = sanitizeForJSON(text);
  if (!value) return null;
  if (preferredKey) {
    const key = escRe(preferredKey);
    const keyed = value.match(new RegExp(`\\{[^{}]*"${key}"\\s*:[\\s\\S]*\\}`, 'i'));
    if (keyed) return keyed[0];
  }
  return extractFirstBalancedObject(value);
}

export function parseJSONSafe(raw, fallback = null) {
  if (raw && typeof raw === 'object') return raw;
  const value = stripMarkdownFences(raw);
  if (!value) return fallback;
  const candidates = [value, repairCommonJsonMistakes(value)];
  const extracted = extractJSON(value);
  if (extracted) candidates.push(extracted, repairCommonJsonMistakes(extracted));
  for (const candidate of candidates) {
    try { return JSON.parse(candidate); } catch (_) {}
  }
  console.warn('[RP Suite] JSON parse failed:', { raw: value.slice(0, 500) });
  return fallback;
}

export function parseTaggedJSON(text, tagName, fallback = null) {
  const inner = extractTaggedBlock(text, tagName);
  if (inner !== null) {
    const parsed = parseJSONSafe(inner, fallback);
    if (parsed !== fallback) return parsed;
  }
  return parseJSONSafe(text, fallback);
}

export function cleanHiddenJSONText(text, tagName) {
  const tag = escRe(tagName);
  return String(text || '')
    .replace(new RegExp(`\\s*(?:` + '```' + `(?:json|html|xml)?\\s*)?<\\s*${tag}\\b[^>]*>[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>(?:\\s*` + '```' + `)?\\s*`, 'gi'), '')
    .replace(new RegExp(`\\{[^{}]*"${tag}"[\\s\\S]*?\\}`, 'gi'), '');
}
