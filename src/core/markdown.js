const ALLOWED_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function isSafeUrl(url) {
  const value = String(url || '').trim();
  if (!value) return false;
  if (value.startsWith('#') || value.startsWith('/')) return true;
  try {
    const base = typeof window !== 'undefined' ? window.location?.origin : 'https://example.invalid';
    const parsed = new URL(value, base || 'https://example.invalid');
    return ALLOWED_PROTOCOLS.has(parsed.protocol);
  } catch (_) {
    return false;
  }
}

function sanitizeLinkUrl(url) {
  const value = String(url || '').trim();
  return isSafeUrl(value) ? escapeHtml(value) : '#';
}

function renderInline(source = '') {
  const code = [];
  let html = escapeHtml(source).replace(/`([^`]+)`/g, (_, body) => {
    const token = `@@RS_CODE_${code.length}@@`;
    code.push(`<code>${body}</code>`);
    return token;
  });

  html = html
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^&]*&quot;)?\)/g, (_, label, url) => `<a href="${sanitizeLinkUrl(url)}" target="_blank" rel="noopener noreferrer">${label}</a>`)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<del>$1</del>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');

  code.forEach((value, index) => { html = html.replace(`@@RS_CODE_${index}@@`, value); });
  return html;
}

function sanitizeRenderedHtml(html) {
  if (typeof DOMParser === 'undefined') {
    return String(html || '')
      .replace(/<\/?(?:script|iframe|object|embed|style|base)\b[^>]*>/gi, '')
      .replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/\s+(?:href|src)\s*=\s*(["'])\s*(?:javascript:|vbscript:|data:)\s*[^"']*\1/gi, '');
  }

  const allowedTags = new Set(['A', 'BLOCKQUOTE', 'BR', 'CODE', 'DEL', 'EM', 'LI', 'OL', 'P', 'STRONG', 'UL']);
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  doc.body.querySelectorAll('*').forEach((el) => {
    if (!allowedTags.has(el.tagName)) {
      el.replaceWith(...Array.from(el.childNodes));
      return;
    }
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value || '';
      if (name.startsWith('on') || name === 'style' || name === 'srcdoc' || name.startsWith('data-')) {
        el.removeAttribute(attr.name);
        return;
      }
      if (el.tagName === 'A') {
        if (name === 'href') {
          if (!isSafeUrl(value)) el.setAttribute('href', '#');
          return;
        }
        if (name === 'target' || name === 'rel') return;
      }
      el.removeAttribute(attr.name);
    });
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener noreferrer');
    }
  });
  return doc.body.firstElementChild?.innerHTML || '';
}

export function renderInlineMarkdownSafe(text, options = {}) {
  const value = String(text ?? '').replace(/\r\n?/g, '\n');
  const html = options.keepLineBreaks === false
    ? renderInline(value.replace(/\n+/g, ' '))
    : value.split(/\n+/).map((line) => renderInline(line)).join('<br>');
  return sanitizeRenderedHtml(html);
}

export function renderMarkdownSafe(text, options = {}) {
  const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
  const blocks = [];
  let list = null;
  const closeList = () => {
    if (!list) return;
    blocks.push(`<${list.type}>${list.items.map((item) => `<li>${renderInline(item)}</li>`).join('')}</${list.type}>`);
    list = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) { closeList(); continue; }
    const unordered = trimmed.match(/^[-*+]\s+(.+)$/);
    const ordered = trimmed.match(/^\d+[.)]\s+(.+)$/);
    if (unordered || ordered) {
      const type = unordered ? 'ul' : 'ol';
      if (!list || list.type !== type) { closeList(); list = { type, items: [] }; }
      list.items.push((unordered || ordered)[1]);
      continue;
    }
    closeList();
    if (trimmed.startsWith('>')) blocks.push(`<blockquote>${renderInline(trimmed.replace(/^>\s?/, ''))}</blockquote>`);
    else blocks.push(`<p>${renderInline(trimmed)}</p>`);
  }
  closeList();

  const html = blocks.join(options.compact ? '' : '\n');
  return sanitizeRenderedHtml(html);
}