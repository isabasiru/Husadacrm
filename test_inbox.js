const http = require('http');

function request(options, postData = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const reqHeaders = { ...headers };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }
    
    const reqOptions = {
      hostname: options.hostname || '127.0.0.1',
      port: options.port || 3000,
      path: options.path,
      method: options.method || 'GET',
      headers: reqHeaders
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

async function main() {
  console.log('Logging in...');
  const loginRes = await request({ path: '/api/auth/login', method: 'POST' }, JSON.stringify({
    email: 'admin@husada.webhaus.id',
    password: 'AdminHusada123!'
  }));

  const setCookie = loginRes.headers['set-cookie'];
  if (!setCookie) {
    console.error('No cookie returned');
    return;
  }
  const cookie = setCookie[0].split(';')[0];
  console.log('Auth cookie retrieved:', cookie);

  console.log('Fetching /dashboard/inbox HTML...');
  const inboxRes = await request({ path: '/dashboard/inbox' }, null, { 'Cookie': cookie });
  console.log('Status code:', inboxRes.statusCode);
  console.log('Body length:', inboxRes.body.length);
  
  if (inboxRes.body.includes('initialContacts')) {
    console.log('Found initialContacts in body!');
  }
  console.log('First 500 characters of body:');
  console.log(inboxRes.body.substring(0, 1500));
}

main().catch(console.error);
