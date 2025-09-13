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
  const limit = Number(req.query.limit || 500);
  const rows = await prisma.rainReading.findMany({
    where: { deviceId: id },
    orderBy: { timestamp: 'desc' },
    take: limit,
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
