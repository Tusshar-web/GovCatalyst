(async () => {
  try {
    const API = 'http://localhost:5009/api';
    
    // 1. Register a new user
    console.log('Registering new user...');
    const regRes = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Official',
        email: 'learnova.service+test1@gmail.com',
        password: 'Password@123',
        role: 'dept_admin',
        department_name: 'Test Dept',
        designation: 'Tester'
      })
    });
    const regData = await regRes.json();
    console.log('Registration Result:', regData);
    
    // 2. Login as SuperAdmin
    console.log('\nLogging in as Super Admin...');
    const loginRes = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'superadmin@govcatalyst.com', password: 'adminpassword123' })
    });
    const loginData = await loginRes.json();
    console.log('SuperAdmin Token retrieved:', !!loginData.token);
    
    // 3. Get pending users
    console.log('\nFetching pending users...');
    const pendingRes = await fetch(`${API}/auth/pending-users`, {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    const pendingData = await pendingRes.json();
    console.log(`Found ${pendingData.users ? pendingData.users.length : 0} pending users.`);
    
    // Find the one we just registered
    const newUser = pendingData.users?.find(u => u.email === 'learnova.service+test1@gmail.com');
    if (!newUser) {
      console.log('Could not find the test user in pending list!');
      return;
    }
    
    // 4. Approve the user
    console.log(`\nApproving user ID ${newUser.id}...`);
    const approveRes = await fetch(`${API}/auth/approve/${newUser.id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    const approveData = await approveRes.json();
    console.log('Approval Result:', approveData);
    
  } catch (err) {
    console.error('Error:', err);
  }
})();
