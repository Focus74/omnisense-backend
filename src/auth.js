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
