const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

const USERS = {
  admin: { password: 'adminpass', role: 'admin' },
  user: { password: 'userpass', role: 'user' }
};


router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = USERS[username];

  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ username, role: user.role }, process.env.JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});


module.exports = router;
