const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const USERS = {
  admin: 'adminpass',
  user: 'userpass'
};

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (USERS[username] !== password) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }
  const token = jwt.sign({ username }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

module.exports = router;
