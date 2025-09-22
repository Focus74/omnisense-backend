const express = require('express');
const { signToken, comparePassword } = require('../auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'email/password required' });
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminHash  = process.env.ADMIN_PASSWORD_HASH;
    if (!adminEmail || !adminHash) {
      return res.status(500).json({ error: 'ADMIN_EMAIL or ADMIN_PASSWORD_HASH not set' });
    }
    if (email !== adminEmail) {
      return res.status(401).json({ error: 'invalid credentials' });
    }

    const ok = await comparePassword(password, adminHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    // ออก token ด้วย role: 'admin' (สอดคล้องกับ authAdmin)
    const token = signToken({ id: 'admin', role: 'admin', email });
    return res.json({ token });
  } catch (e) {
    console.error('LOGIN_ERROR', e);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

module.exports = router;
