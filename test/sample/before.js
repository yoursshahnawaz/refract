// before.js — original file (clean baseline)
import express from 'express';
import jwt from 'jsonwebtoken';
import db from './db.js';

const router = express.Router();

router.get('/users', async (req, res) => {
  const users = await db.query('SELECT * FROM users');
  res.json(users);
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await db.query('SELECT * FROM users WHERE email = ?', [email]);
  if (user && user.password === password) {
    const token = jwt.sign({ id: user.id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

export default router;
