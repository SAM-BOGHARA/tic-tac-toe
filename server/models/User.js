const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../database');

class UserModel {
    static async createUser(username, password) {
        try {
            // Check if username already exists
            const existingUser = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
            
            if (existingUser.rows.length > 0) {
                throw new Error('Username already exists');
            }

            // Hash password
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(password, saltRounds);

            // Create user
            const result = await pool.query(
                'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username, created_at',
                [username, hashedPassword]
            );

            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    static async authenticateUser(username, password) {
        try {
            const result = await pool.query('SELECT id, username, password_hash FROM users WHERE username = $1', [username]);
            
            if (result.rows.length === 0) {
                throw new Error('Invalid username or password');
            }

            const user = result.rows[0];
            const isValidPassword = await bcrypt.compare(password, user.password_hash);

            if (!isValidPassword) {
                throw new Error('Invalid username or password');
            }

            // Update last login
            await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

            // Generate JWT token
            const token = jwt.sign(
                { userId: user.id, username: user.username },
                process.env.JWT_SECRET,
                { expiresIn: '24h' }
            );

            return {
                user: { id: user.id, username: user.username },
                token
            };
        } catch (error) {
            throw error;
        }
    }

    static async getUserById(id) {
        const result = await pool.query('SELECT id, username, created_at, last_login FROM users WHERE id = $1', [id]);
        return result.rows[0];
    }

    static async getUserByUsername(username) {
        const result = await pool.query('SELECT id, username, created_at, last_login FROM users WHERE username = $1', [username]);
        return result.rows[0];
    }
}

module.exports = UserModel;