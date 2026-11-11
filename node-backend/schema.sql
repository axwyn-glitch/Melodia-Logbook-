-- Run this once against an empty database (select the database first).
CREATE TABLE IF NOT EXISTS instructors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL,
  specialty VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(150) NOT NULL,
  instructor_id INT NULL,
  duration VARCHAR(50),
  fee DECIMAL(10,2) DEFAULT 0,
  status ENUM('Active','Revoked') NOT NULL DEFAULT 'Active',
  revoked_reason VARCHAR(255) NULL,
  FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS students (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  phone VARCHAR(30)
);

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(120) NOT NULL UNIQUE,
  password_hash VARCHAR(100) NOT NULL,
  role ENUM('admin','student') NOT NULL,
  student_id INT NULL,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  course_id INT NOT NULL,
  status ENUM('Enrolled','In Progress','Completed','Revoked') NOT NULL DEFAULT 'Enrolled',
  progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  revoked_reason VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY one_per_course (student_id, course_id),
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);
