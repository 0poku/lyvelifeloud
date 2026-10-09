'use strict';

// Surviving to Thriving workbook: autosave answers in this browser and send to Formspree via AJAX.
// Without JavaScript the form still posts to Formspree directly.
const form = document.getElementById('workbook-form');
const statusEl = document.getElementById('form-status');
const saveStatus = document.getElementById('save-status');
const submitBtn = document.getElementById('submit-btn');
form.noValidate = true;
const STORAGE_KEY = 'lll-workbook-v1';
const fields = Array.from(form.querySelectorAll('textarea, input[type=text]:not([name=_gotcha]), input[type=email]'));

function readStore() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; } catch { return {}; }
}

function writeStore() {
  const data = {};
  fields.forEach(field => { if (field.value) data[field.id] = field.value; });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    saveStatus.textContent = 'Saved in this browser · ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch {
    saveStatus.textContent = 'Autosave is unavailable in this browser.';
  }
}

function autosize(textarea) {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 2 + 'px';
}

const saved = readStore();
fields.forEach(field => {
  if (saved[field.id]) field.value = saved[field.id];
  if (field.tagName === 'TEXTAREA') autosize(field);
});
if (Object.keys(saved).length) saveStatus.textContent = 'Welcome back — your answers were restored.';

let saveTimer;
form.addEventListener('input', event => {
  if (event.target.tagName === 'TEXTAREA') autosize(event.target);
  if (event.target.getAttribute('aria-invalid')) showError(event.target, '');
  clearTimeout(saveTimer);
  saveTimer = setTimeout(writeStore, 400);
});

window.addEventListener('beforeprint', () => form.querySelectorAll('textarea').forEach(autosize));
document.getElementById('print-btn').addEventListener('click', () => window.print());

document.getElementById('clear-btn').addEventListener('click', () => {
  if (!window.confirm('Clear every answer in this workbook? This cannot be undone.')) return;
  fields.forEach(field => { field.value = ''; if (field.tagName === 'TEXTAREA') autosize(field); });
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  saveStatus.textContent = 'Your answers were cleared.';
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
