const http = require('http');

const loginOptions = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/login',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
};

const req = http.request(loginOptions, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const response = JSON.parse(data);
    if (!response.token) {
      console.log('Login failed:', response);
      return;
    }
    
    console.log('Login success, testing demo endpoint...');
    
    const demoReq = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/exam/demo',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${response.token}`
      }
    }, (demoRes) => {
      let demoData = '';
      demoRes.on('data', chunk => demoData += chunk);
      demoRes.on('end', () => console.log('Demo Response:', demoRes.statusCode, demoData));
    });
    
    demoReq.on('error', e => console.error('Demo Error:', e));
    demoReq.write(JSON.stringify({ minutesFromNow: 4 }));
    demoReq.end();
  });
});

req.on('error', e => console.error('Login Error:', e));
req.write(JSON.stringify({ username: 'admin', password: 'Admin@123' }));
req.end();
