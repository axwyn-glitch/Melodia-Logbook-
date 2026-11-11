guard('admin');
const pages = ['Dashboard', 'Students', 'Courses', 'Instructors', 'Enrollments', 'Training Progress'];
let page = 'Dashboard', q = '', D = { students: [], courses: [], instructors: [], enrollments: [], stats: {} };

// Table columns and form fields for each section
const C = {
  students: { t: 'Students', one: 'student', cols: [['name', 'Name'], ['email', 'Email'], ['phone', 'Phone']],
    f: [['name', 'Full name'], ['email', 'Email', 'email'], ['phone', 'Phone']], addOnly: [['password', 'Login password (blank = student123)', 'password', true]] },
  courses: { t: 'Courses', one: 'course', cols: [['title', 'Course'], ['instructor', 'Instructor'], ['duration', 'Duration'], ['fee', 'Fee'], ['status', 'Class status']],
    f: [['title', 'Course title'], ['instructor_id', 'Instructor', 'sel', 'instructors', 'name'], ['duration', 'Duration'], ['fee', 'Fee (₦)', 'number']] },
  instructors: { t: 'Instructors', one: 'instructor', cols: [['name', 'Name'], ['email', 'Email'], ['specialty', 'Specialty']],
    f: [['name', 'Full name'], ['email', 'Email', 'email'], ['specialty', 'Specialty']] },
  enrollments: { t: 'Enrollments', one: 'enrollment', cols: [['student', 'Student'], ['course', 'Course'], ['progress', 'Progress'], ['status', 'Status']],
    f: [['student_id', 'Student', 'sel', 'students', 'name'], ['course_id', 'Course', 'sel', 'courses', 'title']] }
};
const show = (k, r) => k === 'status' ? pill(r.status) : k === 'fee' ? '₦' + Number(r.fee).toLocaleString() : k === 'progress' ? r.progress + '%' : esc(r[k] ?? '—');

async function load() {
  const [students, courses, instructors, enrollments, stats] = await Promise.all(['/students', '/courses', '/instructors', '/enrollments', '/stats'].map(u => api(u)));
  D = { students, courses, instructors, enrollments, stats }; render();
}
const nav = () => document.getElementById('nav').innerHTML = pages.map(p => `<button class="${p === page ? 'on' : ''}" data-p="${p}">${p}</button>`).join('');
document.getElementById('nav').onclick = e => { if (e.target.dataset.p) { page = e.target.dataset.p; q = ''; render(); } };
const act = async (fn) => { try { await fn(); await load(); } catch (e) { alert(e.message); } };

function keepSearch() { const i = document.getElementById('sq'); i.oninput = ev => { q = ev.target.value.toLowerCase(); const p = ev.target.selectionStart; render(); const n = document.getElementById('sq'); n.focus(); n.setSelectionRange(p, p); }; }

function render() {
  nav(); const m = document.getElementById('main'); m.onclick = null;
  if (page === 'Dashboard') {
    const s = D.stats, rec = D.enrollments.slice(0, 5);
    m.innerHTML = `<h1>Dashboard</h1><p class="sub">Welcome to Melodia Coding Academy Training Management System.</p>
    <div class="stats">${[['Total Students', s.students], ['Total Courses', s.courses], ['Total Instructors', s.instructors], ['Active Enrollments', s.active]].map(x => `<div class="card stat"><span>${x[0]}</span><b>${x[1] ?? 0}</b><span>Current academy records</span></div>`).join('')}</div>
    <div class="grid"><div class="card"><h2>Recent Enrollments</h2><div class="scroll"><table><tr><th>Student</th><th>Course</th><th>Status</th></tr>${rec.map(e => `<tr><td><b>${esc(e.student)}</b></td><td>${esc(e.course)}</td><td>${pill(e.status)}</td></tr>`).join('') || '<tr><td colspan=3 class="empty">No enrollments yet.</td></tr>'}</table></div></div>
    <div class="card info"><h2>System Information</h2><p><small>Organization</small><b>Melodia Coding Academy</b></p><p><small>Database</small><b>MySQL</b></p><p><small>Backend</small><b>Node.js / Express</b></p><p><small>Frontend</small><b>HTML, CSS, JavaScript</b></p></div></div>`;
    return;
  }
  if (page === 'Training Progress') {
    const rows = D.enrollments.filter(e => (e.student + e.course).toLowerCase().includes(q));
    m.innerHTML = `<h1>Training Progress</h1><p class="sub">Drag a slider, then release to save. Revoked enrollments are locked.</p><div class="bar"><input id="sq" placeholder="Search student or course" value="${esc(q)}"></div>
    <div class="card scroll"><table><tr><th>Student</th><th>Course</th><th>Progress</th><th>Status</th></tr>${rows.map(e => `<tr><td><b>${esc(e.student)}</b></td><td>${esc(e.course)}</td>
    <td><div class="prog"><input type="range" min="0" max="100" step="5" value="${e.progress}" data-id="${e.id}" ${e.status === 'Revoked' ? 'disabled' : ''} aria-label="Progress"><span id="pv${e.id}">${e.progress}%</span></div></td><td id="ps${e.id}">${pill(e.status)}</td></tr>`).join('') || '<tr><td colspan=4 class="empty">No matching records.</td></tr>'}</table></div>`;
    m.querySelectorAll('input[type=range]').forEach(r => {
      r.oninput = () => document.getElementById('pv' + r.dataset.id).textContent = r.value + '%';
      r.onchange = () => act(async () => { await api(`/enrollments/${r.dataset.id}/progress`, 'PUT', { progress: +r.value }); });
    });
    keepSearch(); return;
  }
  const c = page.toLowerCase(), g = C[c];
  const rows = D[c].filter(r => JSON.stringify(r).toLowerCase().includes(q));
  m.innerHTML = `<h1>${g.t}</h1><p class="sub">${D[c].length} record${D[c].length === 1 ? '' : 's'}</p>
  <div class="bar"><input id="sq" placeholder="Search ${g.t.toLowerCase()}" value="${esc(q)}"><button class="b" id="add">Add ${g.one}</button></div>
  <div class="card scroll"><table><tr>${g.cols.map(x => `<th>${x[1]}</th>`).join('')}<th></th></tr>${rows.map(r => `<tr>${g.cols.map(x => `<td>${show(x[0], r)}</td>`).join('')}<td style="text-align:right;white-space:nowrap">${actions(c, r)}</td></tr>`).join('') || `<tr><td colspan="${g.cols.length + 1}" class="empty">Nothing here yet. Add the first ${g.one}.</td></tr>`}</table></div>`;
  document.getElementById('add').onclick = () => form(c);
  m.onclick = e => { const d = e.target.dataset; if (d.a) doAction(c, d.a, +d.id); };
  keepSearch();
}
function actions(c, r) {
  const b = (a, l, cls = '') => `<button class="g ${cls}" data-a="${a}" data-id="${r.id}">${l}</button>`;
  if (c === 'enrollments') return (r.status === 'Completed' ? b('revcomp', 'Revoke completion') : '') + (r.status === 'Revoked' ? b('reinstate', 'Reinstate') : b('revoke', 'Revoke class', 'd')) + b('del', 'Delete', 'd');
  if (c === 'courses') return b('edit', 'Edit') + (r.status === 'Revoked' ? b('creinstate', 'Reinstate class') : b('crevoke', 'Revoke class', 'd')) + b('del', 'Delete', 'd');
  return b('edit', 'Edit') + (c === 'students' ? b('pw', 'Reset password') : '') + b('del', 'Delete', 'd');
}
function doAction(c, a, id) {
  const reason = t => prompt(t + '\nReason (shown to the student):', '');
  if (a === 'edit') return form(c, id);
  if (a === 'pw') return pwDialog('Reset student password', ['New password (8+ characters)'], v => api(`/students/${id}/reset-password`, 'POST', { password: v[0] }));
  if (a === 'del') { if (confirm('Delete this record? Linked records are removed too.')) act(() => api(`/${c}/${id}`, 'DELETE')); return; }
  if (a === 'revcomp') { const r = reason('Revoke this completion? The student goes back to In Progress.'); if (r !== null) act(() => api(`/enrollments/${id}/revoke-completion`, 'POST', { reason: r })); }
  if (a === 'revoke') { const r = reason('Revoke this student’s place in the class?'); if (r !== null) act(() => api(`/enrollments/${id}/revoke`, 'POST', { reason: r })); }
  if (a === 'reinstate') act(() => api(`/enrollments/${id}/reinstate`, 'POST'));
  if (a === 'crevoke') { const r = reason('Revoke this whole class? Every enrolled student will see it as revoked.'); if (r !== null) act(() => api(`/courses/${id}/revoke`, 'POST', { reason: r })); }
  if (a === 'creinstate') act(() => api(`/courses/${id}/reinstate`, 'POST'));
}
function form(c, id) {
  const g = C[c], r = id ? D[c].find(x => x.id === id) : {}, f = document.getElementById('frm'), dlg = document.getElementById('dlg');
  if (c === 'courses' && !D.instructors.length) return alert('Add an instructor first.');
  if (c === 'enrollments' && (!D.students.length || !D.courses.length)) return alert('Add at least one student and one course first.');
  const fields = [...g.f, ...(!id && g.addOnly ? g.addOnly : [])];
  f.innerHTML = `<h2>${id ? 'Edit' : 'Add'} ${g.one}</h2>` + fields.map(x => x[2] === 'sel'
    ? `<label>${x[1]}<select name="${x[0]}">${D[x[3]].map(o => `<option value="${o.id}" ${o.id == r[x[0]] ? 'selected' : ''}>${esc(o[x[4]])}</option>`).join('')}</select></label>`
    : `<label>${x[1]}<input name="${x[0]}" type="${x[2] || 'text'}" value="${esc(r[x[0]] ?? '')}" ${x[3] ? '' : 'required'}></label>`).join('')
    + '<div class="err" id="ferr"></div><div class="row"><button type="button" class="g" id="cx">Cancel</button><button class="b">Save changes</button></div>';
  dlg.showModal(); document.getElementById('cx').onclick = () => dlg.close();
  f.onsubmit = async ev => {
    ev.preventDefault(); const body = {};
    fields.forEach(x => { let v = f.elements[x[0]].value; body[x[0]] = (x[2] === 'number' || x[2] === 'sel') ? +v : v; });
    try { await api(id ? `/${c}/${id}` : `/${c}`, id ? 'PUT' : 'POST', body); dlg.close(); await load(); }
    catch (e) { document.getElementById('ferr').textContent = e.message; }
  };
}
load().catch(e => document.getElementById('main').innerHTML = `<div class="card err">${esc(e.message)}</div>`);
