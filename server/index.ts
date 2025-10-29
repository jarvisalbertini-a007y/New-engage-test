import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { initializeWorkflowData } from "./services/workflowTemplates";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

const app = express();

// Security: Payload size limits (10MB max)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Security: Block access to sensitive files, but allow Vite paths in development
app.use((req, res, next) => {
  // Define patterns for truly sensitive files that should always be blocked
  const criticalBlockPatterns = [
    /^\/\.git\//,      // Block .git directory contents
    /^\/\.env$/,       // Block root .env file  
    /^\/\.env\./,      // Block .env.* files
  ];
  
  // Check critical blocks first - these are always blocked
  if (criticalBlockPatterns.some(pattern => pattern.test(req.path))) {
    return res.status(404).send('Not Found');
  }
  
  // In development, allow everything else for Vite to work properly
  if (app.get("env") === "development") {
    return next();
  }
  
  // In production, block additional sensitive patterns
  const productionBlockPatterns = [
    /\.bak$/,          // Block backup files
    /\.old$/,          // Block old files
    /~$/,              // Block temp files
    /\.backup$/,       // Block backup files
    /\.swp$/,          // Block swap files
    /\.DS_Store$/,     // Block macOS files
    /\.gitignore$/,    // Block gitignore
    /\.log$/,          // Block log files
    /\.sql$/,          // Block SQL files
    /\.sqlite$/,       // Block SQLite files
    /\.db$/            // Block database files
  ];
  
  if (productionBlockPatterns.some(pattern => pattern.test(req.path))) {
    return res.status(404).send('Not Found');
  }
  
  next();
});

// Security: Remove X-Powered-By header
app.disable('x-powered-by');

// Security Headers with Helmet - Very permissive in development for Vite
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
  crossOriginEmbedderPolicy: false
}));

// Rate Limiting - Only apply to API routes, not Vite routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per window for auth endpoints
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many authentication attempts, please try again later",
  skipSuccessfulRequests: false
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window for general API
  standardHeaders: true,
  legacyHeaders: false,
  message: "Too many requests, please try again later"
});

// Apply rate limiting only to specific routes
app.use('/auth', authLimiter);
app.use('/api', apiLimiter);

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
  // Initialize workflow data (templates and agent types)
  try {
    await initializeWorkflowData();
  } catch (error) {
    console.error("Failed to initialize workflow data:", error);
  }

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