// src/routes/admin.js
const express = require('express');
const prisma = require('../db');
const { authAdmin } = require('../auth');

const router = express.Router();

router.use(authAdmin);

// สร้างอุปกรณ์
router.post('/devices', async (req, res) => {
  const { device_id, name, lat, lng } = req.body || {};
  if (!device_id || !name) return res.status(400).json({ error: 'device_id/name required' });

  const d = await prisma.device.create({
    data: {
      device_id,
      name,
      lat: Number(lat) || 0,
      lng: Number(lng) || 0,
      isOnline: false,
    },
  });
  return res.json({ ok: true, device: d });
});

// แก้อุปกรณ์
router.put('/devices/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { name, lat, lng, isOnline } = req.body || {};
  const d = await prisma.device.update({
    where: { id },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(lat !== undefined ? { lat: Number(lat) } : {}),
      ...(lng !== undefined ? { lng: Number(lng) } : {}),
      ...(isOnline !== undefined ? { isOnline: !!isOnline } : {}),
    },
  });
  return res.json({ ok: true, device: d });
});

// ลบอุปกรณ์
router.delete('/devices/:id', async (req, res) => {
  const id = Number(req.params.id);
  await prisma.device.delete({ where: { id } });
  return res.json({ ok: true });
});

// (ออปชัน) สั่งถ่ายภาพใหม่ — ในที่นี้แค่ mock (วาง hook ต่อกับ ESP32-CAM ของคุณภายหลัง)
router.post('/devices/:id/capture', async (req, res) => {
  // TODO: call MQTT/HTTP ไปที่กล้องจริงของคุณ
  return res.json({ ok: true, note: 'capture triggered (mock)' });
});

module.exports = router;
