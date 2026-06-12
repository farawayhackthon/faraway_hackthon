const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/exam/demo',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer test-token' // I need a valid token to test this, wait...
  }
};
