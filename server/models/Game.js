const pool = require('../database');

class GameModel {
    static async createGame(playerId) {
        try {
            const result = await pool.query(`
                INSERT INTO games (player1_id, current_turn, status) 
                VALUES ($1, $1, $2::VARCHAR(20)) 
                RETURNING *
            `, [playerId, 'waiting']);
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    static async joinGame(gameId, playerId) {
        try {
            // Single query to check and update game + get complete game data
            const result = await pool.query(`
                WITH updated_game AS (
                    UPDATE games 
                    SET player2_id = $1, status = 'playing'::VARCHAR(20) 
                    WHERE id = $2 AND status = 'waiting' AND player1_id != $1
                    RETURNING *
                )
                SELECT g.*, 
                       u1.username as player1_username,
                       u2.username as player2_username,
                       uw.username as winner_username
                FROM updated_game g 
                JOIN users u1 ON g.player1_id = u1.id 
                LEFT JOIN users u2 ON g.player2_id = u2.id
                LEFT JOIN users uw ON g.winner_id = uw.id
            `, [playerId, gameId]);

            if (result.rows.length === 0) {
                throw new Error('Game not available for joining');
            }

            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    static async getAvailableGames() {
        try {
            const result = await pool.query(`
                SELECT g.*, u.username as player1_username 
                FROM games g 
                JOIN users u ON g.player1_id = u.id 
                WHERE g.status = 'waiting' 
                ORDER BY g.created_at ASC
                LIMIT 20
            `);
            return result.rows;
        } catch (error) {
            throw error;
        }
    }

    static async getGameById(gameId) {
        try {
            const result = await pool.query(`
                SELECT g.*, 
                       u1.username as player1_username,
                       u2.username as player2_username,
                       uw.username as winner_username
                FROM games g 
                JOIN users u1 ON g.player1_id = u1.id 
                LEFT JOIN users u2 ON g.player2_id = u2.id
                LEFT JOIN users uw ON g.winner_id = uw.id
                WHERE g.id = $1
            `, [gameId]);
            
            return result.rows[0];
        } catch (error) {
            throw error;
        }
    }

    static async makeMove(gameId, playerId, position) {
        try {
            // Get current game state first (reduced DB call from original)
            const game = await this.getGameById(gameId);
            
            if (!game) {
                throw new Error('Game not found');
            }

            if (game.status !== 'playing') {
                throw new Error('Game is not in playing state');
            }

            if (game.current_turn !== playerId) {
                throw new Error('Not your turn');
            }

            // Check if position is valid and empty
            if (position < 0 || position > 8) {
                throw new Error('Invalid position');
            }

            const board = game.board.split('');
            if (board[position] !== ' ') {
                throw new Error('Position already taken');
            }

            // Determine player symbol
            const symbol = playerId === game.player1_id ? 'X' : 'O';
            board[position] = symbol;
            const newBoard = board.join('');

            console.log(`Move made: Player ${playerId} (${symbol}) at position ${position}`);
            console.log(`Board before move: "${game.board}"`);
            console.log(`Board after move: "${newBoard}"`);

            // Check for winner
            const winner = this.checkWinner(newBoard);
            console.log(`Winner check result: ${winner}`);
            
            let status = 'playing';
            let winnerId = null;
            let nextTurn = playerId === game.player1_id ? game.player2_id : game.player1_id;

            if (winner) {
                status = 'finished';
                winnerId = winner === 'X' ? game.player1_id : game.player2_id;
                nextTurn = null;
            } else if (!newBoard.includes(' ')) {
                // It's a tie
                status = 'finished';
                nextTurn = null;
            }

            // Calculate move number
            const moveNumber = newBoard.split('').filter(cell => cell !== ' ').length;

            // Single transaction to update game and record move
            const client = await pool.connect();
            try {
                await client.query('BEGIN');

                // Update game
                const updateResult = await client.query(`
                    UPDATE games 
                    SET board = $1, current_turn = $2, status = $3::VARCHAR(20), winner_id = $4, 
                        finished_at = CASE WHEN $3 = 'finished' THEN CURRENT_TIMESTAMP ELSE finished_at END
                    WHERE id = $5 
                    RETURNING *
                `, [newBoard, nextTurn, status, winnerId, gameId]);

                // Record the move
                await client.query(
                    'INSERT INTO game_moves (game_id, player_id, position, move_number) VALUES ($1, $2, $3, $4)',
                    [gameId, playerId, position, moveNumber]
                );

                await client.query('COMMIT');

                // Return updated game with usernames (reuse existing usernames to avoid extra DB call)
                return {
                    ...updateResult.rows[0],
                    player1_username: game.player1_username,
                    player2_username: game.player2_username,
                    winner_username: winnerId ? 
                        (winnerId === game.player1_id ? game.player1_username : game.player2_username) : null
                };

            } catch (error) {
                await client.query('ROLLBACK');
                throw error;
            } finally {
                client.release();
            }

        } catch (error) {
            throw error;
        }
    }

    static checkWinner(board) {
        const winPatterns = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
            [0, 4, 8], [2, 4, 6] // diagonals
        ];

        for (const pattern of winPatterns) {
            const [a, b, c] = pattern;
            const cellA = board[a];
            const cellB = board[b];
            const cellC = board[c];
            
            console.log(`Checking pattern [${a}, ${b}, ${c}]: "${cellA}", "${cellB}", "${cellC}"`);
            
            if (cellA && cellA === cellB && cellB === cellC && cellA.trim() !== '') {
                console.log(`Winner found: ${cellA.trim()}`);
                return cellA.trim();
            }
        }
        
        console.log('No winner found');
        return null;
    }

    static async getUserGames(userId) {
        try {
            const result = await pool.query(`
                SELECT g.*, 
                       u1.username as player1_username,
                       u2.username as player2_username,
                       uw.username as winner_username
                FROM games g 
                JOIN users u1 ON g.player1_id = u1.id 
                LEFT JOIN users u2 ON g.player2_id = u2.id
                LEFT JOIN users uw ON g.winner_id = uw.id
                WHERE g.player1_id = $1 OR g.player2_id = $1
                ORDER BY g.created_at DESC
                LIMIT 50
            `, [userId]);
            
            return result.rows;
        } catch (error) {
            throw error;
        }
    }
}

module.exports = GameModel;