// src/routes/weather.js
const express = require('express');
const prisma = require('../db');
const crypto = require('crypto');

const router = express.Router();
const hash = (x) => crypto.createHash('md5').update(String(x)).digest('hex').slice(0, 10);

async function handleWeather(req, res) {
  try {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return res.status(400).json({ error: 'lat/lng required' });
    }

    const provider = 'openweather';
    const latHash = hash(lat);
    const lngHash = hash(lng);
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);

    // cache 5 นาที (ถ้าไม่มี ?nocache=1)
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

    // Node 18+ มี global fetch
    const r = await fetch(url, { headers: { Accept: 'application/json' } });
    const raw = await r.json();
    if (!r.ok) return res.status(r.status).json(raw);

    const payload = {
      name: raw.name,
      weather: raw.weather?.[0]?.description,
      icon: raw.weather?.[0]?.icon,
      temp: raw.main?.temp,
      humidity: raw.main?.humidity,
      wind_speed: raw.wind?.speed,
      dt: raw.dt,
      raw, // เก็บดิบไว้ให้ด้วยเผื่อหน้าไหนต้องใช้
    };

    await prisma.weatherCache.create({ data: { latHash, lngHash, provider, payload } });
    return res.json(payload);
  } catch (err) {
    console.error('[weather] error', err);
    return res.status(500).json({ error: 'weather_fetch_failed', detail: String(err?.message || err) });
  }
}

// รองรับทั้งสอง path ด้วย handler เดียว
router.get('/', handleWeather);       // /api/weather?lat=..&lng=..
router.get('/near', handleWeather);   // /api/weather/near?lat=..&lng=..

module.exports = router;
