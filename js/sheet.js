// Нижняя шторка (bottom sheet).
const sheet = document.getElementById('sheet');
const body = sheet.querySelector('.sheet-body');
let onCloseCb = null;

export function openSheet(html, { onClose } = {}) {
  onCloseCb = onClose || null;
  body.innerHTML = html;
  body.scrollTop = 0;
  sheet.classList.add('open');
  sheet.setAttribute('aria-hidden', 'false');
}

export function closeSheet() {
  if (!sheet.classList.contains('open')) return;
  sheet.classList.remove('open');
  sheet.setAttribute('aria-hidden', 'true');
  const cb = onCloseCb;
  onCloseCb = null;
  cb?.();
}

export function isSheetOpen() {
  return sheet.classList.contains('open');
}

sheet.querySelector('.sheet-close').addEventListener('click', closeSheet);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeSheet();
});
