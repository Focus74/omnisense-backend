const p = require('./src/db');
console.log('has device =', !!p.device);
p.$disconnect();
