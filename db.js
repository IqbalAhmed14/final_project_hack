// db.js
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbFile = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(dbFile);

db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON`);

  // USERS
 // USERS
db.run(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin','faculty','student')),
    credits INTEGER NOT NULL DEFAULT 0
  )`);

// Ensure faculty_code exists (add if missing)
db.all(`PRAGMA table_info(users)`, (err, cols) => {
  if (err) {
    console.error('PRAGMA table_info(users) error:', err.message);
    return;
  }
  const hasFacultyCode = cols.some(c => c.name === 'faculty_code');
  if (!hasFacultyCode) {
    db.run(`ALTER TABLE users ADD COLUMN faculty_code TEXT`, (e) => {
      if (e) console.error('ALTER TABLE add faculty_code failed:', e.message);
      else console.log('✅ Added faculty_code column to users');
    });
  }
});



  // UNIVERSITIES
  db.run(`
    CREATE TABLE IF NOT EXISTS universities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      admin_id INTEGER,
      FOREIGN KEY(admin_id) REFERENCES users(id) ON DELETE SET NULL
    )`);

  // UNIVERSITY MEMBERS (many-to-many: students<->universities)
  db.run(`
    CREATE TABLE IF NOT EXISTS university_members (
      student_id INTEGER NOT NULL,
      university_id INTEGER NOT NULL,
      PRIMARY KEY(student_id, university_id),
      FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(university_id) REFERENCES universities(id) ON DELETE CASCADE
    )`);


  // COURSES
  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL,
      title TEXT NOT NULL,
      credit_value INTEGER NOT NULL,
      university_id INTEGER NOT NULL,
      faculty_id INTEGER,
      notes_filename TEXT,
      notes_url TEXT,
      UNIQUE(code, university_id),
      FOREIGN KEY(university_id) REFERENCES universities(id) ON DELETE CASCADE,
      FOREIGN KEY(faculty_id) REFERENCES users(id) ON DELETE SET NULL
    )`);

  // ENROLLMENTS
  db.run(`
    CREATE TABLE IF NOT EXISTS enrollments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'enrolled',
      requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      approved_at DATETIME,
      UNIQUE(student_id, course_id),
      FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    )`);

  // SUBMISSIONS
  db.run(`
    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original TEXT NOT NULL,
      url TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'uploaded',
      marks INTEGER,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE CASCADE
    )`);

  // CERTIFICATES
  db.run(`
    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      serial TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('course','equivalency')),
      student_id INTEGER NOT NULL,
      course_id INTEGER,
      source_university_id INTEGER,
      target_university_id INTEGER,
      status TEXT NOT NULL DEFAULT 'issued',
      data_json TEXT,
      hash TEXT NOT NULL,
      qr_data_url TEXT,
      issued_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      validated_at DATETIME,
      FOREIGN KEY(student_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(course_id) REFERENCES courses(id) ON DELETE SET NULL,
      FOREIGN KEY(source_university_id) REFERENCES universities(id) ON DELETE SET NULL,
      FOREIGN KEY(target_university_id) REFERENCES universities(id) ON DELETE SET NULL
    )`);

  // BLOCKCHAIN
  db.run(`
    CREATE TABLE IF NOT EXISTS blockchain (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      certificate_id INTEGER NOT NULL,
      block_hash TEXT NOT NULL,
      prev_hash TEXT NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(certificate_id) REFERENCES certificates(id) ON DELETE CASCADE
    )`);

  // Helpful Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_courses_uni ON courses(university_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments(student_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_submissions_student ON submissions(student_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_certificates_student ON certificates(student_id)`);
});

// Debug: show created tables
db.all("SELECT name FROM sqlite_master WHERE type='table'", [], (err, rows) => {
  if (err) console.error("Error:", err);
  else console.log("Tables created:", rows.map(r => r.name));
});

module.exports = db;


module.exports = db;
