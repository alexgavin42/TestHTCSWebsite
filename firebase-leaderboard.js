// Firebase Leaderboard Manager
class LeaderboardManager {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.userId = null;
    this.hasSubmitted = false;
    this.todayDate = this.getTodayDate();

    this.initializeFirebase();
    this.setupEventListeners();
  }

  getTodayDate() {
    // Get date in YYYY-MM-DD format
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  initializeFirebase() {
    // Wait for Firebase to be available and initialized
    const checkFirebase = () => {
      if (typeof firebase !== 'undefined' && firebase.firestore) {
        try {
          // Check if Firebase app is already initialized
          if (!firebase.apps.length) {
            // Firebase not initialized yet, wait longer
            setTimeout(checkFirebase, 100);
            return;
          }

          // Firebase is initialized, get Firestore instance
          this.db = firebase.firestore();
          this.initialized = true;
          this.showStatus('✅ Connected to Leaderboard', 'connected');

          // Get or create user ID from localStorage
          this.userId = this.getUserId();

          // Check and reset leaderboard if needed
          this.checkAndResetLeaderboard();

        } catch (error) {
          this.showStatus('❌ Error: ' + error.message, 'error');
          console.error('Leaderboard Firebase initialization error:', error);
        }
      } else {
        setTimeout(checkFirebase, 100);
      }
    };
    checkFirebase();
  }

  getUserId() {
    // Get or create a unique user ID stored in localStorage
    let userId = localStorage.getItem('leaderboardUserId');
    if (!userId) {
      // Generate a unique ID using timestamp + random string
      userId = Date.now().toString(36) + Math.random().toString(36).substring(2);
      localStorage.setItem('leaderboardUserId', userId);
    }
    return userId;
  }

  async checkAndResetLeaderboard() {
    try {
      const metaDoc = await this.db.collection('_leaderboard_meta').doc('current').get();

      if (!metaDoc.exists || metaDoc.data().date !== this.todayDate) {
        // Need to reset - it's a new day or first time
        console.log('Resetting leaderboard for new day:', this.todayDate);

        // Delete all entries from leaderboard collection
        const leaderboardSnapshot = await this.db.collection('leaderboard').get();
        const batch1 = this.db.batch();
        leaderboardSnapshot.docs.forEach(doc => {
          batch1.delete(doc.ref);
        });
        await batch1.commit();

        // Delete all entries from leaderboard_users collection
        const usersSnapshot = await this.db.collection('leaderboard_users').get();
        const batch2 = this.db.batch();
        usersSnapshot.docs.forEach(doc => {
          batch2.delete(doc.ref);
        });
        await batch2.commit();

        // Add base entry with name "Base" and score 100
        await this.db.collection('leaderboard').add({
          name: 'Base',
          score: 100,
          timestamp: firebase.firestore.FieldValue.serverTimestamp(),
          userId: 'system'
        });

        // Update metadata with current date
        await this.db.collection('_leaderboard_meta').doc('current').set({
          date: this.todayDate,
          resetAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        console.log('Leaderboard reset complete');
      }

      // Now check if user has already submitted today
      this.checkUserSubmission();

    } catch (error) {
      console.error('Error checking/resetting leaderboard:', error);
      // Continue anyway
      this.checkUserSubmission();
    }
  }

  async checkUserSubmission() {
    try {
      const userDoc = await this.db.collection('leaderboard_users').doc(this.userId).get();

      if (userDoc.exists) {
        this.hasSubmitted = true;
        document.getElementById('playerName').disabled = true;
        document.getElementById('playerScore').disabled = true;
        document.getElementById('submitScoreBtn').disabled = true;

        // Show their existing score or rejection
        const userData = userDoc.data();
        if (userData.rejected) {
          this.showMessage(`Your score submission was rejected (${userData.name} - ${userData.score}) for exceeding the limit.`, 'error');
        } else {
          this.showMessage(`You have already submitted a score: ${userData.name} - ${userData.score}`, 'info');
        }

        // Show the leaderboard
        this.loadLeaderboard();
      }
    } catch (error) {
      console.error('Error checking user submission:', error);
    }
  }

  setupEventListeners() {
    // Wait for DOM to be ready
    document.addEventListener('DOMContentLoaded', () => {
      const submitBtn = document.getElementById('submitScoreBtn');
      if (submitBtn) {
        submitBtn.addEventListener('click', () => this.submitScore());
      }

      // Allow Enter key to submit
      const nameInput = document.getElementById('playerName');
      const scoreInput = document.getElementById('playerScore');

      if (nameInput && scoreInput) {
        [nameInput, scoreInput].forEach(input => {
          input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
              this.submitScore();
            }
          });
        });
      }
    });
  }

  showStatus(message, type) {
    const statusDiv = document.getElementById('leaderboardStatus');
    if (statusDiv) {
      statusDiv.innerHTML = `<p class="status-${type}">${message}</p>`;

      // Hide status after 3 seconds if connected
      if (type === 'connected') {
        setTimeout(() => {
          statusDiv.style.display = 'none';
        }, 3000);
      }
    }
  }

  showMessage(message, type) {
    const messageDiv = document.getElementById('submissionMessage');
    if (messageDiv) {
      messageDiv.textContent = message;
      messageDiv.className = `submission-message ${type}`;

      // Clear message after 5 seconds
      setTimeout(() => {
        messageDiv.textContent = '';
        messageDiv.className = 'submission-message';
      }, 5000);
    }
  }

  async getHighestScore() {
    try {
      const snapshot = await this.db.collection('leaderboard')
        .orderBy('score', 'desc')
        .limit(1)
        .get();

      if (!snapshot.empty) {
        return snapshot.docs[0].data().score;
      }
      return null;
    } catch (error) {
      console.error('Error getting highest score:', error);
      return null;
    }
  }

  async submitScore() {
    if (!this.initialized) {
      this.showMessage('Please wait for the leaderboard to connect...', 'error');
      return;
    }

    if (this.hasSubmitted) {
      this.showMessage('You have already submitted a score!', 'error');
      return;
    }

    const name = document.getElementById('playerName').value.trim();
    const scoreInput = document.getElementById('playerScore').value;
    const score = parseInt(scoreInput);

    // Validation
    if (!name) {
      this.showMessage('Please enter your name', 'error');
      return;
    }

    if (!scoreInput || isNaN(score) || score < 0) {
      this.showMessage('Please enter a valid score (must be 0 or greater)', 'error');
      return;
    }

    // Check if score exceeds highest by more than 20%
    const highestScore = await this.getHighestScore();

    if (highestScore !== null) {
      const maxAllowedScore = highestScore * 1.2; // 20% more than current highest

      if (score > maxAllowedScore) {
        // Lock out the user even though score was rejected
        try {
          await this.db.collection('leaderboard_users').doc(this.userId).set({
            name: name,
            score: score,
            rejected: true,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
          });

          this.hasSubmitted = true;

          // Disable form
          document.getElementById('playerName').disabled = true;
          document.getElementById('playerScore').disabled = true;
          document.getElementById('submitScoreBtn').disabled = true;

          this.showMessage(
            `Score rejected! Your score (${score}) exceeds the current highest score (${highestScore}) by more than 20%. Maximum allowed: ${Math.floor(maxAllowedScore)}`,
            'error'
          );

          // Show the leaderboard even though score was rejected
          this.loadLeaderboard();

        } catch (error) {
          console.error('Error recording rejected submission:', error);
          this.showMessage('Error recording submission: ' + error.message, 'error');
        }
        return;
      }
    }

    try {
      // Add to leaderboard collection
      await this.db.collection('leaderboard').add({
        name: name,
        score: score,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        userId: this.userId
      });

      // Mark user as submitted
      await this.db.collection('leaderboard_users').doc(this.userId).set({
        name: name,
        score: score,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

      this.hasSubmitted = true;

      // Disable form
      document.getElementById('playerName').disabled = true;
      document.getElementById('playerScore').disabled = true;
      document.getElementById('submitScoreBtn').disabled = true;

      this.showMessage('✅ Score submitted successfully!', 'success');

      // Load and show the leaderboard
      this.loadLeaderboard();

    } catch (error) {
      console.error('Error submitting score:', error);
      this.showMessage('Error submitting score: ' + error.message, 'error');
    }
  }

  async loadLeaderboard() {
    const leaderboardDisplay = document.getElementById('leaderboardDisplay');
    const leaderboardList = document.getElementById('leaderboardList');

    if (!leaderboardDisplay || !leaderboardList) return;

    // Show the leaderboard section
    leaderboardDisplay.style.display = 'block';

    try {
      const snapshot = await this.db.collection('leaderboard')
        .orderBy('score', 'desc')
        .limit(10)
        .get();

      if (snapshot.empty) {
        leaderboardList.innerHTML = '<p class="loading-message">No scores yet. Be the first!</p>';
        return;
      }

      let html = '<div class="leaderboard-table">';
      html += '<div class="leaderboard-header">';
      html += '<div class="rank-col">Rank</div>';
      html += '<div class="name-col">Name</div>';
      html += '<div class="score-col">Score</div>';
      html += '<div class="time-col">Time</div>';
      html += '</div>';

      snapshot.docs.forEach((doc, index) => {
        const data = doc.data();
        const rank = index + 1;
        const isCurrentUser = data.userId === this.userId;
        const highlightClass = isCurrentUser ? 'current-user' : '';

        let rankDisplay = rank;
        if (rank === 1) rankDisplay = '🥇';
        else if (rank === 2) rankDisplay = '🥈';
        else if (rank === 3) rankDisplay = '🥉';

        // Format timestamp
        let timeDisplay = 'N/A';
        if (data.timestamp && data.timestamp.toDate) {
          const date = data.timestamp.toDate();
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          timeDisplay = `${hours}:${minutes}`;
        }

        html += `
          <div class="leaderboard-row ${highlightClass}">
            <div class="rank-col">${rankDisplay}</div>
            <div class="name-col">${this.escapeHtml(data.name)}</div>
            <div class="score-col">${data.score.toLocaleString()}</div>
            <div class="time-col">${timeDisplay}</div>
          </div>
        `;
      });

      html += '</div>';
      leaderboardList.innerHTML = html;

    } catch (error) {
      console.error('Error loading leaderboard:', error);
      leaderboardList.innerHTML = '<p class="error-message">Error loading leaderboard</p>';
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Initialize when script loads
let leaderboardManager;
function waitForFirebase(callback, attempts = 0) {
  if (typeof firebase !== 'undefined' && firebase.firestore) {
    callback();
  } else if (attempts < 50) {
    setTimeout(() => waitForFirebase(callback, attempts + 1), 100);
  } else {
    console.error('Firebase SDK failed to load for leaderboard');
  }
}

waitForFirebase(() => {
  leaderboardManager = new LeaderboardManager();
});
