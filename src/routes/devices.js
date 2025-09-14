const express = require('express');
const prisma = require('../db');
const router = express.Router();

router.get('/', async (_req, res) => {
  const devices = await prisma.device.findMany({
    include: {
      rains:  { orderBy: { timestamp: 'desc' }, take: 1 },
      images: { orderBy: { timestamp: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(devices);
});

router.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const device = await prisma.device.findUnique({
    where: { id },
    include: {
      rains:  { orderBy: { timestamp: 'desc' }, take: 100 },
      images: { orderBy: { timestamp: 'desc' }, take: 50 },
    },
  });
  if (!device) return res.status(404).json({ error: 'device not found' });
  res.json(device);
});

router.get('/:id/rain', async (req, res) => {
  const id = Number(req.params.id);

  // รองรับทั้ง hours และ since (ISO datetime) และ fallback เป็น limit
  const hours = req.query.hours ? Number(req.query.hours) : null;
  const since = req.query.since ? new Date(req.query.since) : null;
  const limit = Number(req.query.limit || 500);

  const where = { deviceId: id };

  if (hours && !Number.isNaN(hours)) {
    const gte = new Date(Date.now() - hours * 60 * 60 * 1000);
    where.timestamp = { gte };
  } else if (since && !Number.isNaN(since.getTime())) {
    where.timestamp = { gte: since };
  }

  // เรียงจากเก่า→ใหม่ จะได้เอาไปวาดกราฟตรง ๆ
  const rows = await prisma.rainReading.findMany({
    where,
    orderBy: { timestamp: 'asc' },
    take: hours || since ? undefined : limit,
  });

  res.json(rows);
});


router.get('/:id/images', async (req, res) => {
  const id = Number(req.params.id);
  const limit = Number(req.query.limit || 100);
  const rows = await prisma.image.findMany({
    where: { deviceId: id },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
  res.json(rows);
});

module.exports = router;
