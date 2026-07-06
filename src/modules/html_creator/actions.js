const wired = new WeakSet();

function cleanAction(text) {
  return String(text || '').replace(/[|{}]/g, '').replace(/[\r\n]+/g, ' ').trim().slice(0, 1000);
}

export async function sendUserAction(text) {
  const clean = cleanAction(text);
  if (!clean) return false;
  try {
    const TH = window.TavernHelper || window.TH;
    if (TH?.triggerSlash) {
      await TH.triggerSlash(`/send ${clean} || /trigger`);
      return true;
    }
  } catch (error) {
    console.warn('[RP Suite] triggerSlash failed:', error);
  }
  const $ = window.jQuery;
  const $ta = $('#send_textarea');
  if ($ta.length) {
    $ta.val(clean).trigger('input').focus();
    return true;
  }
  return false;
}

function wireOnce(el, type, handler) {
  if (wired.has(el)) return;
  wired.add(el);
  el.addEventListener(type, handler);
  if (!el.style.cursor) el.style.cursor = 'pointer';
}

export function wireActions($root) {
  const root = $root?.[0] || $root;
  if (!root) return;
  root.querySelectorAll('[data-rs-action]').forEach((el) => wireOnce(el, 'click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    sendUserAction(el.getAttribute('data-rs-action'));
  }));
  root.querySelectorAll('[data-rs-send]').forEach((el) => wireOnce(el, 'click', (e) => {
    e.preventDefault();
    const box = root.querySelector('[data-rs-reply]');
    sendUserAction(box?.value || box?.textContent || el.getAttribute('data-rs-send'));
  }));
  root.querySelectorAll('[data-rs-reply]').forEach((el) => {
    if (wired.has(el)) return;
    wired.add(el);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendUserAction(el.value || el.textContent);
      }
    });
  });
  root.querySelectorAll('[data-rs-flip]').forEach((el) => wireOnce(el, 'click', (e) => {
    e.preventDefault();
    const faceEl = el.closest('[data-rs-face]');
    const scope = faceEl?.parentElement || el.parentElement;
    if (!scope) return;
    const front = scope.querySelector('[data-rs-face="front"]');
    const back = scope.querySelector('[data-rs-face="back"]');
    scope.classList.toggle('rs-flipped');
    const flipped = scope.classList.contains('rs-flipped');
    if (front) front.style.display = flipped ? 'none' : '';
    if (back) back.style.display = flipped ? '' : 'none';
  }));
}