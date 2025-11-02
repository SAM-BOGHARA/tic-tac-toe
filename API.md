# Multiplayer Tic-Tac-Toe - Backend

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user

### Games
- `GET /api/games/available` - Get available games
- `POST /api/games/create` - Create new game
- `POST /api/games/:id/join` - Join existing game
- `GET /api/games/:id` - Get game details
- `GET /api/games/user/:userId` - Get user's games

### WebSocket Events
- `join-game` - Join a game room
- `make-move` - Make a move in the game
- `game-updated` - Game state updated
- `player-joined` - Player joined game
- `game-finished` - Game completed

## Environment Variables

```
DATABASE_URL=your_neondb_connection_string
JWT_SECRET=your_jwt_secret_key
PORT=3000
NODE_ENV=production
```

## Database

Uses PostgreSQL with NeonDB. Schema includes:
- `users` - User accounts and authentication
- `games` - Game state and metadata  
- `game_moves` - Move history
- Optimized indexes for performance