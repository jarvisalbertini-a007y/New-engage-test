import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";

if (!process.env.REPLIT_DOMAINS) {
  console.warn("[Auth] REPLIT_DOMAINS not set - auth features may be limited in development");
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  let sessionStore: any;
  try {
    const pgStore = connectPg(session);
    sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: true, // Auto-create the sessions table
      ttl: sessionTtl,
      tableName: "sessions",
    });
    console.log('[Session] PostgreSQL session store initialized');
  } catch (error) {
    console.error('[Session] Failed to connect to PostgreSQL, using memory store:', error);
    const MemoryStore = require('memorystore')(session);
    sessionStore = new MemoryStore({
      checkPeriod: 86400000 // prune expired entries every 24h
    });
  }
  
  // Check if we're in a secure environment (production/HTTPS)
  const isProduction = process.env.NODE_ENV === "production";
  const isSecure = isProduction || process.env.REPLIT_DOMAINS?.includes("replit.app");
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isSecure,
      sameSite: isSecure ? "none" : "lax",
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // In development, add a timeout for OIDC config to prevent hanging
  let config: client.Configuration;
  try {
    const configPromise = getOidcConfig();
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('OIDC config timeout')), 10000)
    );
    config = await Promise.race([configPromise, timeoutPromise]);
  } catch (error) {
    console.log('[Auth] OIDC config fetch failed or timed out:', error);
    console.log('[Auth] Continuing with limited auth functionality');
    // Return early in development mode to allow server to start
    if (process.env.NODE_ENV === 'development') {
      console.log('[Auth] Development mode - setting up minimal routes');
      app.get("/api/login", (req, res) => res.json({ message: "Login not available in dev mode" }));
      app.get("/api/callback", (req, res) => res.redirect("/"));
      app.get("/api/logout", (req, res) => res.redirect("/"));
      return;
    }
    throw error;
  }

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login",
    })(req, res, next);
  });

  app.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID!,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
        }).href
      );
    });
  });
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  // Auth bypass for testing - ONLY in development/test environments
  // Multiple safety checks to prevent accidental production bypass
  const isTestEnvironment = process.env.NODE_ENV === 'test' || process.env.NODE_ENV === 'development';
  const bypassEnabled = process.env.AUTH_TEST_BYPASS === 'true';
  const notProduction = process.env.NODE_ENV !== 'production';
  const notReplitProduction = !process.env.REPLIT_DOMAINS?.includes('replit.app');
  
  if (bypassEnabled && isTestEnvironment && notProduction && notReplitProduction) {
    console.warn('[Auth] TEST BYPASS ACTIVE - This should NEVER appear in production logs');
    // Create a test user for authenticated requests
    if (!req.user) {
      req.user = {
        claims: {
          sub: 'test-user-bypass',
          email: 'test@example.com',
          first_name: 'Test',
          last_name: 'User',
          exp: Math.floor(Date.now() / 1000) + 3600 // Expires in 1 hour
        },
        expires_at: Math.floor(Date.now() / 1000) + 3600
      } as any;
    }
    return next();
  }

  // Wrap regular auth logic in an immediately invoked async function
  (async () => {
    const user = req.user as any;
    
    // Debug logging for authentication
    console.log(`[Auth Debug] ${req.method} ${req.path}:`, {
      isAuthenticated: req.isAuthenticated(),
      hasUser: !!req.user,
      userSub: user?.claims?.sub,
      sessionID: req.sessionID,
      hasCookie: !!req.headers.cookie
    });

    if (!req.isAuthenticated() || !user?.expires_at) {
      console.log(`[Auth Debug] Rejecting unauthenticated request to ${req.path}`);
      return res.status(401).json({ message: "Unauthorized" });
    }

    const now = Math.floor(Date.now() / 1000);
    if (now <= user.expires_at) {
      return next();
    }

    const refreshToken = user.refresh_token;
    if (!refreshToken) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    try {
      const config = await getOidcConfig();
      const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
      updateUserSession(user, tokenResponse);
      return next();
    } catch (error) {
      return res.status(401).json({ message: "Unauthorized" });
    }
  })().catch((error) => {
    console.error("[Auth Error]", error);
    res.status(500).json({ message: "Internal server error" });
  });
};