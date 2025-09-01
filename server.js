/************************************************************
 * ABC ERP — Server (Full)
 * ----------------------------------------------------------
 * Express + SQLite + Socket.IO
 * Roles: admin, faculty, student
 * Multi-university (admin can own many universities)
 * Courses (faculty assigned), Enrollments, Submissions
 * Certificates, Equivalency, QR + Blockchain-lite
 * Legacy endpoints included for compatibility with old admin.html
 ************************************************************/
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const QRCode = require('qrcode');
const cors = require('cors');
require('dotenv').config();
const db = require('./db');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

/* ------------ FS/Static -------------- */
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
  // keep folder in git
  try { fs.writeFileSync(path.join(uploadDir, '.gitkeep'), ''); } catch {}
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(uploadDir));
app.use(express.static(path.join(__dirname, 'public')));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) =>
    cb(null, Date.now() + '-' + file.originalname.replace(/\s+/g, '_')),
});
const upload = multer({ storage });

/* ------------ Helpers -------------- */
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows || []);
    });
  });

const now = () => new Date().toISOString();
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const serial = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

/* =========================================================
 * AUTH
 * =======================================================*/
app.post('/signup', async (req, res) => {
  const { username, password, role } = req.body;
  try {
    // Prevent creating multiple admins
    if (role.toLowerCase() === 'admin') {
      return res.json({ ok: false, error: 'Admin signup disabled. Use fixed admin credentials.' });
    }

    // Assign random 3-digit code to faculty
    let faculty_code = null;
    if (role.toLowerCase() === 'faculty') {
      faculty_code = Math.floor(100 + Math.random() * 900);
    }

    const r = await run(
      `INSERT INTO users(username,password,role,faculty_code) VALUES(?,?,?,?)`,
      [username, password, role.toLowerCase(), faculty_code]
    );

    const user = await get(
      `SELECT id,username,role,credits,faculty_code FROM users WHERE id=?`,
      [r.lastID]
    );

    res.json({ ok: true, user });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    // Fixed admin login
    if (username === 'admin' && password === 'admin123') {
      return res.json({ ok: true, user: { id: 0, username: 'admin', role: 'admin' } });
    }

    const user = await get(
      `SELECT id,username,role,credits,faculty_code FROM users WHERE username=? AND password=?`,
      [username, password]
    );

    if (!user) return res.json({ ok: false, error: 'Invalid credentials' });
    res.json({ ok: true, user });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Add University
app.post('/admin/university', async (req, res) => {
  try {
    let admin_id = null;
    const name = (req.body.name || '').trim();

    if (!name) {
      return res.status(400).json({ error: "University name required" });
    }

    // If admin_id passed in request → validate role
    if (req.body.admin_id) {
      const maybeId = Number(req.body.admin_id);
      const u = await get(`SELECT id, role FROM users WHERE id=?`, [maybeId]);
      if (!u || u.role !== 'admin') {
        return res.json({ ok: false, error: 'Not an admin' });
      }
      admin_id = maybeId;
    }

    // Prevent duplicates
    const existing = await get(`SELECT id FROM universities WHERE name=?`, [name]);
    if (existing) {
      return res.json({ ok: false, error: 'University already exists' });
    }

    // Insert (admin_id will be NULL if none given)
    const r = await run(
      `INSERT INTO universities(name, admin_id) VALUES(?, ?)`,
      [name, admin_id]
    );

    io.emit('universityAdded', { id: r.lastID, name });

    return res.json({ ok: true, id: r.lastID });
  } catch (e) {
    console.error('Add university error:', e.message);
    return res.json({ ok: false, error: 'Failed to create university' });
  }
});

// Public: list all universities
app.get('/universities', async (req, res) => {
  const rows = await all(
    `SELECT id, name, admin_id FROM universities ORDER BY name COLLATE NOCASE`
  );
  res.json({ ok: true, universities: rows });
});

// Admin: list my universities (FIXED ✅)
app.get('/admin/universities', async (req, res) => {
  const maybeId = Number(req.query.admin_id);
  let rows;
  if (!req.query.admin_id || isNaN(maybeId)) {
    // If no admin_id passed → return all universities
    rows = await all(`SELECT * FROM universities ORDER BY name`);
  } else {
    rows = await all(
      `SELECT * FROM universities 
       WHERE admin_id=? OR admin_id IS NULL
       ORDER BY name`,
      [maybeId]
    );
  }
  res.json({ ok: true, universities: rows });
});

// Student joins a university
app.post('/student/join-university', async (req, res) => {
  const student_id = Number(req.body.student_id);
  const university_id = Number(req.body.university_id);
  if (!student_id || !university_id)
    return res.json({ ok: false, error: 'missing fields' });

  const u = await get(`SELECT id,role FROM users WHERE id=?`, [student_id]);
  if (!u || u.role !== 'student')
    return res.json({ ok: false, error: 'not a student' });

  await run(
    `INSERT OR IGNORE INTO university_members(student_id, university_id) VALUES(?, ?)`,
    [student_id, university_id]
  );
  res.json({ ok: true });
});

// Student: my universities
app.get('/student/my-universities', async (req, res) => {
  const student_id = Number(req.query.student_id);
  if (!student_id) return res.json({ ok: true, universities: [] });

  const rows = await all(
    `SELECT u.id, u.name
     FROM university_members m
     JOIN universities u ON u.id = m.university_id
     WHERE m.student_id = ?
     ORDER BY u.name`,
    [student_id]
  );
  res.json({ ok: true, universities: rows });
});


// =======================
// PROGRAMS - CLEANED UP
// =======================

// Add Program
app.post('/programs/add', async (req, res) => {
  try {
    const { university_id, name } = req.body;
    
    if (!university_id || !name) {
      return res.status(400).json({ ok: false, error: "Missing fields: university_id and name are required" });
    }

    console.log("Add Program Request:", { university_id, name });

    // Check if university exists
    const university = await get(`SELECT id FROM universities WHERE id = ?`, [university_id]);
    if (!university) {
      return res.status(400).json({ ok: false, error: "University not found" });
    }

    // Check for duplicate program name in the same university
    const existingProgram = await get(
      `SELECT id FROM programs WHERE name = ? AND university_id = ?`,
      [name, university_id]
    );
    
    if (existingProgram) {
      return res.status(400).json({ ok: false, error: "Program with this name already exists in this university" });
    }

    // Insert the new program
    const result = await run(
      `INSERT INTO programs (university_id, name) VALUES (?, ?)`,
      [university_id, name]
    );

    console.log("Program added successfully:", result.lastID);
    res.json({ ok: true, id: result.lastID, message: "Program added successfully" });

  } catch (err) {
    console.error("Add Program Error:", err.message);
    res.status(500).json({ ok: false, error: "Internal server error: " + err.message });
  }
});

// Get Programs by University
app.get('/programs/by-university', async (req, res) => {
  try {
    const university_id = Number(req.query.university_id);
    
    if (!university_id) {
      return res.status(400).json({ ok: false, error: "university_id parameter is required" });
    }

    const rows = await all(
      `SELECT id, name, university_id FROM programs WHERE university_id = ? ORDER BY name`,
      [university_id]
    );

    res.json({ ok: true, programs: rows });

  } catch (err) {
    console.error("Get Programs Error:", err.message);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// Get Programs of a University (legacy endpoint)
app.get("/universities/:id/programs", async (req, res) => {
  try {
    const university_id = req.params.id;
    const rows = await all(
      `SELECT * FROM programs WHERE university_id = ? ORDER BY name`,
      [university_id]
    );
    res.json({ ok: true, data: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
// =======================
// FEES - ADD THESE ENDPOINTS
// =======================

// Get Fees by University
app.get('/fees/by-university', async (req, res) => {
  try {
    const university_id = Number(req.query.university_id);
    
    if (!university_id) {
      return res.status(400).json({ ok: false, error: "university_id parameter is required" });
    }

    const rows = await all(
      `SELECT f.id, f.program_id, f.type, f.amount, p.name as program_name 
       FROM fees f 
       JOIN programs p ON f.program_id = p.id 
       WHERE p.university_id = ? 
       ORDER BY p.name, f.type`,
      [university_id]
    );

    res.json({ ok: true, fees: rows });

  } catch (err) {
    console.error("Get Fees Error:", err.message);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// Add Fee
app.post('/admin/fee', async (req, res) => {
  try {
    const { admin_id, university_id, program_id, type, amount } = req.body;
    
    if (!admin_id || !university_id || !program_id || !type || !amount) {
      return res.status(400).json({ ok: false, error: "All fields are required" });
    }

    // Verify admin has access to this university
    const uni = await get(
      `SELECT id FROM universities WHERE id=? AND admin_id=?`,
      [university_id, admin_id]
    );
    if (!uni) {
      return res.json({ ok: false, error: 'Not your university' });
    }

    // Verify program belongs to university
    const program = await get(
      `SELECT id FROM programs WHERE id=? AND university_id=?`,
      [program_id, university_id]
    );
    if (!program) {
      return res.json({ ok: false, error: 'Program not found in this university' });
    }

    const result = await run(
      `INSERT INTO fees (program_id, type, amount) VALUES (?, ?, ?)`,
      [program_id, type, amount]
    );

    res.json({ ok: true, id: result.lastID, message: "Fee added successfully" });

  } catch (err) {
    console.error("Add Fee Error:", err.message);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

// Get Fees of a Program (legacy endpoint)
app.get("/programs/:id/fees", async (req, res) => {
  try {
    const program_id = req.params.id;
    const rows = await all(
      `SELECT * FROM fees WHERE program_id = ? ORDER BY type`,
      [program_id]
    );
    res.json({ ok: true, fees: rows });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Add Fee for a Program (legacy endpoint)
app.post("/fees", async (req, res) => {
  try {
    const { program_id, type, amount } = req.body;
    if (!program_id || !type || !amount) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }

    const result = await run(
      `INSERT INTO fees (program_id, type, amount) VALUES (?, ?, ?)`,
      [program_id, type, amount]
    );

    res.json({ ok: true, id: result.lastID });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});
/* =========================================================
 * COURSES
 * =======================================================*/

// ===== Admin creates course in their university =====
// ===== Admin creates course in their university =====
app.post('/admin/course', upload.single('notes'), async (req, res) => {
  try {
    const admin_id = Number(req.body.admin_id);
    const university_id = Number(req.body.university_id);
    const code = (req.body.code || '').trim();
    const title = (req.body.title || '').trim();
    const credit_value = Number(req.body.credit_value);
    const faculty_id = req.body.faculty_id ? Number(req.body.faculty_id) : null;

    if (!admin_id || !university_id || !code || !title || !credit_value) {
      return res.json({ ok: false, error: 'Missing fields' });
    }

    // Verify university belongs to this admin
    const uni = await get(
      `SELECT * FROM universities WHERE id=? AND admin_id=?`,
      [university_id, admin_id]
    );
    if (!uni) {
      return res.json({ ok: false, error: 'Not your university' });
    }
// ✅ Verify program belongs to this university
if (req.body.program_id) {
  const program_id = Number(req.body.program_id);
  const prog = await get(
    `SELECT id FROM programs WHERE id=? AND university_id=?`,
    [program_id, university_id]
  );
  if (!prog) {
    return res.json({ ok: false, error: 'Invalid program for this university' });
  }
}

    // ✅ Validate faculty if provided
    if (faculty_id) {
      const fac = await get(`SELECT id, role FROM users WHERE id=?`, [faculty_id]);
      if (!fac) {
        return res.json({ ok: false, error: 'Faculty user does not exist' });
      }
      if (fac.role !== 'faculty') {
        return res.json({ ok: false, error: 'User is not a faculty' });
      }
    }
    // Check duplicate course code in the same university
    const existing = await get(
      `SELECT id FROM courses WHERE code=? AND university_id=?`,
      [code, university_id]
    );
    if (existing) {
      return res.json({ ok: false, error: 'Course code already exists in this university' });
    }
    // Handle file upload (notes)
    let notes_filename = null, notes_url = null;
    if (req.file) {
      notes_filename = req.file.filename;
      notes_url = '/uploads/' + req.file.filename;
    }
    // Insert course
    const program_id = req.body.program_id ? Number(req.body.program_id) : null;
const r = await run(
  `INSERT INTO courses(code,title,credit_value,university_id,program_id,faculty_id,notes_filename,notes_url)
   VALUES(?,?,?,?,?,?,?,?)`,
  [code, title, credit_value, university_id, program_id, faculty_id, notes_filename, notes_url]
);
    const course = await get(`SELECT * FROM courses WHERE id=?`, [r.lastID]);
    // Real-time update
    io.emit('courseAdded', course);

    res.json({ ok: true, course });
  } catch (e) {
    console.error('Add course error:', e.message);
    res.json({ ok: false, error: 'Failed to add course' });
  }
});
// Public: courses by university
app.get('/courses/by-university', async (req, res) => {
  const university_id = Number(req.query.university_id);
  if (!university_id) return res.json({ ok: true, courses: [] });
  const rows = await all(
    `
    SELECT c.*,
           u.username AS faculty_name,
           u.faculty_code AS faculty_code
    FROM courses c
    LEFT JOIN users u ON c.faculty_id = u.id
    WHERE c.university_id=?
    ORDER BY c.code`,
    [university_id]
  );
  res.json({ ok: true, courses: rows });
});
// Public: courses by program
app.get('/courses/by-program', async (req, res) => {
  const program_id = Number(req.query.program_id);
  if (!program_id) return res.json({ ok: true, courses: [] });
  const rows = await all(
    `
    SELECT c.*,
           u.username AS faculty_name,
           u.faculty_code AS faculty_code
    FROM courses c
    LEFT JOIN users u ON c.faculty_id = u.id
    WHERE c.program_id=?
    ORDER BY c.code`,
    [program_id]
  );

  res.json({ ok: true, courses: rows });
});

// Faculty: my courses
app.get('/faculty/my-courses', async (req, res) => {
  const faculty_id = Number(req.query.faculty_id);
  if (!faculty_id) return res.json({ ok: true, courses: [] });
  const rows = await all(
    `
    SELECT c.*, u.name AS university_name
    FROM courses c
    JOIN universities u ON u.id=c.university_id
    WHERE c.faculty_id=?
    ORDER BY c.code`,
    [faculty_id]
  );
  res.json({ ok: true, courses: rows });
});
// Student enroll
app.post('/student/enroll', async (req, res) => {
  const student_id = Number(req.body.student_id);
  const course_id = Number(req.body.course_id);
  if (!student_id || !course_id)
    return res.json({ ok: false, error: 'missing fields' });

  const course = await get(`SELECT * FROM courses WHERE id=?`, [course_id]);
  if (!course) return res.json({ ok: false, error: 'course not found' });

  const isMember = await get(
    `SELECT 1 FROM university_members WHERE student_id=? AND university_id=?`,
    [student_id, course.university_id]
  );
  if (!isMember)
    return res.json({ ok: false, error: 'Join university first' });

  await run(
    `INSERT OR IGNORE INTO enrollments(student_id,course_id,status)
     VALUES(?,?, 'enrolled')`,
    [student_id, course_id]
  );
  const enr = await get(
    `
    SELECT e.id, e.status, e.requested_at, e.approved_at,
           u.username AS student_name, c.title, c.code, c.credit_value, c.faculty_id
    FROM enrollments e
    JOIN users u ON u.id=e.student_id
    JOIN courses c ON c.id=e.course_id
    WHERE e.student_id=? AND e.course_id=?`,
    [student_id, course_id]
  );
  io.emit('studentEnrolled', enr);
  res.json({ ok: true, enrollment: enr });
});
// Student: my enrollments
app.get('/student/my-enrollments', async (req, res) => {
  const student_id = Number(req.query.student_id);
  if (!student_id) return res.json({ ok: true, enrollments: [] });
  const rows = await all(
    `
    SELECT e.id AS enrollment_id, e.status, e.requested_at, e.approved_at,
           c.id AS course_id, c.title, c.code, c.credit_value, c.notes_url,
           u.name AS university_name
    FROM enrollments e
    JOIN courses c ON c.id=e.course_id
    JOIN universities u ON u.id=c.university_id
    WHERE e.student_id=?
    ORDER BY e.requested_at DESC`,
    [student_id]
  );
  res.json({ ok: true, enrollments: rows });
});

// Student: request completion
app.post('/student/request-completion', async (req, res) => {
  const enrollment_id = Number(req.body.enrollment_id);
  if (!enrollment_id)
    return res.json({ ok: false, error: 'enrollment_id required' });
  await run(`UPDATE enrollments SET status='completion_requested' WHERE id=?`, [
    enrollment_id,
  ]);
  const row = await get(`SELECT * FROM enrollments WHERE id=?`, [enrollment_id]);
  io.emit('completionRequested', row);
  res.json({ ok: true });
});
// Faculty: list enrollments in my courses
app.get('/faculty/enrollments', async (req, res) => {
  const faculty_id = Number(req.query.faculty_id);
  if (!faculty_id) return res.json({ ok: true, enrollments: [] });
  const rows = await all(
    `
    SELECT e.id AS enrollment_id, e.status, e.requested_at, e.approved_at,
           st.id AS student_id, st.username AS student_name,
           c.id AS course_id, c.code, c.title, c.credit_value,
           u.name AS university_name
    FROM enrollments e
    JOIN courses c ON c.id=e.course_id
    JOIN users st ON st.id=e.student_id
    JOIN universities u ON u.id=c.university_id
    WHERE c.faculty_id=?
    ORDER BY e.requested_at DESC`,
    [faculty_id]
  );
  res.json({ ok: true, enrollments: rows });
});

// Admin: enrollments across my universities
app.get('/admin/enrollments', async (req, res) => {
  const admin_id = Number(req.query.admin_id);
  if (!admin_id) return res.json({ ok: true, enrollments: [] });
  const rows = await all(
    `
    SELECT e.id AS enrollment_id, e.status, e.requested_at, e.approved_at,
           st.id AS student_id, st.username AS student_name,
           c.id AS course_id, c.code, c.title, c.credit_value,
           u.id AS university_id, u.name AS university_name
    FROM enrollments e
    JOIN courses c ON c.id=e.course_id
    JOIN users st ON st.id=e.student_id
    JOIN universities u ON u.id=c.university_id
    WHERE u.admin_id=?
    ORDER BY e.requested_at DESC`,
    [admin_id]
  );
  res.json({ ok: true, enrollments: rows });
});

// Faculty completes enrollment => issue course certificate + add credits
app.post('/faculty/complete-enrollment', async (req, res) => {
  try {
    const faculty_id = Number(req.body.faculty_id);
    const enrollment_id = Number(req.body.enrollment_id);
    const marks = req.body.marks == null ? null : Number(req.body.marks);
    if (!faculty_id || !enrollment_id)
      return res.json({ ok: false, error: 'missing fields' });

    const enr = await get(`SELECT * FROM enrollments WHERE id=?`, [
      enrollment_id,
    ]);
    if (!enr) return res.json({ ok: false, error: 'enrollment not found' });

    const course = await get(`SELECT * FROM courses WHERE id=?`, [
      enr.course_id,
    ]);
    if (!course || course.faculty_id !== faculty_id)
      return res.json({ ok: false, error: 'not your course' });

    await run(
      `UPDATE enrollments SET status='completed', approved_at=CURRENT_TIMESTAMP WHERE id=?`,
      [enrollment_id]
    );
    await run(`UPDATE users SET credits=credits+? WHERE id=?`, [
      course.credit_value,
      enr.student_id,
    ]);
    // issue certificate
    const student = await get(`SELECT username FROM users WHERE id=?`, [
      enr.student_id,
    ]);
    const uni = await get(`SELECT * FROM universities WHERE id=?`, [
      course.university_id,
    ]);
    const s = serial('COURSE');
    const payload = {
      serial: s,
      type: 'course',
      student_id: enr.student_id,
      student: student.username,
      course_id: course.id,
      course_code: course.code,
      course_title: course.title,
      university_id: course.university_id,
      university: uni.name,
      credits: course.credit_value,
      marks,
      issued_at: now(),
    };
    const json = JSON.stringify(payload);
    const hash = sha256(json);
    const qr = await QRCode.toDataURL(
      `${req.protocol}://${req.get('host')}/verify/${s}`
    );

    await run(
      `INSERT INTO certificates(serial,type,student_id,course_id,source_university_id,target_university_id,status,data_json,hash,qr_data_url)
       VALUES(?,?,?,?,?,NULL,'issued',?,?,?)`,
      [s, 'course', enr.student_id, course.id, course.university_id, json, hash, qr]
    );

    const updated = await get(
      `SELECT id,username,credits FROM users WHERE id=?`,
      [enr.student_id]
    );
    io.emit('enrollmentCompleted', {
      enrollment_id,
      student: updated,
      serial: s,
    });
    res.json({ ok: true, certificate_serial: s });
  } catch (e) {
    console.error('complete-enrollment error:', e.message);
    res.json({ ok: false, error: 'completion failed' });
  }
});
/* =========================================================
 * SUBMISSIONS
 * =======================================================*/
app.post('/student/submission', upload.single('file'), async (req, res) => {
  const student_id = Number(req.body.student_id);
  const course_id = Number(req.body.course_id);
  if (!student_id || !course_id || !req.file)
    return res.json({ ok: false, error: 'missing fields' });

  const url = `/uploads/${req.file.filename}`;
  const r = await run(
    `INSERT INTO submissions(student_id,course_id,filename,original,url)
     VALUES(?,?,?,?,?)`,
    [student_id, course_id, req.file.filename, req.file.originalname, url]
  );

  const sub = await get(`SELECT * FROM submissions WHERE id=?`, [r.lastID]);
  io.emit('submissionUploaded', sub);
  res.json({ ok: true, submission: sub });
});
// Student: my submissions
app.get('/student/submissions', async (req, res) => {
  const student_id = Number(req.query.student_id);
  if (!student_id) return res.json({ ok: true, submissions: [] });
  const rows = await all(
    `
    SELECT s.id, s.status, s.marks, s.created_at, s.original, s.url,
           c.code, c.title
    FROM submissions s
    JOIN courses c ON c.id=s.course_id
    WHERE s.student_id=?
    ORDER BY s.created_at DESC`,
    [student_id]
  );
  res.json({ ok: true, submissions: rows });
});

// Faculty: submissions of my courses
app.get('/faculty/submissions', async (req, res) => {
  const faculty_id = Number(req.query.faculty_id);
  if (!faculty_id) return res.json({ ok: true, submissions: [] });
  const rows = await all(
    `
    SELECT s.*, u.username AS student_name, c.title AS course_title, c.code
    FROM submissions s
    JOIN courses c ON c.id=s.course_id
    JOIN users u ON u.id=s.student_id
    WHERE c.faculty_id=?
    ORDER BY s.created_at DESC`,
    [faculty_id]
  );
  res.json({ ok: true, submissions: rows });
});

app.post('/faculty/review-submission', async (req, res) => {
  const faculty_id = Number(req.body.faculty_id);
  const submission_id = Number(req.body.submission_id);
  const marks = req.body.marks == null ? null : Number(req.body.marks);
  if (!faculty_id || !submission_id)
    return res.json({ ok: false, error: 'missing fields' });
  const sub = await get(
    `
    SELECT s.*, c.faculty_id
    FROM submissions s
    JOIN courses c ON c.id=s.course_id
    WHERE s.id=?`,
    [submission_id]
  );
  if (!sub || sub.faculty_id !== faculty_id)
    return res.json({ ok: false, error: 'not your submission' });

  await run(`UPDATE submissions SET status='reviewed', marks=? WHERE id=?`, [
    marks,
    submission_id,
  ]);
  io.emit('submissionReviewed', { submission_id, marks });
  res.json({ ok: true });
});

// Admin: all submissions across admin universities
app.get('/admin/submissions', async (req, res) => {
  const admin_id = Number(req.query.admin_id);
  if (!admin_id) return res.json({ ok: true, submissions: [] });
  const rows = await all(
    `
    SELECT s.id, s.status, s.marks, s.created_at, s.original, s.url,
           st.username AS student_name,
           c.code, c.title,
           u.name AS university_name
    FROM submissions s
    JOIN courses c ON c.id=s.course_id
    JOIN universities u ON u.id=c.university_id
    JOIN users st ON st.id=s.student_id
    WHERE u.admin_id=?
    ORDER BY s.created_at DESC`,
    [admin_id]
  );
  res.json({ ok: true, submissions: rows });
});

/* =========================================================
 * CERTIFICATES / EQUIVALENCY / BLOCKCHAIN
 * =======================================================*/

// Student: my certificates
app.get('/student/certificates', async (req, res) => {
  const student_id = Number(req.query.student_id);
  if (!student_id) return res.json({ ok: true, certificates: [] });
  const rows = await all(
    `
    SELECT serial,type,status,qr_data_url,issued_at,validated_at
    FROM certificates
    WHERE student_id=?
    ORDER BY issued_at DESC`,
    [student_id]
  );
  res.json({ ok: true, certificates: rows });
});

// Employer fetch by serial
app.get('/certificate/:serial', async (req, res) => {
  const cert = await get(
    `
    SELECT serial,type,status,qr_data_url,data_json,issued_at,validated_at
    FROM certificates
    WHERE serial=?`,
    [req.params.serial]
  );
  res.json({ ok: true, certificate: cert || null });
});
// Admin: certificates tied to my universities
app.get('/admin/certificates', async (req, res) => {
  const admin_id = Number(req.query.admin_id);
  if (!admin_id) return res.json({ ok: true, certificates: [] });
  const rows = await all(
    `
    SELECT c.serial, c.type, c.status, c.issued_at, c.validated_at, c.qr_data_url,
           u.name AS source_university
    FROM certificates c
    LEFT JOIN universities u ON u.id = c.source_university_id
    WHERE c.source_university_id IN (SELECT id FROM universities WHERE admin_id=?)
    ORDER BY c.issued_at DESC`,
    [admin_id]
  );
  res.json({ ok: true, certificates: rows });
});

// Student: create an equivalency certificate (auto-issued)
app.post('/student/equivalency', async (req, res) => {
  try {
    const student_id = Number(req.body.student_id);
    const source_serial = (req.body.source_serial || '').trim();
    const target_university_id = Number(req.body.target_university_id);
    if (!student_id || !source_serial || !target_university_id)
      return res.json({ ok: false, error: 'missing fields' });

    const base = await get(
      `SELECT * FROM certificates WHERE serial=? AND student_id=?`,
      [source_serial, student_id]
    );
    if (!base) return res.json({ ok: false, error: 'base certificate not found' });

    const targetUni = await get(`SELECT * FROM universities WHERE id=?`, [
      target_university_id,
    ]);
    if (!targetUni)
      return res.json({ ok: false, error: 'target university not found' });

    const s = serial('EQUIV');
    const payload = {
      serial: s,
      type: 'equivalency',
      base_serial: source_serial,
      student_id,
      course_id: base.course_id,
      source_university_id: base.source_university_id,
      target_university_id,
      target_university: targetUni.name,
      issued_at: now(),
    };
    const json = JSON.stringify(payload);
    const hash = sha256(json);
    const qr = await QRCode.toDataURL(
      `${req.protocol}://${req.get('host')}/verify/${s}`
    );

    await run(
      `INSERT INTO certificates(serial,type,student_id,course_id,source_university_id,target_university_id,status,data_json,hash,qr_data_url)
       VALUES(?,?,?,?,?,?, 'issued', ?, ?, ?)`,
      [
        s,
        'equivalency',
        student_id,
        base.course_id,
        base.source_university_id,
        target_university_id,
        json,
        hash,
        qr,
      ]
    );
    res.json({ ok: true, serial: s, qr_data_url: qr });
  } catch (e) {
    console.error('equivalency error:', e.message);
    res.json({ ok: false, error: 'equivalency failed' });
  }
});

// Accreditation → validate to blockchain
app.post('/accreditation/validate', async (req, res) => {
  try {
    const s = (req.body.serial || '').trim();
    if (!s) return res.json({ ok: false, error: 'serial required' });

    const cert = await get(`SELECT * FROM certificates WHERE serial=?`, [s]);
    if (!cert) return res.json({ ok: false, error: 'Certificate not found' });

    const last = await get(`SELECT * FROM blockchain ORDER BY id DESC LIMIT 1`);
    const prev = last ? last.block_hash : 'GENESIS';
    const block_string = `${cert.serial}|${cert.hash}|${prev}|${now()}`;
    const bhash = sha256(block_string);

    await run(
      `INSERT INTO blockchain(certificate_id,block_hash,prev_hash)
       VALUES(?,?,?)`,
      [cert.id, bhash, prev]
    );
    await run(
      `UPDATE certificates SET status='validated', validated_at=CURRENT_TIMESTAMP WHERE id=?`,
      [cert.id]
    );

    res.json({ ok: true, serial: cert.serial, block_hash: bhash, prev_hash: prev });
  } catch (e) {
    console.error('accreditation validate error:', e.message);
    res.json({ ok: false, error: 'validation failed' });
  }
});

// Public verify page (QR)
app.get('/verify/:serial', async (req, res) => {
  try {
    const s = req.params.serial;
    const cert = await get(`SELECT * FROM certificates WHERE serial=?`, [s]);
    if (!cert) return res.send(`<h2 style="font-family:Arial">Invalid certificate</h2>`);

    const block = await get(`SELECT * FROM blockchain WHERE certificate_id=?`, [cert.id]);
    const status = block ? '✅ Verified on blockchain' : '⏳ Pending validation';

    const data = JSON.parse(cert.data_json || '{}');
    const html = `
      <html><head><title>Verify</title>
      <style>body{font-family:Arial;background:#0f172a;color:#e5e7eb;padding:20px}
      .card{background:#1f2937;border:1px solid #334155;border-radius:10px;padding:18px}</style>
      </head><body>
      <div class="card">
        <h2>Serial: ${s}</h2>
        <p>Type: <b>${cert.type}</b></p>
        <p>Status: <b>${cert.status}</b></p>
        <p>${status}</p>
        <pre style="white-space:pre-wrap">${JSON.stringify(data,null,2)}</pre>
      </div>
      </body></html>`;
    res.send(html);
  } catch (e) {
    console.error('verify error:', e.message);
    res.send(`<h2>Error</h2>`);
  }
});
// Simple QR endpoint (demo)
app.get('/generate-qr', async (req, res) => {
  const data = req.query.data || 'ABC';
  try {
    const png = await QRCode.toDataURL(String(data));
    res.send(png);
  } catch {
    res.status(500).send('QR failed');
  }
});

app.post('/chatbot', async (req, res) => {
  try {
    const { q, user_id } = req.body || {};
    const text = String(q || '').toLowerCase();

    if (text.includes('credit') && user_id) {
      const u = await get('SELECT username,credits FROM users WHERE id=?', [user_id]);
      if (!u) return res.json({ ok: false, error: 'User not found' });
      return res.json({ ok: true, reply: `${u.username}, your credits are ${u.credits}.` });
    }

    if (text.includes('list course')) {
      const rows = await all(`
        SELECT c.code,c.title,u.name AS uni
        FROM courses c
        JOIN universities u ON u.id=c.university_id
        ORDER BY u.name,c.code`);
      const r = rows.map(x => `[${x.uni}] ${x.code} — ${x.title}`).join('\n');
      return res.json({ ok: true, reply: r || 'No courses yet.' });
    }

    if (text.includes('equival')) {
      return res.json({ ok: true, reply: `To request equivalency: enter your course certificate serial and choose a target university in the Certificates section.` });
    }

    return res.json({ ok: true, reply: "Hi! You can ask: 'my credits', 'list courses', 'how to get certificate', 'equivalency'." });
  } catch (e) {
    console.error('chatbot error:', e.message);
    return res.json({ ok: false, error: 'Bot error' });
  }
});
app.get('/getAllUniversities', async (req, res) => {
  try {
    const rows = await all(`SELECT id,name FROM universities ORDER BY name COLLATE NOCASE`);
    return res.json(rows);
  } catch {
    return res.json([]);
  }
});
app.post('/addUniversity', async (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.json({ error: 'Name required' });
  try {
    await run(`INSERT INTO universities(name, admin_id) VALUES(?, NULL)`, [name]);
    io.emit('universityAdded', { name });
    return res.json({ ok: true });
  } catch (e) {
    return res.json({ error: 'DB error: ' + e.message });
  }
});
app.get('/getCourses/:uniId', async (req, res) => {
  try {
    const uniId = Number(req.params.uniId);
    const rows = await all(`SELECT * FROM courses WHERE university_id=? ORDER BY code`, [uniId]);
    res.json(rows);
  } catch {
    res.json([]);
  }
});
app.post('/addCourse', async (req, res) => {
  try {
    const { university_id, code, title, credit_value } = req.body || {};
    if (!university_id || !code || !title || !credit_value) {
      return res.json({ error: 'All fields required' });
    }
    await run(
      `INSERT INTO courses(code,title,credit_value,university_id) VALUES(?,?,?,?)`,
      [code, title, Number(credit_value), Number(university_id)]
    );
    io.emit('courseAdded', { code, title, university_id });
    return res.json({ ok: true });
  } catch (e) {
    return res.json({ error: 'DB error: ' + e.message });
  }
});
app.get('/admin/getAllEnrollments', async (req, res) => {
  const rows = await all(`SELECT * FROM enrollments ORDER BY requested_at DESC`);
  res.json(rows);
});

app.get('/admin/getAllSubmissions', async (req, res) => {
  const rows = await all(`SELECT * FROM submissions ORDER BY created_at DESC`);
  res.json(rows);
});

app.get('/admin/getAllCertificates', async (req, res) => {
  const rows = await all(
    `SELECT id,student_id,course_id,status,serial FROM certificates ORDER BY issued_at DESC`
  );
  res.json(rows);
});
app.post('/admin/approveCertificate', async (req, res) => {
  const { id } = req.body || {};
  if (!id) return res.json({ error: 'id required' });

  const cert = await get(`SELECT * FROM certificates WHERE id=?`, [Number(id)]);
  if (!cert) return res.json({ error: 'Certificate not found' });

  const lastBlock = await get(`SELECT * FROM blockchain ORDER BY id DESC LIMIT 1`);
  const prev = lastBlock ? lastBlock.block_hash : 'GENESIS';
  const block_str = `${cert.serial}|${cert.hash}|${prev}|${now()}`;
  const bhash = sha256(block_str);

  await run(
    `INSERT INTO blockchain(certificate_id,block_hash,prev_hash) VALUES(?,?,?)`,
    [cert.id, bhash, prev]
  );
  await run(
    `UPDATE certificates SET status='validated', validated_at=CURRENT_TIMESTAMP WHERE id=?`,
    [cert.id]
  );
  io.emit('certificateApproved', { id: cert.id, serial: cert.serial });
  return res.json({ ok: true });
});

/* =========================================================
 * SOCKET.IO
 * =======================================================*/
io.on('connection', (socket) => {
  console.log('🔌 connected', socket.id);
  socket.on('disconnect', () => console.log('❌ disconnected', socket.id));
});

/* =========================================================
 * SERVER START
 * =======================================================*/
server.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});
