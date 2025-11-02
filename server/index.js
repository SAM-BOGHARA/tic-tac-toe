require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const gameRoutes = require('./routes/games');
const { authenticateToken } = require('./middleware/auth');
const GameModel = require('./models/Game');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: process.env.CORS_ORIGIN || "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || "*"
}));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../client')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/games', (req, res, next) => {
    req.io = io; // Make Socket.IO available to routes
    next();
}, gameRoutes);

// Socket.IO authentication middleware
const authenticateSocket = async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error'));
        }

        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        const pool = require('./database');
        const result = await pool.query('SELECT id, username FROM users WHERE id = $1', [decoded.userId]);
        
        if (result.rows.length === 0) {
            return next(new Error('User not found'));
        }

        socket.user = result.rows[0];
        next();
    } catch (error) {
        next(new Error('Authentication error'));
    }
};

// Use authentication middleware for Socket.IO
io.use(authenticateSocket);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`🔗 User ${socket.user.username} connected`);

    // Join user to their personal room
    socket.join(`user_${socket.user.id}`);

    // Join a game room
    socket.on('joinGame', async (gameId) => {
        try {
            const game = await GameModel.getGameById(gameId);
            
            if (!game) {
                socket.emit('error', { message: 'Game not found' });
                return;
            }

            // Check if user is part of this game
            if (game.player1_id !== socket.user.id && game.player2_id !== socket.user.id) {
                socket.emit('error', { message: 'Access denied' });
                return;
            }

            socket.join(`game_${gameId}`);
            socket.emit('gameJoined', { gameId, game });
            
            // Notify other player in the game
            socket.to(`game_${gameId}`).emit('playerJoined', {
                username: socket.user.username,
                userId: socket.user.id
            });

            console.log(`👥 ${socket.user.username} joined game ${gameId}`);
        } catch (error) {
            console.error('Join game error:', error);
            socket.emit('error', { message: 'Failed to join game' });
        }
    });

    // Leave a game room
    socket.on('leaveGame', (gameId) => {
        socket.leave(`game_${gameId}`);
        socket.to(`game_${gameId}`).emit('playerLeft', {
            username: socket.user.username,
            userId: socket.user.id
        });
        console.log(`👋 ${socket.user.username} left game ${gameId}`);
    });

    // Handle game moves
    socket.on('makeMove', async (data) => {
        try {
            const { gameId, position } = data;
            const game = await GameModel.makeMove(gameId, socket.user.id, position);
            
            // Emit the updated game state to all players in the game
            io.to(`game_${gameId}`).emit('gameUpdate', { game });
            
            console.log(`🎮 ${socket.user.username} made move in game ${gameId} at position ${position}`);
        } catch (error) {
            console.error('Make move error:', error);
            socket.emit('error', { message: error.message });
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`❌ User ${socket.user.username} disconnected`);
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Serve client files
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Start server
server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🌐 Game available at http://localhost:${PORT}`);
});

module.exports = { app, server, io };