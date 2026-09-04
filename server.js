const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { nanoid } = require('nanoid');
const mime = require('mime-types');

const app = express();

// ---- Config ----
const PORT = process.env.PORT || 3000;
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const DATA_FILE = path.join(__dirname, 'data', 'links.json');
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '1024', 10); // 1GB default
const DEFAULT_EXPIRY_HOURS = parseInt(process.env.DEFAULT_EXPIRY_HOURS || '168', 10); // 7 days
const MAX_EXPIRY_HOURS = parseInt(process.env.MAX_EXPIRY_HOURS || '720', 10); // 30 days cap

if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(path.dirname(DATA_FILE))) fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}');

// ---- Simple JSON "database" helpers ----
function readDb() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return {};
  }
}

function writeDb(db) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function sanitizeFilename(name) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180);
}

// ---- Multer storage: write directly to disk with a random internal name ----
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const internalName = crypto.randomBytes(16).toString('hex');
    cb(null, internalName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 }
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- Upload endpoint ----
app.post('/api/upload', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File too large. Max size is ${MAX_FILE_SIZE_MB}MB.` });
      }
      return res.status(400).json({ error: err.message });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded.' });
    }

    let expiryHours = parseInt(req.body.expiresInHours, 10);
    if (isNaN(expiryHours) || expiryHours <= 0) expiryHours = DEFAULT_EXPIRY_HOURS;
    expiryHours = Math.min(expiryHours, MAX_EXPIRY_HOURS);

    const id = nanoid(10);
    const now = Date.now();
    const expiresAt = now + expiryHours * 60 * 60 * 1000;

    const db = readDb();
    db[id] = {
      id,
      originalName: sanitizeFilename(req.file.originalname),
      storedName: req.file.filename,
      size: req.file.size,
      mimeType: req.file.mimetype || mime.lookup(req.file.originalname) || 'application/octet-stream',
      uploadedAt: now,
      expiresAt,
      downloadCount: 0
    };
    writeDb(db);

    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.get('host');
    const link = `${protocol}://${host}/f/${id}`;

    res.json({
      id,
      link,
      originalName: db[id].originalName,
      size: db[id].size,
      expiresAt: db[id].expiresAt
    });
  });
});

// ---- Metadata lookup (used by download landing page) ----
app.get('/api/info/:id', (req, res) => {
  const db = readDb();
  const entry = db[req.params.id];
  if (!entry) return res.status(404).json({ error: 'File not found.' });
  if (Date.now() > entry.expiresAt) {
    return res.status(410).json({ error: 'This link has expired.' });
  }
  res.json({
    originalName: entry.originalName,
    size: entry.size,
    mimeType: entry.mimeType,
    uploadedAt: entry.uploadedAt,
    expiresAt: entry.expiresAt,
    downloadCount: entry.downloadCount
  });
});

// ---- Landing page shown when someone opens a share link ----
app.get('/f/:id', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'download.html'));
});

// ---- Actual file download ----
app.get('/d/:id', (req, res) => {
  const db = readDb();
  const entry = db[req.params.id];
  if (!entry) return res.status(404).send('File not found.');

  if (Date.now() > entry.expiresAt) {
    return res.status(410).send('This link has expired.');
  }

  const filePath = path.join(UPLOAD_DIR, entry.storedName);
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File no longer exists on server.');
  }

  entry.downloadCount += 1;
  db[req.params.id] = entry;
  writeDb(db);

  res.download(filePath, entry.originalName);
});

// ---- Cleanup expired files periodically ----
function cleanupExpired() {
  const db = readDb();
  const now = Date.now();
  let changed = false;

  for (const id of Object.keys(db)) {
    if (db[id].expiresAt < now) {
      const filePath = path.join(UPLOAD_DIR, db[id].storedName);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
      }
      delete db[id];
      changed = true;
    }
  }

  if (changed) writeDb(db);
}

setInterval(cleanupExpired, 60 * 60 * 1000); // hourly
cleanupExpired();

app.listen(PORT, () => {
  console.log(`File distro system running on http://localhost:${PORT}`);
  console.log(`Max upload size: ${MAX_FILE_SIZE_MB}MB | Default link expiry: ${DEFAULT_EXPIRY_HOURS}h`);
});
