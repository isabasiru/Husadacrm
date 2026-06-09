const http = require('http');

console.log('Sending request to /api/settings...');
const req = http.request({
  hostname: '127.0.0.1',
  port: 3000,
  path: '/api/settings',
  method: 'GET'
}, (res) => {
  console.log('STATUS:', res.statusCode);
  console.log('HEADERS:', res.headers);
  let body = '';
  res.on('data', (c) => body += c);
  res.on('end', () => {
    console.log('BODY length:', body.length);
    console.log('BODY:', body.substring(0, 500));
  });
});
req.end();
