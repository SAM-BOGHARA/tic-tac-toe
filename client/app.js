// Global variables
let socket = null;
let currentUser = null;
let currentGame = null;
let authToken = localStorage.getItem('authToken');


document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        fetch(`${window.CONFIG.API_BASE_URL}/api/auth/profile`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.user) {
                currentUser = data.user;
                showGameSection();
                initializeSocket();
            } else {
                localStorage.removeItem('authToken');
                showAuthSection();
            }
        })
        .catch(() => {
            localStorage.removeItem('authToken');
            showAuthSection();
        });
    } else {
        showAuthSection();
    }

    initializeGameBoard();
});

function showLogin() {
    document.getElementById('loginForm').classList.remove('hidden');
    document.getElementById('registerForm').classList.add('hidden');
    clearAuthMessage();
}

function showRegister() {
    document.getElementById('loginForm').classList.add('hidden');
    document.getElementById('registerForm').classList.remove('hidden');
    clearAuthMessage();
}

function showAuthSection() {
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('gameSection').classList.add('hidden');
}

function showGameSection() {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('gameSection').classList.remove('hidden');
    document.getElementById('username').textContent = currentUser.username;
}

async function login() {
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (!username || !password) {
        showAuthMessage('Please fill in all fields', 'error');
        return;
    }

    try {
        const response = await fetch(`${window.CONFIG.API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            authToken = data.token;
            currentUser = data.user;
            localStorage.setItem('authToken', authToken);
            showAuthMessage('Login successful!', 'success');
            setTimeout(() => {
                showGameSection();
                initializeSocket();
            }, 1000);
        } else {
            showAuthMessage(data.error, 'error');
        }
    } catch (error) {
        showAuthMessage('Network error. Please try again.', 'error');
    }
}

async function register() {
    const username = document.getElementById('registerUsername').value.trim();
    const password = document.getElementById('registerPassword').value;

    if (!username || !password) {
        showAuthMessage('Please fill in all fields', 'error');
        return;
    }

    try {
        const response = await fetch(`${window.CONFIG.API_BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            showAuthMessage('Registration successful! You can now login.', 'success');
            setTimeout(() => {
                showLogin();
                document.getElementById('loginUsername').value = username;
            }, 1500);
        } else {
            showAuthMessage(data.error, 'error');
        }
    } catch (error) {
        showAuthMessage('Network error. Please try again.', 'error');
    }
}

function logout() {
    if (socket) {
        socket.disconnect();
    }
    localStorage.removeItem('authToken');
    authToken = null;
    currentUser = null;
    currentGame = null;
    showAuthSection();
    clearGameBoard();
}

function showAuthMessage(message, type) {
    const messageDiv = document.getElementById('authMessage');
    messageDiv.textContent = message;
    messageDiv.className = `mt-4 p-3 rounded-md ${type === 'success' ? 'bg-green-100 text-green-700 border border-green-300' : 'bg-red-100 text-red-700 border border-red-300'}`;
    messageDiv.classList.remove('hidden');
}

function clearAuthMessage() {
    document.getElementById('authMessage').classList.add('hidden');
}

// Socket.IO functions
function initializeSocket() {
    socket = io(window.CONFIG.WS_URL, {
        auth: {
            token: authToken
        }
    });

    socket.on('connect', () => {
        console.log('Connected to server');
        loadAvailableGames();
    });

    socket.on('gameJoined', (data) => {
        currentGame = data.game;
        updateGameDisplay();
        showGameMessage(`Joined game #${data.gameId}`, 'success');
    });

    socket.on('gameUpdate', (data) => {
        console.log('Received gameUpdate:', data.game);
        currentGame = data.game;
        updateGameDisplay();
    });

    socket.on('playerJoined', (data) => {
        showGameMessage(`${data.username} joined the game!`, 'info');
        loadAvailableGames(); // Refresh available games
        // Trigger a refresh of the current game state
        if (currentGame) {
            refreshCurrentGame();
        }
    });

    socket.on('playerLeft', (data) => {
        showGameMessage(`${data.username} left the game`, 'info');
    });

    socket.on('error', (data) => {
        showGameMessage(data.message, 'error');
    });

    socket.on('disconnect', () => {
        console.log('Disconnected from server');
    });
}

// Game functions
async function createGame() {
    try {
        const response = await fetch(`${window.CONFIG.API_BASE_URL}/api/games/create`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            currentGame = data.game;
            socket.emit('joinGame', data.game.id);
            showGameMessage('Game created! Waiting for another player...', 'success');
            updateGameDisplay(); // Update the display immediately
            loadAvailableGames();
        } else {
            showGameMessage(data.error, 'error');
        }
    } catch (error) {
        showGameMessage('Failed to create game', 'error');
    }
}

async function joinGame(gameId) {
    try {
        const response = await fetch(`${window.CONFIG.API_BASE_URL}/api/games/join/${gameId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });

        const data = await response.json();

        if (response.ok) {
            currentGame = data.game;
            socket.emit('joinGame', gameId);
            showGameMessage('Joined game successfully!', 'success');
            updateGameDisplay(); // Update the display immediately
            loadAvailableGames();
        } else {
            showGameMessage(data.error, 'error');
        }
    } catch (error) {
        showGameMessage('Failed to join game', 'error');
    }
}

async function loadAvailableGames() {
    try {
        const response = await fetch(`${window.CONFIG.API_BASE_URL}/api/games/available`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            displayAvailableGames(data.games);
        } else {
            showGameMessage(data.error, 'error');
        }
    } catch (error) {
        showGameMessage('Failed to load available games', 'error');
    }
}

async function refreshCurrentGame() {
    if (!currentGame || !currentGame.id) return;
    
    try {
        const response = await fetch(`${window.CONFIG.API_BASE_URL}/api/games/${currentGame.id}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });

        const data = await response.json();

        if (response.ok) {
            console.log('Refreshed game data:', data.game);
            currentGame = data.game;
            updateGameDisplay();
        } else {
            console.error('Failed to refresh game:', data);
        }
    } catch (error) {
        console.error('Failed to refresh current game:', error);
    }
}

function displayAvailableGames(games) {
    const container = document.getElementById('availableGames');
    
    if (games.length === 0) {
        container.innerHTML = '<p class="text-gray-500">No games available. Create one!</p>';
        return;
    }

    container.innerHTML = games.map(game => `
        <div class="flex justify-between items-center p-3 border border-gray-200 rounded-md">
            <div>
                <p class="font-semibold">${game.player1_username}'s Game</p>
                <p class="text-sm text-gray-500">Created ${new Date(game.created_at).toLocaleTimeString()}</p>
            </div>
            <button onclick="joinGame(${game.id})" 
                    class="bg-blue-500 text-white px-3 py-1 rounded-md hover:bg-blue-600 transition duration-200">
                Join
            </button>
        </div>
    `).join('');
}

function initializeGameBoard() {
    const board = document.getElementById('gameBoard');
    board.innerHTML = '';
    
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.className = 'bg-gray-50 border-2 border-gray-300 rounded-md flex items-center justify-center text-2xl font-bold cursor-pointer hover:bg-gray-100 transition duration-200 w-20 h-20';
        cell.onclick = () => makeMove(i);
        cell.id = `cell-${i}`;
        board.appendChild(cell);
    }
}

function updateGameDisplay() {
    console.log('updateGameDisplay called with currentGame:', currentGame);
    
    if (!currentGame) {
        document.getElementById('gameStatus').innerHTML = '<p>No active game</p>';
        document.getElementById('gameInfo').innerHTML = '<p>Create or join a game to start playing!</p>';
        clearGameBoard();
        return;
    }

    // Update game status
    const statusDiv = document.getElementById('gameStatus');
    const isPlayer1 = currentGame.player1_id === currentUser.id;
    const playerSymbol = isPlayer1 ? 'X' : 'O';
    
    let statusText = '';
    if (currentGame.status === 'waiting') {
        statusText = '<p class="text-yellow-600">Waiting for another player...</p>';
    } else if (currentGame.status === 'playing') {
        const isMyTurn = currentGame.current_turn === currentUser.id;
        if (isMyTurn) {
            statusText = '<p class="text-green-600">Your turn!</p>';
        } else {
            const otherPlayer = isPlayer1 ? currentGame.player2_username : currentGame.player1_username;
            statusText = `<p class="text-blue-600">Waiting for ${otherPlayer}...</p>`;
        }
    } else if (currentGame.status === 'finished') {
        console.log('Game finished. currentUser.id:', currentUser.id, 'currentGame.winner_id:', currentGame.winner_id, 'Types:', typeof currentUser.id, typeof currentGame.winner_id);
        
        // Convert both to numbers for comparison to handle type mismatches
        const currentUserId = parseInt(currentUser.id);
        const winnerId = parseInt(currentGame.winner_id);
        
        if (winnerId === currentUserId) {
            statusText = '<p class="text-green-600 font-bold">You won! 🎉</p>';
        } else if (currentGame.winner_id) {
            // Use winner_username if available, otherwise fallback to player usernames
            let winnerName = currentGame.winner_username;
            if (!winnerName) {
                winnerName = currentGame.winner_id === currentGame.player1_id ? 
                    (currentGame.player1_username || 'Player 1') : 
                    (currentGame.player2_username || 'Player 2');
            }
            statusText = `<p class="text-red-600 font-bold">${winnerName} won!</p>`;
        } else {
            statusText = '<p class="text-gray-600 font-bold">It\'s a tie!</p>';
        }
    }
    
    statusDiv.innerHTML = statusText;

    // Update game info
    const infoDiv = document.getElementById('gameInfo');
    if (currentGame.player1_username && currentGame.player2_username) {
        infoDiv.innerHTML = `
            <p><span class="font-semibold">${currentGame.player1_username}</span> (X) vs <span class="font-semibold">${currentGame.player2_username}</span> (O)</p>
            <p class="text-sm">You are playing as <span class="font-bold">${playerSymbol}</span></p>
        `;
    } else if (currentGame.player1_username) {
        infoDiv.innerHTML = `
            <p><span class="font-semibold">${currentGame.player1_username}</span> is waiting for a player</p>
            <p class="text-sm">You are <span class="font-bold">${playerSymbol}</span></p>
        `;
    } else {
        infoDiv.innerHTML = '<p class="text-gray-500">Loading game info...</p>';
    }

    // Update board
    updateBoard(currentGame.board);
}

function updateBoard(boardString) {
    const gameFinished = currentGame && currentGame.status === 'finished';
    
    for (let i = 0; i < 9; i++) {
        const cell = document.getElementById(`cell-${i}`);
        const value = boardString[i];
        cell.textContent = value === ' ' ? '' : value;
        
        // Update colors based on player
        if (value === 'X') {
            cell.className = cell.className.replace('text-2xl', 'text-2xl text-blue-600');
        } else if (value === 'O') {
            cell.className = cell.className.replace('text-2xl', 'text-2xl text-red-600');
        }
        
        // Disable pointer events if game is finished
        if (gameFinished) {
            cell.style.pointerEvents = 'none';
            cell.style.opacity = '0.7';
        } else {
            cell.style.pointerEvents = 'auto';
            cell.style.opacity = '1';
        }
    }
}

function clearGameBoard() {
    for (let i = 0; i < 9; i++) {
        const cell = document.getElementById(`cell-${i}`);
        cell.textContent = '';
        cell.className = 'bg-gray-50 border-2 border-gray-300 rounded-md flex items-center justify-center text-2xl font-bold cursor-pointer hover:bg-gray-100 transition duration-200 w-20 h-20';
    }
}

function makeMove(position) {
    if (!currentGame) {
        console.log('No current game');
        return;
    }
    
    if (currentGame.status !== 'playing') {
        console.log('Game is not in playing state:', currentGame.status);
        return;
    }
    
    if (currentGame.current_turn !== currentUser.id) {
        console.log('Not your turn');
        return;
    }

    if (currentGame.board[position] !== ' ') {
        console.log('Position already taken');
        return;
    }

    socket.emit('makeMove', {
        gameId: currentGame.id,
        position: position
    });
}

function showGameMessage(message, type) {
    const messageDiv = document.getElementById('gameMessage');
    messageDiv.textContent = message;
    
    let bgColor = 'bg-blue-100 text-blue-700 border border-blue-300';
    if (type === 'success') bgColor = 'bg-green-100 text-green-700 border border-green-300';
    if (type === 'error') bgColor = 'bg-red-100 text-red-700 border border-red-300';
    if (type === 'info') bgColor = 'bg-blue-100 text-blue-700 border border-blue-300';
    
    messageDiv.className = `max-w-md mx-auto mt-8 p-3 rounded-md ${bgColor}`;
    messageDiv.classList.remove('hidden');
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        messageDiv.classList.add('hidden');
    }, 5000);
}