import type { Express } from "express";
import crypto from "crypto";

interface TestUser {
  id: string;
  email: string;
  password: string;
  name: string;
  createdAt: string;
}

// In-memory storage for test users (development only)
const testUsers = new Map<string, TestUser>();

// Pre-create a default test user
testUsers.set("test@example.com", {
  id: "test-user-123",
  email: "test@example.com",
  password: "test123", // In production, this would be hashed
  name: "Test User",
  createdAt: new Date().toISOString()
});

// Development authentication middleware
export function setupDevAuth(app: Express) {
  // Only enable in development
  if (process.env.NODE_ENV === 'production') {
    console.log('[DevAuth] Skipping development auth setup in production');
    return;
  }

  console.log('[DevAuth] Setting up development authentication');

  // Create test user endpoint
  app.post('/api/dev/create-user', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ message: 'Not found' });
    }

    const { email, password, name } = req.body;
    
    if (!email || !password || !name) {
      return res.status(400).json({ message: 'Email, password, and name are required' });
    }

    if (testUsers.has(email)) {
      return res.status(409).json({ message: 'User already exists' });
    }

    const newUser: TestUser = {
      id: `test-user-${crypto.randomBytes(8).toString('hex')}`,
      email,
      password, // In production, this would be hashed
      name,
      createdAt: new Date().toISOString()
    };

    testUsers.set(email, newUser);
    
    res.json({
      message: 'Test user created successfully',
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name
      }
    });
  });

  // Test login endpoint
  app.post('/api/dev/login', (req: any, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ message: 'Not found' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = testUsers.get(email);
    
    if (!user || user.password !== password) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Create a session for the test user
    req.session = req.session || {};
    req.user = {
      claims: {
        sub: user.id,
        email: user.email,
        name: user.name,
        first_name: user.name.split(' ')[0],
        last_name: user.name.split(' ')[1] || ''
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    };

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      }
    });
  });

  // List test users endpoint (development only)
  app.get('/api/dev/users', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ message: 'Not found' });
    }

    const users = Array.from(testUsers.values()).map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      createdAt: u.createdAt
    }));

    res.json({ users });
  });

  // Auto-login as test user (for easier development)
  app.post('/api/dev/auto-login', (req: any, res) => {
    if (process.env.NODE_ENV === 'production') {
      return res.status(404).json({ message: 'Not found' });
    }

    const testUser = testUsers.get('test@example.com');
    
    if (!testUser) {
      return res.status(500).json({ message: 'Default test user not found' });
    }

    req.session = req.session || {};
    req.user = {
      claims: {
        sub: testUser.id,
        email: testUser.email,
        name: testUser.name,
        first_name: 'Test',
        last_name: 'User'
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    };

    res.json({
      message: 'Auto-login successful',
      user: {
        id: testUser.id,
        email: testUser.email,
        name: testUser.name
      }
    });
  });

  console.log('[DevAuth] Development authentication endpoints ready');
  console.log('[DevAuth] Default test user: test@example.com / test123');
  console.log('[DevAuth] Use /api/dev/login or /api/dev/auto-login to authenticate');
}