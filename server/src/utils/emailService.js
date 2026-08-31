const nodemailer = require('nodemailer');

// 1. Configure Nodemailer with Gmail service optimization
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: {
    rejectUnauthorized: false
  }
});

/**
 * Universal dispatcher: Sends via Resend HTTP API (if key present) or Nodemailer SMTP
 */
async function dispatchEmail({ to, subject, html }) {
  // Option A: If BREVO_API_KEY is provided, use HTTP API (immune to cloud SMTP port blocks)
  if (process.env.BREVO_API_KEY) {
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': process.env.BREVO_API_KEY,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          sender: { name: 'GovCatalyst', email: process.env.SMTP_USER || 'learnova.service@gmail.com' },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html
        })
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[EMAIL SERVICE (Brevo HTTP)] ✅ Email dispatched to ${to} (MessageID: ${data.messageId})`);
        return true;
      } else {
        console.warn(`[EMAIL SERVICE (Brevo HTTP)] Brevo API response:`, data);
      }
    } catch (httpErr) {
      console.error('[EMAIL SERVICE (Brevo HTTP)] ❌ Error:', httpErr.message);
    }
  }

  // Option B: Nodemailer SMTP
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn(`[EMAIL SERVICE] ⚠️ SMTP_USER or SMTP_PASS is missing in environment variables.`);
    return false;
  }

  try {
    const mailOptions = {
      from: `"GovCatalyst Portal" <${process.env.SMTP_USER}>`,
      to: to,
      subject: subject,
      html: html,
    };
    const info = await transporter.sendMail(mailOptions);
    console.log(`[EMAIL SERVICE (SMTP)] ✅ Email sent to ${to} (MessageID: ${info.messageId})`);
    return true;
  } catch (smtpErr) {
    console.error(`[EMAIL SERVICE (SMTP)] ❌ Delivery to ${to} failed:`, smtpErr.message);
    return false;
  }
}

async function sendNewRegistrationToAdmin(user) {
  const adminEmail = process.env.SUPERADMIN_EMAIL || 'learnova.service@gmail.com';
  console.log(`[EMAIL SERVICE] Preparing registration notification for Super Admin (${adminEmail})...`);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #1e3a8a;">🏛️ GovCatalyst — New User Registration Alert</h2>
      <p>A new government official has registered on the GovCatalyst platform and is awaiting your verification.</p>
      <div style="background: #f8fafc; padding: 15px; border-radius: 6px; margin: 15px 0;">
        <p style="margin: 5px 0;"><strong>Name:</strong> ${user.name}</p>
        <p style="margin: 5px 0;"><strong>Email:</strong> ${user.email}</p>
        <p style="margin: 5px 0;"><strong>Role:</strong> <span style="background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px;">${user.role}</span></p>
        ${user.department_name ? `<p style="margin: 5px 0;"><strong>Department:</strong> ${user.department_name}</p>` : ''}
        ${user.designation ? `<p style="margin: 5px 0;"><strong>Designation:</strong> ${user.designation}</p>` : ''}
      </div>
      <p>Please log in to the <a href="https://govcatalyst.onrender.com/docs/admin.html" style="color: #2563eb; font-weight: bold;">Super Admin Panel</a> to approve or reject this request.</p>
    </div>
  `;

  await dispatchEmail({
    to: adminEmail,
    subject: `[GovCatalyst] New Registration Awaiting Verification: ${user.name} (${user.role})`,
    html: html
  });
}

async function sendOtpToUser(email, otpCode) {
  console.log(`[EMAIL SERVICE] Sending 6-digit OTP (${otpCode}) to: ${email}...`);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #047857;">🏛️ GovCatalyst — Registration Approved!</h2>
      <p>Your registration request has been verified and approved by the MSInS State Super Administrator.</p>
      <div style="background: #ecfdf5; border: 1px dashed #059669; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
        <span style="font-size: 13px; color: #065f46; text-transform: uppercase; font-weight: bold; letter-spacing: 1px;">Your Account Activation OTP</span>
        <div style="font-size: 32px; font-weight: 800; color: #047857; letter-spacing: 6px; margin: 10px 0; font-family: monospace;">${otpCode}</div>
        <small style="color: #065f46;">Valid for 15 minutes. Do not share this code.</small>
      </div>
      <p>Please return to the <a href="https://govcatalyst.onrender.com/docs/index.html" style="color: #2563eb; font-weight: bold;">GovCatalyst Portal</a> and verify your OTP to activate your credentials.</p>
    </div>
  `;

  await dispatchEmail({
    to: email,
    subject: `[GovCatalyst] Account Approved — OTP: ${otpCode}`,
    html: html
  });
}

async function sendRejectionToUser(email) {
  console.log(`[EMAIL SERVICE] Sending rejection notice to: ${email}...`);

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h2 style="color: #b91c1c;">🏛️ GovCatalyst — Registration Update</h2>
      <p>We are writing to inform you that your registration request for government official access has been declined by the system administrator.</p>
      <p>If you believe this decision was made in error, please reach out to the MSInS State Innovation Helpdesk.</p>
    </div>
  `;

  await dispatchEmail({
    to: email,
    subject: `[GovCatalyst] Registration Status Update`,
    html: html
  });
}

module.exports = {
  sendNewRegistrationToAdmin,
  sendOtpToUser,
  sendRejectionToUser,
  dispatchEmail
};
