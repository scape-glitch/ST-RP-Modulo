export const ALLOWED_DATA = new Set(['data-rs-action','data-rs-reply','data-rs-send','data-rs-flip','data-rs-face']);
const BAD_URL = /^\s*(javascript:|vbscript:|data:text\/html)/i;

export function sanitizeMessage($text) {
  const root = $text?.[0] || $text;
  if (!root) return;
  root.querySelectorAll('script, iframe, object, embed, base').forEach((el) => el.remove());
  root.querySelectorAll('*').forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value || '';
      if (name.startsWith('on')) el.removeAttribute(attr.name);
      if ((name === 'href' || name === 'src' || name === 'xlink:href') && BAD_URL.test(value)) el.removeAttribute(attr.name);
      if (name === 'srcdoc') el.removeAttribute(attr.name);
      if (name.startsWith('data-rs-') && !ALLOWED_DATA.has(name)) el.removeAttribute(attr.name);
    });
  });
}