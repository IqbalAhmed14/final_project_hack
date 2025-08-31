// seed.js
const db = require('./db');

console.log('🌱 Seeding database...');

db.serialize(() => {
  // Insert one admin (optional — your server has fixed admin, but keep one DB admin)
  db.run(
    `INSERT OR IGNORE INTO users (username, password, role) VALUES (?,?,?)`,
    ['admin1', 'admin123', 'admin'],
    function (err) {
      if (err) console.error('⚠️ Admin insert error:', err.message);
      else console.log('✅ Admin inserted with ID:', this.lastID);
    }
  );

  // Insert a few faculties (with random faculty_code)
  for (let i = 1; i <= 2; i++) {
    const uname = `faculty${i}`;
    const pwd = `fac${i}23`;
    const code = Math.floor(1000 + Math.random() * 9000).toString();

    db.run(
      `INSERT OR IGNORE INTO users (username, password, role, faculty_code) VALUES (?,?,?,?)`,
      [uname, pwd, 'faculty', code],
      function (err) {
        if (err) console.error('⚠️ Faculty insert error:', err.message);
        else console.log(`✅ Faculty ${uname} inserted (ID: ${this.lastID}, code: ${code})`);
      }
    );
  }

  // Insert a few students
  for (let i = 1; i <= 3; i++) {
    const uname = `student${i}`;
    const pwd = `stud${i}23`;

    db.run(
      `INSERT OR IGNORE INTO users (username, password, role) VALUES (?,?,?)`,
      [uname, pwd, 'student'],
      function (err) {
        if (err) console.error('⚠️ Student insert error:', err.message);
        else console.log(`✅ Student ${uname} inserted (ID: ${this.lastID})`);
      }
    );
  }
});
