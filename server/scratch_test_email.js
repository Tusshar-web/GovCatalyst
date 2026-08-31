require('dotenv').config();
const { dispatchEmail } = require('./src/utils/emailService');

(async () => {
  console.log('Testing email service...');
  const success = await dispatchEmail({
    to: 'learnova.service@gmail.com',
    subject: 'Test Email from GovCatalyst',
    html: '<h1>This is a test email.</h1>'
  });
  console.log('Email sent successfully:', success);
  process.exit(0);
})();
