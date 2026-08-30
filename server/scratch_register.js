const http = require('http');

const postData = JSON.stringify({
  name: 'GovTech Innovations',
  email: 'founder@govtechinnovations.com',
  password: 'Password@123',
  role: 'startup',
  company_name: 'GovTech Innovations Ltd.',
  sector: 'AI/ML',
  dpiit_reg_number: 'DPIIT1234567'
});

const options = {
  hostname: 'localhost',
  port: 5000,
  path: '/api/auth/register',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    console.log('Response:', data);
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.write(postData);
req.end();
