const http = require('http');

const agent = new http.Agent({ keepAlive: true });

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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
  console.log('🧪 Starting Husada CRM API Endpoints verification...');
  
  // 1. Login to get Auth Cookie
  console.log('\n🔑 Step 1: Logging in as admin...');
  const loginData = JSON.stringify({
    email: 'admin@husada.webhaus.id',
    password: 'AdminHusada123!'
  });
  
  const loginRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(loginData)
    }
  }, loginData);

  console.log(`Response Status: ${loginRes.statusCode}`);
  console.log(`Body: ${loginRes.body}`);
  
  if (loginRes.statusCode !== 200) {
    console.error('❌ Login failed!');
    process.exit(1);
  }

  // Extract auth cookie
  const setCookie = loginRes.headers['set-cookie'];
  if (!setCookie || setCookie.length === 0) {
    console.error('❌ Set-Cookie header missing!');
    process.exit(1);
  }
  
  const cookie = setCookie[0].split(';')[0];
  console.log(`✅ Extracted Auth Cookie: ${cookie.substring(0, 30)}...`);

  // 2. Fetch Users List
  console.log('\n👥 Step 2: Fetching active users list (GET /api/users)...');
  const usersRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/users',
    method: 'GET',
    headers: {
      'Cookie': cookie
    }
  });

  console.log(`Response Status: ${usersRes.statusCode}`);
  const users = JSON.parse(usersRes.body);
  console.log(`Active users count: ${Array.isArray(users) ? users.length : 0}`);
  if (Array.isArray(users) && users.length > 0) {
    console.log(`First User: ${JSON.stringify(users[0])}`);
  }

  // 3. Fetch Dashboard Stats
  console.log('\n📊 Step 3: Fetching dashboard stats (GET /api/dashboard/stats)...');
  const statsRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/dashboard/stats',
    method: 'GET',
    headers: {
      'Cookie': cookie
    }
  });

  console.log(`Response Status: ${statsRes.statusCode}`);
  const stats = JSON.parse(statsRes.body);
  console.log(`Stats metrics: ${JSON.stringify(stats.metrics, null, 2)}`);
  console.log(`Funnel Breakdown: ${JSON.stringify(stats.funnel, null, 2)}`);
  console.log(`Source Attribution: ${JSON.stringify(stats.sourceAttribution, null, 2)}`);

  // 4. Create new Agent/User
  console.log('\n➕ Step 4: Creating new agent (POST /api/users)...');
  const newUserData = JSON.stringify({
    email: 'new_agent_' + Math.floor(Math.random() * 1000) + '@husada.webhaus.id',
    fullName: 'Test Agent ' + Math.floor(Math.random() * 100),
    password: 'password123',
    role: 'AGENT'
  });

  const createUserRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/users',
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(newUserData)
    }
  }, newUserData);

  console.log(`Response Status: ${createUserRes.statusCode}`);
  console.log(`Body: ${createUserRes.body}`);
  const createdUser = JSON.parse(createUserRes.body);

  // 5. Update user/agent (PATCH /api/users/[id])
  if (createdUser && createdUser.id) {
    console.log(`\n✏️ Step 5: Updating agent details (PATCH /api/users/${createdUser.id})...`);
    const updateUserData = JSON.stringify({
      fullName: createdUser.fullName + ' Updated',
      role: 'AGENT'
    });

    const updateUserRes = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: `/api/users/${createdUser.id}`,
      method: 'PATCH',
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(updateUserData)
      }
    }, updateUserData);

    console.log(`Response Status: ${updateUserRes.statusCode}`);
    console.log(`Body: ${updateUserRes.body}`);

    // Soft-deactivate user/agent (DELETE /api/users/[id])
    console.log(`\n🗑️ Step 6: Soft-deactivating agent (DELETE /api/users/${createdUser.id})...`);
    const deleteUserRes = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: `/api/users/${createdUser.id}`,
      method: 'DELETE',
      headers: {
        'Cookie': cookie
      }
    });

    console.log(`Response Status: ${deleteUserRes.statusCode}`);
    console.log(`Body: ${deleteUserRes.body}`);
  }

  // 6. Update contact custom fields (PATCH /api/contacts/[id])
  // Let's get contacts first to find a valid contact ID
  console.log('\n🔍 Step 7: Searching for contact to update custom fields...');
  const contactsSearchRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/contacts',
    method: 'GET',
    headers: {
      'Cookie': cookie
    }
  });
  
  let contactId = null;
  if (contactsSearchRes.statusCode === 200) {
    try {
      const contactsList = JSON.parse(contactsSearchRes.body);
      if (Array.isArray(contactsList) && contactsList.length > 0) {
        contactId = contactsList[0].id;
      }
    } catch(e) {}
  }
  
  if (contactId) {
    console.log(`Found contact: ${contactId}. Testing PATCH custom fields (revenue, client_type)...`);
    const patchData = JSON.stringify({
      revenue: 1250000,
      client_type: 'B2C'
    });
    
    const patchContactRes = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: `/api/contacts/${contactId}`,
      method: 'PATCH',
      headers: {
        'Cookie': cookie,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(patchData)
      }
    }, patchData);
    
    console.log(`Response Status: ${patchContactRes.statusCode}`);
    const updatedContactObj = JSON.parse(patchContactRes.body);
    console.log(`Updated customFields: ${JSON.stringify(updatedContactObj.contact ? updatedContactObj.contact.customFields : [])}`);

    // 8. Fetch Dashboard Stats Again to verify updated revenue
    console.log('\n📊 Step 8: Re-fetching dashboard stats to verify updated revenue...');
    const statsRes2 = await request({
      hostname: '127.0.0.1',
      port: 3000,
      path: '/api/dashboard/stats',
      method: 'GET',
      headers: {
        'Cookie': cookie
      }
    });

    console.log(`Response Status: ${statsRes2.statusCode}`);
    const stats2 = JSON.parse(statsRes2.body);
    console.log(`Stats metrics: ${JSON.stringify(stats2.metrics, null, 2)}`);
  } else {
    console.log('No contacts found. Skipping contact update test.');
  }

  console.log('\n🎉 All API endpoint verification checks complete!');
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
