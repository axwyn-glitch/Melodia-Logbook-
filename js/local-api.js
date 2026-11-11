// Browser-only backend: same API the Node server offered, stored in this browser's localStorage.
(function () {
  const KEY = 'tms_db';
  const err = (m, s = 400) => Object.assign(new Error(m), { status: s });
  const okPw = p => typeof p === 'string' && p.length >= 8;
  const low = s => String(s || '').trim().toLowerCase();
  async function hash(p) {
    try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('melodia:' + p)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
    catch { let h = 5381; for (const c of 'melodia:' + p) h = (h * 33 ^ c.charCodeAt(0)) >>> 0; return 'x' + h; }
  }
  const save = d => localStorage.setItem(KEY, JSON.stringify(d));
  async function db() {
    let d; try { d = JSON.parse(localStorage.getItem(KEY)); } catch {}
    if (d && d.users) return d;
    const [a, s] = await Promise.all([hash('admin123'), hash('student123')]);
    const stu = [['Mary James', 'mary@example.com', '0803 000 0001'], ['Daniel Eze', 'daniel@example.com', '0803 000 0002'], ['Grace Adebayo', 'grace@example.com', '0803 000 0003'], ['John Okafor', 'john@example.com', '0803 000 0004']];
    d = { seq: 100,
      instructors: [[1, 'Tunde Bello', 'tunde@melodia.dev', 'Full Stack'], [2, 'Amaka Obi', 'amaka@melodia.dev', 'JavaScript'], [3, 'Sade Ibrahim', 'sade@melodia.dev', 'Frontend']].map(r => ({ id: r[0], name: r[1], email: r[2], specialty: r[3] })),
      courses: [[1, 'Full Stack Web Development', 1, '6 months', 250000], [2, 'JavaScript Programming', 2, '3 months', 120000], [3, 'Frontend Web Development', 3, '4 months', 150000]].map(r => ({ id: r[0], title: r[1], instructor_id: r[2], duration: r[3], fee: r[4], status: 'Active', revoked_reason: null })),
      students: stu.map((r, i) => ({ id: i + 1, name: r[0], email: r[1], phone: r[2] })),
      enrollments: [[1, 1, 'Enrolled', 0], [2, 2, 'Completed', 100], [3, 3, 'In Progress', 45], [4, 1, 'In Progress', 30]].map((r, i) => ({ id: i + 1, student_id: r[0], course_id: r[1], status: r[2], progress: r[3], revoked_reason: null })),
      users: [{ id: 1, name: 'Academy Admin', email: 'admin@melodia.dev', hash: a, role: 'admin', student_id: null }, ...stu.map((r, i) => ({ id: i + 2, name: r[0], email: r[1], hash: s, role: 'student', student_id: i + 1 }))] };
    save(d); return d;
  }
  const T = { students: ['name', 'email', 'phone'], instructors: ['name', 'email', 'specialty'], courses: ['title', 'instructor_id', 'duration', 'fee'], enrollments: ['student_id', 'course_id'] };

  window.localApi = async function (url, method, body) {
    const b = body || {}, m = method || 'GET', path = url.split('?')[0], d = await db();
    if (path === '/login' && m === 'POST') {
      const u = d.users.find(x => low(x.email) === low(b.email));
      if (!u || u.hash !== await hash(b.password || '')) throw err('Wrong email or password', 401);
      return { token: String(u.id), role: u.role, name: u.name };
    }
    if (path === '/signup' && m === 'POST') {
      if (!String(b.name || '').trim() || !String(b.email || '').trim()) throw err('Enter your name and email.');
      if (b.name.trim().length > 100 || b.email.trim().length > 120) throw err('Name or email is too long.');
      if (!okPw(b.password)) throw err('Password must be at least 8 characters.');
      if (d.users.some(x => low(x.email) === low(b.email))) throw err('An account with that email already exists. Log in instead.', 409);
      const sid = ++d.seq, uid = ++d.seq;
      d.students.push({ id: sid, name: b.name.trim(), email: b.email.trim(), phone: b.phone || null });
      d.users.push({ id: uid, name: b.name.trim(), email: b.email.trim(), hash: await hash(b.password), role: 'student', student_id: sid });
      save(d); return { token: String(uid), role: 'student', name: b.name.trim() };
    }
    const me = d.users.find(u => String(u.id) === localStorage.getItem('tms_token'));
    if (!me) throw err('Please log in', 401);
    const adm = () => { if (me.role !== 'admin') throw err('Not allowed', 403); };

    if (path === '/change-password' && m === 'POST') {
      if (!okPw(b.password)) throw err('New password must be at least 8 characters.');
      if (me.hash !== await hash(b.current || '')) throw err('Current password is wrong.');
      me.hash = await hash(b.password); save(d); return { ok: true };
    }
    if (path === '/my/enrollments') {
      if (me.role !== 'student') throw err('Not allowed', 403);
      return d.enrollments.filter(e => e.student_id === me.student_id).reverse().map(e => {
        const c = d.courses.find(x => x.id === e.course_id) || {}, i = d.instructors.find(x => x.id === c.instructor_id);
        const rev = c.status === 'Revoked';
        return { id: e.id, title: c.title, duration: c.duration, instructor: i ? i.name : null, progress: e.progress,
          status: rev ? 'Revoked' : e.status, reason: rev ? (c.revoked_reason || 'This class was closed.') : e.revoked_reason };
      });
    }
    adm();
    if (path === '/stats') return { students: d.students.length, courses: d.courses.length, instructors: d.instructors.length,
      active: d.enrollments.filter(e => ['Enrolled', 'In Progress'].includes(e.status)).length };

    let r = path.match(/^\/students\/(\d+)\/reset-password$/);
    if (r && m === 'POST') {
      if (!okPw(b.password)) throw err('Password must be at least 8 characters.');
      const u = d.users.find(x => x.student_id === +r[1]); if (u) u.hash = await hash(b.password); save(d); return { ok: true };
    }
    r = path.match(/^\/enrollments\/(\d+)\/(progress|revoke-completion|revoke|reinstate)$/);
    if (r) {
      const e = d.enrollments.find(x => x.id === +r[1]); if (!e) throw err('Not found', 404);
      if (r[2] === 'progress') {
        const p = Math.max(0, Math.min(100, +b.progress || 0)), st = p >= 100 ? 'Completed' : p > 0 ? 'In Progress' : 'Enrolled';
        if (e.status !== 'Revoked') { e.progress = p; e.status = st; e.revoked_reason = null; } save(d); return { status: st };
      }
      if (r[2] === 'revoke-completion' && e.status === 'Completed') { e.status = 'In Progress'; e.progress = Math.min(e.progress, 90); e.revoked_reason = b.reason || 'Completion revoked by admin'; }
      if (r[2] === 'revoke') { e.status = 'Revoked'; e.revoked_reason = b.reason || 'Revoked by admin'; }
      if (r[2] === 'reinstate' && e.status === 'Revoked') { e.revoked_reason = null; e.status = e.progress >= 100 ? 'Completed' : e.progress > 0 ? 'In Progress' : 'Enrolled'; }
      save(d); return { ok: true };
    }
    r = path.match(/^\/courses\/(\d+)\/(revoke|reinstate)$/);
    if (r) {
      const c = d.courses.find(x => x.id === +r[1]); if (!c) throw err('Not found', 404);
      c.status = r[2] === 'revoke' ? 'Revoked' : 'Active'; c.revoked_reason = r[2] === 'revoke' ? (b.reason || 'Class closed by the academy') : null;
      save(d); return { ok: true };
    }
    r = path.match(/^\/(students|instructors|courses|enrollments)(?:\/(\d+))?$/);
    if (!r) throw err('Not found', 404);
    const n = r[1], id = r[2] && +r[2], cols = T[n], find = (k, v) => d[k].find(x => x.id === v) || {};
    if (m === 'GET') {
      const rows = [...d[n]].reverse();
      if (n === 'courses') return rows.map(c => ({ ...c, instructor: find('instructors', c.instructor_id).name || null }));
      if (n === 'enrollments') return rows.map(e => ({ ...e, student: find('students', e.student_id).name, course: find('courses', e.course_id).title, course_status: find('courses', e.course_id).status }));
      return rows;
    }
    if (m === 'POST') {
      const rec = { id: ++d.seq }; cols.forEach(c => rec[c] = b[c] ?? null);
      if (n === 'students') {
        if (b.password && !okPw(b.password)) throw err('Password must be at least 8 characters.');
        if (d.users.some(x => low(x.email) === low(b.email))) throw err('That email or enrollment already exists.', 409);
        d.users.push({ id: ++d.seq, name: b.name, email: b.email, hash: await hash(b.password || 'student123'), role: 'student', student_id: rec.id });
      }
      if (n === 'courses') Object.assign(rec, { status: 'Active', revoked_reason: null });
      if (n === 'enrollments') {
        if (d.enrollments.some(e => e.student_id === rec.student_id && e.course_id === rec.course_id)) throw err('That email or enrollment already exists.', 409);
        Object.assign(rec, { status: 'Enrolled', progress: 0, revoked_reason: null });
      }
      d[n].push(rec); save(d); return { id: rec.id };
    }
    const rec = d[n].find(x => x.id === id); if (!rec) throw err('Not found', 404);
    if (m === 'PUT') {
      cols.forEach(c => rec[c] = b[c] ?? null);
      if (n === 'students') d.users.filter(u => u.student_id === id).forEach(u => { u.name = rec.name; u.email = rec.email; });
      save(d); return { ok: true };
    }
    if (m === 'DELETE') {
      d[n] = d[n].filter(x => x.id !== id);
      if (n === 'students') { d.users = d.users.filter(u => u.student_id !== id); d.enrollments = d.enrollments.filter(e => e.student_id !== id); }
      if (n === 'courses') d.enrollments = d.enrollments.filter(e => e.course_id !== id);
      if (n === 'instructors') d.courses.forEach(c => { if (c.instructor_id === id) c.instructor_id = null; });
      save(d); return { ok: true };
    }
    throw err('Not found', 404);
  };
})();
