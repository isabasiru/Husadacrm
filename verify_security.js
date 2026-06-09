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

async function runTests() {
  console.log('🛡️ Starting Husada CRM Security Verification Tests...');
  let failures = 0;

  // 1. Backdoor Login Tests
  console.log('\n--- 1. Backdoor Login Tests ---');
  
  // Test A: Admin with backdoor password
  const backdoorLogin1 = await request({ path: '/api/auth/login', method: 'POST' }, JSON.stringify({
    email: 'admin@husada.webhaus.id',
    password: 'password'
  }));
  if (backdoorLogin1.statusCode === 401) {
    console.log('✅ PASS: Backdoor login with email "admin@husada.webhaus.id" and password "password" is blocked (401)');
  } else {
    console.error(`❌ FAIL: Backdoor login allowed! Status: ${backdoorLogin1.statusCode}`);
    failures++;
  }

  // Test B: Super Admin with backdoor password
  const backdoorLogin2 = await request({ path: '/api/auth/login', method: 'POST' }, JSON.stringify({
    email: 'super_admin@husada.id',
    password: 'password'
  }));
  if (backdoorLogin2.statusCode === 401) {
    console.log('✅ PASS: Backdoor login with email "super_admin@husada.id" and password "password" is blocked (401)');
  } else {
    console.error(`❌ FAIL: Backdoor login allowed! Status: ${backdoorLogin2.statusCode}`);
    failures++;
  }

  // Test C: Valid credentials
  const validLogin = await request({ path: '/api/auth/login', method: 'POST' }, JSON.stringify({
    email: 'admin@husada.webhaus.id',
    password: 'AdminHusada123!'
  }));
  let authCookie = '';
  if (validLogin.statusCode === 200) {
    console.log('✅ PASS: Login with correct bcrypt credentials succeeds (200)');
    const setCookie = validLogin.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      authCookie = setCookie[0].split(';')[0];
    }
  } else {
    console.error(`❌ FAIL: Login with valid credentials failed! Status: ${validLogin.statusCode}, Body: ${validLogin.body}`);
    failures++;
  }

  // 2. WAHA Webhook Authentication Tests
  console.log('\n--- 2. WAHA Webhook Authentication Tests ---');
  
  // Test A: Webhook with no auth header
  const webhookNoAuth = await request({ path: '/api/waha/webhook', method: 'POST' }, JSON.stringify({ event: 'message' }));
  if (webhookNoAuth.statusCode === 401) {
    console.log('✅ PASS: Webhook POST without X-Api-Key header is blocked (401)');
  } else {
    console.error(`❌ FAIL: Webhook accepted unauthenticated requests! Status: ${webhookNoAuth.statusCode}`);
    failures++;
  }

  // Test B: Webhook with wrong key
  const webhookWrongAuth = await request({ path: '/api/waha/webhook', method: 'POST' }, JSON.stringify({ event: 'message' }), {
    'X-Api-Key': 'wrong-key-value'
  });
  if (webhookWrongAuth.statusCode === 401) {
    console.log('✅ PASS: Webhook POST with invalid X-Api-Key is blocked (401)');
  } else {
    console.error(`❌ FAIL: Webhook accepted invalid X-Api-Key! Status: ${webhookWrongAuth.statusCode}`);
    failures++;
  }

  // Test C: Webhook with correct key
  const webhookCorrectAuth = await request({ path: '/api/waha/webhook', method: 'POST' }, JSON.stringify({ event: 'message' }), {
    'X-Api-Key': 'webhaus-waha-key'
  });
  if (webhookCorrectAuth.statusCode === 200) {
    console.log('✅ PASS: Webhook POST with correct X-Api-Key is allowed (200)');
  } else {
    console.error(`❌ FAIL: Webhook with correct key failed! Status: ${webhookCorrectAuth.statusCode}, Body: ${webhookCorrectAuth.body}`);
    failures++;
  }

  // 3. Contact Details API Authentication Tests
  console.log('\n--- 3. Contact Details API Authentication Tests ---');
  
  // Find a contact ID by using our active session
  let contactId = '';
  if (authCookie) {
    const contactsRes = await request({ path: '/api/contacts', method: 'GET' }, null, { 'Cookie': authCookie });
    if (contactsRes.statusCode === 200) {
      try {
        const list = JSON.parse(contactsRes.body);
        if (list && list.length > 0) {
          contactId = list[0].id;
        }
      } catch (e) {}
    }
  }

  if (contactId) {
    // Test A: GET Contact details without session cookie
    const getContactNoAuth = await request({ path: `/api/contacts/${contactId}`, method: 'GET' });
    if (getContactNoAuth.statusCode === 401) {
      console.log('✅ PASS: GET /api/contacts/[id] without session cookie is blocked (401)');
    } else {
      console.error(`❌ FAIL: GET /api/contacts/[id] allowed without session! Status: ${getContactNoAuth.statusCode}`);
      failures++;
    }

    // Test B: PATCH Contact details without session cookie
    const patchContactNoAuth = await request({ path: `/api/contacts/${contactId}`, method: 'PATCH' }, JSON.stringify({ notes: 'Hack attempt' }));
    if (patchContactNoAuth.statusCode === 401) {
      console.log('✅ PASS: PATCH /api/contacts/[id] without session cookie is blocked (401)');
    } else {
      console.error(`❌ FAIL: PATCH /api/contacts/[id] allowed without session! Status: ${patchContactNoAuth.statusCode}`);
      failures++;
    }

    // Test C: GET Contact details with valid session cookie
    const getContactWithAuth = await request({ path: `/api/contacts/${contactId}`, method: 'GET' }, null, { 'Cookie': authCookie });
    if (getContactWithAuth.statusCode === 200) {
      console.log('✅ PASS: GET /api/contacts/[id] with valid session cookie is allowed (200)');
    } else {
      console.error(`❌ FAIL: GET /api/contacts/[id] failed with valid session! Status: ${getContactWithAuth.statusCode}`);
      failures++;
    }
  } else {
    console.log('⚠️ SKIP: No contact found in database to run contacts detail auth test.');
  }

  // 4. Broadcast API Authentication Tests
  console.log('\n--- 4. Broadcast API Authentication Tests ---');
  
  // Test A: Broadcast triggers without session cookie
  const broadcastNoAuth = await request({ path: '/api/broadcast', method: 'POST' }, JSON.stringify({
    targetType: 'all',
    message: 'Hack message'
  }));
  if (broadcastNoAuth.statusCode === 401) {
    console.log('✅ PASS: POST /api/broadcast without session cookie is blocked (401)');
  } else {
    console.error(`❌ FAIL: POST /api/broadcast allowed without session! Status: ${broadcastNoAuth.statusCode}`);
    failures++;
  }

  console.log('\n=======================================');
  if (failures === 0) {
    console.log('🎉 SUCCESS: All security verification tests passed!');
  } else {
    console.error(`❌ FAILURE: ${failures} security verification test(s) failed!`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('❌ Tests execution failed:', err);
  process.exit(1);
});
