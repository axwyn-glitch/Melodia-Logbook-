guard('student');
document.getElementById('hi').textContent = 'Hello, ' + (localStorage.getItem('tms_name') || 'student');
(async () => {
  const rows = await api('/my/enrollments');
  const n = s => rows.filter(r => r.status === s).length;
  document.getElementById('stats').innerHTML = [['My classes', rows.length], ['Completed', n('Completed')], ['In progress', n('In Progress') + n('Enrolled')], ['Revoked', n('Revoked')]]
    .map(s => `<div class="card stat"><span>${s[0]}</span><b>${s[1]}</b></div>`).join('');
  document.getElementById('list').innerHTML = rows.map(r => `<div class="card class">
    <div><h2>${esc(r.title)}</h2><div class="meta">${esc(r.instructor || 'No instructor yet')} · ${esc(r.duration || '')}</div></div>${pill(r.status)}
    <div class="meter" role="progressbar" aria-valuenow="${r.progress}" aria-valuemin="0" aria-valuemax="100"><i style="width:${r.progress}%"></i></div>
    <div class="meta">${r.progress}% complete${r.status === 'Completed' ? '. You have completed this class.' : ''}</div>
    ${r.reason ? `<div class="why">${r.status === 'Revoked' ? 'Revoked' : 'Update'}: ${esc(r.reason)}</div>` : ''}</div>`).join('')
    || '<div class="card empty">You are not enrolled in any class yet. Contact the academy office.</div>';
})().catch(e => document.getElementById('list').innerHTML = `<div class="card err">${esc(e.message)}</div>`);
