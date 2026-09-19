import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import { Logger } from './server/logger.ts';
import { NotFoundError } from './server/errors.ts';
import { errorHandler } from './server/middleware/errorHandler.ts';
import {
  AuthRequest,
  authenticateJwt,
  requireAdmin,
  requireCoachOrAdmin,
  canAccessStudent,
  verifyStudentAccess
} from './server/middleware/auth.ts';
import {
  createRateLimiter,
  paymentRateLimiter,
  attendanceRateLimiter,
  demoBookingRateLimiter,
  authRateLimiter
} from './server/middleware/rateLimiter.ts';
import { recordAudit } from './server/helpers/audit.ts';

// Feature Routers (Direct imports)
import { healthRouter } from './server/routes/health.routes.ts';
import { authRouter } from './server/routes/auth.routes.ts';
import { coachesRouter } from './server/routes/coaches.routes.ts';
import { studentsRouter } from './server/routes/students.routes.ts';
import { attendanceRouter } from './server/routes/attendance.routes.ts';
import { feesRouter } from './server/routes/fees.routes.ts';
import { progressTrackersRouter } from './server/routes/progressTrackers.routes.ts';
import { reportsRouter } from './server/routes/reports.routes.ts';
import { studentWorksRouter } from './server/routes/studentWorks.routes.ts';
import { remindersRouter } from './server/routes/reminders.routes.ts';
import { demoBookingsRouter } from './server/routes/demoBookings.routes.ts';
import { alertsRouter } from './server/routes/alerts.routes.ts';
import { testimonialsRouter } from './server/routes/testimonials.routes.ts';
import { aiRouter } from './server/routes/ai.routes.ts';

// Backward compatibility re-exports
export type { AuthRequest };
export {
  authenticateJwt,
  requireAdmin,
  requireCoachOrAdmin,
  canAccessStudent,
  verifyStudentAccess,
  createRateLimiter,
  paymentRateLimiter,
  attendanceRateLimiter,
  demoBookingRateLimiter,
  authRateLimiter,
  recordAudit
};

const sysLogger = Logger.get('SYSTEM');

// Process-level uncaught exception handling (Log-and-Exit per Rule #5)
process.on('uncaughtException', (err: Error) => {
  sysLogger.fatal('FATAL: Uncaught exception detected. Draining and terminating for clean restart.', err);
  setTimeout(() => {
    process.exit(1);
  }, 1000).unref();
});

process.on('unhandledRejection', (reason: any) => {
  sysLogger.error('Unhandled promise rejection detected', reason);
});

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);
const jwtSecret = (process.env.JWT_SECRET || '').trim();
if (!jwtSecret) {
  console.error('[FATAL] JWT_SECRET environment variable is not set. Server will not start.');
  process.exit(1);
}

if (jwtSecret.length < 32) {
  console.error('[FATAL] JWT_SECRET must be at least 32 characters long for cryptographic security. Server will not start.');
  process.exit(1);
}

const INSECURE_DEFAULT_SECRETS = [
  'smartpen_academy_jwt_secret_key_2026',
  'super-secret-jwt-token-with-at-least-32-characters-long',
  'replace_with_at_least_32_chars_random_secret_here'
];

if (process.env.NODE_ENV === 'production' && INSECURE_DEFAULT_SECRETS.includes(jwtSecret)) {
  console.error('[FATAL] Insecure default/placeholder JWT_SECRET detected in production. You must set a strong, random secret in production. Server will not start.');
  process.exit(1);
}

// Render runs behind a reverse proxy; trust proxy allows req.ip to accurately reflect client IP
app.set('trust proxy', 1);

// Granular body parser ceilings: upload routes allow larger payloads, general API routes strictly 1MB (DoS mitigation)
app.use('/api/student-works', express.json({ limit: '25mb' }), express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/api/reports', express.json({ limit: '25mb' }), express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/api/testimonials', express.json({ limit: '5mb' }), express.urlencoded({ extended: true, limit: '5mb' }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));
app.use(cookieParser());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co', 'https://generativelanguage.googleapis.com', 'ws:', 'wss:'],
        mediaSrc: ["'self'", 'data:', 'blob:'],
        objectSrc: ["'none'"],
        frameSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);

// Static directories for uploads
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

// ================= API ROUTERS MOUNTING =================
app.use('/api', healthRouter);
app.use('/api/auth', authRouter);
app.use('/api/coaches', coachesRouter);
app.use('/api/students', studentsRouter);
app.use('/api/attendance', attendanceRouter);
app.use('/api/fees', feesRouter);
app.use('/api/progress-trackers', progressTrackersRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/student-works', studentWorksRouter);
app.use('/api/reminders', remindersRouter);
app.use('/api/demo-bookings', demoBookingsRouter);
app.use('/api/alerts', alertsRouter);
app.use('/api/testimonials', testimonialsRouter);
app.use('/api/ai', aiRouter);

// Unhandled API routes catch-all: return 404 JSON rather than falling through to SPA HTML
app.all(['/api', '/api/*'], (req, _res, next) => {
  next(new NotFoundError(`API endpoint not found: ${req.method} ${req.originalUrl}`));
});

// ================= GLOBAL ERROR HANDLING MIDDLEWARE =================
app.use(errorHandler);

// ================= VITE INTEGRATION & SERVER LIFECYCLE =================
async function startServer() {
  const isProductionMode = process.env.NODE_ENV === 'production' || (typeof __dirname !== 'undefined' && __dirname.includes('dist'));
  if (!isProductionMode) {
    const isHmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: isHmrDisabled ? false : true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));

    // Explicit zero-redirect static route handlers for public pre-rendered pages
    const publicStaticRoutes = ['/about', '/syllabus', '/workshops', '/testimonials', '/free-demo'];
    publicStaticRoutes.forEach((route) => {
      const filePath = path.join(distPath, route.slice(1), 'index.html');
      app.get([route, `${route}/`], (req, res) => {
        if (fs.existsSync(filePath)) {
          res.sendFile(filePath);
        } else {
          res.sendFile(path.join(distPath, 'index.html'));
        }
      });
    });

    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`SmartPen Academy server running on http://localhost:${PORT}`);
  });

  // Graceful shutdown handling for Cloud Run & Container Lifecycle
  const handleShutdown = (signal: string) => {
    console.log(`Received ${signal}. Draining connections and shutting down gracefully...`);
    server.close(() => {
      console.log('HTTP server closed successfully.');
      process.exit(0);
    });

    // Force exit after 10 seconds if connections fail to close
    setTimeout(() => {
      console.error('Forced shutdown due to timeout on active connections.');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
