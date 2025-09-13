// src/routes/weather.js
const express = require('express');
const prisma = require('../db');
const crypto = require('crypto');
const fetch = (...a) => import('node-fetch').then(({ default: f }) => f(...a));

const router = express.Router();
const hash = (x) => crypto.createHash('md5').update(String(x)).digest('hex').slice(0, 10);

router.get('/', async (req, res) => {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return res.status(400).json({ error: 'lat/lng required' });
    }

    const provider = 'openweather';
    const latHash  = hash(lat);
    const lngHash  = hash(lng);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    // ใช้ cache เฉพาะเมื่อไม่ขอ nocache
    if (!req.query.nocache) {
      const cached = await prisma.weatherCache.findFirst({
        where: { latHash, lngHash, provider, fetchedAt: { gte: fiveMinAgo } },
        orderBy: { fetchedAt: 'desc' },
      });
      if (cached) return res.json(cached.payload);
    }

    const key = process.env.OPENWEATHER_API_KEY;
    if (!key) return res.status(503).json({ error: 'OPENWEATHER_API_KEY missing' });

    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&lang=th&appid=${key}`;
    const r = await fetch(url, { headers: { Accept: 'application/json' }, timeout: 8000 });
    const payload = await r.json();

    // ❗️ไม่เก็บ cache ถ้า upstream ไม่ ok (เช่น 401/429/5xx)
    if (!r.ok) return res.status(r.status).json(payload);

    // เก็บ cache เฉพาะเมื่อสำเร็จ
    await prisma.weatherCache.create({ data: { latHash, lngHash, provider, payload } });

    // ส่งข้อมูลที่อ่านง่าย (หรือจะ res.json(payload) ก็ได้)
    return res.json({
      name: payload.name,
      weather: payload.weather?.[0]?.description,
      icon: payload.weather?.[0]?.icon,
      temp: payload.main?.temp,
      humidity: payload.main?.humidity,
      wind_speed: payload.wind?.speed,
      dt: payload.dt,
      raw: payload,
    });
  } catch (err) {
    return res.status(500).json({ error: 'weather_fetch_failed', detail: String(err?.message || err) });
  }
});

module.exports = router;
