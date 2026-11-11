# Melodia Training Management System

HTML, CSS and JavaScript front end, Node.js/Express back end, MySQL database.
Admin portal: `/admin.html`. Student portal: `/student.html`. Both log in at `/login.html`.

## Run it on your computer
1. Install Node.js 18+ and MySQL. Create an empty database: `CREATE DATABASE melodia_tms;`
2. Load the tables: `mysql -u root -p melodia_tms < schema.sql`
3. Optional sample data: `mysql -u root -p melodia_tms < seed.sql`
4. Copy `.env.example` to `.env`. Fill in the DB_ settings, a long random `JWT_SECRET`, and an `ADMIN_PASSWORD`.
5. `npm install`, then `npm start`, then open http://localhost:3000

The first start creates the admin account (from ADMIN_EMAIL / ADMIN_PASSWORD) and a login for every student
(password `student123` until you reset it with "Reset password" in the admin Students page, or the student changes it).

## Put it on a live server
You need two things: somewhere to run Node, and a MySQL database it can reach.

**Option A: managed host (easiest).** Use a host that runs Node apps from a Git repo (Render, Railway, etc.) plus a hosted MySQL.
1. Push this folder to a GitHub repo (`.env` and `node_modules` are already git-ignored).
2. Create the MySQL database on your host and run `schema.sql` on it (use any MySQL client, e.g. MySQL Workbench or DBeaver).
3. Create a web service from the repo. Build command: `npm install`. Start command: `npm start`.
4. Set the environment variables from `.env.example` in the host's dashboard (DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME,
   DB_SSL=true if the database requires SSL, JWT_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD). Do not set PORT; the host provides it.
5. Open the URL the host gives you, then log in at `/login.html`. `/health` returns `ok` for uptime checks.

**Option B: your own VPS.** Install Node 18+, MySQL, nginx and pm2. Run `pm2 start server.js --name melodia`, proxy nginx to
port 3000, and add HTTPS with certbot.

**Option C: cPanel shared hosting.** Use "Setup Node.js App" (startup file `server.js`), create the MySQL database in
cPanel, import `schema.sql` with phpMyAdmin, and set the environment variables in the app settings.

## Before going live
- Always serve over HTTPS; logins and tokens travel in every request.
- Set a strong `ADMIN_PASSWORD` and `JWT_SECRET`. The server refuses to start without a JWT_SECRET.
- Skip `seed.sql` on the real site, and have students change their first password.
- Back up the database regularly.

## What the portals do
- **Admin:** manage students, courses, instructors and enrollments; update progress; revoke a completion, revoke a
  student's place in a class, or revoke a whole class (all undoable with Reinstate); reset student passwords.
- **Student:** see each class, progress, completion status and any revocation reason; change their own password.
- **Sign-up:** new students create their own account at `/signup.html` (5 per hour per connection). The admin then adds them to a class under Enrollments. Set `SIGNUP_ENABLED=false` to close sign-up.
- Logging in is limited to 10 failed attempts per 15 minutes per email and address.
