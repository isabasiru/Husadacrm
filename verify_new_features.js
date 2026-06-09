const http = require('http');

function request(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    });
    req.on('error', (err) => { reject(err); });
    if (postData) { req.write(postData); }
    req.end();
  });
}

async function runVerification() {
  console.log('🧪 Starting Husada CRM New Features Verification...');

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

  if (loginRes.statusCode !== 200) {
    console.error('❌ Login failed!');
    process.exit(1);
  }

  const setCookie = loginRes.headers['set-cookie'];
  const cookie = setCookie[0].split(';')[0];
  console.log('✅ Logged in successfully.');

  // 2. Test GET /api/settings
  console.log('\n⚙️ Step 2: Fetching system settings (GET /api/settings)...');
  const getSettingsRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/settings',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });

  console.log(`Response Status: ${getSettingsRes.statusCode}`);
  console.log(`Settings: ${getSettingsRes.body}`);
  const settingsObj = JSON.parse(getSettingsRes.body);
  if (getSettingsRes.statusCode !== 200 || !settingsObj.success) {
    console.error('❌ Fetching settings failed!');
    process.exit(1);
  }
  console.log('✅ Settings API (GET) is working.');

  // 3. Test POST /api/settings
  console.log('\n💾 Step 3: Updating system settings (POST /api/settings)...');
  const updatePayload = JSON.stringify({
    auto_followup_enabled: 'true',
    auto_followup_hours: '12',
    auto_followup_template: 'Halo Kak {{nama}}, ada yang bisa Rian bantu hari ini? 😊'
  });

  const postSettingsRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/settings',
    method: 'POST',
    headers: {
      'Cookie': cookie,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(updatePayload)
    }
  }, updatePayload);

  console.log(`Response Status: ${postSettingsRes.statusCode}`);
  console.log(`Body: ${postSettingsRes.body}`);
  if (postSettingsRes.statusCode !== 200) {
    console.error('❌ Saving settings failed!');
    process.exit(1);
  }
  console.log('✅ Settings API (POST) is working.');

  // Verify GET settings matches the updated payload
  const verifySettingsRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/settings',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });
  const updatedSettings = JSON.parse(verifySettingsRes.body).settings;
  if (updatedSettings.auto_followup_enabled !== 'true' || updatedSettings.auto_followup_hours !== '12') {
    console.error('❌ Settings update verification failed! Saved values do not match.');
    process.exit(1);
  }
  console.log('✅ Settings verification check passed.');

  // 4. Test GET /api/dashboard/stats
  console.log('\n📊 Step 4: Fetching dashboard stats (GET /api/dashboard/stats) for Agent Response KPI...');
  const statsRes = await request({
    hostname: '127.0.0.1',
    port: 3000,
    path: '/api/dashboard/stats?range=month',
    method: 'GET',
    headers: { 'Cookie': cookie }
  });

  console.log(`Response Status: ${statsRes.statusCode}`);
  const statsData = JSON.parse(statsRes.body);
  console.log(`Agent Performance: ${JSON.stringify(statsData.agentPerformance, null, 2)}`);
  
  if (statsRes.statusCode !== 200 || !Array.isArray(statsData.agentPerformance)) {
    console.error('❌ Fetching agent performance stats failed!');
    process.exit(1);
  }
  console.log('✅ Agent Response KPI Leaderboard API is working.');

  console.log('\n🎉 All new features successfully verified!');
}

runVerification().catch(err => {
  console.error('❌ Verification failed with error:', err);
  process.exit(1);
});
