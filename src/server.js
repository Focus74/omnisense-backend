// src/server.js
require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const prisma = new PrismaClient();

// ---------- middleware ----------
app.use(express.json());
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN?.split(',') || '*',
  credentials: true,
}));

// socket.io
const io = new Server(server, {
  cors: { origin: process.env.ALLOWED_ORIGIN?.split(',') || '*', credentials: true }
});
app.use((req, _res, next) => { req.io = io; next(); });

// static /uploads (เสิร์ฟไฟล์รูปที่อุปกรณ์อัปโหลด)
const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.cwd(), process.env.STORAGE_DIR)
  : path.resolve(process.cwd(), 'uploads');
app.use('/uploads', express.static(STORAGE_DIR, { index: false, maxAge: '1h' }));

// (ถ้าติดตั้งแล้วคงไว้ได้) rate limit
const rateLimit = require('express-rate-limit');
app.use('/api/', rateLimit({ windowMs: 60_000, max: 300 }));

// ---------- routes ----------
app.use('/api/auth',    require('./routes/auth'));
app.use('/api/devices', require('./routes/devices'));
app.use('/api/ingest',  require('./routes/ingest'));
app.use('/api/weather', require('./routes/weather'));
app.use('/api/admin/devices', require('./routes/adminDevices'));

// health
app.get(['/health', '/api/health'], (_req, res) =>
  res.json({ ok: true, ts: new Date().toISOString() })
);

// error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('UNCAUGHT_ERROR', err);
  res.status(500).json({ error: 'Internal Server Error' });
});

async function start() {
  try {
    await prisma.$connect();
    console.log('[prisma] connected');

    const PORT = Number(process.env.PORT) || 3000;
    // ⬇️ NEW: ผูกเฉพาะ loopback (เหมาะเมื่อมี Nginx proxy อยู่ข้างหน้า)
    const HOST = process.env.HOST || '127.0.0.1';

    server.listen(PORT, HOST, () => {
      console.log(`[server] listening on http://${HOST}:${PORT}`);
    });
  } catch (e) {
    console.error('[startup] failed:', e);
    process.exit(1);
  }
}

process.on('unhandledRejection', r => console.error('UNHANDLED_REJECTION', r));
process.on('uncaughtException',  e => { console.error('UNCAUGHT_EXCEPTION', e); process.exit(1); });

start();
