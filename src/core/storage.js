const loaded = new Set();

export function loadCssOnce(href) {
  if (!href || loaded.has(href)) return;
  loaded.add(href);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  link.dataset.rpsuiteStyle = '1';
  document.head.appendChild(link);
}

export function loadSuiteStyles(ctx) {
  const base = ctx.extensionFolderPath;
  [
    'style.css',
    'src/modules/metrics/style.css',
    'src/modules/tarot/style.css',
    'src/modules/comments/style.css',
    'src/modules/infoblock/style.css',
    'src/modules/wallet/style.css',
    'src/modules/html_creator/style.css',
  ].forEach((path) => loadCssOnce(`${base}/${path}`));
}

export function localStore(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch (_) { return fallback; }
}

export function setLocalStore(key, value) {
  if (value === undefined || value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}