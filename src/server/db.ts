import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

const dataDir = path.resolve(process.cwd(), 'data');
export const uploadsDir = path.resolve(process.cwd(), 'uploads');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'senbet.db');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Helper to create a valid minimal PDF file on disk for seeded resources
function ensureSamplePdf(filename: string, titleLine: string, bodyLine: string) {
  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) return;

  const safeTitle = titleLine.replace(/[()\\]/g, '');
  const safeBody = bodyLine.replace(/[()\\]/g, '');

  const streamContent = `BT /F1 18 Tf 50 740 Td (${safeTitle}) Tj /F1 12 Tf 0 -30 Td (${safeBody}) Tj 0 -20 Td (Senbet Timihirt Bet - Official Document) Tj ET`;
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
    '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >> endobj',
    `4 0 obj << /Length ${Buffer.byteLength(streamContent, 'utf8')} >> stream\n${streamContent}\nendstream endobj`,
    '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [0];
  for (const obj of objects) {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj + '\n';
  }
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i++) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  fs.writeFileSync(filePath, pdf, 'utf8');
}

// Helper to create a clean melodic WAV audio file for seeded choir/audio lessons
function ensureSampleWav(filename: string) {
  const filePath = path.join(uploadsDir, filename);
  if (fs.existsSync(filePath)) return;

  const sampleRate = 22050;
  const durationSec = 4;
  const numSamples = sampleRate * durationSec;
  const buffer = Buffer.alloc(44 + numSamples * 2);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Pentatonic-inspired gentle chime notes
  const freqs = [293.66, 329.63, 392.0, 440.0];
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    const noteIdx = Math.min(3, Math.floor(t));
    const localT = t - noteIdx;
    const envelope = Math.exp(-localT * 2.5) * Math.min(1, localT * 20);
    const val = Math.sin(2 * Math.PI * freqs[noteIdx] * t) * 0.35 * envelope;
    buffer.writeInt16LE(Math.round(val * 32767), 44 + i * 2);
  }

  fs.writeFileSync(filePath, buffer);
}

// Helper to create a minimal valid MP4/WebM placeholder video or SVG-based fallback?
// Note: We can generate a valid minimal silent MP4 or let's use a real tiny valid WebM/MP4?
// Actually, let's generate a minimal valid WebM/MP4 or store a clean sample MP4 buffer if needed.
// Let's write a tiny valid MP4 container? Hand-crafting MP4 atoms is complex, so for seeded video we can omit or create a real downloadable sample, OR we allow real MP4/WebM uploads from the user! Wait: let's check if we should create a tiny valid WebM? Even simpler: let's seed PDF and Audio with real files, and for video let's check if browser plays or let users upload real video files cleanly, or let's generate a tiny valid animated GIF/MP4? No, `<video>` plays `.mp4`/`.webm`. Let's stick to real PDF + real WAV audio for seeded items (plus any real video users upload via the upload form!), OR we can embed a tiny base64 valid MP4! Wait - a valid 1-second blank/colored MP4 is only ~1KB in base64! Let's check if we really need it — actually, a tiny valid MP4 in base64 isn't needed if seeded video isn't broken; better NOT to put an unreadable corrupted MP4! So let's seed PDF and Audio with 100% genuine valid files, and allow teachers & choir head to upload real MP4/WebM videos anytime.

export function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      fullName TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('head', 'teacher', 'student', 'dept_head', 'dept_member')),
      age INTEGER,
      educationLevel TEXT,
      assignedGrade INTEGER,
      department TEXT,
      subject TEXT,
      phone TEXT,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS departments (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      allowsMedia INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId INTEGER NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS educational_resources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      resourceType TEXT NOT NULL CHECK(resourceType IN ('pdf', 'audio', 'video')),
      fileUrl TEXT NOT NULL,
      fileName TEXT NOT NULL,
      targetGrade INTEGER,
      targetDivision TEXT NOT NULL DEFAULT 'all',
      uploadedBy INTEGER NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS exam_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      grade INTEGER NOT NULL,
      subject TEXT NOT NULL,
      examTitle TEXT NOT NULL,
      score REAL NOT NULL,
      maxScore REAL NOT NULL DEFAULT 100,
      term TEXT NOT NULL DEFAULT '1ኛ መንፈቅ ዓመት',
      remarks TEXT NOT NULL DEFAULT '',
      recordedBy INTEGER NOT NULL,
      updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recordedBy) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      studentId INTEGER NOT NULL,
      grade INTEGER NOT NULL,
      date TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('present', 'absent', 'late', 'excused')),
      note TEXT NOT NULL DEFAULT '',
      recordedBy INTEGER NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(studentId, date),
      FOREIGN KEY (studentId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recordedBy) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS department_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department TEXT NOT NULL,
      submittedBy INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      pdfUrl TEXT,
      pdfName TEXT,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'reviewed')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (submittedBy) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS directives (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderId INTEGER NOT NULL,
      targetDepartment TEXT NOT NULL,
      targetScope TEXT NOT NULL CHECK(targetScope IN ('dept_head', 'dept_members')),
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'acknowledged')),
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS department_materials (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      department TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      fileType TEXT NOT NULL CHECK(fileType IN ('pdf', 'audio', 'video')),
      fileUrl TEXT NOT NULL,
      fileName TEXT NOT NULL,
      uploadedBy INTEGER NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (uploadedBy) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS targeted_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      senderId INTEGER NOT NULL,
      targetType TEXT NOT NULL CHECK(targetType IN ('all', 'division', 'grade', 'department', 'teachers')),
      targetValue TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  ensureUsersSubjectColumn();
  ensureDefaultDepartments();

  const userCount = (db.prepare('SELECT COUNT(*) as cnt FROM users').get() as { cnt: number }).cnt;
  if (userCount === 0) {
    seedInitialData();
  }
  ensureTeacherSubjects();
  ensureCustomAdmin('baye', '7654321', 'ባዬ (ዋና ሀላፊ)');
  ensureAttendanceHistory();
}

function ensureUsersSubjectColumn() {
  const columns = db.prepare('PRAGMA table_info(users)').all() as { name: string }[];
  if (!columns.some((c) => c.name === 'subject')) {
    db.exec('ALTER TABLE users ADD COLUMN subject TEXT');
  }
}

function ensureDefaultDepartments() {
  const defaults = [
    {
      id: 'education',
      label: 'ትምህርት ክፍል',
      description: 'የትምህርት ካሪኩለም፣ የመጽሐፍ ቅዱስና የቤተ ክርስቲያን ታሪክ ትምህርቶች አስተባባሪ',
      allowsMedia: 0,
    },
    {
      id: 'choir',
      label: 'መዝሙር ክፍል',
      description: 'የመዝሙር ልምምድ፣ የበገናና የከበሮ አገልግሎት (PDF፣ ኦዲዮ እና ቪዲዮ ግብአቶች)',
      allowsMedia: 1,
    },
    {
      id: 'property',
      label: 'ንብረት ክፍል',
      description: 'የሰንበት ትምህርት ቤቱ ንብረቶች፣ መጻሕፍትና ቁሳቁስ አስተዳደር',
      allowsMedia: 0,
    },
    {
      id: 'charity',
      label: 'በጎ አድራጎት ክፍል',
      description: 'የድጋፍ፣ የጉብኝት እና የበጎ አድራጎት አገልግሎት ማስተባበሪያ',
      allowsMedia: 0,
    },
    {
      id: 'member_admin',
      label: 'አባላት አስተዳደር ክፍል',
      description: 'የአባላት መረጃ፣ ስነ-ምግባርና ለሁሉም ክፍሎች መልእክት ማስተላለፊያ',
      allowsMedia: 0,
    },
  ];

  const stmt = db.prepare(
    `INSERT OR IGNORE INTO departments (id, label, description, allowsMedia) VALUES (?, ?, ?, ?)`
  );
  for (const d of defaults) {
    stmt.run(d.id, d.label, d.description, d.allowsMedia);
  }
}

function ensureTeacherSubjects() {
  const updates: [string, string][] = [
    ['teacher1', 'የግዕዝ ንባብ እና የዘወትር ጸሎት'],
    ['teacher3', 'መጽሐፍ ቅዱስ ጥናት'],
    ['teacher5', 'የቤተ ክርስቲያን ታሪክ'],
    ['teacher7', 'ነገረ ሃይማኖት (ዶግማ)'],
  ];
  const stmt = db.prepare(
    `UPDATE users SET subject = ? WHERE username = ? AND role = 'teacher' AND (subject IS NULL OR subject = '')`
  );
  for (const [username, subject] of updates) {
    stmt.run(subject, username);
  }
}

function ensureCustomAdmin(username: string, password: string, fullName: string) {
  const existing = db
    .prepare('SELECT id, role FROM users WHERE username = ?')
    .get(username) as { id: number; role: string } | undefined;

  if (!existing) {
    db.prepare(
      `INSERT INTO users (username, password, fullName, role, age, educationLevel, assignedGrade, department, phone)
       VALUES (?, ?, ?, 'head', NULL, NULL, NULL, NULL, '')`
    ).run(username, password, fullName);
  } else if (existing.role !== 'head') {
    db.prepare(
      `UPDATE users SET role = 'head', password = ?, assignedGrade = NULL, department = NULL WHERE id = ?`
    ).run(password, existing.id);
  }
}

function ensureAttendanceHistory() {
  const dateCount = (db.prepare('SELECT COUNT(DISTINCT date) as c FROM attendance').get() as { c: number }).c;
  if (dateCount > 1) return;

  const students = db
    .prepare("SELECT id, assignedGrade FROM users WHERE role = 'student' AND assignedGrade IS NOT NULL")
    .all() as { id: number; assignedGrade: number }[];
  const recorder = db
    .prepare("SELECT id FROM users WHERE role IN ('head', 'teacher') ORDER BY id ASC LIMIT 1")
    .get() as { id: number } | undefined;

  if (students.length === 0 || !recorder) return;

  const insertIgnore = db.prepare(`
    INSERT OR IGNORE INTO attendance (studentId, grade, date, status, note, recordedBy)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const statusPatterns: Record<number, ('present' | 'absent' | 'late' | 'excused')[]> = {
    28: ['present', 'present', 'absent', 'present', 'late'],
    21: ['present', 'absent', 'present', 'present', 'present'],
    14: ['present', 'present', 'present', 'late', 'absent'],
    7: ['present', 'present', 'late', 'present', 'present'],
  };

  const now = Date.now();
  const tx = db.transaction(() => {
    for (const [daysAgoStr, pattern] of Object.entries(statusPatterns)) {
      const daysAgo = Number(daysAgoStr);
      const dateStr = new Date(now - daysAgo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      students.forEach((st, idx) => {
        const status = pattern[idx % pattern.length];
        insertIgnore.run(st.id, st.assignedGrade, dateStr, status, '', recorder.id);
      });
    }
  });
  tx();
}

function seedInitialData() {
  ensureSamplePdf('sample_wetani_lesson1.pdf', 'Wetani Grade 1 - Lesson 1', 'Basic Ge-ez Fidel and Daily Prayers Guide');
  ensureSamplePdf('sample_maekelawi_history.pdf', 'Maekelawi Grade 5 - Church History', 'Introduction to Ethiopian Orthodox Church History');
  ensureSamplePdf('sample_wetat_dogma.pdf', 'Wetat Grade 7 - Dogma Foundations', 'Five Pillars of Mystery Study Material');
  ensureSamplePdf('sample_choir_lyrics.pdf', 'Mezmur Department - Hymnal Sheet', 'Selected Seasonal Mezmur Lyrics and Notes');
  ensureSamplePdf('sample_quarterly_report.pdf', 'Department Quarterly Report', 'Summary of activities, member attendance, and plans');
  ensureSampleWav('sample_mezmur_audio.wav');
  ensureSampleWav('sample_lesson_audio.wav');

  const insertUser = db.prepare(`
    INSERT INTO users (username, password, fullName, role, age, educationLevel, assignedGrade, department, phone)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  // 1. Sunday School Head
  const headId = Number(
    insertUser.run('admin', 'admin123', 'ዲያቆን ዳዊት ተስፋዬ ገብሬ', 'head', 32, 'ዲግሪ', null, null, '0911223344').lastInsertRowid
  );

  // 2. Teachers (assigned by Head)
  const t1 = Number(
    insertUser.run('teacher1', 'teach123', 'መምህር ዮሐንስ በቀለ ወልዴ', 'teacher', 28, 'ዲግሪ', 1, null, '0911456789').lastInsertRowid
  );
  const t3 = Number(
    insertUser.run('teacher3', 'teach123', 'መምህርት ሳራ መኮንን ታደሰ', 'teacher', 26, 'ዲግሪ', 3, null, '0912345678').lastInsertRowid
  );
  const t5 = Number(
    insertUser.run('teacher5', 'teach123', 'መምህር ጳውሎስ ኃይሉ ደምሴ', 'teacher', 30, 'ማስተርስ', 5, null, '0913456789').lastInsertRowid
  );
  const t7 = Number(
    insertUser.run('teacher7', 'teach123', 'መምህር ኤፍሬም አለሙ ካሳ', 'teacher', 34, 'ማስተርስ', 7, null, '0914567890').lastInsertRowid
  );

  // 3. Students across Wetani (1-4), Maekelawi (5-6), Wetat (7-12)
  const s1 = Number(
    insertUser.run('abebe', 'stud123', 'አበበ ከበደ ተሰማ', 'student', 9, '3ኛ ክፍል መደበኛ', 1, null, '0921112233').lastInsertRowid
  );
  const s2 = Number(
    insertUser.run('hanna', 'stud123', 'ሐና ብርሃኑ አለሙ', 'student', 8, '2ኛ ክፍል መደበኛ', 1, null, '0921112244').lastInsertRowid
  );
  const s3 = Number(
    insertUser.run('tigist', 'stud123', 'ትግስት አየለ ብርሃኑ', 'student', 13, '7ኛ ክፍል መደበኛ', 3, null, '0922223344').lastInsertRowid
  );
  const s4 = Number(
    insertUser.run('samuel', 'stud123', 'ሳሙኤል ታደሰ ሞላ', 'student', 16, '10ኛ ክፍል መደበኛ', 5, null, '0923334455').lastInsertRowid
  );
  const s5 = Number(
    insertUser.run('rahel', 'stud123', 'ራሔል ገብረመድኅን አሰፋ', 'student', 20, '2ኛ ዓመት ዩኒቨርሲቲ', 7, null, '0924445566').lastInsertRowid
  );

  // 4. Department Heads (assigned by Head)
  const eduHead = Number(
    insertUser.run('edu_head', 'dept123', 'ዲያቆን ናትናኤል ግርማ አበበ', 'dept_head', 29, 'ዲግሪ', null, 'education', '0931112233').lastInsertRowid
  );
  const choirHead = Number(
    insertUser.run('choir_head', 'dept123', 'ዘማሪት ቤተልሔም ዘውዴ ታፈሰ', 'dept_head', 25, 'ዲግሪ', null, 'choir', '0932223344').lastInsertRowid
  );
  const propHead = Number(
    insertUser.run('prop_head', 'dept123', 'አቶ ብርሃኑ ዳኛቸው ወርቁ', 'dept_head', 35, 'ዲፕሎማ', null, 'property', '0933334455').lastInsertRowid
  );
  const charHead = Number(
    insertUser.run('char_head', 'dept123', 'ወ/ሮ ማርታ ደበበ ንጉሤ', 'dept_head', 31, 'ዲግሪ', null, 'charity', '0934445566').lastInsertRowid
  );
  const memHead = Number(
    insertUser.run('mem_head', 'dept123', 'አቶ ቴዎድሮስ አሰፋ በላይ', 'dept_head', 33, 'ማስተርስ', null, 'member_admin', '0935556677').lastInsertRowid
  );

  // 5. Department Members
  insertUser.run('choir_mem', 'mem123', 'ዘማሪ ዳንኤል ፍቃዱ ገብሬ', 'dept_member', 22, '3ኛ ዓመት ዩኒቨርሲቲ', null, 'choir', '0941112233');
  insertUser.run('mem_admin_mem', 'mem123', 'ወ/ሪት ሄለን መስፍን ጌታቸው', 'dept_member', 24, 'ዲግሪ', null, 'member_admin', '0942223344');
  insertUser.run('edu_mem', 'mem123', 'መምህር ሚካኤል ሰለሞን ታዬ', 'dept_member', 27, 'ዲግሪ', null, 'education', '0943334455');

  // Seed Educational Resources
  const insertResource = db.prepare(`
    INSERT INTO educational_resources (title, description, resourceType, fileUrl, fileName, targetGrade, targetDivision, uploadedBy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertResource.run(
    'የግዕዝ ፊደልና የዘወትር ጸሎት መማሪያ (PDF)',
    'ለ1ኛ ክፍል ወጣኒ ተማሪዎች የተዘጋጀ የንባብና የጸሎት መማሪያ መጽሐፍ',
    'pdf',
    '/uploads/sample_wetani_lesson1.pdf',
    'sample_wetani_lesson1.pdf',
    1,
    'wetani',
    t1
  );
  insertResource.run(
    'የመዝሙር ልምምድ ድምጽ (Audio)',
    'ለወጣኒና ማእከላዊ ተማሪዎች የተዘጋጀ የቅዳሴና የምስጋና ዜማ',
    'audio',
    '/uploads/sample_lesson_audio.wav',
    'sample_lesson_audio.wav',
    null,
    'all',
    headId
  );
  insertResource.run(
    'የቤተ ክርስቲያን ታሪክ መግቢያ (PDF)',
    'ለ5ኛ ክፍል ማእከላዊ ተማሪዎች የተዘጋጀ የመጀመሪያ መንፈቅ ዓመት ማስታወሻ',
    'pdf',
    '/uploads/sample_maekelawi_history.pdf',
    'sample_maekelawi_history.pdf',
    5,
    'maekelawi',
    t5
  );
  insertResource.run(
    'አምስቱ አዕማደ ምሥጢር መሰረታዊ ትምህርት (PDF)',
    'ለ7ኛ ክፍል ወጣት ተማሪዎች የዶግማ ትምህርት መምሪያ',
    'pdf',
    '/uploads/sample_wetat_dogma.pdf',
    'sample_wetat_dogma.pdf',
    7,
    'wetat',
    t7
  );

  // Seed Exam Results
  const insertExam = db.prepare(`
    INSERT INTO exam_results (studentId, grade, subject, examTitle, score, maxScore, term, remarks, recordedBy)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertExam.run(s1, 1, 'የግዕዝ ንባብ', 'የመጀመሪያ ፈተና', 88, 100, '1ኛ መንፈቅ ዓመት', 'በጣም ጥሩ ጥረት', t1);
  insertExam.run(s1, 1, 'የዘወትር ጸሎት', 'የክፍል ሙከራ', 92, 100, '1ኛ መንፈቅ ዓመት', 'ምስጉን', t1);
  insertExam.run(s2, 1, 'የግዕዝ ንባብ', 'የመጀመሪያ ፈተና', 84, 100, '1ኛ መንፈቅ ዓመት', 'ጥሩ', t1);
  insertExam.run(s3, 3, 'መጽሐፍ ቅዱስ ጥናት', 'የአጋማሽ ፈተና', 90, 100, '1ኛ መንፈቅ ዓመት', 'በጣም ጥሩ', t3);
  insertExam.run(s4, 5, 'የቤተ ክርስቲያን ታሪክ', 'የመጀመሪያ ፈተና', 86, 100, '1ኛ መንፈቅ ዓመት', 'ጥሩ ተሳትፎ', t5);
  insertExam.run(s5, 7, 'ነገረ ሃይማኖት', 'የአጋማሽ ፈተና', 94, 100, '1ኛ መንፈቅ ዓመት', 'እጅግ በጣም ጥሩ', t7);

  // Seed Attendance
  const today = new Date().toISOString().slice(0, 10);
  const insertAtt = db.prepare(`
    INSERT INTO attendance (studentId, grade, date, status, note, recordedBy)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertAtt.run(s1, 1, today, 'present', 'በሰዓቱ ተገኝቷል', t1);
  insertAtt.run(s2, 1, today, 'present', '', t1);
  insertAtt.run(s3, 3, today, 'present', '', t3);
  insertAtt.run(s4, 5, today, 'late', '10 ደቂቃ ዘግይቷል', t5);
  insertAtt.run(s5, 7, today, 'present', '', t7);

  // Seed Department Reports (from dept_head to head)
  const insertReport = db.prepare(`
    INSERT INTO department_reports (department, submittedBy, title, content, pdfUrl, pdfName, status)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertReport.run(
    'choir',
    choirHead,
    'የመዝሙር ክፍል የመጀመሪያ ሩብ ዓመት ሪፖርት',
    'በዚህ ሩብ ዓመት 24 አባላት በቋሚነት የበገናና የዝማሬ ልምምድ አድርገዋል። ለበዓለ ጥምቀት አዲስ መዝሙራት ተዘጋጅተዋል።',
    '/uploads/sample_quarterly_report.pdf',
    'sample_quarterly_report.pdf',
    'pending'
  );
  insertReport.run(
    'education',
    eduHead,
    'የትምህርት ክፍል የካሪኩለም ዝግጅት ሪፖርት',
    'ለወጣኒ፣ ማእከላዊ እና ወጣት ክፍሎች የመጀመሪያ መንፈቅ ዓመት የትምህርት መርሐ ግብርና የማስተማሪያ ሰነዶች ተጠናቀዋል።',
    null,
    null,
    'reviewed'
  );

  // Seed Directives (Head -> Dept Head, and Dept Head -> Dept Members)
  const insertDirective = db.prepare(`
    INSERT INTO directives (senderId, targetDepartment, targetScope, title, body, status)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  insertDirective.run(
    headId,
    'choir',
    'dept_head',
    'ለመጪው በዓል የመዝሙር ዝግጅት ትዕዛዝ',
    'የመዝሙር ክፍል ሀላፊ፣ ለመጪው ታላቅ በዓል የአባላቱን የልምምድ ሰዓት በማጠናከር የተመረጡ 5 መዝሙራትን እስከ ሳምንቱ መጨረሻ እንድታዘጋጁ እና ሪፖርት እንድታቀርቡ።',
    'active'
  );
  insertDirective.run(
    headId,
    'member_admin',
    'dept_head',
    'የአዳዲስ ተማሪዎች መረጃ ማጠናከሪያ ትዕዛዝ',
    'አዳዲስ የተመዘገቡ ተማሪዎችን መረጃ በመከታተል ለየክፍላቸው የእንኳን ደህና መጣችሁ መልእክት እንዲተላለፍ ይሁን።',
    'active'
  );
  insertDirective.run(
    choirHead,
    'choir',
    'dept_members',
    'የቅዳሜ ልምምድ ሰዓት ማሳሰቢያ',
    'ሁሉም የመዝሙር ክፍል አባላት ቅዳሜ ከሰዓት 8:00 ሰዓት በመዝሙር አዳራሽ ተገኝታችሁ የተላከውን ኦዲዮ እንድትለማመዱ።',
    'active'
  );

  // Seed Department Materials (PDF only for non-choir; PDF + Audio + Video for choir)
  const insertMat = db.prepare(`
    INSERT INTO department_materials (department, title, description, fileType, fileUrl, fileName, uploadedBy)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  insertMat.run(
    'choir',
    'የበዓል መዝሙር ግጥምና ኖታ (PDF)',
    'ለመዝሙር ክፍል አባላት የተዘጋጀ የግጥም ሰነድ',
    'pdf',
    '/uploads/sample_choir_lyrics.pdf',
    'sample_choir_lyrics.pdf',
    choirHead
  );
  insertMat.run(
    'choir',
    'የዜማ ልምምድ ኦዲዮ (Audio)',
    'የመዝሙር ክፍል አባላት የድምጽ ልምምድ',
    'audio',
    '/uploads/sample_mezmur_audio.wav',
    'sample_mezmur_audio.wav',
    choirHead
  );
  insertMat.run(
    'education',
    'የመምህራን የማስተማር ዘዴ መመሪያ (PDF)',
    'ለትምህርት ክፍል አባላት የተዘጋጀ PDF ሰነድ',
    'pdf',
    '/uploads/sample_maekelawi_history.pdf',
    'sample_maekelawi_history.pdf',
    eduHead
  );

  // Seed Targeted Messages
  const insertMsg = db.prepare(`
    INSERT INTO targeted_messages (senderId, targetType, targetValue, title, body)
    VALUES (?, ?, ?, ?, ?)
  `);
  insertMsg.run(
    headId,
    'all',
    'all',
    'የአዲሱ የትምህርት ዘመን መልእክት',
    'ውድ የሰንበት ትምህርት ቤታችን ተማሪዎች፣ መምህራንና የክፍል አገልጋዮች በሙሉ እንኳን ለአዲሱ የትምህርት ዘመን በሰላም አደረሳችሁ።'
  );
  insertMsg.run(
    memHead,
    'division',
    'wetani',
    'ለወጣኒ ክፍል (1ኛ-4ኛ) ተማሪዎችና ወላጆች',
    'የወጣኒ ክፍል ትምህርት ዘወትር እሁድ ጠዋት 2:00 ሰዓት ስለሚጀምር ተማሪዎች በሰዓቱ እንዲገኙ እናሳስባለን።'
  );
  insertMsg.run(
    memHead,
    'department',
    'choir',
    'ለመዝሙር ክፍል አባላት የተላለፈ መልእክት',
    'የመዝሙር ክፍል አባላት የአባላት መታወቂያ መረጃችሁን እስከ እሁድ ድረስ ለአባላት አስተዳደር ክፍል አረጋግጡ።'
  );
}
