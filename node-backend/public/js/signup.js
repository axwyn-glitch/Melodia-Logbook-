document.getElementById('f').onsubmit = async e => {
  e.preventDefault();
  const err = document.getElementById('err'); err.textContent = '';
  if (pw.value !== pw2.value) { err.textContent = 'The two passwords do not match.'; return; }
  try {
    const d = await api('/signup', 'POST', { name: name.value, email: email.value, phone: phone.value, password: pw.value });
    localStorage.setItem('tms_token', d.token); localStorage.setItem('tms_role', d.role); localStorage.setItem('tms_name', d.name);
    location.href = '/student.html';
  } catch (x) { err.textContent = x.message; }
};
