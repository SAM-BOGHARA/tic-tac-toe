-- Database schema for multiplayer Tic-Tac-Toe

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Games table
CREATE TABLE games (
    id SERIAL PRIMARY KEY,
    player1_id INTEGER REFERENCES users(id),
    player2_id INTEGER REFERENCES users(id),
    board TEXT DEFAULT '         ', -- 9 spaces representing empty board
    current_turn INTEGER REFERENCES users(id), -- whose turn it is
    status VARCHAR(20) DEFAULT 'waiting', -- waiting, playing, finished
    winner_id INTEGER REFERENCES users(id), -- NULL if no winner or tie
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP
);

-- Game moves history (optional, for tracking moves)
CREATE TABLE game_moves (
    id SERIAL PRIMARY KEY,
    game_id INTEGER REFERENCES games(id),
    player_id INTEGER REFERENCES users(id),
    position INTEGER NOT NULL, -- 0-8 position on the board
    move_number INTEGER NOT NULL, -- 1, 2, 3, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for better performance
CREATE INDEX idx_games_status ON games(status);
CREATE INDEX idx_games_players ON games(player1_id, player2_id);
CREATE INDEX idx_users_username ON users(username);

-- 1. Composite index for finding available games (most frequent query)
CREATE INDEX IF NOT EXISTS idx_games_status_created_at 
ON games(status, created_at) 
WHERE status = 'waiting';

-- 2. Composite index for finding user games efficiently  
CREATE INDEX IF NOT EXISTS idx_games_player1_created_at 
ON games(player1_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_games_player2_created_at 
ON games(player2_id, created_at DESC);

-- 3. Index for current turn lookups (game moves)
CREATE INDEX IF NOT EXISTS idx_games_current_turn_status 
ON games(current_turn, status) 
WHERE status = 'playing';

-- 4. Index for game moves history
CREATE INDEX IF NOT EXISTS idx_game_moves_game_id 
ON game_moves(game_id, move_number);

-- 5. Index for user ID lookups in game_moves
CREATE INDEX IF NOT EXISTS idx_game_moves_player_id 
ON game_moves(player_id);