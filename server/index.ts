import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

// Security: Payload size limits to prevent memory exhaustion
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// CRITICAL SECURITY: Block access to sensitive files and directories
app.use((req, res, next) => {
  const blockedPatterns = [
    /^\/\.git/,       // Block .git directory
    /^\/\.env/,       // Block .env files
    /\.env$/,         // Block any .env file
    /\.bak$/,         // Block backup files
    /\.old$/,         // Block old files
    /~$/,             // Block temp files
    /\.backup$/,      // Block backup files
    /\.swp$/,         // Block swap files
    /\.DS_Store$/,    // Block macOS files
    /\.gitignore$/,   // Block gitignore
    /\.git/,          // Block any git path
    /node_modules/,   // Block node_modules
    /\.log$/,         // Block log files
    /\.sql$/,         // Block SQL files
    /\.sqlite$/,      // Block SQLite files
    /\.db$/           // Block database files
  ];
  
  if (blockedPatterns.some(pattern => pattern.test(req.path))) {
    return res.status(404).send('Not Found');
  }
  next();
});

// Security: Remove X-Powered-By header
app.disable('x-powered-by');

// Security Headers with Helmet
// In development, use less restrictive CSP to allow Vite to work
const isDevelopment = app.get("env") === "development";
app.use(helmet({
  contentSecurityPolicy: isDevelopment ? false : {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https:", "http:"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:", "http:"],
      imgSrc: ["'self'", "data:", "https:", "http:", "blob:"],
      fontSrc: ["'self'", "data:", "https:", "http:"],
      connectSrc: ["'self'", "https:", "http:", "ws:", "wss:"],
      frameSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false // Allow embedding for development
}));

// Rate Limiting Configuration
// Strict rate limiting for authentication endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many authentication attempts, please try again later",
  skipSuccessfulRequests: false
});

// Moderate rate limiting for general API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window for general API
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please slow down",
  skip: (req) => {
    // Skip rate limiting for static assets
    return !req.path.startsWith('/api');
  }
});

// Apply rate limiters
app.use('/api/login', authLimiter);
app.use('/api/logout', authLimiter);
app.use('/api/callback', authLimiter);
app.use('/api/', apiLimiter);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
