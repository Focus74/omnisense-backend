require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const pino = require('pino');
const pinoHttp = require('pino-http');
const path = require('path');

const devicesRoute = require('./routes/devices');
const ingestRoute  = require('./routes/ingest');
const weatherRoute = require('./routes/weather');

const app = express();
const server = http.createServer(app);

const { Server } = require('socket.io');
const io = new Server(server, { cors: { origin: process.env.ALLOWED_ORIGIN || '*' } });

app.use((req, _res, next) => { req.io = io; next(); });
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(pinoHttp({ logger: pino({ transport: { target: 'pino-pretty' } }) }));

app.use('/uploads', express.static(path.resolve(process.env.STORAGE_DIR || './uploads')));

app.use('/api/devices', devicesRoute);
app.use('/api/ingest', ingestRoute);
app.use('/api/weather', weatherRoute);

app.get('/api/health', (_req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
