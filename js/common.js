async function api(url, method = 'GET', body) {
  try { return await localApi(url, method, body); }
  catch (e) { if (e.status === 401 && !url.startsWith('/login')) { logout(); throw new Error('Please log in'); } throw e; }
}
function logout() { localStorage.removeItem('tms_token'); localStorage.removeItem('tms_role'); localStorage.removeItem('tms_name'); location.href = 'login.html'; }
function guard(role) { if (localStorage.getItem('tms_role') !== role) { logout(); } }
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pill = s => `<span class="pill ${String(s).replace(' ', '-')}">${esc(s)}</span>`;

function pwDialog(title, labels, onOk) {
  const d = document.createElement('dialog');
  d.innerHTML = `<form method="dialog"><h2>${esc(title)}</h2>${labels.map((l, i) => `<label>${esc(l)}<input type="password" required minlength="${i === labels.length - 1 ? 8 : 1}" autocomplete="${i === labels.length - 1 ? 'new-password' : 'current-password'}"></label>`).join('')}<div class="err" role="alert"></div><div class="row"><button type="button" class="g" data-x>Cancel</button><button class="b">Save password</button></div></form>`;
  document.body.appendChild(d); d.showModal();
  const f = d.querySelector('form'), close = () => { d.close(); d.remove(); };
  d.querySelector('[data-x]').onclick = close;
  f.onsubmit = async e => {
    e.preventDefault();
    try { await onOk([...f.querySelectorAll('input')].map(i => i.value)); close(); alert('Password updated.'); }
    catch (x) { d.querySelector('.err').textContent = x.message; }
  };
}
const changeMyPassword = () => pwDialog('Change your password', ['Current password', 'New password (8+ characters)'], v => api('/change-password', 'POST', { current: v[0], password: v[1] }));
