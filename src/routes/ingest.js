// src/routes/ingest.js  (เวอร์ชันแทนของเดิม)

const express = require('express');
const prisma = require('../db');
const { authDevice } = require('../auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

const storageDir = process.env.STORAGE_DIR || './uploads';
fs.mkdirSync(storageDir, { recursive: true });

/**
 * ใช้ multer.diskStorage:
 * - แยกโฟลเดอร์รายเดือน: uploads/YYYY-MM
 * - ชื่อไฟล์: <device_id>_<timestamp>.<ext>  (ถ้าไม่มีนามสกุล เดาเป็น .jpg)
 */
const storage = multer.diskStorage({
  destination(req, file, cb) {
    const yymm = new Date().toISOString().slice(0, 7); // YYYY-MM
    const dest = path.join(storageDir, yymm);
    fs.mkdirSync(dest, { recursive: true });
    cb(null, dest);
  },
  filename(req, file, cb) {
    const safeId = String(req.body.device_id || 'unknown').replace(/[^\w-]/g, '_');
    let ext = path.extname(file.originalname || '').toLowerCase();
    if (!ext) ext = '.jpg';
    cb(null, `${safeId}_${Date.now()}${ext}`);
  },
});

const upload = multer({ storage });

/* -------------------- heartbeat -------------------- */
router.post('/heartbeat', authDevice, async (req, res) => {
  const { device_id, name, lat, lng } = req.body;
  if (!device_id) return res.status(400).json({ error: 'device_id required' });

  const device = await prisma.device.upsert({
    where: { device_id },
    create: {
      device_id,
      name: name || device_id,
      lat: Number(lat) || 0,
      lng: Number(lng) || 0,
      isOnline: true,
      lastSeenAt: new Date(),
    },
    update: {
      name: name || device_id,
      lat: Number(lat) || 0,
      lng: Number(lng) || 0,
      isOnline: true,
      lastSeenAt: new Date(),
    },
  });

  req.io.emit('device:update', device);
  res.json({ ok: true, device });
});

/* -------------------- rain -------------------- */
router.post('/rain', authDevice, async (req, res) => {
  const { device_id, rainfall_mm, timestamp } = req.body;
  if (!device_id) return res.status(400).json({ error: 'device_id required' });

  const device = await prisma.device.findUnique({ where: { device_id } });
  if (!device) return res.status(404).json({ error: 'device not found' });

  const row = await prisma.rainReading.create({
    data: {
      deviceId: device.id,
      rainfall_mm: Number(rainfall_mm) || 0,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    },
  });

  req.io.emit('rain:new', { deviceId: device.id, row });
  res.json({ ok: true, row });
});

/* -------------------- image (อัปเดตให้มีนามสกุล & โฟลเดอร์รายเดือน) -------------------- */
router.post('/image', authDevice, upload.single('file'), async (req, res) => {
  const { device_id, width, height, timestamp } = req.body;
  if (!device_id) return res.status(400).json({ error: 'device_id required' });
  if (!req.file)   return res.status(400).json({ error: 'file required' });

  const device = await prisma.device.findUnique({ where: { device_id } });
  if (!device) return res.status(404).json({ error: 'device not found' });

  // แปลงพาธบนดิสก์ -> พาธ public (ใช้ / เสมอ)
  const publicPath = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');
  const sizeKB = Math.round((fs.statSync(req.file.path).size || 0) / 1024);

  const row = await prisma.image.create({
    data: {
      deviceId: device.id,
      filePath: publicPath,                 // ตัวอย่าง: uploads/2025-09/ESP32-001_169xxxxxxx.jpg
      width:  width  ? Number(width)  : null,
      height: height ? Number(height) : null,
      sizeKB,
      timestamp: timestamp ? new Date(timestamp) : new Date(),
    },
  });

  req.io.emit('image:new', { deviceId: device.id, row });
  res.json({ ok: true, row });
});

module.exports = router;
