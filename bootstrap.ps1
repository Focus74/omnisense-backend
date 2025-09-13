# === bootstrap.ps1 ===
New-Item -ItemType Directory -Force -Path src,prisma,uploads,src\routes | Out-Null

'{
  "name": "omnisense-backend",
  "version": "1.0.0",
  "type": "commonjs",
  "scripts": {
    "dev": "nodemon --watch src --ext js --exec node src/server.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev --name init",
    "prisma:studio": "prisma studio"
  }
}' | Out-File -Encoding UTF8 package.json

@"
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5433/omnisense
JWT_SECRET=change_me
ALLOWED_ORIGIN=http://localhost:5173
OPENWEATHER_API_KEY=
DEVICE_INGEST_TOKEN=change_me_device
STORAGE_DIR=./uploads
"@ | Out-File -Encoding UTF8 .env

@"
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

model Device {
  id          Int       @id @default(autoincrement())
  device_id   String    @unique
  name        String
  lat         Float
  lng         Float
  lastSeenAt  DateTime?
  isOnline    Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  rains       RainReading[]
  images      Image[]
}
model RainReading {
  id          Int      @id @default(autoincrement())
  deviceId    Int
  timestamp   DateTime @default(now())
  rainfall_mm Float
  device      Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  @@index([deviceId, timestamp])
}
model Image {
  id        Int      @id @default(autoincrement())
  deviceId  Int
  timestamp DateTime @default(now())
  filePath  String
  width     Int?
  height    Int?
  sizeKB    Int?
  device    Device   @relation(fields: [deviceId], references: [id], onDelete: Cascade)
  @@index([deviceId, timestamp])
}
model WeatherCache {
  id        Int      @id @default(autoincrement())
  latHash   String
  lngHash   String
  payload   Json
  fetchedAt DateTime @default(now())
  provider  String
  @@index([latHash, lngHash])
}
model User {
  id           Int     @id @default(autoincrement())
  email        String  @unique
  passwordHash String
  role         String  @default("admin")
}
"@ | Out-File -Encoding UTF8 prisma\schema.prisma

@"
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
module.exports = prisma;
"@ | Out-File -Encoding UTF8 src\db.js

@"
const jwt = require('jsonwebtoken');
function authAdmin(req,res,next){
  const token=(req.headers.authorization||'').replace('Bearer ','');
  if(!token) return res.status(401).json({error:'missing token'});
  try{
    const p=jwt.verify(token,process.env.JWT_SECRET);
    if(p.role!=='admin') return res.status(403).json({error:'forbidden'});
    req.user=p; next();
  }catch{ return res.status(401).json({error:'invalid token'}); }
}
function authDevice(req,res,next){
  const t=req.headers['x-device-token'];
  if(!t||t!==process.env.DEVICE_INGEST_TOKEN) return res.status(401).json({error:'invalid device token'});
  next();
}
module.exports={authAdmin,authDevice};
"@ | Out-File -Encoding UTF8 src\auth.js

@"
const express=require('express');
const prisma=require('../db');
const router=express.Router();
router.get('/',async(_req,res)=>{
  const devices=await prisma.device.findMany({
    include:{rains:{orderBy:{timestamp:'desc'},take:1},images:{orderBy:{timestamp:'desc'},take:1}},
    orderBy:{updatedAt:'desc'}
  });
  res.json(devices);
});
router.get('/:id',async(req,res)=>{
  const id=Number(req.params.id);
  const device=await prisma.device.findUnique({
    where:{id},include:{rains:{orderBy:{timestamp:'desc'},take:100},images:{orderBy:{timestamp:'desc'},take:50}}
  });
  if(!device) return res.status(404).json({error:'device not found'});
  res.json(device);
});
router.get('/:id/rain',async(req,res)=>{
  const id=Number(req.params.id); const limit=Number(req.query.limit||500);
  const rows=await prisma.rainReading.findMany({where:{deviceId:id},orderBy:{timestamp:'desc'},take:limit});
  res.json(rows);
});
router.get('/:id/images',async(req,res)=>{
  const id=Number(req.params.id); const limit=Number(req.query.limit||100);
  const rows=await prisma.image.findMany({where:{deviceId:id},orderBy:{timestamp:'desc'},take:limit});
  res.json(rows);
});
module.exports=router;
"@ | Out-File -Encoding UTF8 src\routes\devices.js

@"
const express=require('express');
const prisma=require('../db');
const {authDevice}=require('../auth');
const multer=require('multer');
const path=require('path'); const fs=require('fs');
const router=express.Router();
const storageDir=process.env.STORAGE_DIR||'./uploads';
fs.mkdirSync(storageDir,{recursive:true});
const upload=multer({dest:storageDir});
router.post('/heartbeat',authDevice,async(req,res)=>{
  const {device_id,name,lat,lng}=req.body;
  if(!device_id) return res.status(400).json({error:'device_id required'});
  const device=await prisma.device.upsert({
    where:{device_id},
    create:{device_id,name:name||device_id,lat:Number(lat)||0,lng:Number(lng)||0,isOnline:true,lastSeenAt:new Date()},
    update:{name:name||device_id,lat:Number(lat)||0,lng:Number(lng)||0,isOnline:true,lastSeenAt:new Date()}
  });
  req.io.emit('device:update',device);
  res.json({ok:true,device});
});
router.post('/rain',authDevice,async(req,res)=>{
  const {device_id,rainfall_mm,timestamp}=req.body;
  if(!device_id) return res.status(400).json({error:'device_id required'});
  const device=await prisma.device.findUnique({where:{device_id}});
  if(!device) return res.status(404).json({error:'device not found'});
  const row=await prisma.rainReading.create({data:{
    deviceId:device.id,rainfall_mm:Number(rainfall_mm)||0,timestamp:timestamp?new Date(timestamp):new Date()
  }});
  req.io.emit('rain:new',{deviceId:device.id,row});
  res.json({ok:true,row});
});
router.post('/image',authDevice,upload.single('file'),async(req,res)=>{
  const {device_id,width,height,timestamp}=req.body;
  if(!device_id) return res.status(400).json({error:'device_id required'});
  if(!req.file) return res.status(400).json({error:'file required'});
  const device=await prisma.device.findUnique({where:{device_id}});
  if(!device) return res.status(404).json({error:'device not found'});
  const filePath=path.relative(process.cwd(),req.file.path).replace(/\\/g,'/');
  const sizeKB=Math.round(req.file.size/1024);
  const row=await prisma.image.create({data:{
    deviceId:device.id,filePath,width:width?Number(width):null,height:height?Number(height):null,sizeKB,
    timestamp:timestamp?new Date(timestamp):new Date()
  }});
  req.io.emit('image:new',{deviceId:device.id,row});
  res.json({ok:true,row});
});
module.exports=router;
"@ | Out-File -Encoding UTF8 src\routes\ingest.js

@"
const express=require('express');
const prisma=require('../db');
const router=express.Router();
const crypto=require('crypto');
const fetch=(...a)=>import('node-fetch').then(({default:f})=>f(...a));
function hash(x){return crypto.createHash('md5').update(String(x)).digest('hex').slice(0,10);}
router.get('/',async(req,res)=>{
  const lat=Number(req.query.lat), lng=Number(req.query.lng);
  if(Number.isNaN(lat)||Number.isNaN(lng)) return res.status(400).json({error:'lat/lng required'});
  const provider='openweather', latHash=hash(lat), lngHash=hash(lng);
  const fiveMinAgo=new Date(Date.now()-5*60*1000);
  const cached=await prisma.weatherCache.findFirst({
    where:{latHash,lngHash,provider,fetchedAt:{gte:fiveMinAgo}}, orderBy:{fetchedAt:'desc'}
  });
  if(cached) return res.json(cached.payload);
  if(!process.env.OPENWEATHER_API_KEY) return res.status(503).json({error:'OPENWEATHER_API_KEY missing'});
  const url=`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&units=metric&lang=th&appid=${process.env.OPENWEATHER_API_KEY}`;
  const r=await fetch(url); const payload=await r.json();
  await prisma.weatherCache.create({data:{latHash,lngHash,provider,payload}});
  res.json(payload);
});
module.exports=router;
"@ | Out-File -Encoding UTF8 src\routes\weather.js

@"
require('dotenv').config();
const express=require('express');
const http=require('http');
const cors=require('cors');
const pino=require('pino'); const pinoHttp=require('pino-http');
const path=require('path');
const devicesRoute=require('./routes/devices');
const ingestRoute=require('./routes/ingest');
const weatherRoute=require('./routes/weather');
const app=express(); const server=http.createServer(app);
const {Server}=require('socket.io');
const io=new Server(server,{cors:{origin:process.env.ALLOWED_ORIGIN||'*'}});
app.use((req,_res,next)=>{req.io=io; next();});
app.use(cors({origin:process.env.ALLOWED_ORIGIN||'*'}));
app.use(express.json({limit:'10mb'}));
app.use(pinoHttp({logger:pino({transport:{target:'pino-pretty'}})}));
app.use('/uploads',express.static(path.resolve(process.env.STORAGE_DIR||'./uploads')));
app.use('/api/devices',devicesRoute);
app.use('/api/ingest',ingestRoute);
app.use('/api/weather',weatherRoute);
app.get('/api/health',(_req,res)=>res.json({ok:true}));
const PORT=process.env.PORT||3000;
server.listen(PORT,()=>console.log(`Backend running on http://localhost:${PORT}`));
"@ | Out-File -Encoding UTF8 src\server.js
# === end bootstrap.ps1 ===
