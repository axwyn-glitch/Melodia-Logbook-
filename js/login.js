if (localStorage.getItem('tms_token')) location.href = localStorage.getItem('tms_role') === 'admin' ? 'admin.html' : 'student.html';
document.getElementById('f').onsubmit = async e => {
  e.preventDefault();
  const err = document.getElementById('err'); err.textContent = '';
  try {
    const d = await api('/login', 'POST', { email: email.value.trim(), password: pw.value });
    localStorage.setItem('tms_token', d.token); localStorage.setItem('tms_role', d.role); localStorage.setItem('tms_name', d.name);
    location.href = d.role === 'admin' ? 'admin.html' : 'student.html';
  } catch (x) { err.textContent = x.message; }
};
