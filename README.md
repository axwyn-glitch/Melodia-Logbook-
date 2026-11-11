# Melodia Coding Academy – Training Management System

Static site (HTML, CSS, JavaScript). No server or database needed. Opening the site shows the login page.

- Login: `login.html` (admin and students both log in here and are sent to the right portal)
- Admin portal: `admin.html` · Student portal: `student.html` · Sign-up: `signup.html`

## Default logins (change them after first login)
- Admin: `admin@melodia.dev` / `admin123`
- Sample students: `mary@example.com`, `daniel@example.com`, `grace@example.com`, `john@example.com` / `student123`

## Deploy on Netlify
Drag this folder onto https://app.netlify.com/drop, or connect the GitHub repo (no build command; publish directory `.`).

## Deploy on GitHub Pages
Push this folder to a repo, then Settings → Pages → Deploy from branch → `main` / `(root)`.
Your site will be at `https://<your-username>.github.io/<repo>/`.

## Important: where the data lives
Data is stored in each visitor's own browser (localStorage). It is not shared between devices or people, so a student
who signs up on their phone will not appear in the admin's browser. Passwords are only hashed in the browser, so this is
suited to demos, training and single-computer use. For shared, secure data you need a real backend:
the original Node.js + MySQL version is kept in `node-backend/` (see its README).
