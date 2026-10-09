'use strict';

// Surviving to Thriving workbook: open the online version on request, autosave answers on this device,
// and send them to Formspree via AJAX. Without JavaScript everything shows and the form posts directly.
const root = document.documentElement;
const form = document.getElementById('workbook-form');
const online = document.getElementById('online-workbook');
const openBtn = document.getElementById('open-online');
const statusEl = document.getElementById('form-status');
const saveStatus = document.getElementById('save-status');
const submitBtn = document.getElementById('submit-btn');
form.noValidate = true;
const STORAGE_KEY = 'lll-workbook-v1';
const OPEN_KEY = 'lll-workbook-open';
const fields = Array.from(form.querySelectorAll('textarea, input[type=text]:not([name=_gotcha]), input[type=email]'));

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

let quietTimer;
function showSaveStatus(message, warning = false) {
  saveStatus.textContent = message;
  saveStatus.classList.toggle('is-warning', warning);
  saveStatus.classList.remove('is-quiet');
  clearTimeout(quietTimer);
  if (!warning) quietTimer = setTimeout(() => saveStatus.classList.add('is-quiet'), 2500);
}

let dirty = false;
function writeStore() {
  if (!dirty) return;
  const data = {};
  fields.forEach(field => { if (field.value) data[field.id] = field.value; });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    dirty = false;
    showSaveStatus('✓ Saved · ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }));
  } catch {
    showSaveStatus('Autosave is off in this browser — download or print to keep your answers', true);
  }
}

function autosize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 2 + 'px';
}

const saved = readStore();
fields.forEach(field => { if (saved[field.id]) field.value = saved[field.id]; });
const hasSaved = Object.keys(saved).length > 0;

function sizeAll() { form.querySelectorAll('textarea').forEach(autosize); }

function setOpen(open, scroll) {
  root.classList.toggle('wb-is-open', open);
  openBtn.setAttribute('aria-expanded', String(open));
  openBtn.textContent = open ? 'Filling it out online ↓' : 'Fill it out online instead';
  if (!open) return;
  try { localStorage.setItem(OPEN_KEY, '1'); } catch {}
  // Ask the browser not to clear this site's storage when space runs low.
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  sizeAll();
  if (scroll) {
    online.focus({ preventScroll: true });
    online.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

// Reopen automatically after a refresh, or whenever answers already exist.
if (root.classList.contains('wb-is-open') || hasSaved) setOpen(true, false);
if (hasSaved) showSaveStatus('Welcome back — your answers were restored');

openBtn.addEventListener('click', () => setOpen(true, true));

let saveTimer;
form.addEventListener('input', event => {
  if (event.target.tagName === 'TEXTAREA') autosize(event.target);
  if (event.target.getAttribute('aria-invalid')) showError(event.target, '');
  dirty = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeStore, 250);
});
// Save immediately whenever the page might go away: leaving a field, switching apps, locking the phone, closing the tab.
form.addEventListener('change', writeStore);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') writeStore(); });
window.addEventListener('pagehide', writeStore);
window.addEventListener('beforeunload', writeStore);

window.addEventListener('beforeprint', sizeAll);
document.getElementById('print-btn').addEventListener('click', () => window.print());

document.getElementById('clear-btn').addEventListener('click', () => {
  if (!window.confirm('Clear every answer in this workbook? This cannot be undone.')) return;
  fields.forEach(field => { field.value = ''; if (field.tagName === 'TEXTAREA') autosize(field); });
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  dirty = false;
  showSaveStatus('Your answers were cleared');
  setStatus('', '');
});

function showError(field, message) {
  const slot = form.querySelector(`[data-error-for="${field.name}"]`);
  if (slot) slot.textContent = message;
  if (message) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
}

function setStatus(message, kind) {
  statusEl.textContent = message;
  statusEl.className = 'wb-status' + (kind ? ' is-' + kind : '');
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  setStatus('', '');

  const name = form.elements.name;
  const email = form.elements.email;
  let firstInvalid = null;
  [[name, 'Please add your name.'], [email, 'Please add a valid email address.']].forEach(([field, message]) => {
    const ok = field.value.trim() && field.checkValidity();
    showError(field, ok ? '' : message);
    if (!ok && !firstInvalid) firstInvalid = field;
  });
  if (firstInvalid) { firstInvalid.focus(); return; }

  const answered = fields.some(field => field.tagName === 'TEXTAREA' && field.name !== 'message' && field.value.trim());
  if (!answered) {
    setStatus('Your workbook is empty — add a reflection or two before sending.', 'error');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    });
    if (response.ok) {
      setStatus('Thank you. Your workbook is on its way to Nashay. Your answers are still saved here for you.', 'success');
      submitBtn.textContent = 'Sent';
      return;
    }
    const data = await response.json().catch(() => ({}));
    const errors = Array.isArray(data.errors) ? data.errors : [];
    errors.forEach(error => { if (error.field && form.elements[error.field]) showError(form.elements[error.field], error.message); });
    const message = errors.map(error => error.message).filter(Boolean).join(' ');
    setStatus(message || 'Something went wrong while sending. Please try again in a moment.', 'error');
  } catch {
    setStatus('We couldn’t reach the server. Check your connection and try again — your answers are saved.', 'error');
  }
  submitBtn.disabled = false;
  submitBtn.textContent = 'Send my workbook';
});
