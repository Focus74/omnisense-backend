// src/routes/ingest.js
const express = require('express');
const prisma = require('../db');
const { authDevice } = require('../auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ===== storage config =====
const STORAGE_DIR = path.resolve(process.cwd(), process.env.STORAGE_DIR || './uploads');
fs.mkdirSync(STORAGE_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      const month = new Date().toISOString().slice(0, 7); // YYYY-MM
      const dir = path.join(STORAGE_DIR, month);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    } catch (e) { cb(e); }
  },
  filename: (req, file, cb) => {
    try {
      const did = (req.body?.device_id || 'unknown').toString();
      const ts = Date.now();
      const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
      cb(null, `${did}_${ts}${ext}`);
    } catch (e) { cb(e); }
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5*1024*1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg','image/png','image/jpg','image/webp'].includes(file.mimetype);
    cb(ok ? null : new Error('invalid file type'), ok);
  }
});

function uploadSingle(field) {
  return (req, res, next) =>
    upload.single(field)(req, res, (err) => {
      if (err) {
        console.error('MULTER_ERR', err);
        return res.status(400).json({ error: 'upload_failed', detail: String(err?.message || err) });
      }
      next();
    });
}

// ===== heartbeat =====
router.post('/heartbeat', authDevice, async (req, res) => {
  try {
    const { device_id, name, lat, lng } = req.body || {};
    if (!device_id) return res.status(400).json({ error: 'device_id required' });

    const d = await prisma.device.upsert({
      where: { device_id },
      update: {
        name: name ?? undefined,
        lat: lat ?? undefined,
        lng: lng ?? undefined,
        lastSeenAt: new Date(),
        isOnline: true,
      },
      create: {
        device_id,
        name: name || null,
        lat: lat ?? null,
        lng: lng ?? null,
        lastSeenAt: new Date(),
        isOnline: true,
      },
    });

    req.io?.emit?.('device:heartbeat', { id: d.id, device_id: d.device_id, at: Date.now() });
    res.json({ ok: true, device: d });
  } catch (e) {
    console.error('HEARTBEAT_ERR', e);
    res.status(500).json({ error: 'heartbeat_failed', detail: String(e?.message || e) });
  }
});

// ===== rain =====
router.post('/rain', authDevice, async (req, res) => {
  try {
    const { device_id, rainfall_mm, timestamp } = req.body || {};
    if (!device_id || rainfall_mm === undefined) {
      return res.status(400).json({ error: 'device_id/rainfall_mm required' });
    }
    const device = await prisma.device.findUnique({ where: { device_id } });
    if (!device) return res.status(404).json({ error: 'device not found' });

    const row = await prisma.rainReading.create({
      data: {
        deviceId: device.id,
        rainfall_mm: Number(rainfall_mm),
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    req.io?.emit?.('rain:new', { deviceId: device.id, timestamp: row.timestamp, rainfall_mm: row.rainfall_mm });
    res.json({ ok: true, row });
  } catch (e) {
    console.error('RAIN_ERR', e);
    res.status(500).json({ error: 'rain_failed', detail: String(e?.message || e) });
  }
});

// ===== image upload =====
router.post('/image', authDevice, uploadSingle('image'), async (req, res) => {
  try {
    const { device_id, width, height, timestamp } = req.body || {};
    if (!device_id) return res.status(400).json({ error: 'device_id required' });
    if (!req.file)  return res.status(400).json({ error: 'missing file', hint: 'field name "image" (multipart/form-data)' });

    const device = await prisma.device.findUnique({ where: { device_id } });
    if (!device) return res.status(404).json({ error: 'device not found' });

    const absFile = path.resolve(req.file.destination, req.file.filename);
    const relFromStorage = path.relative(STORAGE_DIR, absFile).replace(/\\/g, '/');
    const filePath = `uploads/${relFromStorage}`;
    const sizeKB = Math.round((req.file.size || 0) / 1024);

    const row = await prisma.image.create({
      data: {
        deviceId: device.id,
        filePath,
        width:  width ? Number(width) : null,
        height: height ? Number(height) : null,
        sizeKB,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      },
    });

    req.io?.emit?.('image:new', { deviceId: device.id, id: row.id, filePath: row.filePath, timestamp: row.timestamp, sizeKB: row.sizeKB });
    res.json({ ok: true, row, url: `/${filePath}` });
  } catch (e) {
    console.error('IMAGE_ERR', e);
    res.status(500).json({ error: 'upload_failed', detail: String(e?.message || e) });
  }
});

module.exports = router;
