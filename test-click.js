const http = require('http');

const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/exam/demo',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // I don't have a token, but I can check if it returns 401 Unauthorized immediately
    // If it hangs, it means the server is stuck before auth check!
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('Response:', res.statusCode, data));
});

req.on('error', e => console.error('Error:', e));
req.write(JSON.stringify({ minutesFromNow: 4 }));
req.end();
