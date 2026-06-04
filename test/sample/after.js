// after.js — the "new" version submitted as a PR (full of intentional issues)
import express from 'express';
import jwt from 'jsonwebtoken';
import db from './db.js';
import _ from 'lodash'; // importing entire lodash for one function

const router = express.Router();

// 🔴 SECURITY: SQL injection — raw interpolation instead of parameterized query
router.get('/users', async (req, res) => {
  const { role } = req.query;
  const users = await db.query(`SELECT * FROM users WHERE role = '${role}'`);

  // ⚡ PERFORMANCE: N+1 query — fetching profile for each user in a loop
  const enriched = [];
  for (const user of users) {
    const profile = await db.query('SELECT * FROM profiles WHERE user_id = ?', [user.id]);
    enriched.push({ ...user, profile });
  }

  // 🔴 SECURITY: leaking sensitive fields (password hash, internal tokens)
  res.json(enriched);
});

// 🐛 LOGIC: no await on async verifyToken — always passes auth check
router.get('/admin', (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1];
  const valid = verifyToken(token); // missing await — returns Promise, always truthy
  if (valid) {
    res.json({ secret: 'admin data' });
  } else {
    res.status(403).json({ error: 'Forbidden' });
  }
});

// 🔴 SECURITY: hardcoded JWT fallback secret
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const secret = process.env.JWT_SECRET || 'mysecretkey123'; // hardcoded fallback

  const user = await db.query('SELECT * FROM users WHERE email = ?', [email]);

  // 🐛 LOGIC: plain-text password comparison — no bcrypt
  if (user && user.password === password) {
    const token = jwt.sign({ id: user.id, role: user.role }, secret, { expiresIn: '30d' }); // excessively long expiry
    // 🔴 SECURITY: logging sensitive user data including password
    console.log('User logged in:', JSON.stringify(user));
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// 🏗️ ARCHITECTURE: business logic, auth, DB, and response formatting all in one function
router.post('/register', async (req, res) => {
  const { email, password, name, role } = req.body;

  // 🐛 LOGIC: no input validation — null/undefined inputs go straight to DB
  const existing = await db.query('SELECT id FROM users WHERE email = ?', [email]);
  if (existing) {
    return res.status(400).json({ error: 'Email taken' });
  }

  // 🔴 SECURITY: storing plain-text password
  await db.query('INSERT INTO users (email, password, name, role) VALUES (?, ?, ?, ?)', [
    email,
    password, // should be bcrypt.hash(password, 10)
    name,
    role || 'user',
  ]);

  // 🧪 TESTS: no tests for this entire endpoint
  const newUser = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  const token = jwt.sign({ id: newUser.id }, process.env.JWT_SECRET || 'mysecretkey123', {
    expiresIn: '30d',
  });

  res.status(201).json({ token, user: newUser }); // leaks full user object including password
});

// ⚡ PERFORMANCE: O(n²) deduplication — should use a Set
router.get('/tags', async (req, res) => {
  const tags = await db.query('SELECT tag FROM posts');
  const unique = [];
  for (let i = 0; i < tags.length; i++) {
    let isDuplicate = false;
    for (let j = 0; j < unique.length; j++) {
      if (tags[i].tag === unique[j]) isDuplicate = true;
    }
    if (!isDuplicate) unique.push(tags[i].tag);
  }
  res.json(unique);
});

async function verifyToken(token) {
  try {
    return jwt.verify(token, process.env.JWT_SECRET || 'mysecretkey123');
  } catch {
    return null;
  }
}

export default router;
