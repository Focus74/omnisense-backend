const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authAdmin } = require('../auth');

const router = express.Router();
const prisma = new PrismaClient();

// ใช้ JWT แอดมินจริง
router.use(authAdmin);

/** แปลงพารามิเตอร์เป็น where โดยรับได้ทั้ง id (number) หรือ device_id (string) */
function whereFrom(param) {
  const n = Number(param);
  return Number.isFinite(n) ? { id: n } : { device_id: param };
}

// LIST
router.get('/', async (_req, res) => {
  const items = await prisma.device.findMany({ orderBy: { createdAt: 'desc' } }).catch(() => []);
  res.json(items);
});

// CREATE
router.post('/', async (req, res) => {
  const { device_id, name, lat, lng } = req.body || {};
  if (!device_id || !name) return res.status(400).json({ error: 'device_id/name required' });
  try {
    const d = await prisma.device.create({ data: { device_id, name, lat, lng } });
    res.json(d);
  } catch (e) {
    if (String(e.message).includes('Unique constraint')) {
      return res.status(409).json({ error: 'device_id already exists' });
    }
    console.error(e);
    res.status(500).json({ error: 'create failed' });
  }
});

// UPDATE  (/:idOrDeviceId)
router.patch('/:idOrKey', async (req, res) => {
  const where = whereFrom(req.params.idOrKey);
  const data = {};
  ['name','lat','lng'].forEach(k => (req.body?.[k] !== undefined) && (data[k] = req.body[k]));
  try {
    const d = await prisma.device.update({ where, data });
    res.json(d);
  } catch {
    res.status(404).json({ error: 'not found' });
  }
});

// DELETE  (/:idOrDeviceId)
router.delete('/:idOrKey', async (req, res) => {
  const where = whereFrom(req.params.idOrKey);
  try {
    await prisma.device.delete({ where });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'not found' });
  }
});

// CAPTURE stub  (/:idOrDeviceId/capture)
router.post('/:idOrKey/capture', async (_req, res) => {
  // TODO: ใส่โค้ดสั่งกล้องจริงของคุณ
  res.json({ ok: true, queued: true });
});

module.exports = router;
