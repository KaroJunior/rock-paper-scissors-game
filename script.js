const firebaseConfig = {
    apiKey: "AIzaSyARFYKiMSFtuQdd4zV74lbUgd3HUKon6HM",
    authDomain: "rockpaperscissorsgame-70867.firebaseapp.com",
    databaseURL: "https://rockpaperscissorsgame-70867-default-rtdb.firebaseio.com",
    projectId: "rockpaperscissorsgame-70867",
    storageBucket: "rockpaperscissorsgame-70867.firebasestorage.app",
    messagingSenderId: "445566144485",
    appId: "1:445566144485:web:cf8a595a6bef49d1f8a90c"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

// Game state
const state = {
    mode: 'single-player',
    playerScore: 0,
    computerScore: 0,
    player1Score: 0,
    player2Score: 0,
    gameCode: null,
    gameHistory: [],
    opponentConnected: false,
    isHost: false,
    playerChoice: null,
    opponentChoice: null,
    roundActive: false,
    playerId: Math.random().toString(36).substring(2, 10),
    gameRef: null,
    playerRef: null,
    opponentRef: null,
    countdownInterval: null,
    gameCheckInterval: null,
    roundListener: null,
    resultsListener: null,
    playersListener: null,
    countdownListener: null,
    gameStatusListener: null,
    opponentId: null // Added to track opponent's ID
};

// DOM elements
const modeButtons = document.querySelectorAll('.mode-btn');
const gameScreens = document.querySelectorAll('.game-screen');

// Show the selected game screen
function showScreen(screenId) {
    // Update active button
    modeButtons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    
    // Show selected screen
    gameScreens.forEach(screen => screen.classList.remove('active-screen'));
    document.getElementById(screenId).classList.add('active-screen');
    
    state.mode = screenId;
}

// Show/hide join section
function showJoinSection(show) {
    document.getElementById('join-section').style.display = show ? 'flex' : 'none';
}

// Single player game logic
function playGame(playerChoice) {
    const choices = ['rock', 'paper', 'scissors'];
    const computerChoice = choices[Math.floor(Math.random() * 3)];
    
    // Add shake animation to player choice
    const playerChoiceElement = document.getElementById('player-choice');
    playerChoiceElement.classList.add('shake');
    
    // Update choices display after animation
    setTimeout(() => {
        playerChoiceElement.textContent = getEmoji(playerChoice);
        playerChoiceElement.classList.remove('shake');
        
        const computerChoiceElement = document.getElementById('computer-choice');
        computerChoiceElement.textContent = getEmoji(computerChoice);
        computerChoiceElement.classList.add('reveal');
        setTimeout(() => computerChoiceElement.classList.remove('reveal'), 500);
        
        // Determine winner
        let result = '';
        if (playerChoice === computerChoice) {
            result = "It's a tie!";
        } else if (
            (playerChoice === 'rock' && computerChoice === 'scissors') ||
            (playerChoice === 'paper' && computerChoice === 'rock') ||
            (playerChoice === 'scissors' && computerChoice === 'paper')
        ) {
            result = "You win!";
            state.playerScore++;
        } else {
            result = "Computer wins!";
            state.computerScore++;
        }
        
        // Update scores
        document.getElementById('player-score').textContent = state.playerScore;
        document.getElementById('computer-score').textContent = state.computerScore;
        
        // Display result
        const resultElement = document.getElementById('sp-result');
        resultElement.innerHTML = `${result}`;
        
        // Add to history
        addToHistory(`You: ${getEmoji(playerChoice)} vs Computer: ${getEmoji(computerChoice)} - ${result}`);
    }, 500);
}

// Improved multiplayer gameplay function
function playMultiplayer(playerChoice) {
    if (!state.opponentConnected) {
        document.getElementById('mp-result').textContent = "Wait for your friend to connect!";
        return;
    }
    
    if (state.roundActive) {
        document.getElementById('mp-result').textContent = "Round in progress!";
        return;
    }
    
    state.roundActive = true;
    state.playerChoice = playerChoice;
    
    // Disable choice buttons during round
    const choiceButtons = document.querySelectorAll('#mp-choices .choice');
    choiceButtons.forEach(button => {
        button.classList.add('disabled');
    });
    
    // Add shake animation to player choice
    const playerChoiceElement = document.getElementById('mp-player-choice');
    playerChoiceElement.classList.add('shake');
    
    // Update status
    document.getElementById('mp-status').className = 'status-message playing';
    document.getElementById('mp-status').innerHTML = '<i class="fas fa-gamepad"></i> Game in progress';
    document.getElementById('mp-result').textContent = "Waiting for friend's move...";
    
    // Show "..." for opponent to indicate they're thinking/playing
    document.getElementById('mp-opponent-choice').textContent = "...";
    
    // Update choices display after animation
    setTimeout(() => {
        playerChoiceElement.textContent = getEmoji(playerChoice);
        playerChoiceElement.classList.remove('shake');
        
        // Send choice to Firebase - store in the round data
        if (state.gameRef) {
            // Store choice in round data for both players to see
            const choiceUpdate = {};
            choiceUpdate[state.playerId] = playerChoice;
            
            state.gameRef.child('round/choices').update(choiceUpdate);
            state.gameRef.child('round/status').set('choices-made');
            
            // Also update player data for score tracking
            if (state.playerRef) {
                state.playerRef.update({
                    choice: playerChoice,
                    ready: true,
                    updatedAt: Date.now()
                });
            }
        }
        
        // Update game status
        if (state.gameRef) {
            state.gameRef.update({
                status: 'playing'
            });
        }
    }, 500);
}

// Reset multiplayer round with better state management
function resetMultiplayerRound() {
    state.roundActive = false;
    state.playerChoice = null;
    state.opponentChoice = null;

    // Clear any existing countdown
    if (state.countdownInterval) {
        clearInterval(state.countdownInterval);
        state.countdownInterval = null;
    }
    
    // Reset choice displays
    document.getElementById('mp-player-choice').textContent = '?';
    document.getElementById('mp-opponent-choice').textContent = '?';
    
    // Update status
    document.getElementById('mp-result').textContent = "Make your move!";
    
    // Enable choice buttons
    const choiceButtons = document.querySelectorAll('#mp-choices .choice');
    choiceButtons.forEach(button => {
        button.classList.remove('disabled');
    });
    
    // Reset choices in Firebase
    if (state.playerRef) {
        state.playerRef.update({
            choice: null,
            ready: false
        });
    }
    
    // Clear round choices in Firebase
    if (state.gameRef) {
        state.gameRef.child('round').set({
            status: 'active',
            choices: {},
            winner: null,
            timestamp: Date.now()
        });
    }
    
    // Update game status in Firebase
    if (state.gameRef) {
        state.gameRef.update({
            status: 'waiting'
        });
    }
}

// Get emoji for choice
function getEmoji(choice) {
    switch(choice) {
        case 'rock': return '✊';
        case 'paper': return '✋';
        case 'scissors': return '✌️';
        default: return '?';
    }
}

// Add game result to history
function addToHistory(text, isMultiplayer = false) {
    const historyElement = isMultiplayer ? 
        document.getElementById('mp-history') : 
        document.getElementById('sp-history');
    
    const historyItem = document.createElement('div');
    historyItem.className = 'history-item';
    
    // Extract result to style it
    const parts = text.split(' - ');
    if (parts[1] === "You win!") {
        historyItem.innerHTML = `${parts[0]} - <span class="winner">${parts[1]}</span>`;
    } else if (parts[1] === "You lose!") {
        historyItem.innerHTML = `${parts[0]} - <span class="loser">${parts[1]}</span>`;
    } else {
        historyItem.innerHTML = `${parts[0]} - ${parts[1]}`;
    }
    
    historyElement.prepend(historyItem);
    
    // Keep only the last 5 history items
    if (historyElement.children.length > 5) {
        historyElement.removeChild(historyElement.lastChild);
    }
    
    state.gameHistory.push(text);
}

// Check for stale game state and recover
function checkGameState() {
    if (state.gameRef && state.playerChoice && !state.opponentChoice) {
        // Check if it's been too long waiting for opponent
        state.opponentRef.once('value').then((snapshot) => {
            const opponentData = snapshot.val();
            if (opponentData && !opponentData.choice) {
                // Opponent might be disconnected or not responding
                state.gameRef.child('players').once('value').then((playersSnapshot) => {
                    const players = playersSnapshot.val();
                    if (players && Object.keys(players).length < 2) {
                        // Opponent has disconnected
                        document.getElementById('mp-result').textContent = "Your friend disconnected!";
                        resetMultiplayerRound();
                    }
                });
            }
        });
    }
}

// Clean up Firebase listeners
function cleanupFirebaseListeners() {
    // Remove all Firebase listeners
    if (state.gameRef) {
        state.gameRef.off();
    }
    if (state.playerRef) {
        state.playerRef.off();
    }
    if (state.opponentRef) {
        state.opponentRef.off();
    }
    
    // Remove specific listeners
    if (state.roundListener) {
        state.roundListener();
        state.roundListener = null;
    }
    if (state.resultsListener) {
        state.resultsListener();
        state.resultsListener = null;
    }
    if (state.playersListener) {
        state.playersListener();
        state.playersListener = null;
    }
    if (state.countdownListener) {
        state.countdownListener();
        state.countdownListener = null;
    }
    if (state.gameStatusListener) {
        state.gameStatusListener();
        state.gameStatusListener = null;
    }
    
    // Clear intervals
    if (state.countdownInterval) {
        clearInterval(state.countdownInterval);
        state.countdownInterval = null;
    }
    
    if (state.gameCheckInterval) {
        clearInterval(state.gameCheckInterval);
        state.gameCheckInterval = null;
    }
    
    // Reset all Firebase references
    state.gameRef = null;
    state.playerRef = null;
    state.opponentRef = null;
}

// Reset multiplayer UI completely
function resetMultiplayerUI() {
    // Reset all UI elements to their initial state
    document.getElementById('mp-status').className = 'status-message waiting';
    document.getElementById('mp-status').innerHTML = '<i class="fas fa-clock"></i> Waiting for friend to connect...';
    document.getElementById('mp-result').textContent = "Share the code with a friend to start playing";
    document.getElementById('mp-choices').style.display = 'none';
    document.getElementById('share-section').style.display = 'block';
    document.getElementById('game-code-display').style.display = 'none';
    
    // Enable choice buttons
    const choiceButtons = document.querySelectorAll('#mp-choices .choice');
    choiceButtons.forEach(button => {
        button.classList.remove('disabled');
    });
    
    // Reset scores display
    document.getElementById('player1-score').textContent = '0';
    document.getElementById('player2-score').textContent = '0';
    
    // Clear game history
    document.getElementById('mp-history').innerHTML = '';
    
    // Show instructions again
    document.querySelector('.instructions').style.display = 'block';
}

// Multiplayer functions
function createGame() {
    // Clean up any existing Firebase listeners first
    cleanupFirebaseListeners();
    
    // Reset multiplayer state
    state.opponentConnected = false;
    state.isHost = true;
    state.player1Score = 0;
    state.player2Score = 0;
    state.roundActive = false;
    state.playerChoice = null;
    state.opponentChoice = null;
    
    // Hide setup buttons and join section
    document.getElementById('setup-options').style.display = 'none';
    document.getElementById('join-section').style.display = 'none';
    
    // Generate a random game code
    state.gameCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Show game UI
    document.getElementById('multiplayer-game').style.display = 'block';
    
    // Show game code and share section
    document.getElementById('game-code-display').style.display = 'block';
    document.getElementById('code-display').textContent = state.gameCode;
    document.getElementById('share-section').style.display = 'block';
    
    // Create the full URL with game code
    const gameUrl = `${window.location.origin}${window.location.pathname}?game=${state.gameCode}`;
    document.getElementById('game-link').value = gameUrl;
    
    // Update status
    document.getElementById('mp-status').innerHTML = '<i class="fas fa-clock"></i> Waiting for friend to connect...';
    document.getElementById('mp-status').className = 'status-message waiting';
    document.getElementById('mp-result').textContent = "Share the code with a friend to start playing";
    
    // Hide game choices until opponent connects
    document.getElementById('mp-choices').style.display = 'none';
    
    // Create game in Firebase
    createFirebaseGame();
}

function joinGame() {
    const gameCode = document.getElementById('game-code').value.trim();
    
    if (!gameCode) {
        alert("Please enter a game code");
        return;
    }
    
    // Clean up any existing Firebase listeners first
    cleanupFirebaseListeners();
    
    // Reset multiplayer state
    state.opponentConnected = false;
    state.isHost = false;
    state.player1Score = 0;
    state.player2Score = 0;
    state.roundActive = false;
    state.playerChoice = null;
    state.opponentChoice = null;
    
    // Hide setup buttons
    document.getElementById('setup-options').style.display = 'none';
    
    // Set game code
    state.gameCode = gameCode;
    
    // Show game UI
    document.getElementById('multiplayer-game').style.display = 'block';
    document.getElementById('share-section').style.display = 'none';
    document.getElementById('game-code-display').style.display = 'none';
    
    // Update status
    document.getElementById('mp-status').innerHTML = '<i class="fas fa-clock"></i> Connecting to game...';
    document.getElementById('mp-status').className = 'status-message waiting';
    document.getElementById('mp-result').textContent = "Joining game...";
    
    // Hide game choices until connection is established
    document.getElementById('mp-choices').style.display = 'none';
    
    // Join game in Firebase
    joinFirebaseGame();
}

// Determine multiplayer winner with proper perspective
function determineMultiplayerWinner() {
    let result = '';
    let winnerPerspective = '';
    
    if (state.playerChoice === state.opponentChoice) {
        result = "It's a tie!";
        winnerPerspective = "tie";
    } else if (
        (state.playerChoice === 'rock' && state.opponentChoice === 'scissors') ||
        (state.playerChoice === 'paper' && state.opponentChoice === 'rock') ||
        (state.playerChoice === 'scissors' && state.opponentChoice === 'paper')
    ) {
        result = "You win!";
        winnerPerspective = "player";
        state.player1Score++;
        document.getElementById('player1-score').textContent = state.player1Score;
        
        // Update score in Firebase
        if (state.playerRef) {
            state.playerRef.update({
                score: state.player1Score
            });
        }
    } else {
        result = "You lose!";
        winnerPerspective = "opponent";
        state.player2Score++;
        document.getElementById('player2-score').textContent = state.player2Score;
    }
    
    // Update game state to indicate round is complete
    if (state.gameRef) {
        state.gameRef.child('round').update({
            status: 'complete',
            winner: winnerPerspective,
            timestamp: Date.now()
        });
        
        // Store result in Firebase for both players to see
        state.gameRef.child('results').push({
            playerChoice: state.playerChoice,
            opponentChoice: state.opponentChoice,
            timestamp: Date.now(),
            winnerPerspective: winnerPerspective,
            playerId: state.playerId // Store who created this result
        });
    }
    
    // Display result with animation
    const resultElement = document.getElementById('mp-result');
    resultElement.innerHTML = `${result}`;
    resultElement.classList.add('reveal');
    
    // Add to history
    addToHistory(`You: ${getEmoji(state.playerChoice)} vs Friend: ${getEmoji(state.opponentChoice)} - ${result}`, true);
    
    // Start synchronized countdown for next round (5 seconds)
    startCountdown(5);
    
    // Update status to show round is complete
    document.getElementById('mp-status').className = 'status-message waiting';
    document.getElementById('mp-status').innerHTML = '<i class="fas fa-flag-checkered"></i> Round complete - Next round starting soon';
}

// Start a synchronized countdown for next round
function startCountdown(seconds) {
    // Clear any existing countdown
    if (state.countdownInterval) {
        clearInterval(state.countdownInterval);
    }
    
    let countdown = seconds;
    const resultElement = document.getElementById('mp-result');
    
    // Create countdown display
    const countdownElement = document.createElement('div');
    countdownElement.className = 'countdown';
    countdownElement.textContent = `Next round in: ${countdown}`;
    resultElement.appendChild(countdownElement);
    
    // Update countdown in Firebase for both players to see
    if (state.gameRef) {
        state.gameRef.child('round/countdown').set(countdown);
    }
    
    // Start countdown
    state.countdownInterval = setInterval(() => {
        countdown--;
        
        if (countdown > 0) {
            countdownElement.textContent = `Next round in: ${countdown}`;
            
            // Update countdown in Firebase
            if (state.gameRef) {
                state.gameRef.child('round/countdown').set(countdown);
            }
        } else {
            // Countdown finished
            clearInterval(state.countdownInterval);
            state.countdownInterval = null;
            countdownElement.remove();
            
            // Reset for next round
            resetMultiplayerRound();
        }
    }, 1000);
}

// Firebase functions
function createFirebaseGame() {
    state.gameRef = database.ref('games/' + state.gameCode);
    
    // Set up game data with proper round structure
    state.gameRef.set({
        host: state.playerId,
        status: 'waiting',
        createdAt: Date.now(),
        round: {
            status: 'active',
            choices: {},
            winner: null,
            timestamp: Date.now(),
            countdown: 0
        }
    });
    
    // Create player entry
    state.playerRef = database.ref('games/' + state.gameCode + '/players/' + state.playerId);
    state.playerRef.set({
        name: 'Player 1',
        score: 0,
        choice: null,
        connected: true
    });
    
    // Listen for player changes
    state.playersListener = state.gameRef.child('players').on('child_added', (snapshot) => {
        const playerId = snapshot.key;
        const playerData = snapshot.val();
        
        // If a new player joined and it's not us
        if (playerId !== state.playerId) {
            state.opponentConnected = true;
            state.opponentRef = database.ref('games/' + state.gameCode + '/players/' + playerId);
            state.opponentId = playerId; // Store opponent's ID
            
            document.getElementById('mp-status').innerHTML = '<i class="fas fa-check-circle"></i> Friend connected!';
            document.getElementById('mp-status').className = 'status-message connected';
            document.getElementById('mp-result').textContent = "Game starting...";
            
            // Hide share section when friend connects
            document.getElementById('share-section').style.display = 'none';
            
            // Show game choices
            document.getElementById('mp-choices').style.display = 'flex';
            // Hide instructions when game starts
            document.querySelector('.instructions').style.display = 'none';
            
            // Start the game after a brief delay
            setTimeout(() => {
                document.getElementById('mp-result').textContent = "Make your move!";
            }, 1000);
            
            // Update game status
            state.gameRef.update({
                status: 'playing'
            });
            
            // Listen for round changes to see both players' choices
            state.roundListener = state.gameRef.child('round/choices').on('value', (snapshot) => {
                const choicesData = snapshot.val();
                if (choicesData) {
                    // Check if both players have made choices
                    const playerIds = Object.keys(choicesData);
                    
                    if (playerIds.length === 2) {
                        // Both players have made choices
                        const opponentId = playerIds.find(id => id !== state.playerId);
                        
                        if (opponentId) {
                            state.opponentChoice = choicesData[opponentId];
                            
                            // Show both choices with a brief pause for anticipation
                            setTimeout(() => {
                                // Reveal opponent's choice
                                const opponentChoiceElement = document.getElementById('mp-opponent-choice');
                                opponentChoiceElement.textContent = getEmoji(state.opponentChoice);
                                opponentChoiceElement.classList.add('reveal');
                                setTimeout(() => opponentChoiceElement.classList.remove('reveal'), 500);
                                
                                // Determine winner after seeing both choices
                                setTimeout(determineMultiplayerWinner, 1500);
                            }, 800);
                        }
                    } else if (playerIds.length === 1) {
                        // Only one player has made a choice so far
                        const playerId = playerIds[0];
                        
                        if (playerId !== state.playerId) {
                            // Opponent has made a choice but we haven't
                            document.getElementById('mp-opponent-choice').textContent = "...";
                            document.getElementById('mp-result').textContent = "Your friend has made a choice! Make your move!";
                        }
                    }
                }
            });
            
            // Listen for round completion to sync both players
            state.resultsListener = state.gameRef.child('results').on('child_added', (snapshot) => {
                const resultData = snapshot.val();
                if (resultData) {
                    // Only update UI if this is a new result (not the one we just created)
                    if (Date.now() - resultData.timestamp < 5000) {
                        // Calculate result based on current player's perspective
                        let displayResult;
                        if (resultData.winnerPerspective === 'tie') {
                            displayResult = "It's a tie!";
                        } else if (resultData.winnerPerspective === 'player') {
                            // If the winner is 'player', check if it's the current player
                            displayResult = (resultData.playerId === state.playerId) ? "You win!" : "You lose!";
                        } else {
                            // If the winner is 'opponent'
                            displayResult = (resultData.playerId !== state.playerId) ? "You win!" : "You lose!";
                        }
                        
                        // Display result for both players
                        document.getElementById('mp-result').innerHTML = displayResult;
                        
                        // Update status to show round is complete
                        document.getElementById('mp-status').className = 'status-message waiting';
                        document.getElementById('mp-status').innerHTML = '<i class="fas fa-flag-checkered"></i> Round complete - Next round starting soon';
                    }
                }
            });

            // Listen for countdown changes
            state.countdownListener = state.gameRef.child('round/countdown').on('value', (snapshot) => {
                const countdownValue = snapshot.val();
                if (countdownValue > 0) {
                    // Update countdown display
                    const countdownElement = document.querySelector('#mp-result .countdown');
                    if (countdownElement) {
                        countdownElement.textContent = `Next round in: ${countdownValue}`;
                    }
                }
            });

            // Monitor game status changes
            state.gameStatusListener = state.gameRef.on('value', (snapshot) => {
                const gameData = snapshot.val();
                if (gameData) {
                    // Handle game status changes
                    if (gameData.status === 'ended') {
                        document.getElementById('mp-status').innerHTML = '<i class="fas fa-exclamation-circle"></i> Game ended';
                        document.getElementById('mp-status').className = 'status-message waiting';
                        document.getElementById('mp-result').textContent = "The other player left the game";
                        
                        // Clean up and return to menu
                        setTimeout(() => {
                            leaveMultiplayerGame();
                        }, 2000);
                    }
                }
            });

            // Monitor if opponent disconnects
            state.playersListener = state.gameRef.child('players').on('child_removed', (snapshot) => {
                const playerId = snapshot.key;
                if (playerId !== state.playerId) {
                    // Opponent disconnected
                    state.opponentConnected = false;
                    document.getElementById('mp-status').innerHTML = '<i class="fas fa-exclamation-circle"></i> Friend disconnected';
                    document.getElementById('mp-status').className = 'status-message waiting';
                    document.getElementById('mp-result').textContent = "Your friend has disconnected from the game";
                    
                    // Disable choice buttons
                    const choiceButtons = document.querySelectorAll('#mp-choices .choice');
                    choiceButtons.forEach(button => {
                        button.classList.add('disabled');
                    });
                    
                    // Clean up and return to menu after a delay
                    setTimeout(() => {
                        leaveMultiplayerGame();
                    }, 2000);
                }
            });
        }
    });
    
    // Call this periodically when in a game
    state.gameCheckInterval = setInterval(checkGameState, 5000);
}

function joinFirebaseGame() {
    state.gameRef = database.ref('games/' + state.gameCode);
    
    // Check if game exists
    state.gameRef.once('value').then((snapshot) => {
        if (!snapshot.exists()) {
            document.getElementById('mp-status').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Game not found';
            document.getElementById('mp-status').className = 'status-message waiting';
            document.getElementById('mp-result').textContent = "Make sure the game code is correct and the game exists";
            
            // Show try again button
            const tryAgainBtn = document.createElement('button');
            tryAgainBtn.textContent = 'Try Again';
            tryAgainBtn.onclick = function() {
                document.getElementById('multiplayer-game').style.display = 'none';
                document.getElementById('setup-options').style.display = 'flex';
                document.getElementById('join-section').style.display = 'flex';
            };
            document.getElementById('mp-result').appendChild(document.createElement('br'));
            document.getElementById('mp-result').appendChild(tryAgainBtn);
            
            return;
        }
        
        const gameData = snapshot.val();
        
        // Check if game already has 2 players
        if (gameData.players && Object.keys(gameData.players).length >= 2) {
            document.getElementById('mp-status').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Game is full';
            document.getElementById('mp-status').className = 'status-message waiting';
            document.getElementById('mp-result').textContent = "This game already has 2 players";
            return;
        }
        
        // Join the game
        state.playerRef = database.ref('games/' + state.gameCode + '/players/' + state.playerId);
        state.playerRef.set({
            name: 'Player 2',
            score: 0,
            choice: null,
            connected: true
        });
        
        // Find the opponent
        const players = Object.keys(gameData.players || {});
        const opponentId = players.find(id => id !== state.playerId);
        
        if (opponentId) {
            state.opponentConnected = true;
            state.opponentRef = database.ref('games/' + state.gameCode + '/players/' + opponentId);
            state.opponentId = opponentId; // Store opponent's ID
            
            // Update status
            document.getElementById('mp-status').innerHTML = '<i class="fas fa-check-circle"></i> Connected to game!';
            document.getElementById('mp-status').className = 'status-message connected';
            document.getElementById('mp-result').textContent = "Make your move!";
            
            // Show game choices
            document.getElementById('mp-choices').style.display = 'flex';
            // Hide instructions when game starts
            document.querySelector('.instructions').style.display = 'none';
            // Hide Join Section
            document.getElementById('join-section').style.display = 'none';
            
            // Listen for round changes to see both players' choices
            state.roundListener = state.gameRef.child('round/choices').on('value', (snapshot) => {
                const choicesData = snapshot.val();
                if (choicesData) {
                    // Check if both players have made choices
                    const playerIds = Object.keys(choicesData);
                    
                    if (playerIds.length === 2) {
                        // Both players have made choices
                        const opponentId = playerIds.find(id => id !== state.playerId);
                        
                        if (opponentId) {
                            state.opponentChoice = choicesData[opponentId];
                            
                            // Show both choices with a brief pause for anticipation
                            setTimeout(() => {
                                // Reveal opponent's choice
                                const opponentChoiceElement = document.getElementById('mp-opponent-choice');
                                opponentChoiceElement.textContent = getEmoji(state.opponentChoice);
                                opponentChoiceElement.classList.add('reveal');
                                setTimeout(() => opponentChoiceElement.classList.remove('reveal'), 500);
                                
                                // Determine winner after seeing both choices
                                setTimeout(determineMultiplayerWinner, 1500);
                            }, 800);
                        }
                    } else if (playerIds.length === 1) {
                        // Only one player has made a choice so far
                        const playerId = playerIds[0];
                        
                        if (playerId !== state.playerId) {
                            // Opponent has made a choice but we haven't
                            document.getElementById('mp-opponent-choice').textContent = "...";
                            document.getElementById('mp-result').textContent = "Your friend has made a choice! Make your move!";
                        }
                    }
                }
            });
            
            // Listen for round completion to sync both players
            state.resultsListener = state.gameRef.child('results').on('child_added', (snapshot) => {
                const resultData = snapshot.val();
                if (resultData) {
                    // Only update UI if this is a new result (not the one we just created)
                    if (Date.now() - resultData.timestamp < 5000) {
                        // Calculate result based on current player's perspective
                        let displayResult;
                        if (resultData.winnerPerspective === 'tie') {
                            displayResult = "It's a tie!";
                        } else if (resultData.winnerPerspective === 'player') {
                            // If the winner is 'player', check if it's the current player
                            displayResult = (resultData.playerId === state.playerId) ? "You win!" : "You lose!";
                        } else {
                            // If the winner is 'opponent'
                            displayResult = (resultData.playerId !== state.playerId) ? "You win!" : "You lose!";
                        }
                        
                        // Display result for both players
                        document.getElementById('mp-result').innerHTML = displayResult;
                        
                        // Update status to show round is complete
                        document.getElementById('mp-status').className = 'status-message waiting';
                        document.getElementById('mp-status').innerHTML = '<i class="fas fa-flag-checkered"></i> Round complete - Next round starting soon';
                    }
                }
            });
        } else {
            // If no opponent found, listen for when they join
            state.playersListener = state.gameRef.child('players').on('child_added', (snapshot) => {
                const playerId = snapshot.key;
                if (playerId !== state.playerId) {
                    state.opponentConnected = true;
                    state.opponentRef = database.ref('games/' + state.gameCode + '/players/' + playerId);
                    state.opponentId = playerId; // Store opponent's ID
                    
                    document.getElementById('mp-status').innerHTML = '<i class="fas fa-check-circle"></i> Friend connected!';
                    document.getElementById('mp-status').className = 'status-message connected';
                    document.getElementById('mp-result').textContent = "Make your move!";
                    
                    // Show game choices
                    document.getElementById('mp-choices').style.display = 'flex';
                    
                    // Listen for round changes to see both players' choices
                    state.roundListener = state.gameRef.child('round/choices').on('value', (snapshot) => {
                        const choicesData = snapshot.val();
                        if (choicesData) {
                            // Check if both players have made choices
                            const playerIds = Object.keys(choicesData);
                            
                            if (playerIds.length === 2) {
                                // Both players have made choices
                                const opponentId = playerIds.find(id => id !== state.playerId);
                                
                                if (opponentId) {
                                    state.opponentChoice = choicesData[opponentId];
                                    
                                    // Show both choices with a brief pause for anticipation
                                    setTimeout(() => {
                                        // Reveal opponent's choice
                                        const opponentChoiceElement = document.getElementById('mp-opponent-choice');
                                        opponentChoiceElement.textContent = getEmoji(state.opponentChoice);
                                        opponentChoiceElement.classList.add('reveal');
                                        setTimeout(() => opponentChoiceElement.classList.remove('reveal'), 500);
                                        
                                        // Determine winner after seeing both choices
                                        setTimeout(determineMultiplayerWinner, 1500);
                                    }, 800);
                                }
                            }
                        }
                    });
                    
                    // Listen for round completion to sync both players
                    state.resultsListener = state.gameRef.child('results').on('child_added', (snapshot) => {
                        const resultData = snapshot.val();
                        if (resultData) {
                            // Only update UI if this is a new result (not the one we just created)
                            if (Date.now() - resultData.timestamp < 5000) {
                                // Calculate result based on current player's perspective
                                let displayResult;
                                if (resultData.winnerPerspective === 'tie') {
                                    displayResult = "It's a tie!";
                                } else if (resultData.winnerPerspective === 'player') {
                                    // If the winner is 'player', check if it's the current player
                                    displayResult = (resultData.playerId === state.playerId) ? "You win!" : "You lose!";
                                } else {
                                    // If the winner is 'opponent'
                                    displayResult = (resultData.playerId !== state.playerId) ? "You win!" : "You lose!";
                                }
                                
                                // Display result for both players
                                document.getElementById('mp-result').innerHTML = displayResult;
                                
                                // Update status to show round is complete
                                document.getElementById('mp-status').className = 'status-message waiting';
                                document.getElementById('mp-status').innerHTML = '<i class="fas fa-flag-checkered"></i> Round complete - Next round starting soon';
                            }
                        }
                    });
                }
            });
        }

        // Listen for countdown changes
        state.countdownListener = state.gameRef.child('round/countdown').on('value', (snapshot) => {
            const countdownValue = snapshot.val();
            if (countdownValue > 0) {
                // Update countdown display
                const countdownElement = document.querySelector('#mp-result .countdown');
                if (countdownElement) {
                    countdownElement.textContent = `Next round in: ${countdownValue}`;
                }
            }
        });

        // Monitor game status changes
        state.gameStatusListener = state.gameRef.on('value', (snapshot) => {
            const gameData = snapshot.val();
            if (gameData) {
                // Handle game status changes
                if (gameData.status === 'ended') {
                    document.getElementById('mp-status').innerHTML = '<i class="fas fa-exclamation-circle"></i> Game ended';
                    document.getElementById('mp-status').className = 'status-message waiting';
                    document.getElementById('mp-result').textContent = "The other player left the game";
                    
                    // Clean up and return to menu
                    setTimeout(() => {
                        leaveMultiplayerGame();
                    }, 2000);
                }
            }
        });

        // Monitor if opponent disconnects
        state.playersListener = state.gameRef.child('players').on('child_removed', (snapshot) => {
            const playerId = snapshot.key;
            if (playerId !== state.playerId) {
                // Opponent disconnected
                state.opponentConnected = false;
                document.getElementById('mp-status').innerHTML = '<i class="fas fa-exclamation-circle"></i> Friend disconnected';
                document.getElementById('mp-status').className = 'status-message waiting';
                document.getElementById('mp-result').textContent = "Your friend has disconnected from the game";
                
                // Disable choice buttons
                const choiceButtons = document.querySelectorAll('#mp-choices .choice');
                choiceButtons.forEach(button => {
                    button.classList.add('disabled');
                });
                
                // Clean up and return to menu after a delay
                setTimeout(() => {
                    leaveMultiplayerGame();
                }, 2000);
            }
        });

    }).catch((error) => {
        console.error("Error joining game:", error);
        document.getElementById('mp-status').innerHTML = '<i class="fas fa-exclamation-triangle"></i> Connection error';
        document.getElementById('mp-status').className = 'status-message waiting';
        document.getElementById('mp-result').textContent = "Could not connect to the game. Please check your internet connection.";
    });
    
    // Call this periodically when in a game
    state.gameCheckInterval = setInterval(checkGameState, 5000);
}

function copyLink() {
    const linkInput = document.getElementById('game-link');
    linkInput.select();
    document.execCommand('copy');
    alert("Game link copied to clipboard!");
}

function shareViaWhatsApp() {
    const gameUrl = document.getElementById('game-link').value;
    const text = `Join me for a game of Rock Paper Scissors! Use this link: ${gameUrl}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

function leaveMultiplayerGame() {
    // Simply reload the page to reset everything
    window.location.reload();
}


// Initialize the game
function init() {
    // Check if URL has a game parameter for joining directly
    const urlParams = new URLSearchParams(window.location.search);
    const gameParam = urlParams.get('game');
    
    if (gameParam) {
        document.getElementById('game-code').value = gameParam;
        showScreen('multiplayer');
        // Auto-join after a brief delay
        setTimeout(joinGame, 500);
    }
}

// Run initialization when page loads
window.onload = init;