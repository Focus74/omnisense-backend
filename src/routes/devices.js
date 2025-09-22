// src/routes/devices.js
const express = require('express');
const prisma = require('../db');
const router = express.Router();

/** รับทั้ง id (number) หรือ device_id (string) */
function whereFrom(param) {
  const n = Number(param);
  return Number.isFinite(n) ? { id: n } : { device_id: String(param) };
}

// รายการอุปกรณ์ + ค่าล่าสุด
router.get('/', async (_req, res) => {
  const devices = await prisma.device.findMany({
    include: {
      rains:  { orderBy: { timestamp: 'desc' }, take: 1 },
      images: { orderBy: { timestamp: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  }).catch(() => []);
  res.json(devices);
});

// รายละเอียดอุปกรณ์
router.get('/:idOrKey', async (req, res) => {
  const d = await prisma.device.findFirst({
    where: whereFrom(req.params.idOrKey),
    include: {
      rains:  { orderBy: { timestamp: 'desc' }, take: 50 },
      images: { orderBy: { timestamp: 'desc' }, take: 50 },
    },
  });
  if (!d) return res.status(404).json({ error: 'not found' });
  res.json(d);
});

// ✅ รูปล่าสุดของอุปกรณ์
router.get('/:idOrKey/latest-image', async (req, res) => {
  const device = await prisma.device.findFirst({ where: whereFrom(req.params.idOrKey) });
  if (!device) return res.status(404).json({ error: 'not found' });

  const last = await prisma.image.findFirst({
    where: { deviceId: device.id },
    orderBy: { timestamp: 'desc' },
  });
  if (!last) return res.status(404).json({ error: 'not found' });

  const url = last.filePath.startsWith('/')
    ? last.filePath
    : `/${last.filePath.replace(/\\/g, '/')}`;

  res.json({ ...last, url });
});

// (ออปชัน) รูปทั้งหมดแบบ limit
router.get('/:idOrKey/images', async (req, res) => {
  const limit = Math.min(Number(req.query.limit || 100), 500);
  const device = await prisma.device.findFirst({ where: whereFrom(req.params.idOrKey) });
  if (!device) return res.status(404).json({ error: 'not found' });

  const rows = await prisma.image.findMany({
    where: { deviceId: device.id },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  res.json(rows.map(r => ({
    ...r,
    url: r.filePath.startsWith('/') ? r.filePath : `/${r.filePath.replace(/\\/g, '/')}`
  })));
});

module.exports = router;

// อ่านข้อมูลฝนตามช่วงเวลา: /api/devices/:idOrKey/rain?hours=24 หรือ ?today=true
router.get('/:idOrKey/rain', async (req, res) => {
  const whereDev = whereFrom(req.params.idOrKey);
  const device = await prisma.device.findFirst({ where: whereDev });
  if (!device) return res.status(404).json({ error: 'not found' });

  const now = new Date();
  let since = null;
  if (req.query.today) {
    since = new Date(); since.setHours(0,0,0,0);
  } else {
    const h = Number(req.query.hours || 24);
    since = new Date(now.getTime() - h * 60 * 60 * 1000);
  }

  const rows = await prisma.rainReading.findMany({
    where: { deviceId: device.id, timestamp: { gte: since } },
    orderBy: { timestamp: 'asc' },
  });

  res.json(rows);
});

