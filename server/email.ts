import { Resend } from 'resend';
import { db } from './supabaseDb.ts';

let cachedApiKey: string | null = null;
let resendClient: Resend | null = null;

export function getResendClient(): Resend | null {
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  if (!apiKey) {
    return null;
  }
  if (!resendClient || cachedApiKey !== apiKey) {
    cachedApiKey = apiKey;
    resendClient = new Resend(apiKey);
  }
  return resendClient;
}

/**
 * Resolves the sender email address dynamically from the users table (admin user).
 * The sender address is always the email id of the admin user from the database.
 */
export async function getSenderEmail(): Promise<string> {
  try {
    const admin = await db.getAdminUser();
    if (admin && admin.email) {
      const name = admin.firstName || 'SmartPen Academy';
      return `${name} <${admin.email.trim()}>`;
    }
  } catch (err: any) {
    console.warn(`[Email Service] Warning resolving sender from users table:`, err.message || err);
  }

  // Fallback to environment variable if database is temporarily unavailable
  const envSender = (process.env.RESEND_FROM_EMAIL || '').trim().replace(/^["']|["']$/g, '');
  if (envSender) {
    return envSender;
  }
  return 'SmartPen Academy <onboarding@resend.dev>';
}

/**
 * Resolves the admin notification recipient email address dynamically from the users table.
 */
export async function getAdminNotificationEmail(): Promise<string | null> {
  try {
    const admin = await db.getAdminUser();
    if (admin && admin.email) {
      return admin.email.trim();
    }
  } catch (err: any) {
    console.warn(`[Email Service] Warning resolving admin recipient from users table:`, err.message || err);
  }

  const envAdmin = (process.env.ADMIN_EMAIL || '').trim().replace(/^["']|["']$/g, '');
  return envAdmin || null;
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export async function sendEmail({ to, subject, html, text, from }: SendEmailParams): Promise<{ success: boolean; id?: string; error?: string; sender?: string }> {
  const resend = getResendClient();
  const recipientList = Array.isArray(to) ? to.filter(Boolean) : (to ? [to] : []);
  const fromSender = from || await getSenderEmail();

  if (recipientList.length === 0) {
    console.warn(`[Resend Notice] No valid recipient specified for subject: "${subject}".`);
    return { success: false, error: 'No recipient email specified' };
  }

  if (!resend) {
    console.log(`[Resend Simulated Dispatch] RESEND_API_KEY is not configured. Email logged to console:`);
    console.log(`  To: ${recipientList.join(', ')}`);
    console.log(`  From: ${fromSender}`);
    console.log(`  Subject: ${subject}`);
    return {
      success: true,
      id: `simulated_${Date.now()}`,
      sender: fromSender
    };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromSender,
      to: recipientList,
      subject,
      html,
      text: text || html.replace(/<[^>]*>?/gm, '')
    });

    if (error) {
      if (error.name === 'validation_error' || error.message?.toLowerCase().includes('testing email') || error.message?.toLowerCase().includes('verify')) {
        console.warn(`[Resend Sandbox Notice] Recipient "${recipientList.join(', ')}" notice: ${error.message}. (Note: With onboarding@resend.dev, Resend permits sending only to your registered account email. To send to any recipient, verify your domain in resend.com).`);
      } else {
        console.warn(`[Resend Dispatch Notice] Failed to dispatch to ${recipientList.join(', ')}: ${error.message}`);
      }
      return { success: false, error: error.message, sender: fromSender };
    }

    console.log(`[Resend Success] Email dispatched to ${recipientList.join(', ')}! Message ID: ${data?.id} (From: ${fromSender})`);
    return { success: true, id: data?.id, sender: fromSender };
  } catch (err: any) {
    console.error(`[Resend Error] Exception sending email to ${recipientList.join(', ')}: ${err.message || String(err)}`);
    return { success: false, error: err.message || String(err), sender: fromSender };
  }
}

// 1. Student Registration / Enrollment Confirmation Email
export async function sendEnrollmentEmails(student: {
  firstName: string;
  lastName?: string;
  age?: number | string;
  gender?: string;
  dominantHand?: string;
  gradeClass?: string;
  schoolName?: string;
  parentName: string;
  whatsappMobile?: string;
  email: string;
  password?: string;
  preferredDays?: string;
  preferredSlot?: string;
  scriptsRequired?: string[];
  academicModules?: string[];
  diagnosticObservations?: string[];
  isSiblingEnrollment?: boolean;
  siblingOfStudentName?: string;
}) {
  const loginEmail = student.email;
  const loginPassword = student.isSiblingEnrollment
    ? 'Your Existing Family Account Password'
    : (student.password ? student.password : 'Registered Account Password');

  // Fetch admin user from users table for dynamic sender & contact details
  const adminUser = await db.getAdminUser();
  const adminContactEmail = adminUser?.email || await getAdminNotificationEmail() || '';
  const adminContactPhone = adminUser?.phoneNumber || '';
  const adminDisplayName = adminUser?.firstName || '';

  const parentHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #0E3589 0%, #0084F4 50%, #F46E20 100%); color: #ffffff; padding: 30px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 22px; font-weight: 800; }
    .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.95; }
    .content { padding: 28px 24px; }
    .box { background: #f1f5f9; border-radius: 12px; padding: 18px; margin: 18px 0; border: 1px solid #cbd5e1; }
    .credential-box { background: #eff6ff; border: 2px dashed #0E3589; border-radius: 12px; padding: 18px; margin: 20px 0; }
    .credential-item { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 14px; }
    .label { color: #64748b; font-weight: 500; }
    .value { color: #0f172a; font-weight: 700; }
    .pill { display: inline-block; background: #0E3589; color: white; padding: 4px 10px; border-radius: 6px; font-size: 12px; margin: 3px 2px; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; padding: 16px 24px 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>SmartPen Academy</h1>
      <p>Enrollment Confirmation &amp; Student Portal Access</p>
    </div>
    <div class="content">
      <p>Dear <strong>${student.parentName}</strong>,</p>
      <p>Welcome to SmartPen Academy! We are delighted to confirm the successful registration of <strong>${student.firstName}</strong> in our handwriting mastery program.</p>
      
      <div class="credential-box">
        <h3 style="margin-top: 0; color: #0E3589; font-size: 15px;">🔑 Parent &amp; Student Portal Login Credentials</h3>
        <p style="font-size: 12px; color: #475569; margin-bottom: 12px;">Use these credentials to log in to the portal to track attendance, practice worksheets, and progress reports:</p>
        <div class="credential-item">
          <span class="label">Login ID (Email):</span>
          <span class="value" style="color: #0E3589;">${loginEmail}</span>
        </div>
        <div class="credential-item" style="margin-bottom: 0;">
          <span class="label">Password:</span>
          <span class="value" style="color: #F46E20;">${loginPassword}</span>
        </div>
        ${student.isSiblingEnrollment ? `
        <div style="margin-top: 14px; padding: 12px; background: #ffffff; border-radius: 8px; border: 1px solid #bfdbfe;">
          <p style="margin: 0; font-size: 13px; color: #1e40af; font-weight: 700;">
            👨‍👩‍👧‍👦 Family &amp; Sibling Access Note
          </p>
          <p style="margin: 6px 0 0 0; font-size: 12px; color: #334155; line-height: 1.5;">
            You can use the <strong>exact same password</strong> you already use for ${student.siblingOfStudentName ? `<strong>${student.siblingOfStudentName}</strong>` : 'your other enrolled child'}.
            When signing into the portal, you will be prompted to select which student profile to view, or you can switch between siblings anytime using the profile switcher in the top navigation bar!
          </p>
        </div>` : ''}
      </div>

      <div class="box">
        <h4 style="margin: 0 0 10px 0; color: #0E3589; font-size: 14px;">📋 Enrollment Summary</h4>
        <div class="credential-item"><span class="label">Student Name:</span><span class="value">${student.firstName}</span></div>
        ${student.age ? `<div class="credential-item"><span class="label">Age:</span><span class="value">${student.age} years</span></div>` : ''}
        ${student.gender ? `<div class="credential-item"><span class="label">Gender:</span><span class="value">${student.gender}</span></div>` : ''}
        ${student.dominantHand ? `<div class="credential-item"><span class="label">Dominant Hand:</span><span class="value">${student.dominantHand} Handed</span></div>` : ''}
        ${student.gradeClass ? `<div class="credential-item"><span class="label">Grade/Class:</span><span class="value">${student.gradeClass}</span></div>` : ''}
        ${student.schoolName ? `<div class="credential-item"><span class="label">School:</span><span class="value">${student.schoolName}</span></div>` : ''}
        ${student.preferredDays ? `<div class="credential-item"><span class="label">Schedule Days:</span><span class="value">${student.preferredDays}</span></div>` : ''}
        ${student.preferredSlot ? `<div class="credential-item"><span class="label">Time Slot:</span><span class="value">${student.preferredSlot}</span></div>` : ''}
      </div>

      ${student.scriptsRequired && student.scriptsRequired.length > 0 ? `
      <div style="margin-top: 15px;">
        <span class="label" style="display: block; margin-bottom: 6px;">Scripts Selected:</span>
        <div>${student.scriptsRequired.map(s => `<span class="pill">${s}</span>`).join(' ')}</div>
      </div>` : ''}

      ${student.academicModules && student.academicModules.length > 0 ? `
      <div style="margin-top: 15px;">
        <span class="label" style="display: block; margin-bottom: 6px;">Academic Modules:</span>
        <div>${student.academicModules.map(m => `<span class="pill" style="background:#F46E20;">${m}</span>`).join(' ')}</div>
      </div>` : ''}

      <p style="margin-top: 24px; font-size: 13px; color: #475569;">
        Our team looks forward to guiding <strong>${student.firstName}</strong> towards fluent, confident, and beautiful handwriting!
      </p>
    </div>
    <div class="footer">
      <p>SmartPen Academy • ${adminDisplayName}</p>
      ${adminContactEmail ? `<p>Need assistance? Contact us at ${adminContactEmail}${adminContactPhone ? ' or ' + adminContactPhone : ''}</p>` : ''}
    </div>
  </div>
</body>
</html>
`;

  const adminHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; padding: 20px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; border: 2px solid #0E3589; border-radius: 12px; padding: 20px; background: #fff;">
    <h2 style="color: #0E3589; margin-top: 0;">🎉 New Student Enrollment Notification</h2>
    <p>A new student registration has been completed on the SmartPen Academy portal:</p>
    <ul>
      <li><strong>Student:</strong> ${student.firstName} (${student.age || 'N/A'} yrs, ${student.gender || 'N/A'}, ${student.dominantHand || 'N/A'} handed)</li>
      <li><strong>Parent:</strong> ${student.parentName}</li>
      <li><strong>WhatsApp / Phone:</strong> ${student.whatsappMobile || 'N/A'}</li>
      <li><strong>Registered Email (Login ID):</strong> ${student.email}</li>
      <li><strong>Password:</strong> ${loginPassword}</li>
      <li><strong>Preferred Days:</strong> ${student.preferredDays || 'N/A'}</li>
      <li><strong>Preferred Slot:</strong> ${student.preferredSlot || 'N/A'}</li>
      <li><strong>Scripts:</strong> ${(student.scriptsRequired || []).join(', ') || 'N/A'}</li>
      <li><strong>Modules:</strong> ${(student.academicModules || []).join(', ') || 'N/A'}</li>
      <li><strong>Areas of Concern:</strong> ${(student.diagnosticObservations || []).join('; ') || 'None noted'}</li>
    </ul>
    <p style="font-size: 12px; color: #64748b;">This notification was dispatched automatically via Resend integration.</p>
  </div>
</body>
</html>
`;

  // Dispatch to Parent
  const parentSubject = student.isSiblingEnrollment
    ? `✨ SmartPen Academy - Sibling Enrollment Confirmed for ${student.firstName}`
    : `✨ Welcome to SmartPen Academy - Enrollment Confirmed for ${student.firstName}`;

  const parentPromise = sendEmail({
    to: student.email,
    subject: parentSubject,
    html: parentHtml
  }).then(res => {
    if (res.success) {
      console.log(`[Enrollment Email] Confirmation email successfully delivered to parent: ${student.email} (Message ID: ${res.id})`);
    } else {
      console.warn(`[Enrollment Email] Notice sending confirmation email to parent: ${student.email} - ${res.error}`);
    }
    return res;
  });

  // Dispatch to Admin (email dynamically fetched from users table)
  const adminEmail = await getAdminNotificationEmail();
  const adminSubject = student.isSiblingEnrollment
    ? `👨‍👩‍👧‍👦 [Sibling Enrollment] ${student.firstName} (Sibling of ${student.siblingOfStudentName || student.parentName})`
    : `🔔 [New Enrollment] ${student.firstName} (${student.parentName})`;

  const adminPromise = adminEmail ? sendEmail({
    to: adminEmail,
    subject: adminSubject,
    html: adminHtml
  }).then(res => {
    if (res.success) {
      console.log(`[Enrollment Email] Admin notification successfully delivered to: ${adminEmail} (Message ID: ${res.id})`);
    } else {
      console.warn(`[Enrollment Email] Notice sending admin notification to: ${adminEmail} - ${res.error}`);
    }
    return res;
  }) : Promise.resolve({ success: false, error: 'No admin user email found in users table' });

  return Promise.allSettled([parentPromise, adminPromise]);
}

// 2. Forgot Password Email & Reset Link Email
export async function sendPasswordResetLinkEmail(toEmail: string, params: { resetLink: string; firstName?: string }) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; }
    .header { background: #0E3589; color: #ffffff; padding: 24px; text-align: center; }
    .content { padding: 24px; }
    .btn-box { text-align: center; margin: 24px 0; }
    .btn { display: inline-block; background: #0E3589; color: #ffffff !important; text-decoration: none; padding: 12px 28px; border-radius: 8px; font-weight: 700; font-size: 15px; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; padding: 16px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h2 style="margin:0;">SmartPen Academy</h2>
      <p style="margin:4px 0 0; font-size: 13px; color: #bfdbfe;">Password Reset Request</p>
    </div>
    <div class="content">
      <p>Hello <strong>${params.firstName || 'User'}</strong>,</p>
      <p>We received a request to reset the password for your SmartPen Academy account (<strong>${toEmail}</strong>).</p>
      
      <div class="btn-box">
        <a href="${params.resetLink}" class="btn" target="_blank">Reset Your Password</a>
      </div>

      <p style="font-size: 13px; color: #64748b; word-break: break-all;">
        Or copy and paste this link into your browser:<br/>
        <a href="${params.resetLink}" style="color: #0084F4;">${params.resetLink}</a>
      </p>

      <p style="font-size: 12px; color: #94a3b8; margin-top: 20px;">
        This reset link will expire in 1 hour. If you did not request a password reset, you can safely ignore this email.
      </p>
    </div>
    <div class="footer">
      <p>SmartPen Academy • Automated Security Notification</p>
    </div>
  </div>
</body>
</html>
`;

  return sendEmail({
    to: toEmail,
    subject: `🔐 Reset Your SmartPen Academy Password`,
    html
  });
}

// 3. Password Changed Confirmation Email
export async function sendPasswordChangedEmail(toEmail: string, user: { firstName?: string }) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; padding: 20px; color: #1e293b; background: #f8fafc;">
  <div style="max-width: 500px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
    <h3 style="color: #0E3589; margin-top: 0;">🛡️ Password Updated Successfully</h3>
    <p>Hello ${user.firstName || 'SmartPen Student / Parent'},</p>
    <p>This is a confirmation that the password for your SmartPen Academy account (<strong>${toEmail}</strong>) was successfully updated.</p>
    <p style="font-size: 12px; color: #64748b;">If you did not perform this update, please contact the academy administration immediately.</p>
  </div>
</body>
</html>
`;

  return sendEmail({
    to: toEmail,
    subject: `🛡️ Password Updated for SmartPen Academy Account`,
    html
  });
}

// 4. Free Demo Class Booking Alert Email
export async function sendDemoBookingAlert(booking: {
  studentName: string;
  parentName?: string;
  age: number | string;
  contactNumber: string;
  preferredDate: string;
  preferredTimeSlot: string;
  notes?: string;
}) {
  const cleanAge = String(booking.age || '').replace(/\s*(years?|yrs)\b/gi, '').trim();
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; padding: 20px; color: #1e293b;">
  <div style="max-width: 550px; margin: 0 auto; background: #fff; border: 2px solid #F46E20; border-radius: 12px; padding: 24px;">
    <h3 style="color: #F46E20; margin-top: 0;">🎯 New Free Demo Class Booking</h3>
    <p>A parent has booked a Free Handwriting Diagnostic Demo Class:</p>
    <ul>
      <li><strong>Student Name:</strong> ${booking.studentName}</li>
      <li><strong>Parent / Guardian:</strong> ${booking.parentName || 'Parent'}</li>
      <li><strong>Age:</strong> ${cleanAge ? `${cleanAge} years` : 'Not specified'}</li>
      <li><strong>Contact Number:</strong> <a href="tel:${booking.contactNumber}">${booking.contactNumber}</a></li>
      <li><strong>Preferred Date:</strong> ${booking.preferredDate}</li>
      <li><strong>Preferred Time Slot:</strong> ${booking.preferredTimeSlot}</li>
      ${booking.notes ? `<li><strong>Notes / Questions:</strong> ${booking.notes}</li>` : ''}
    </ul>
    <p style="font-size: 12px; color: #64748b;">Dispatched via Resend real-time integration.</p>
  </div>
</body>
</html>
`;

  const adminEmail = await getAdminNotificationEmail();
  if (!adminEmail) {
    console.log('[Resend Notice] ADMIN_EMAIL is not configured; skipping admin demo booking alert.');
    return { success: false, error: 'ADMIN_EMAIL not configured' };
  }

  return sendEmail({
    to: adminEmail,
    subject: `🎯 [Free Demo Request] ${booking.studentName} (${booking.parentName ? booking.parentName + ' • ' : ''}${booking.contactNumber})`,
    html
  });
}

// 5. Fee Payment Reminder / Receipt Email
export async function sendFeeReminderEmail(params: {
  toEmail: string;
  parentName: string;
  studentName: string;
  amount: number;
  month?: string;
  gpayLink?: string;
}) {
  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; padding: 20px; color: #1e293b; background: #f8fafc;">
  <div style="max-width: 540px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 24px; border: 1px solid #e2e8f0;">
    <h3 style="color: #0E3589; margin-top: 0;">SmartPen Academy — Fee Payment Notice</h3>
    <p>Dear ${params.parentName},</p>
    <p>This is a gentle payment reminder for <strong>${params.studentName}'s</strong> handwriting program for <strong>${params.month || 'the current period'}</strong>.</p>
    <div style="background: #f1f5f9; padding: 14px; border-radius: 8px; margin: 16px 0; font-size: 15px;">
      <strong>Amount Due:</strong> ₹${params.amount}<br>
      <strong>Payment Mode:</strong> Academy Reception (Cash / UPI / Card) or UPI ID: <code>smartpen.academy@okaxis</code>
    </div>
    <p style="font-size: 12px; color: #64748b;">Thank you for your continuous support in ${params.studentName}'s handwriting journey!</p>
  </div>
</body>
</html>
`;

  return sendEmail({
    to: params.toEmail,
    subject: `✍️ SmartPen Academy - Fee Payment Details for ${params.studentName}`,
    html
  });
}


// 6. Student Profile Updated Notification Email (Parent & Admin)
export async function sendStudentUpdatedEmails(student: {
  id?: string;
  firstName: string;
  lastName?: string;
  parentName?: string;
  email?: string;
  whatsappMobile?: string;
  age?: number | string;
  gender?: string;
  dominantHand?: string;
  gradeClass?: string;
  schoolName?: string;
  modeOfLearning?: string;
  preferredDays?: string;
  preferredSlot?: string;
  scriptsRequired?: string[];
  academicModules?: string[];
  diagnosticObservations?: string[];
}, updatedFields?: any) {
  const adminUser = await db.getAdminUser();
  const adminContactEmail = adminUser?.email || await getAdminNotificationEmail() || "";
  const adminContactPhone = adminUser?.phoneNumber || "";
  const adminDisplayName = adminUser?.firstName || "SmartPen Academy";

  const parentEmail = student.email;

  const parentHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 20px; color: #1e293b; }
    .card { max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
    .header { background: linear-gradient(135deg, #0E3589 0%, #0084F4 100%); color: #ffffff; padding: 26px 24px; text-align: center; }
    .header h1 { margin: 0; font-size: 20px; font-weight: 800; }
    .header p { margin: 6px 0 0 0; font-size: 13px; opacity: 0.95; }
    .content { padding: 28px 24px; }
    .box { background: #f8fafc; border-radius: 12px; padding: 18px; margin: 18px 0; border: 1px solid #e2e8f0; }
    .item { display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; }
    .label { color: #64748b; font-weight: 500; }
    .value { color: #0f172a; font-weight: 700; }
    .pill { display: inline-block; background: #0E3589; color: white; padding: 3px 8px; border-radius: 6px; font-size: 11px; margin: 2px; }
    .footer { text-align: center; font-size: 12px; color: #94a3b8; padding: 16px 24px 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>SmartPen Academy</h1>
      <p>Student Profile &amp; Enrollment Details Updated</p>
    </div>
    <div class="content">
      <p>Dear <strong>${student.parentName || "Parent"}</strong>,</p>
      <p>This is a confirmation that the profile and enrollment details for <strong>${student.firstName}</strong> have been successfully updated in our academy records.</p>
      
      <div class="box">
        <h4 style="margin: 0 0 12px 0; color: #0E3589; font-size: 14px;">📋 Updated Student Profile Summary</h4>
        <div class="item"><span class="label">Student Name:</span><span class="value">${student.firstName}</span></div>
        ${student.age ? `<div class="item"><span class="label">Age:</span><span class="value">${student.age} years</span></div>` : ""}
        ${student.gender ? `<div class="item"><span class="label">Gender:</span><span class="value">${student.gender}</span></div>` : ""}
        ${student.modeOfLearning ? `<div class="item"><span class="label">Mode of Learning:</span><span class="value">${student.modeOfLearning}</span></div>` : ""}
        ${student.dominantHand ? `<div class="item"><span class="label">Dominant Hand:</span><span class="value">${student.dominantHand} Handed</span></div>` : ""}
        ${student.gradeClass ? `<div class="item"><span class="label">Grade/Class:</span><span class="value">${student.gradeClass}</span></div>` : ""}
        ${student.schoolName ? `<div class="item"><span class="label">School:</span><span class="value">${student.schoolName}</span></div>` : ""}
        ${student.preferredDays ? `<div class="item"><span class="label">Schedule Days:</span><span class="value">${student.preferredDays}</span></div>` : ""}
        ${student.preferredSlot ? `<div class="item"><span class="label">Time Slot:</span><span class="value">${student.preferredSlot}</span></div>` : ""}
        ${student.whatsappMobile ? `<div class="item"><span class="label">WhatsApp Contact:</span><span class="value">${student.whatsappMobile}</span></div>` : ""}
      </div>

      ${student.scriptsRequired && student.scriptsRequired.length > 0 ? `
      <div style="margin-top: 12px;">
        <span class="label" style="display: block; margin-bottom: 4px; font-size: 12px;">Scripts:</span>
        <div>${student.scriptsRequired.map(s => `<span class="pill">${s}</span>`).join(" ")}</div>
      </div>` : ""}

      ${student.academicModules && student.academicModules.length > 0 ? `
      <div style="margin-top: 12px;">
        <span class="label" style="display: block; margin-bottom: 4px; font-size: 12px;">Modules:</span>
        <div>${student.academicModules.map(m => `<span class="pill" style="background:#F46E20;">${m}</span>`).join(" ")}</div>
      </div>` : ""}

      <p style="margin-top: 24px; font-size: 13px; color: #475569;">
        If you have any questions or require modifications, please contact our academy support.
      </p>
    </div>
    <div class="footer">
      <p>SmartPen Academy • ${adminDisplayName}</p>
      ${adminContactEmail ? `<p>Need assistance? Contact us at ${adminContactEmail}${adminContactPhone ? " or " + adminContactPhone : ""}</p>` : ""}
    </div>
  </div>
</body>
</html>
`;

  const adminHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; padding: 20px; color: #1e293b;">
  <div style="max-width: 600px; margin: 0 auto; border: 2px solid #0E3589; border-radius: 12px; padding: 20px; background: #fff;">
    <h2 style="color: #0E3589; margin-top: 0;">📝 Student Profile Updated</h2>
    <p>Student profile details have been updated on the SmartPen Academy portal:</p>
    <ul>
      <li><strong>Student:</strong> ${student.firstName} (${student.age || "N/A"} yrs, ${student.gender || "N/A"}, ${student.dominantHand || "N/A"} handed)</li>
      <li><strong>Parent:</strong> ${student.parentName || "N/A"}</li>
      <li><strong>Mode of Learning:</strong> ${student.modeOfLearning || "N/A"}</li>
      <li><strong>WhatsApp / Phone:</strong> ${student.whatsappMobile || "N/A"}</li>
      <li><strong>Contact Email:</strong> ${student.email || "N/A"}</li>
      <li><strong>Grade/Class:</strong> ${student.gradeClass || "N/A"}</li>
      <li><strong>School:</strong> ${student.schoolName || "N/A"}</li>
      <li><strong>Schedule Days:</strong> ${student.preferredDays || "N/A"}</li>
      <li><strong>Preferred Slot:</strong> ${student.preferredSlot || "N/A"}</li>
      <li><strong>Scripts:</strong> ${(student.scriptsRequired || []).join(", ") || "N/A"}</li>
      <li><strong>Modules:</strong> ${(student.academicModules || []).join(", ") || "N/A"}</li>
    </ul>
    <p style="font-size: 12px; color: #64748b;">Dispatched automatically via SmartPen Academy email service.</p>
  </div>
</body>
</html>
`;

  const dispatches: Promise<any>[] = [];

  // Dispatch to Parent (if email present)
  if (parentEmail) {
    dispatches.push(
      sendEmail({
        to: parentEmail,
        subject: `📝 Student Details Updated - ${student.firstName} | SmartPen Academy`,
        html: parentHtml
      }).then(res => {
        if (res.success) {
          console.log(`[Student Update Email] Delivered to parent: ${parentEmail} (ID: ${res.id})`);
        } else {
          console.warn(`[Student Update Email] Notice delivering to parent: ${parentEmail} - ${res.error}`);
        }
        return res;
      })
    );
  }

  // Dispatch to Admin
  const adminEmail = await getAdminNotificationEmail();
  if (adminEmail) {
    dispatches.push(
      sendEmail({
        to: adminEmail,
        subject: `🔔 [Student Updated] ${student.firstName} (${student.parentName || "Parent"})`,
        html: adminHtml
      }).then(res => {
        if (res.success) {
          console.log(`[Student Update Email] Delivered to admin: ${adminEmail} (ID: ${res.id})`);
        } else {
          console.warn(`[Student Update Email] Notice delivering to admin: ${adminEmail} - ${res.error}`);
        }
        return res;
      })
    );
  }

  return Promise.allSettled(dispatches);
}
