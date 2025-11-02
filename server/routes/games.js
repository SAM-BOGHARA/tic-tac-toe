const express = require('express');
const router = express.Router();
const GameModel = require('../models/Game');
const { authenticateToken } = require('../middleware/auth');

// Create a new game
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const game = await GameModel.createGame(req.user.id);
        res.status(201).json({
            message: 'Game created successfully',
            game
        });
    } catch (error) {
        console.error('Create game error:', error);
        res.status(500).json({ error: 'Failed to create game' });
    }
});

// Get available games to join
router.get('/available', authenticateToken, async (req, res) => {
    try {
        const games = await GameModel.getAvailableGames();
        res.json({ games });
    } catch (error) {
        console.error('Get available games error:', error);
        res.status(500).json({ error: 'Failed to fetch available games' });
    }
});

// Join an existing game
router.post('/join/:gameId', authenticateToken, async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const game = await GameModel.joinGame(gameId, req.user.id);
        
        // Emit Socket.IO event to notify all players in the game
        if (req.io) {
            req.io.to(`game_${gameId}`).emit('gameUpdate', { game });
            req.io.to(`game_${gameId}`).emit('playerJoined', {
                username: req.user.username,
                userId: req.user.id
            });
        }
        
        res.json({
            message: 'Joined game successfully',
            game
        });
    } catch (error) {
        if (error.message === 'Game not available for joining') {
            return res.status(400).json({ error: error.message });
        }
        
        console.error('Join game error:', error);
        res.status(500).json({ error: 'Failed to join game' });
    }
});

// Get specific game details
router.get('/:gameId', authenticateToken, async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const game = await GameModel.getGameById(gameId);
        
        if (!game) {
            return res.status(404).json({ error: 'Game not found' });
        }

        // Check if user is part of this game
        if (game.player1_id !== req.user.id && game.player2_id !== req.user.id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json({ game });
    } catch (error) {
        console.error('Get game error:', error);
        res.status(500).json({ error: 'Failed to fetch game' });
    }
});

// Make a move in the game
router.post('/:gameId/move', authenticateToken, async (req, res) => {
    try {
        const gameId = parseInt(req.params.gameId);
        const { position } = req.body;

        if (position === undefined || position < 0 || position > 8) {
            return res.status(400).json({ error: 'Invalid position' });
        }

        const game = await GameModel.makeMove(gameId, req.user.id, position);
        
        // Emit Socket.IO event to notify all players in the game
        if (req.io) {
            req.io.to(`game_${gameId}`).emit('gameUpdate', { game });
        }
        
        res.json({
            message: 'Move made successfully',
            game
        });
    } catch (error) {
        if (error.message.includes('Not your turn') || 
            error.message.includes('Position already taken') ||
            error.message.includes('Game is not in playing state')) {
            return res.status(400).json({ error: error.message });
        }
        
        console.error('Make move error:', error);
        res.status(500).json({ error: 'Failed to make move' });
    }
});

// Get user's games
router.get('/user/games', authenticateToken, async (req, res) => {
    try {
        const games = await GameModel.getUserGames(req.user.id);
        res.json({ games });
    } catch (error) {
        console.error('Get user games error:', error);
        res.status(500).json({ error: 'Failed to fetch user games' });
    }
});

module.exports = router;