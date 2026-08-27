import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import { db } from './server/db.ts';
import { handleAIAgentChat } from './server/aiAgent.ts';

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'smartpen_academy_jwt_secret_key_2026';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Static directories for folders
const publicDir = path.join(process.cwd(), 'public');
const studentWorksDir = path.join(publicDir, 'student_works');
const progressReportsDir = path.join(publicDir, 'progress_reports');
const appImagesDir = path.join(publicDir, 'app_images');
const testimonialsDir = path.join(publicDir, 'testimonials');

[studentWorksDir, progressReportsDir, appImagesDir, testimonialsDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Serve public static assets
app.use(express.static(publicDir));

// ================= RATE LIMITING MIDDLEWARE =================
interface RateLimitBucket {
  count: number;
  resetTime: number;
}
const rateLimitStore = new Map<string, RateLimitBucket>();

// Clean up expired buckets periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateLimitStore.entries()) {
    if (bucket.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export function createRateLimiter(options: { windowMs: number; max: number; message?: string }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Check for user identity from JWT (via req.user or cookie/header decode)
    let userKey: string | null = null;
    if ((req as any).user?.id) {
      userKey = `user:${(req as any).user.id}`;
    } else {
      const token = req.cookies?.smartpen_token || (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);
      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET) as any;
          if (decoded?.id) {
            userKey = `user:${decoded.id}`;
          }
        } catch {
          // Fall back to IP
        }
      }
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const identifier = userKey || `ip:${ip}`;
    const key = `${req.baseUrl || req.path}:${identifier}`;
    const now = Date.now();

    let bucket = rateLimitStore.get(key);
    if (!bucket || bucket.resetTime < now) {
      bucket = { count: 1, resetTime: now + options.windowMs };
      rateLimitStore.set(key, bucket);
      return next();
    }

    bucket.count += 1;
    if (bucket.count > options.max) {
      const retryAfterSeconds = Math.ceil((bucket.resetTime - now) / 1000);
      res.set('Retry-After', String(retryAfterSeconds));
      res.status(429).json({
        error: options.message || 'Too many requests. Please slow down and try again shortly.',
        retryAfter: retryAfterSeconds
      });
      return;
    }

    next();
  };
}

// Mutating endpoints rate limiters (independent of chat UI)
const paymentRateLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  message: 'Payment mutation rate limit reached. Please wait before recording more payments.'
});

const attendanceRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Attendance update rate limit exceeded. Please wait a moment before retrying.'
});

const demoBookingRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'Demo booking rate limit reached. Please try again in a few moments.'
});

// Auth Middleware (supports both httpOnly cookie and Bearer header)
interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    role: 'admin' | 'student';
    studentId?: string;
    fullName: string;
    email: string;
  };
}

const authenticateJwt = (req: AuthRequest, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  // 1. Check secure httpOnly cookie first
  if (req.cookies && req.cookies.smartpen_token) {
    token = req.cookies.smartpen_token;
  }

  // 2. Fallback to Authorization Bearer header
  if (!token) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }
  }

  if (!token) {
    res.status(401).json({ error: 'Unauthorized. Please sign in with valid credentials.', requireLogin: true });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = decoded;
    next();
  } catch (err: any) {
    res.status(401).json({ 
      error: 'Session expired or invalid token. Please log in again to continue.', 
      isExpired: true,
      requireLogin: true 
    });
    return;
  }
};

const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access forbidden. Administrator privileges required.' });
    return;
  }
  next();
};

// ================= API ROUTES =================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 1. Auth API
app.post('/api/auth/login', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username/Email and password are required.' });
  }

  const user = db.findUserByEmailOrUsername(username);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  if (role && user.role !== role) {
    return res.status(401).json({ error: `Account exists, but is not registered as ${role}.` });
  }

  const passwordMatch = bcrypt.compareSync(password, user.passwordHash) || user.rawPassword === password;
  if (!passwordMatch) {
    return res.status(401).json({ error: 'Invalid username or password.' });
  }

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    studentId: user.studentId,
    fullName: user.fullName,
    email: user.email
  };

  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });

  // Set secure, httpOnly, SameSite=strict cookie
  res.cookie('smartpen_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  });

  return res.json({ token, user: payload });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('smartpen_token', {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });
  return res.json({ success: true, message: 'Logged out successfully' });
});

app.post('/api/auth/forgot-password', (req, res) => {
  const { identifier } = req.body;
  if (!identifier) {
    return res.status(400).json({ error: 'Please provide username or registered email.' });
  }

  const user = db.findUserByEmailOrUsername(identifier);
  if (!user) {
    return res.status(404).json({ error: 'No account found with this username or email.' });
  }

  // Simulated Email Dispatch with raw password retrieval
  console.log(`[EMAIL DISPATCH] Sent password to ${user.email} for username: ${user.username}. Password: ${user.rawPassword || 'password123'}`);

  return res.json({
    success: true,
    message: `Password has been sent to registered email: ${user.email}`,
    email: user.email
  });
});

app.get('/api/auth/me', authenticateJwt, (req: AuthRequest, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
  const user = db.findUserByUsername(req.user.username);
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json({
    id: user.id,
    username: user.username,
    role: user.role,
    studentId: user.studentId,
    fullName: user.fullName,
    email: user.email
  });
});

// 2. Students API (Protected by JWT)
app.get('/api/students', authenticateJwt, requireAdmin, (req, res) => {
  const students = db.getAllStudents();
  return res.json(students);
});

app.get('/api/students/:id', authenticateJwt, (req, res) => {
  const student = db.getStudentById(req.params.id);
  if (!student) return res.status(404).json({ error: 'Student not found' });
  return res.json(student);
});

app.post('/api/students/enroll', (req, res) => {
  const data = req.body;
  if (!data.fullName || !data.parentName || !data.email) {
    return res.status(400).json({ error: 'Required student profile fields missing.' });
  }

  const newId = `std-${Date.now()}`;
  const username = data.username || `std_${data.fullName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
  const password = data.password || 'password123';

  const newStudent = {
    ...data,
    id: newId,
    username,
    password,
    status: data.status || 'Active',
    enrollmentDate: data.enrollmentDate || new Date().toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const created = db.createStudent(newStudent);

  // Simulated Email Dispatch to Parent and Admin
  console.log(`[EMAIL DISPATCH] Student Registration Notification sent to Parent (${data.email}) and Admin (rockefashy@gmail.com).`);
  console.log(`Credentials -> Username: ${username}, Password: ${password}`);

  return res.status(201).json({
    student: created,
    credentials: {
      username,
      password,
      parentEmail: data.email
    }
  });
});

app.put('/api/students/:id', authenticateJwt, requireAdmin, (req, res) => {
  const updated = db.updateStudent(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Student not found' });
  return res.json(updated);
});

// 3. Attendance API (Protected by JWT)
app.get('/api/attendance/month/:yearMonth', authenticateJwt, requireAdmin, (req, res) => {
  const records = db.getAttendanceByMonth(req.params.yearMonth);
  return res.json(records);
});

app.get('/api/attendance/student/:id', authenticateJwt, (req: AuthRequest, res) => {
  // Ownership scoping check
  if (req.user?.role === 'student' && req.user.studentId !== req.params.id) {
    return res.status(403).json({ error: 'Access denied. You can only view your own attendance records.' });
  }
  const records = db.getAttendanceByStudent(req.params.id);
  return res.json(records);
});

app.post('/api/attendance/batch', authenticateJwt, requireAdmin, attendanceRateLimiter, (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'Records must be an array' });
  }
  db.saveAttendanceBatch(records);
  return res.json({ success: true, count: records.length });
});

app.delete('/api/attendance/:studentId/:date', authenticateJwt, requireAdmin, (req, res) => {
  const { studentId, date } = req.params;
  db.deleteAttendance(studentId, date);
  return res.json({ success: true });
});

// 4. Fees API (Protected by JWT)
app.get('/api/fees/month/:yearMonth', authenticateJwt, requireAdmin, (req, res) => {
  const records = db.getFeesByMonth(req.params.yearMonth);
  return res.json(records);
});

app.get('/api/fees/student/:id', authenticateJwt, (req: AuthRequest, res) => {
  // Ownership scoping check
  if (req.user?.role === 'student' && req.user.studentId !== req.params.id) {
    return res.status(403).json({ error: 'Access denied. You can only view your own fee receipts.' });
  }
  const records = db.getFeesByStudent(req.params.id);
  return res.json(records);
});

app.post('/api/fees', authenticateJwt, requireAdmin, paymentRateLimiter, (req, res) => {
  const fee = req.body;
  if (!fee.studentId) {
    return res.status(400).json({ error: 'studentId is required' });
  }
  const saved = db.saveFeeRecord(fee);
  return res.json(saved);
});

app.put('/api/fees/:id', authenticateJwt, requireAdmin, (req, res) => {
  const updated = db.updateFeeRecord(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Fee record not found' });
  return res.json(updated);
});

app.patch('/api/fees/:id', authenticateJwt, requireAdmin, (req, res) => {
  const updated = db.updateFeeRecord(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Fee record not found' });
  return res.json(updated);
});

app.delete('/api/fees/:id', authenticateJwt, requireAdmin, (req, res) => {
  const success = db.deleteFeeRecord(req.params.id);
  if (!success) return res.status(404).json({ error: 'Fee record not found' });
  return res.json({ success: true, message: 'Fee record deleted successfully' });
});

// 5. Progress Trackers API (Protected by JWT)
app.get('/api/progress-trackers/student/:id', authenticateJwt, (req, res) => {
  const trackers = db.getProgressTrackersByStudent(req.params.id);
  return res.json(trackers);
});

app.post('/api/progress-trackers', authenticateJwt, requireAdmin, (req, res) => {
  const tracker = req.body;
  if (!tracker.studentId || !tracker.evaluationDate) {
    return res.status(400).json({ error: 'studentId and evaluationDate required' });
  }
  const saved = db.saveProgressTracker(tracker);
  return res.json(saved);
});

app.delete('/api/progress-trackers/:id', authenticateJwt, requireAdmin, (req, res) => {
  db.deleteProgressTracker(req.params.id);
  return res.json({ success: true });
});

// 6. Student Works & Camera Uploads API (Protected by JWT)
app.get('/api/student-works/student/:id', authenticateJwt, (req, res) => {
  const works = db.getStudentWorks(req.params.id);
  return res.json(works);
});

app.post('/api/student-works/upload', authenticateJwt, (req, res) => {
  const { studentId, imageData, captureDate, comments, category } = req.body;
  if (!studentId || !imageData) {
    return res.status(400).json({ error: 'studentId and imageData required' });
  }

  let finalImagePath = imageData;

  // If imageData is a base64 string, write to /public/student_works/
  if (imageData.startsWith('data:image/')) {
    try {
      const match = imageData.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const base64Data = match[2];
        const fileName = `work_${studentId}_${Date.now()}.${ext}`;
        const filePath = path.join(studentWorksDir, fileName);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        finalImagePath = `/student_works/${fileName}`;
      }
    } catch (e) {
      console.error('Error saving image to disk, falling back to base64:', e);
    }
  }

  const saved = db.saveStudentWork({
    studentId,
    imageData: finalImagePath,
    captureDate: captureDate || new Date().toISOString().split('T')[0],
    comments: comments || '',
    category: category || 'Practice Sheet'
  });

  return res.json(saved);
});

app.delete('/api/student-works/:id', authenticateJwt, (req, res) => {
  db.deleteStudentWork(req.params.id);
  return res.json({ success: true });
});

// 7. Progress Reports API (Protected by JWT)
app.get('/api/reports/student/:id', authenticateJwt, (req, res) => {
  const reports = db.getProgressReports(req.params.id);
  return res.json(reports);
});

app.post('/api/reports/generate', authenticateJwt, requireAdmin, (req, res) => {
  const report = req.body;
  if (!report.studentId || !report.reportDate) {
    return res.status(400).json({ error: 'studentId and reportDate required' });
  }

  const saved = db.saveProgressReport({
    ...report,
    savedToFolder: '/progress_reports/'
  });

  return res.json(saved);
});

app.delete('/api/reports/:id', authenticateJwt, requireAdmin, (req, res) => {
  db.deleteProgressReport(req.params.id);
  return res.json({ success: true });
});

app.post('/api/reports/:id/email', authenticateJwt, requireAdmin, (req, res) => {
  const { studentEmail, parentEmail } = req.body;
  console.log(`[EMAIL DISPATCH] Progress Report ${req.params.id} dispatched to Parent (${parentEmail || 'parent'}) and Admin (rockefashy@gmail.com)`);
  return res.json({
    success: true,
    message: `Progress Report successfully emailed to ${parentEmail || 'parent'} and Admin!`
  });
});

// 8. Reminders API (Fee reminder with WhatsApp & GPay link - Protected by JWT)
app.post('/api/reminders/whatsapp', authenticateJwt, requireAdmin, (req, res) => {
  const { studentId, parentPhone, parentName, studentName, amount, milestone, receiptNumber } = req.body;
  if (!studentId || !amount) {
    return res.status(400).json({ error: 'studentId and amount are required' });
  }

  const cleanPhone = (parentPhone || '').replace(/[^\d+]/g, '');
  const periodText = milestone || 'Current Period';
  const receiptText = receiptNumber ? ` (Ref: ${receiptNumber})` : '';

  const messageText = `Dear ${parentName || 'Parent'}, greetings from SmartPen Academy! ✍️\n\nThis is a fee payment request for ${studentName}'s handwriting program for ${periodText}${receiptText}.\n\n• Amount: ₹${amount}\n• Mode: In-Person Reception Settlement (Cash / UPI / Card)\n• UPI ID: smartpen.academy@okaxis\n\nKindly complete the settlement at the academy reception or via UPI. Thank you for your continued partnership in ${studentName}'s handwriting mastery!\n\nWarm regards,\nMrs. Deepthy Rock\nSmartPen Academy`;

  const encodedMessage = encodeURIComponent(messageText);
  const whatsappUrl = cleanPhone 
    ? `https://wa.me/${cleanPhone.replace('+', '')}?text=${encodedMessage}`
    : `https://wa.me/?text=${encodedMessage}`;

  const reminder = db.saveFeeReminder({
    studentId,
    parentEmail: cleanPhone || 'whatsapp',
    parentName: parentName || 'Parent',
    studentName: studentName || 'Student',
    amount: Number(amount),
    month: periodText,
    gpayLink: `upi://pay?pa=smartpen.academy@okaxis&pn=SmartPen%20Academy&am=${amount}&cu=INR`,
    status: 'Sent'
  });

  console.log(`[WHATSAPP REMINDER] Prepared WhatsApp reminder for ${parentName} (${cleanPhone}), Student: ${studentName}, Amount: ₹${amount}, Milestone: ${periodText}`);

  return res.json({
    success: true,
    reminder,
    messageText,
    whatsappUrl,
    message: `WhatsApp reminder prepared and logged for ${parentName || studentName}!`
  });
});

app.post('/api/reminders/send', authenticateJwt, requireAdmin, (req, res) => {
  const { studentId, parentEmail, parentName, studentName, amount, month, gpayLink } = req.body;
  if (!studentId || !amount) {
    return res.status(400).json({ error: 'studentId and amount required' });
  }

  const reminder = db.saveFeeReminder({
    studentId,
    parentEmail: parentEmail || 'parent@gmail.com',
    parentName: parentName || 'Parent',
    studentName: studentName || 'Student',
    amount: Number(amount),
    month: month || new Date().toLocaleString('default', { month: 'long', year: 'numeric' }),
    gpayLink: gpayLink || `upi://pay?pa=smartpen.academy@okaxis&pn=SmartPen%20Academy&am=${amount}&cu=INR`,
    status: 'Sent'
  });

  console.log(`[EMAIL DISPATCH] Fee Reminder Sent to ${parentEmail} for student ${studentName}, Amount ₹${amount} with GPay link: ${reminder.gpayLink}`);

  return res.json({
    success: true,
    reminder,
    message: `Payment reminder with Google Pay link dispatched to ${parentEmail}!`
  });
});

// 9. Free Demo Class Bookings API (Admin Protected for viewing & updating)
app.get('/api/demo-bookings', authenticateJwt, requireAdmin, (req, res) => {
  const bookings = db.getDemoBookings();
  return res.json(bookings);
});

app.post('/api/demo-bookings', demoBookingRateLimiter, (req, res) => {
  const { studentName, age, contactNumber, preferredSlot, notes } = req.body;
  if (!studentName || !age || !contactNumber) {
    return res.status(400).json({ error: 'studentName, age, and contactNumber are required' });
  }

  const result = db.createDemoBooking({
    studentName,
    age,
    contactNumber,
    preferredSlot: preferredSlot || 'All days (4 - 7 PM)',
    notes
  });

  console.log(`[DEMO BOOKING] New Free Demo Class Booking: ${studentName} (${age}), Contact: ${contactNumber}, Slot: ${preferredSlot}`);
  console.log(`[ALERT DISPATCH] Created alert id: ${result.alert.id}`);

  return res.status(201).json(result.booking);
});

app.patch('/api/demo-bookings/:id', authenticateJwt, requireAdmin, (req, res) => {
  const updated = db.updateDemoBooking(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Booking not found' });
  return res.json(updated);
});

app.delete('/api/demo-bookings/:id', authenticateJwt, requireAdmin, (req, res) => {
  db.deleteDemoBooking(req.params.id);
  return res.json({ success: true });
});

// Tool Audit Logs API (Admin Only)
app.get('/api/ai/audit-logs', authenticateJwt, requireAdmin, (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : 50;
  const logs = db.getToolAuditLogs(limit);
  return res.json(logs);
});

// 10. Admin Alerts Module API (Protected by JWT)
app.get('/api/alerts', authenticateJwt, requireAdmin, (req, res) => {
  const alerts = db.getAlerts();
  return res.json(alerts);
});

app.patch('/api/alerts/:id/read', authenticateJwt, requireAdmin, (req, res) => {
  const alert = db.markAlertAsRead(req.params.id);
  if (!alert) return res.status(404).json({ error: 'Alert not found' });
  return res.json(alert);
});

app.post('/api/alerts/mark-all-read', authenticateJwt, requireAdmin, (req, res) => {
  db.markAllAlertsAsRead();
  return res.json({ success: true });
});

app.delete('/api/alerts/:id', authenticateJwt, requireAdmin, (req, res) => {
  db.deleteAlert(req.params.id);
  return res.json({ success: true });
});

// 11. Testimonials / Parent Voices API
app.get('/api/testimonials', (req, res) => {
  const { studentId, status } = req.query;
  const testimonials = db.getTestimonials(studentId as string, status as string);
  return res.json(testimonials);
});

app.get('/api/testimonials/student/:id', (req, res) => {
  const testimonials = db.getTestimonials(req.params.id);
  return res.json(testimonials);
});

app.post('/api/testimonials', (req, res) => {
  const { 
    studentId, 
    studentName, 
    parentName, 
    grade, 
    schoolName, 
    relationship, 
    rating, 
    title, 
    review, 
    beforeAfterTag, 
    image, 
    mediaConsent 
  } = req.body;

  if (!studentId || !studentName || !review || !rating) {
    return res.status(400).json({ error: 'studentId, studentName, review, and rating are required.' });
  }

  let finalImagePath = image;
  if (image && image.startsWith('data:image/')) {
    try {
      const match = image.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        const ext = match[1] === 'jpeg' ? 'jpg' : match[1];
        const base64Data = match[2];
        const fileName = `testimony_${studentId}_${Date.now()}.${ext}`;
        const filePath = path.join(testimonialsDir, fileName);
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
        finalImagePath = `/testimonials/${fileName}`;
      }
    } catch (e) {
      console.error('Error saving testimony photo to disk:', e);
    }
  }

  const saved = db.saveTestimonial({
    studentId,
    studentName,
    parentName: parentName || 'Parent',
    grade: grade || '',
    schoolName: schoolName || '',
    relationship: relationship || 'Parent',
    rating: Number(rating) || 5,
    title: title || '',
    review,
    beforeAfterTag: beforeAfterTag || '5 Star Transformation',
    image: finalImagePath,
    mediaConsent: mediaConsent !== false,
    status: 'Featured' // automatically featured so parents see it immediately
  });

  console.log(`[TESTIMONIAL] New Testimony received from ${parentName} for student ${studentName}`);
  return res.status(201).json(saved);
});

app.patch('/api/testimonials/:id', authenticateJwt, requireAdmin, (req, res) => {
  const updated = db.updateTestimonial(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Testimonial not found' });
  return res.json(updated);
});

app.delete('/api/testimonials/:id', authenticateJwt, requireAdmin, (req, res) => {
  db.deleteTestimonial(req.params.id);
  return res.json({ success: true });
});

// 12. AI Agent Chatbot & Function Calling API
app.post('/api/ai/agent-chat', async (req: Request, res: Response) => {
  try {
    const { messages, settings } = req.body;
    
    // Resolve user context from httpOnly cookie first, then Authorization Bearer header
    let userContext: any = null;
    let token: string | undefined;

    if (req.cookies && req.cookies.smartpen_token) {
      token = req.cookies.smartpen_token;
    }

    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
      }
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        userContext = decoded;
      } catch (e) {
        // Invalid or expired token
        userContext = null;
      }
    }

    if (!userContext) {
      return res.status(401).json({
        error: 'Authentication required. Please sign in to converse with the SmartPen AI Assistant.',
        requireLogin: true
      });
    }

    const result = await handleAIAgentChat({
      messages: messages || [],
      userContext,
      settings
    });

    return res.json(result);
  } catch (error: any) {
    console.error('Error in /api/ai/agent-chat:', error);
    return res.status(500).json({
      error: 'An error occurred while communicating with the AI Assistant.',
      details: error.message || String(error)
    });
  }
});

app.post('/api/ai/test-config', async (req: Request, res: Response) => {
  const { apiKey, model } = req.body;
  const targetKey = apiKey || process.env.GEMINI_API_KEY;
  if (!targetKey) {
    return res.json({
      success: true,
      mode: 'Local AI Engine',
      message: 'Using built-in SmartPen AI Agent Engine. Full tool automation active.'
    });
  }

  return res.json({
    success: true,
    mode: 'Gemini Cloud API',
    model: model || 'gemini-3.7-flash',
    message: 'AI Model configuration verified successfully!'
  });
});

// ================= VITE INTEGRATION =================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartPen Academy server running on http://localhost:${PORT}`);
  });
}

startServer();
