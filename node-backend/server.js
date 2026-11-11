require('dotenv').config();
const express = require('express'), mysql = require('mysql2/promise'), bcrypt = require('bcryptjs'),
      jwt = require('jsonwebtoken'), path = require('path');

const app = express();
app.set('trust proxy', 1);
app.use((req, res, next) => { res.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin' }); next(); });
app.get('/health', (req, res) => res.send('ok'));
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost', port: +process.env.DB_PORT || 3306, user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '', database: process.env.DB_NAME || 'melodia_tms',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined
});
const SECRET = process.env.JWT_SECRET;
if (!SECRET || SECRET.length < 16) { console.error('Set JWT_SECRET (at least 16 random characters) in your environment.'); process.exit(1); }
const q = async (sql, p = []) => (await pool.query(sql, p))[0];
const wrap = f => (req, res) => f(req, res).catch(e => {
  console.error(e);
  res.status(e.status || (e.code === 'ER_DUP_ENTRY' ? 409 : 500)).json({ error: e.status ? e.message : e.code === 'ER_DUP_ENTRY' ? 'That email or enrollment already exists.' : 'Server error' });
});
const auth = role => async (req, res, next) => {
  try {
    const u = jwt.verify((req.headers.authorization || '').slice(7), SECRET);
    if (role && u.role !== role) return res.status(403).json({ error: 'Not allowed' });
    const [row] = await q('SELECT id FROM users WHERE id=?', [u.id]);
    if (!row) throw new Error('account removed');
    req.user = u; next();
  } catch { res.status(401).json({ error: 'Please log in' }); }
};
const admin = auth('admin');

// ---------- Login ----------
const tries = new Map(), WINDOW = 15 * 60 * 1000;
const recent = k => { const t = (tries.get(k) || []).filter(x => Date.now() - x < WINDOW); tries.set(k, t); return t; };
setInterval(() => tries.forEach((_, k) => recent(k).length || tries.delete(k)), WINDOW).unref();
const okPw = p => typeof p === 'string' && p.length >= 8;
const bad = msg => Object.assign(new Error(msg), { status: 400 });

app.post('/api/login', wrap(async (req, res) => {
  const { email, password } = req.body;
  const key = req.ip + '|' + String(email || '').toLowerCase();
  if (recent(key).length >= 10) return res.status(429).json({ error: 'Too many attempts. Try again in 15 minutes.' });
  const [u] = await q('SELECT * FROM users WHERE email=?', [email]);
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) {
    recent(key).push(Date.now());
    return res.status(401).json({ error: 'Wrong email or password' });
  }
  tries.delete(key);
  const token = jwt.sign({ id: u.id, role: u.role, studentId: u.student_id, name: u.name }, SECRET, { expiresIn: '8h' });
  res.json({ token, role: u.role, name: u.name });
}));

// ---------- Student sign-up (public) ----------
const signups = new Map();
app.post('/api/signup', wrap(async (req, res) => {
  if (process.env.SIGNUP_ENABLED === 'false') throw Object.assign(new Error('Sign-up is closed. Please contact the academy.'), { status: 403 });
  const now = Date.now(), t = (signups.get(req.ip) || []).filter(x => now - x < 3600000);
  if (t.length >= 5) throw Object.assign(new Error('Too many sign-ups from this connection. Try again later.'), { status: 429 });
  const { name, email, phone, password } = req.body;
  // Accept any name and any email text; only require that both are filled in and fit the database columns.
  if (typeof name !== 'string' || !name.trim() || typeof email !== 'string' || !email.trim()) throw bad('Enter your name and email.');
  if (name.trim().length > 100 || email.trim().length > 120) throw bad('Name (max 100) or email (max 120) is too long.');
  if (!okPw(password)) throw bad('Password must be at least 8 characters.');
  t.push(now); signups.set(req.ip, t);
  const taken = Object.assign(new Error('An account with that email already exists. Log in instead.'), { status: 409 });
  let sid;
  try { sid = (await q('INSERT INTO students (name,email,phone) VALUES (?,?,?)', [name.trim(), email.trim(), phone || null])).insertId; }
  catch (e) { throw e.code === 'ER_DUP_ENTRY' ? taken : e; }
  let uid;
  try { uid = (await q("INSERT INTO users (name,email,password_hash,role,student_id) VALUES (?,?,?,'student',?)", [name.trim(), email.trim(), bcrypt.hashSync(password, 10), sid])).insertId; }
  catch (e) { await q('DELETE FROM students WHERE id=?', [sid]); throw e.code === 'ER_DUP_ENTRY' ? taken : e; }
  const token = jwt.sign({ id: uid, role: 'student', studentId: sid, name: name.trim() }, SECRET, { expiresIn: '8h' });
  res.json({ token, role: 'student', name: name.trim() });
}));

// ---------- Passwords ----------
app.post('/api/change-password', auth(), wrap(async (req, res) => {
  const { current, password } = req.body;
  if (!okPw(password)) throw bad('New password must be at least 8 characters.');
  const [u] = await q('SELECT * FROM users WHERE id=?', [req.user.id]);
  if (!bcrypt.compareSync(current || '', u.password_hash)) throw bad('Current password is wrong.');
  await q('UPDATE users SET password_hash=? WHERE id=?', [bcrypt.hashSync(password, 10), u.id]);
  res.json({ ok: true });
}));
app.post('/api/students/:id/reset-password', admin, wrap(async (req, res) => {
  if (!okPw(req.body.password)) throw bad('Password must be at least 8 characters.');
  await q('UPDATE users SET password_hash=? WHERE student_id=?', [bcrypt.hashSync(req.body.password, 10), req.params.id]);
  res.json({ ok: true });
}));

// ---------- Generic admin CRUD ----------
function crud(name, table, cols, list, hooks = {}) {
  app.get(`/api/${name}`, admin, wrap(async (req, res) => res.json(await q(list))));
  app.post(`/api/${name}`, admin, wrap(async (req, res) => {
    if (hooks.pre) hooks.pre(req.body);
    const r = await q(`INSERT INTO ${table} (${cols.join(',')}) VALUES (?)`, [cols.map(c => req.body[c] ?? null)]);
    if (hooks.ins) try { await hooks.ins(r.insertId, req.body); } catch (e) { await q(`DELETE FROM ${table} WHERE id=?`, [r.insertId]); throw e; }
    res.json({ id: r.insertId });
  }));
  app.put(`/api/${name}/:id`, admin, wrap(async (req, res) => {
    await q(`UPDATE ${table} SET ${cols.map(c => c + '=?').join(',')} WHERE id=?`, [...cols.map(c => req.body[c] ?? null), req.params.id]);
    if (hooks.upd) await hooks.upd(req.params.id, req.body);
    res.json({ ok: true });
  }));
  app.delete(`/api/${name}/:id`, admin, wrap(async (req, res) => {
    await q(`DELETE FROM ${table} WHERE id=?`, [req.params.id]); res.json({ ok: true });
  }));
}
crud('students', 'students', ['name', 'email', 'phone'], 'SELECT * FROM students ORDER BY id DESC', {
  pre: b => { if (b.password && !okPw(b.password)) throw bad('Password must be at least 8 characters.'); },
  ins: (id, b) => q('INSERT INTO users (name,email,password_hash,role,student_id) VALUES (?,?,?,?,?)',
    [b.name, b.email, bcrypt.hashSync(b.password || 'student123', 10), 'student', id]),
  upd: (id, b) => q('UPDATE users SET name=?,email=? WHERE student_id=?', [b.name, b.email, id])
});
crud('instructors', 'instructors', ['name', 'email', 'specialty'], 'SELECT * FROM instructors ORDER BY id DESC');
crud('courses', 'courses', ['title', 'instructor_id', 'duration', 'fee'],
  'SELECT c.*, i.name AS instructor FROM courses c LEFT JOIN instructors i ON i.id=c.instructor_id ORDER BY c.id DESC');
crud('enrollments', 'enrollments', ['student_id', 'course_id'],
  `SELECT e.*, s.name AS student, c.title AS course, c.status AS course_status
   FROM enrollments e JOIN students s ON s.id=e.student_id JOIN courses c ON c.id=e.course_id ORDER BY e.id DESC`);

// ---------- Progress and revocation (admin) ----------
const put = (url, fn) => app.post(url, admin, wrap(async (req, res) => { await fn(req); res.json({ ok: true }); }));
app.put('/api/enrollments/:id/progress', admin, wrap(async (req, res) => {
  const p = Math.max(0, Math.min(100, +req.body.progress || 0));
  const st = p >= 100 ? 'Completed' : p > 0 ? 'In Progress' : 'Enrolled';
  await q("UPDATE enrollments SET progress=?, status=?, revoked_reason=NULL WHERE id=? AND status<>'Revoked'", [p, st, req.params.id]);
  res.json({ status: st });
}));
// Take back a completion: student drops to In Progress (max 90%)
put('/api/enrollments/:id/revoke-completion', r =>
  q("UPDATE enrollments SET status='In Progress', progress=LEAST(progress,90), revoked_reason=? WHERE id=? AND status='Completed'",
    [r.body.reason || 'Completion revoked by admin', r.params.id]));
// Revoke a student's place in a class
put('/api/enrollments/:id/revoke', r =>
  q("UPDATE enrollments SET status='Revoked', revoked_reason=? WHERE id=?", [r.body.reason || 'Revoked by admin', r.params.id]));
put('/api/enrollments/:id/reinstate', r =>
  q(`UPDATE enrollments SET revoked_reason=NULL,
     status=CASE WHEN progress>=100 THEN 'Completed' WHEN progress>0 THEN 'In Progress' ELSE 'Enrolled' END
     WHERE id=? AND status='Revoked'`, [r.params.id]));
// Revoke a whole class (every student sees it as revoked)
put('/api/courses/:id/revoke', r =>
  q("UPDATE courses SET status='Revoked', revoked_reason=? WHERE id=?", [r.body.reason || 'Class closed by the academy', r.params.id]));
put('/api/courses/:id/reinstate', r =>
  q("UPDATE courses SET status='Active', revoked_reason=NULL WHERE id=?", [r.params.id]));

app.get('/api/stats', admin, wrap(async (req, res) => {
  const [s] = await q(`SELECT
    (SELECT COUNT(*) FROM students) students, (SELECT COUNT(*) FROM courses) courses,
    (SELECT COUNT(*) FROM instructors) instructors,
    (SELECT COUNT(*) FROM enrollments WHERE status IN ('Enrolled','In Progress')) active`);
  res.json(s);
}));

// ---------- Student portal ----------
app.get('/api/my/enrollments', auth('student'), wrap(async (req, res) => {
  res.json(await q(`SELECT e.id, c.title, c.duration, i.name AS instructor, e.progress,
      IF(c.status='Revoked','Revoked',e.status) AS status,
      IF(c.status='Revoked', COALESCE(c.revoked_reason,'This class was closed.'), e.revoked_reason) AS reason
    FROM enrollments e JOIN courses c ON c.id=e.course_id LEFT JOIN instructors i ON i.id=c.instructor_id
    WHERE e.student_id=? ORDER BY e.id DESC`, [req.user.studentId]));
}));

// ---------- First-run: create admin and student logins ----------
async function init() {
  const [a] = await q("SELECT id FROM users WHERE role='admin' LIMIT 1");
  if (!a) {
    if (!process.env.ADMIN_PASSWORD) console.warn('ADMIN_PASSWORD not set: using the default "admin123". Change it after logging in.');
    await q("INSERT INTO users (name,email,password_hash,role) VALUES (?,?,?,'admin')",
      ['Academy Admin', process.env.ADMIN_EMAIL || 'admin@melodia.dev', bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'admin123', 10)]);
  }
  const missing = await q('SELECT s.* FROM students s LEFT JOIN users u ON u.student_id=s.id WHERE u.id IS NULL');
  for (const s of missing) await q("INSERT INTO users (name,email,password_hash,role,student_id) VALUES (?,?,?,'student',?)",
    [s.name, s.email, bcrypt.hashSync('student123', 10), s.id]);
}
init().then(() => app.listen(process.env.PORT || 3000, () => console.log('Running on http://localhost:' + (process.env.PORT || 3000))))
  .catch(e => { console.error('Could not start. Check your database settings in .env\n', e.message); process.exit(1); });
