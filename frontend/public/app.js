// PearTalk - Main JavaScript File
// Handles all functionality for the chat application

// API Configuration
const API_URL = 'http://localhost:8000/api';

// Supported Languages
const languages = [
  { code: 'en', name: 'English' },
  { code: 'es', name: 'Spanish' },
  { code: 'zh-Hans', name: 'Chinese (Simplified)' },
  { code: 'hi', name: 'Hindi' },
  { code: 'ar', name: 'Arabic' },
  { code: 'bn', name: 'Bengali' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'ja', name: 'Japanese' },
  { code: 'fr', name: 'French' }
];

// App State
const state = {
  uniqueId: localStorage.getItem('userId') || '',
  email: '',
  language: 'en',
  otp: '',
  friends: [],
  pendingRequests: [],
  selectedFriend: null,
  messages: [],
  isRecording: false,
  mediaRecorder: null,
  audioChunks: [],
  refreshInterval: null
};

// DOM Elements
const elements = {
  // Auth Elements
  authContainer: document.getElementById('auth-container'),
  registerTab: document.getElementById('register-tab'),
  loginTab: document.getElementById('login-tab'),
  registerForm: document.getElementById('register-form'),
  loginForm: document.getElementById('login-form'),
  otpForm: document.getElementById('otp-form'),
  registerEmail: document.getElementById('register-email'),
  language: document.getElementById('language'),
  uniqueId: document.getElementById('unique-id'),
  otp: document.getElementById('otp'),
  errorAlert: document.getElementById('error-alert'),
  
  // Chat Elements
  chatContainer: document.getElementById('chat-container'),
  addFriendBtn: document.getElementById('add-friend-btn'),
  notificationsBtn: document.getElementById('notifications-btn'),
  refreshBtn: document.getElementById('refresh-btn'),
  logoutBtn: document.getElementById('logout-btn'),
  friendsList: document.getElementById('friends-list'),
  friendsCount: document.getElementById('friends-count'),
  welcomeMessage: document.getElementById('welcome-message'),
  chatView: document.getElementById('chat-view'),
  messagesContainer: document.getElementById('messages-container'),
  emptyConversation: document.getElementById('empty-conversation'),
  messageForm: document.getElementById('message-form'),
  messageInput: document.getElementById('message-input'),
  voiceBtn: document.getElementById('voice-btn'),
  sendBtn: document.getElementById('send-btn'),
  userUniqueId: document.getElementById('user-unique-id'),
  selectedFriendName: document.getElementById('selected-friend-name'),
  selectedFriendLanguage: document.getElementById('selected-friend-language'),
  welcomeAddFriendBtn: document.getElementById('welcome-add-friend-btn'),
  sidebarAddFriendBtn: document.getElementById('sidebar-add-friend-btn'),
  notificationBadge: document.getElementById('notification-badge'),
  
  // Dialogs
  addFriendDialog: document.getElementById('add-friend-dialog'),
  addFriendForm: document.getElementById('add-friend-form'),
  friendId: document.getElementById('friend-id'),
  cancelAddFriend: document.getElementById('cancel-add-friend'),
  notificationsDialog: document.getElementById('notifications-dialog'),
  requestsContainer: document.getElementById('requests-container'),
  requestsList: document.getElementById('requests-list'),
  noRequestsMessage: document.getElementById('no-requests-message'),
  closeNotifications: document.getElementById('close-notifications'),
  overlay: document.getElementById('overlay')
};

// Initialize the application
function init() {
  // Set up event listeners
  setupEventListeners();
  
  // Check if user is already logged in
  if (state.uniqueId) {
    showChatInterface();
    loadUserData();
  }
}

// Set up all event listeners
function setupEventListeners() {
  // Tab switching
  elements.registerTab.addEventListener('click', () => {
    showForm('register');
  });
  
  elements.loginTab.addEventListener('click', () => {
    showForm('login');
  });
  
  // Form submissions
  elements.registerForm.addEventListener('submit', handleRegister);
  elements.loginForm.addEventListener('submit', handleLogin);
  elements.otpForm.addEventListener('submit', handleVerifyOTP);
  
  // Chat actions
  elements.logoutBtn.addEventListener('click', handleLogout);
  elements.refreshBtn.addEventListener('click', loadUserData);
  elements.messageForm.addEventListener('submit', handleSendMessage);
  
  // Friend actions
  elements.addFriendBtn.addEventListener('click', () => showDialog('addFriend'));
  elements.welcomeAddFriendBtn.addEventListener('click', () => showDialog('addFriend'));
  elements.sidebarAddFriendBtn.addEventListener('click', () => showDialog('addFriend'));
  elements.notificationsBtn.addEventListener('click', () => showDialog('notifications'));
  
  // Dialog actions
  elements.addFriendForm.addEventListener('submit', handleSendFriendRequest);
  elements.cancelAddFriend.addEventListener('click', () => hideDialog('addFriend'));
  elements.closeNotifications.addEventListener('click', () => hideDialog('notifications'));
  elements.overlay.addEventListener('click', hideAllDialogs);
  
  // Voice recording
  elements.voiceBtn.addEventListener('click', toggleRecording);
}

// Show registration or login form
function showForm(formType) {
  elements.registerTab.classList.toggle('active', formType === 'register');
  elements.loginTab.classList.toggle('active', formType === 'login');
  
  elements.registerForm.style.display = formType === 'register' ? 'block' : 'none';
  elements.loginForm.style.display = formType === 'login' ? 'block' : 'none';
  elements.otpForm.style.display = 'none';
  
  hideError();
}

// Show OTP verification form
function showOtpForm() {
  elements.registerForm.style.display = 'none';
  elements.loginForm.style.display = 'none';
  elements.otpForm.style.display = 'block';
}

// Show error message
function showError(message) {
  elements.errorAlert.textContent = message;
  elements.errorAlert.style.display = 'block';
}

// Hide error message
function hideError() {
  elements.errorAlert.style.display = 'none';
}

// Handle registration
async function handleRegister(e) {
  e.preventDefault();
  hideError();
  
  state.email = elements.registerEmail.value;
  state.language = elements.language.value;
  
  try {
    showLoading();
    
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: state.email,
        preferredLanguage: state.language
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Registration failed');
    }
    
    state.uniqueId = data.uniqueId;
    showOtpForm();
    hideLoading();
  } catch (error) {
    hideLoading();
    showError(error.message);
  }
}

// Handle login
async function handleLogin(e) {
  e.preventDefault();
  hideError();
  
  state.uniqueId = elements.uniqueId.value;
  
  try {
    showLoading();
    
    const response = await fetch(`${API_URL}/request-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uniqueId: state.uniqueId
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'User not found');
    }
    
    showOtpForm();
    hideLoading();
  } catch (error) {
    hideLoading();
    showError(error.message);
  }
}

// Handle OTP verification
async function handleVerifyOTP(e) {
  e.preventDefault();
  hideError();
  
  state.otp = elements.otp.value;
  
  try {
    showLoading();
    
    const response = await fetch(`${API_URL}/verify-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uniqueId: state.uniqueId,
        otp: state.otp
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'OTP verification failed');
    }
    
    localStorage.setItem('userId', state.uniqueId);
    
    showChatInterface();
    loadUserData();
    hideLoading();
  } catch (error) {
    hideLoading();
    showError(error.message);
  }
}

// Show chat interface
function showChatInterface() {
  elements.authContainer.style.display = 'none';
  elements.chatContainer.style.display = 'flex';
  elements.userUniqueId.textContent = state.uniqueId;
  
  // Set up message refresh interval
  if (state.refreshInterval) {
    clearInterval(state.refreshInterval);
  }
  
  state.refreshInterval = setInterval(() => {
    if (state.selectedFriend) {
      fetchMessages();
    }
    fetchPendingRequests();
  }, 5000);
}

// Load user data
async function loadUserData() {
  try {
    await fetchFriends();
    await fetchPendingRequests();
  } catch (error) {
    console.error('Error loading user data:', error);
    showError('Failed to load user data');
  }
}

// Fetch friends
async function fetchFriends() {
  try {
    const response = await fetch(`${API_URL}/friends/${state.uniqueId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch friends');
    }
    
    const data = await response.json();
    state.friends = data;
    
    // Update friends list in UI
    renderFriendsList();
  } catch (error) {
    console.error('Error fetching friends:', error);
  }
}

// Fetch pending requests
async function fetchPendingRequests() {
  try {
    const response = await fetch(`${API_URL}/friend-requests/${state.uniqueId}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch friend requests');
    }
    
    const data = await response.json();
    state.pendingRequests = data;
    
    // Update notification badge
    updateNotificationBadge();
  } catch (error) {
    console.error('Error fetching friend requests:', error);
  }
}

// Update notification badge
function updateNotificationBadge() {
  if (state.pendingRequests.length > 0) {
    elements.notificationBadge.textContent = state.pendingRequests.length;
    elements.notificationBadge.style.display = 'flex';
  } else {
    elements.notificationBadge.style.display = 'none';
  }
}

// Render friends list
function renderFriendsList() {
  // Clear current list
  const emptyFriends = document.querySelector('.empty-friends');
  if (emptyFriends) {
    elements.friendsList.removeChild(emptyFriends);
  }
  
  // Remove existing friend items
  const friendItems = document.querySelectorAll('.friend-item');
  friendItems.forEach(item => {
    elements.friendsList.removeChild(item);
  });
  
  // Update friends count
  elements.friendsCount.textContent = `(${state.friends.length})`;
  
  // Check if there are any friends
  if (state.friends.length === 0) {
    const emptyFriendsEl = document.createElement('div');
    emptyFriendsEl.className = 'empty-friends';
    emptyFriendsEl.innerHTML = `
      <p>No friends yet. Add friends using their unique ID.</p>
      <button id="empty-add-friend-btn" class="btn btn-outline">
        <span class="material-icons">person_add</span> Add Friend
      </button>
    `;
    elements.friendsList.appendChild(emptyFriendsEl);
    
    // Add event listener to the new button
    document.getElementById('empty-add-friend-btn').addEventListener('click', () => showDialog('addFriend'));
    return;
  }
  
  // Add friend items
  state.friends.forEach(friend => {
    const friendItem = document.createElement('div');
    friendItem.className = 'friend-item';
    if (state.selectedFriend && state.selectedFriend.id === friend.id) {
      friendItem.classList.add('active');
    }
    
    friendItem.innerHTML = `
      <div class="friend-avatar">${friend.email.charAt(0).toUpperCase()}</div>
      <div class="friend-info">
        <h4>${friend.email}</h4>
        <p>Language: ${languages.find(l => l.code === friend.preferredLanguage)?.name || friend.preferredLanguage}</p>
      </div>
    `;
    
    // Add click event to select this friend
    friendItem.addEventListener('click', () => selectFriend(friend));
    
    elements.friendsList.appendChild(friendItem);
  });
}

// Select a friend
function selectFriend(friend) {
  state.selectedFriend = friend;
  
  // Update UI
  elements.welcomeMessage.style.display = 'none';
  elements.chatView.style.display = 'flex';
  
  // Update selected friend info
  elements.selectedFriendName.textContent = friend.email;
  elements.selectedFriendLanguage.textContent = 
    `Speaking ${languages.find(l => l.code === friend.preferredLanguage)?.name || friend.preferredLanguage}`;
  
  // Update friend avatar
  const friendAvatar = document.querySelector('.friend-avatar');
  friendAvatar.textContent = friend.email.charAt(0).toUpperCase();
  
  // Enable message input and buttons
  elements.messageInput.disabled = false;
  elements.voiceBtn.disabled = false;
  elements.sendBtn.disabled = false;
  
  // Highlight selected friend in the list
  renderFriendsList();
  
  // Fetch messages
  fetchMessages();
}

// Fetch messages
async function fetchMessages() {
  if (!state.selectedFriend) return;
  
  try {
    const response = await fetch(`${API_URL}/chat/messages/${state.uniqueId}/${state.selectedFriend.id}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch messages');
    }
    
    const data = await response.json();
    state.messages = data;
    
    // Render messages
    renderMessages();
  } catch (error) {
    console.error('Error fetching messages:', error);
  }
}

// Render messages
function renderMessages() {
  // Clear container
  while (elements.messagesContainer.firstChild) {
    elements.messagesContainer.removeChild(elements.messagesContainer.firstChild);
  }
  
  // Check if there are any messages
  if (state.messages.length === 0) {
    const emptyConversation = document.createElement('div');
    emptyConversation.className = 'empty-conversation';
    emptyConversation.innerHTML = `<p>Start your conversation with ${state.selectedFriend.email}</p>`;
    elements.messagesContainer.appendChild(emptyConversation);
    return;
  }
  
  // Add message bubbles
  state.messages.forEach(message => {
    const isSent = message.fromId === state.uniqueId;
    const messageEl = document.createElement('div');
    messageEl.className = `message-bubble ${isSent ? 'message-sent' : 'message-received'}`;
    
    if (message.type === 'text') {
      messageEl.innerHTML = `
        <div class="message-content">${message.content}</div>
        ${!isSent && message.originalContent ? 
          `<div class="original-text">Original: ${message.originalContent}</div>` : ''}
        <div class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</div>
      `;
    } else if (message.type === 'voice') {
      messageEl.innerHTML = `
        <div class="voice-message">
          <button class="btn btn-outline play-voice">
            <span class="material-icons">volume_up</span> Play Voice
          </button>
        </div>
        ${message.transcription ? 
          `<div class="message-content">Transcript: ${message.transcription}</div>` : ''}
        ${!isSent && message.originalTranscription ? 
          `<div class="original-text">Original: ${message.originalTranscription}</div>` : ''}
        <div class="message-time">${new Date(message.timestamp).toLocaleTimeString()}</div>
      `;
      
      // Add event listener to play button (after it's added to DOM)
      setTimeout(() => {
        const playButton = messageEl.querySelector('.play-voice');
        if (playButton) {
          playButton.addEventListener('click', () => playAudio(message.content));
        }
      }, 0);
    }
    
    elements.messagesContainer.appendChild(messageEl);
  });
  
  // Scroll to bottom
  elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

// Handle send message
async function handleSendMessage(e) {
  e.preventDefault();
  
  const messageText = elements.messageInput.value.trim();
  if (!messageText || !state.selectedFriend) return;
  
  try {
    const response = await fetch(`${API_URL}/chat/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fromId: state.uniqueId,
        toId: state.selectedFriend.id,
        message: {
          type: 'text',
          content: messageText
        }
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    
    // Clear input
    elements.messageInput.value = '';
    
    // Refresh messages
    fetchMessages();
  } catch (error) {
    console.error('Error sending message:', error);
    alert('Failed to send message. Please try again.');
  }
}

// Handle send friend request
async function handleSendFriendRequest(e) {
  e.preventDefault();
  
  const friendId = elements.friendId.value.trim();
  if (!friendId) return;
  
  try {
    const response = await fetch(`${API_URL}/friend-request`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fromId: state.uniqueId,
        toId: friendId
      })
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || 'Failed to send friend request');
    }
    
    // Clear input and hide dialog
    elements.friendId.value = '';
    hideDialog('addFriend');
    
    // Show success message
    alert('Friend request sent successfully!');
  } catch (error) {
    console.error('Error sending friend request:', error);
    alert(error.message);
  }
}

// Show dialog
function showDialog(dialogType) {
  elements.overlay.style.display = 'block';
  
  if (dialogType === 'addFriend') {
    elements.addFriendDialog.style.display = 'block';
  } else if (dialogType === 'notifications') {
    elements.notificationsDialog.style.display = 'block';
    renderFriendRequests();
  }
}

// Hide dialog
function hideDialog(dialogType) {
  if (dialogType === 'addFriend') {
    elements.addFriendDialog.style.display = 'none';
  } else if (dialogType === 'notifications') {
    elements.notificationsDialog.style.display = 'none';
  }
  
  elements.overlay.style.display = 'none';
}

// Hide all dialogs
function hideAllDialogs() {
  elements.addFriendDialog.style.display = 'none';
  elements.notificationsDialog.style.display = 'none';
  elements.overlay.style.display = 'none';
}

// Render friend requests
function renderFriendRequests() {
  // Clear current list
  elements.requestsList.innerHTML = '';
  
  // Check if there are any requests
  if (state.pendingRequests.length === 0) {
    elements.noRequestsMessage.style.display = 'block';
    return;
  }
  
  elements.noRequestsMessage.style.display = 'none';
  
  // Add request items
  state.pendingRequests.forEach(request => {
    const requestItem = document.createElement('li');
    requestItem.className = 'request-item';
    requestItem.innerHTML = `
      <div class="request-info">${request.fromEmail}</div>
      <div class="request-time">Sent at ${new Date(request.createdAt).toLocaleString()}</div>
      <div class="request-actions">
        <button class="btn btn-primary accept-btn">Accept</button>
        <button class="btn btn-text reject-btn">Reject</button>
      </div>
    `;
    
    // Add event listeners to buttons
    setTimeout(() => {
      const acceptBtn = requestItem.querySelector('.accept-btn');
      const rejectBtn = requestItem.querySelector('.reject-btn');
      
      acceptBtn.addEventListener('click', () => handleRespondToFriendRequest(request.from, 'accepted'));
      rejectBtn.addEventListener('click', () => handleRespondToFriendRequest(request.from, 'rejected'));
    }, 0);
    
    elements.requestsList.appendChild(requestItem);
  });
}

// Handle respond to friend request
async function handleRespondToFriendRequest(fromId, status) {
  try {
    const response = await fetch(`${API_URL}/friend-request/respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: state.uniqueId,
        fromId,
        status
      })
    });
    
    if (!response.ok) {
      throw new Error('Failed to respond to friend request');
    }
    
    // Refresh friend requests and friends if accepted
    if (status === 'accepted') {
      await fetchFriends();
    }
    
    await fetchPendingRequests();
    
    // Re-render friend requests
    renderFriendRequests();
  } catch (error) {
    console.error('Error responding to friend request:', error);
    alert('Failed to respond to friend request. Please try again.');
  }
}

// Handle logout
function handleLogout() {
  // Clear local storage
  localStorage.removeItem('userId');
  
  // Clear state
  state.uniqueId = '';
  state.email = '';
  state.friends = [];
  state.pendingRequests = [];
  state.selectedFriend = null;
  state.messages = [];
  
  // Clear intervals
  if (state.refreshInterval) {
    clearInterval(state.refreshInterval);
    state.refreshInterval = null;
  }
  
  // Reset UI
  elements.authContainer.style.display = 'flex';
  elements.chatContainer.style.display = 'none';
  elements.registerForm.style.display = 'block';
  elements.loginForm.style.display = 'none';
  elements.otpForm.style.display = 'none';
  elements.registerTab.classList.add('active');
  elements.loginTab.classList.remove('active');
  
  // Clear form values
  elements.registerEmail.value = '';
  elements.language.value = 'en';
  elements.uniqueId.value = '';
  elements.otp.value = '';
  elements.messageInput.value = '';
  
  hideError();
}

// Toggle recording
async function toggleRecording() {
  if (state.isRecording) {
    stopRecording();
  } else {
    startRecording();
  }
}

// Start recording
async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    state.mediaRecorder = new MediaRecorder(stream);
    state.audioChunks = [];
    
    state.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        state.audioChunks.push(e.data);
      }
    };
    
    state.mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(state.audioChunks, { type: 'audio/wav' });
      
      // Convert blob to base64
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        const base64Audio = reader.result.split(',')[1];
        
        try {
          const response = await fetch(`${API_URL}/chat/message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              fromId: state.uniqueId,
              toId: state.selectedFriend.id,
              message: {
                type: 'voice',
                content: base64Audio
              }
            })
          });
          
          if (!response.ok) {
            throw new Error('Failed to send voice message');
          }
          
          // Refresh messages
          fetchMessages();
        } catch (error) {
          console.error('Error sending voice message:', error);
          alert('Failed to send voice message. Please try again.');
        }
      };
    };
    
    state.mediaRecorder.start();
    state.isRecording = true;
    
    // Update UI
    elements.voiceBtn.innerHTML = '<span class="material-icons recording">stop</span>';
  } catch (error) {
    console.error('Error starting recording:', error);
    alert('Failed to start recording. Please check your microphone permissions.');
  }
}

// Stop recording
function stopRecording() {
  if (state.mediaRecorder) {
    state.mediaRecorder.stop();
    state.isRecording = false;
    
    // Stop all audio tracks
    state.mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    // Update UI
    elements.voiceBtn.innerHTML = '<span class="material-icons">mic</span>';
  }
}

// Play audio
function playAudio(audioBase64) {
  const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
  audio.play();
}

// Show loading
function showLoading() {
  // Implement loading UI
  console.log('Loading...');
}

// Hide loading
function hideLoading() {
  // Implement loading UI
  console.log('Loading complete');
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', init);
