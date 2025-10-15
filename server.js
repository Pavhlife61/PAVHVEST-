// server.js - Node.js + Express prototype for PAVHVEST
// Run: npm install && npm start
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// storage for uploads
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Multer setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const safe = Date.now() + '-' + file.originalname.replace(/\s+/g,'-').replace(/[^a-zA-Z0-9\.\-_]/g,'');
    cb(null, safe);
  }
});
const upload = multer({ storage });

// static
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(uploadDir));
app.use(express.json());
app.use(cors());

// simple sqlite DB
const dbFile = path.join(__dirname, 'pavhvest.db');
const db = new sqlite3.Database(dbFile);
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    author TEXT,
    note TEXT,
    image_path TEXT,
    is_host INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
});

// API: create post (image optional)
app.post('/api/posts', upload.single('image'), (req, res) => {
  const { author, note, is_host } = req.body;
  const image_path = req.file ? '/uploads/' + req.file.filename : null;
  const hostFlag = is_host === 'on' || is_host === '1' || is_host === 'true' ? 1 : 0;

  const stmt = db.prepare('INSERT INTO posts (author, note, image_path, is_host) VALUES (?, ?, ?, ?)');
  stmt.run(author || 'Anonymous', note || '', image_path, hostFlag, function(err) {
    if (err) {
      console.error('DB insert error', err);
      return res.status(500).json({ error: 'DB error' });
    }
    const id = this.lastID;
    db.get('SELECT * FROM posts WHERE id = ?', [id], (err,row) => {
      if (err) return res.status(500).json({ error: 'DB read error' });
      res.json({ post: row });
    });
  });
});

// API: list posts (most recent first)
app.get('/api/posts', (req, res) => {
  db.all('SELECT * FROM posts ORDER BY created_at DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'DB read error' });
    res.json({ posts: rows });
  });
});

// basic ping
app.get('/api/ping', (req, res) => res.json({ ok: true, now: new Date() }));

app.listen(PORT, () => {
  console.log(`PAVHVEST prototype running at http://localhost:${PORT}`);
});
