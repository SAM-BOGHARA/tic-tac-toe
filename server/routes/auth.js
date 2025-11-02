const express = require('express');
const router = express.Router();
const UserModel = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { username, password } = req.body;

        // Basic validation
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (username.length < 3 || username.length > 50) {
            return res.status(400).json({ error: 'Username must be between 3 and 50 characters' });
        }

        if (password.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters long' });
        }

        // Username should only contain alphanumeric characters and underscores
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            return res.status(400).json({ error: 'Username can only contain letters, numbers, and underscores' });
        }

        const user = await UserModel.createUser(username, password);
        
        res.status(201).json({
            message: 'User created successfully',
            user: { id: user.id, username: user.username }
        });
    } catch (error) {
        if (error.message === 'Username already exists') {
            return res.status(409).json({ error: error.message });
        }
        
        console.error('Registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Login user
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        const { user, token } = await UserModel.authenticateUser(username, password);
        
        res.json({
            message: 'Login successful',
            user,
            token
        });
    } catch (error) {
        if (error.message === 'Invalid username or password') {
            return res.status(401).json({ error: error.message });
        }
        
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get current user profile
router.get('/profile', authenticateToken, async (req, res) => {
    try {
        const user = await UserModel.getUserById(req.user.id);
        res.json({ user });
    } catch (error) {
        console.error('Profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;