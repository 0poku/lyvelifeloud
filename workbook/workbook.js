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

// "Email me a link": answers are compressed into the link's #fragment (never sent to any server),
// so the workbook can be picked up on another device with nothing but static hosting.
const resumeStatus = document.getElementById('resume-status');
const resumeEmail = document.getElementById('resume-email');
const shareBtn = document.getElementById('resume-share-btn');

function setResumeStatus(message, kind) {
  resumeStatus.textContent = message;
  resumeStatus.className = 'wb-status' + (kind ? ' is-' + kind : '');
}

function toBase64Url(bytes) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text) {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function packAnswers() {
  const data = {};
  fields.forEach(field => { if (field.value.trim()) data[field.id] = field.value; });
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  if ('CompressionStream' in window) {
    const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate-raw'));
    return 'z' + toBase64Url(new Uint8Array(await new Response(stream).arrayBuffer()));
  }
  return 'j' + toBase64Url(bytes);
}

async function unpackAnswers(code) {
  let bytes = fromBase64Url(code.slice(1));
  if (code[0] === 'z') {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return JSON.parse(new TextDecoder().decode(bytes));
}

async function buildLink() {
  return location.origin + location.pathname + '#a=' + await packAnswers();
}

function hasAnswers() {
  return fields.some(field => field.value.trim());
}

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

document.getElementById('resume-email-btn').addEventListener('click', async () => {
  if (!hasAnswers()) { setResumeStatus('Add a few answers first — then send yourself the link.', 'error'); return; }
  const to = resumeEmail.value.trim();
  if (to && !resumeEmail.checkValidity()) { setResumeStatus('That email address doesn’t look quite right.', 'error'); resumeEmail.focus(); return; }
  writeStore();
  const link = await buildLink();
  const copied = await copyText(link);
  const body = 'Here is my Surviving to Thriving workbook. Open this link on any phone or computer to pick up where I left off:\n\n' + link + '\n\nLive Lyfe Loud';
  window.location.href = 'mailto:' + encodeURIComponent(to) + '?subject=' + encodeURIComponent('My Surviving to Thriving workbook') + '&body=' + encodeURIComponent(body);
  setResumeStatus('Your email app should open with the link ready — just press send.' + (copied ? ' We also copied the link, so you can paste it if the email doesn’t open or the link looks cut off.' : ''), 'success');
});

document.getElementById('resume-copy-btn').addEventListener('click', async () => {
  if (!hasAnswers()) { setResumeStatus('Add a few answers first — then copy your link.', 'error'); return; }
  writeStore();
  const link = await buildLink();
  if (await copyText(link)) setResumeStatus('Link copied. Paste it into an email, text, or note to yourself.', 'success');
  else window.prompt('Copy your workbook link:', link);
});

if (navigator.share) {
  shareBtn.hidden = false;
  shareBtn.addEventListener('click', async () => {
    if (!hasAnswers()) { setResumeStatus('Add a few answers first — then share your link.', 'error'); return; }
    writeStore();
    try { await navigator.share({ title: 'My Surviving to Thriving workbook', url: await buildLink() }); } catch {}
  });
}

const prefillEmail = () => { if (!resumeEmail.value && form.elements.email.value) resumeEmail.value = form.elements.email.value; };
prefillEmail();
form.elements.email.addEventListener('change', prefillEmail);

// Opening a link: load its answers, save them on this device, then tidy the address bar.
async function importFromLink() {
  if (location.hash.indexOf('#a=') !== 0) return;
  const code = location.hash.slice(3);
  history.replaceState(null, '', location.pathname + location.search);
  setOpen(true, false);
  let data;
  try { data = await unpackAnswers(code); } catch {
    setResumeStatus('This workbook link couldn’t be opened. It may have been cut off — try copying the whole link again.', 'error');
    document.getElementById('resume').scrollIntoView();
    return;
  }
  if (hasAnswers() && !window.confirm('Load the answers from your link? This replaces the answers currently saved on this device.')) return;
  fields.forEach(field => { field.value = data[field.id] || ''; });
  sizeAll();
  dirty = true;
  writeStore();
  showSaveStatus('Welcome back — your workbook was loaded from your link');
  online.scrollIntoView({ block: 'start' });
}
importFromLink();

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
