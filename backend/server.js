const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const nodemailer = require('nodemailer');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');
const P2PManager = require('./p2p');

// Add Application Insights for monitoring when in Azure
let appInsights = null;
if (process.env.APPLICATIONINSIGHTS_CONNECTION_STRING) {
  const { ApplicationInsights } = require('applicationinsights');
  appInsights = new ApplicationInsights();
  appInsights.setup(process.env.APPLICATIONINSIGHTS_CONNECTION_STRING)
    .setAutoDependencyCorrelation(true)
    .setAutoCollectRequests(true)
    .setAutoCollectPerformance(true)
    .setAutoCollectExceptions(true)
    .setAutoCollectDependencies(true)
    .setAutoCollectConsole(true)
    .setUseDiskRetryCaching(true)
    .start();
  console.log('Application Insights initialized');
}

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from the frontend/public directory
app.use(express.static(path.join(__dirname, '../frontend/public')));

// Serve static files from the frontend/build directory if it exists (for production)
if (fs.existsSync(path.join(__dirname, '../frontend/build'))) {
  app.use(express.static(path.join(__dirname, '../frontend/build')));
}

// In-memory data storage
const users = new Map();
const otps = new Map();
const friends = new Map();
const friendRequests = new Map();
const messages = new Map();

// Ensure data directory exists
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Configure email transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Azure AI Services configuration
const azureEndpoint = process.env.AZURE_AI_ENDPOINT;
const azureApiKey = process.env.AZURE_API_KEY;
const azureSpeechToTextEndpoint = process.env.AZURE_SPEECH_TO_TEXT_ENDPOINT;
const azureTextToSpeechEndpoint = process.env.AZURE_TEXT_TO_SPEECH_ENDPOINT;

// Initialize P2P Manager
const p2pManagers = new Map(); // Map of user IDs to their P2P managers

// Function to get or create a P2P manager for a user
function getP2PManager(userId) {
  if (!p2pManagers.has(userId)) {
    const manager = new P2PManager({
      userId,
      storageDirectory: path.join(dataDir, 'p2p', userId)
    });
    
    // Listen for P2P messages
    manager.on('message', async (message) => {
      console.log(`P2P message received for user ${userId}:`, message.type);
      
      // Process message (e.g., translation for text messages)
      if (message.type === 'text' && message.sender !== userId) {
        const receiverLanguage = users.get(userId)?.preferredLanguage;
        if (receiverLanguage) {
          try {
            // Translate the message content
            const translatedText = await translateText(message.content, receiverLanguage);
            message.originalContent = message.content;
            message.content = translatedText;
          } catch (error) {
            console.error('Translation error in P2P message:', error);
          }
        }
      }
    });
    
    // Connect to P2P network
    manager.connect().catch(err => {
      console.error(`Error connecting user ${userId} to P2P network:`, err);
    });
    
    p2pManagers.set(userId, manager);
  }
  
  return p2pManagers.get(userId);
}

// Helper functions
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendOTPEmail(email, otp) {
  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: 'PearTalk: Your OTP',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #4CAF50;">PearTalk Verification</h2>
        <p>Your one-time password (OTP) for PearTalk is:</p>
        <h1 style="font-size: 32px; letter-spacing: 5px; text-align: center; margin: 30px 0; color: #333;">${otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this OTP, please ignore this email.</p>
      </div>
    `
  };

  return transporter.sendMail(mailOptions);
}

// Get Azure token for AI services
async function getAzureToken() {
  try {
    const response = await axios.post(
      `${azureEndpoint}/sts/v1.0/issuetoken`,
      {},
      {
        headers: {
          'Ocp-Apim-Subscription-Key': azureApiKey,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('Error getting Azure token:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Translate text using Azure AI services
async function translateText(text, targetLanguage) {
  try {
    const token = await getAzureToken();
    const response = await axios.post(
      `${azureEndpoint}/translator/text/v3.0/translate?api-version=3.0&to=${targetLanguage}`,
      [{ text }],
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data[0].translations[0].text;
  } catch (error) {
    console.error('Translation error:', error.response ? error.response.data : error.message);
    return text; // Return original text if translation fails
  }
}

// Convert speech to text using Azure AI services
async function speechToText(audioBuffer) {
  try {
    const token = await getAzureToken();
    const response = await axios.post(
      `${azureSpeechToTextEndpoint}/speech/recognition/conversation/cognitiveservices/v1`,
      audioBuffer,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'audio/wav'
        },
        params: {
          'language': 'en-US'
        }
      }
    );
    return response.data.DisplayText;
  } catch (error) {
    console.error('Speech to text error:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Convert text to speech using Azure AI services
async function textToSpeech(text, language) {
  try {
    const token = await getAzureToken();
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="${language}">
        <voice name="en-US-JennyNeural">
          ${text}
        </voice>
      </speak>
    `;
    
    const response = await axios.post(
      `${azureTextToSpeechEndpoint}/cognitiveservices/v1`,
      ssml,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': 'audio-16khz-128kbitrate-mono-mp3'
        },
        responseType: 'arraybuffer'
      }
    );
    
    return Buffer.from(response.data).toString('base64');
  } catch (error) {
    console.error('Text to speech error:', error.response ? error.response.data : error.message);
    throw error;
  }
}

// Language list
const supportedLanguages = [
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

// API routes

// Add health check endpoint for Azure
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok', version: '1.0.0', environment: process.env.NODE_ENV });
});

// Get supported languages
app.get('/api/languages', (req, res) => {
  res.json(supportedLanguages);
});

// Register a new user
app.post('/api/register', async (req, res) => {
  try {
    const { email, preferredLanguage } = req.body;

    // Check if email is already registered
    for (const [id, user] of users.entries()) {
      if (user.email === email) {
        // Generate and send OTP for existing user
        const otp = generateOTP();
        otps.set(email, {
          code: otp,
          expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
        });
        try {
          await sendOTPEmail(email, otp);
          return res.json({ uniqueId: id, message: 'OTP sent to your email' });
        } catch (emailError) {
          console.error('Email sending error:', emailError);
          return res.status(500).json({ error: 'Failed to send OTP email. Please check email configuration.' });
        }
      }
    }

    // Create new user with a unique ID
    const uniqueId = uuidv4();
    const otp = generateOTP();
    
    // Store OTP
    otps.set(email, {
      code: otp,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });
    
    // Store user
    users.set(uniqueId, {
      email,
      uniqueId,
      preferredLanguage,
      createdAt: Date.now()
    });
    
    // Initialize empty friends list
    friends.set(uniqueId, []);
    
    // Initialize P2P for this user
    getP2PManager(uniqueId);
    
    // Send OTP email
    try {
      await sendOTPEmail(email, otp);
      res.status(201).json({ uniqueId, message: 'OTP sent to your email' });
    } catch (emailError) {
      console.error('Email sending error:', emailError);
      // Clean up the created user since email failed
      users.delete(uniqueId);
      friends.delete(uniqueId);
      otps.delete(email);
      res.status(500).json({ error: 'Failed to send OTP email. Please check email configuration.' });
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: `Registration failed: ${error.message}` });
  }
});

// Verify OTP
app.post('/api/verify-otp', async (req, res) => {
  try {
    const { uniqueId, otp } = req.body;
    
    // Get user
    const user = users.get(uniqueId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get stored OTP
    const storedOTP = otps.get(user.email);
    if (!storedOTP) {
      return res.status(400).json({ error: 'OTP expired or not found' });
    }
    
    // Verify OTP
    if (storedOTP.code !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }
    
    if (storedOTP.expiresAt < Date.now()) {
      otps.delete(user.email);
      return res.status(400).json({ error: 'OTP expired' });
    }
    
    // OTP verified, delete it
    otps.delete(user.email);
    
    // Return user info
    res.json({
      uniqueId: user.uniqueId,
      email: user.email,
      preferredLanguage: user.preferredLanguage
    });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: 'OTP verification failed' });
  }
});

// Request login OTP
app.post('/api/request-otp', async (req, res) => {
  try {
    const { uniqueId } = req.body;
    
    // Find user
    const user = users.get(uniqueId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Generate OTP
    const otp = generateOTP();
    
    // Store OTP
    otps.set(user.email, {
      code: otp,
      expiresAt: Date.now() + 10 * 60 * 1000 // 10 minutes
    });
    
    // Send OTP email
    await sendOTPEmail(user.email, otp);
    
    res.json({ message: 'OTP sent to your email', email: user.email });
  } catch (error) {
    console.error('OTP request error:', error);
    res.status(500).json({ error: 'Failed to send OTP' });
  }
});

// Send friend request
app.post('/api/friend-request', async (req, res) => {
  try {
    const { fromId, toId } = req.body;
    
    // Check if users exist
    if (!users.has(fromId) || !users.has(toId)) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if they are already friends
    const userFriends = friends.get(fromId) || [];
    if (userFriends.includes(toId)) {
      return res.status(400).json({ error: 'Already friends' });
    }
    
    // Check if request already exists
    const requestKey = `${fromId}:${toId}`;
    if (friendRequests.has(requestKey)) {
      return res.status(400).json({ error: 'Friend request already sent' });
    }
    
    // Store friend request
    friendRequests.set(requestKey, {
      from: fromId,
      to: toId,
      status: 'pending',
      createdAt: Date.now()
    });
    
    res.status(201).json({ message: 'Friend request sent' });
  } catch (error) {
    console.error('Friend request error:', error);
    res.status(500).json({ error: 'Failed to send friend request' });
  }
});

// Respond to friend request
app.post('/api/friend-request/respond', async (req, res) => {
  try {
    const { userId, fromId, status } = req.body;
    
    // Check if users exist
    if (!users.has(userId) || !users.has(fromId)) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if request exists
    const requestKey = `${fromId}:${userId}`;
    if (!friendRequests.has(requestKey)) {
      return res.status(404).json({ error: 'Friend request not found' });
    }
    
    // Update request status
    const request = friendRequests.get(requestKey);
    request.status = status;
    request.updatedAt = Date.now();
    friendRequests.set(requestKey, request);
    
    // If accepted, add both users to each other's friends lists
    if (status === 'accepted') {
      const userFriends = friends.get(userId) || [];
      const fromFriends = friends.get(fromId) || [];
      
      if (!userFriends.includes(fromId)) {
        userFriends.push(fromId);
        friends.set(userId, userFriends);
      }
      
      if (!fromFriends.includes(userId)) {
        fromFriends.push(userId);
        friends.set(fromId, fromFriends);
      }
      
      // Initialize P2P chat between these users
      const userP2P = getP2PManager(userId);
      const friendP2P = getP2PManager(fromId);
      
      // Join the same chat topic
      await userP2P.joinChat(fromId);
      await friendP2P.joinChat(userId);
    }
    
    res.json({ message: `Friend request ${status}` });
  } catch (error) {
    console.error('Friend request response error:', error);
    res.status(500).json({ error: 'Failed to respond to friend request' });
  }
});

// Get pending friend requests
app.get('/api/friend-requests/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    if (!users.has(userId)) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Find pending requests for this user
    const pendingRequests = [];
    for (const [key, request] of friendRequests.entries()) {
      if (request.to === userId && request.status === 'pending') {
        const fromUser = users.get(request.from);
        pendingRequests.push({
          from: request.from,
          fromEmail: fromUser.email,
          createdAt: request.createdAt
        });
      }
    }
    
    res.json(pendingRequests);
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Failed to get friend requests' });
  }
});

// Get user's friends
app.get('/api/friends/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    if (!users.has(userId)) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get friends list
    const userFriends = friends.get(userId) || [];
    
    // Get friend details
    const friendDetails = userFriends.map(friendId => {
      const friend = users.get(friendId);
      return {
        id: friendId,
        email: friend.email,
        preferredLanguage: friend.preferredLanguage
      };
    });
    
    res.json(friendDetails);
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to get friends' });
  }
});

// Get user language
app.get('/api/user/language/:userId', (req, res) => {
  try {
    const { userId } = req.params;
    
    // Check if user exists
    const user = users.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({ language: user.preferredLanguage });
  } catch (error) {
    console.error('Get user language error:', error);
    res.status(500).json({ error: 'Failed to get user language' });
  }
});

// Send message
app.post('/api/chat/message', async (req, res) => {
  try {
    const { fromId, toId, message } = req.body;
    
    // Check if users exist
    if (!users.has(fromId) || !users.has(toId)) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if they are friends
    const userFriends = friends.get(fromId) || [];
    if (!userFriends.includes(toId)) {
      return res.status(403).json({ error: 'Not friends with this user' });
    }
    
    // Get user's P2P manager
    const p2pManager = getP2PManager(fromId);
    
    // Process message based on type
    let processedMessage = { ...message };
    
    if (message.type === 'text') {
      // No need to translate here - translation happens on receiver side
      processedMessage.originalContent = message.content;
    } 
    else if (message.type === 'voice') {
      // Process voice message
      // 1. Transcribe audio to text
      const transcribedText = await speechToText(Buffer.from(message.content, 'base64'));
      processedMessage.originalTranscription = transcribedText;
    }
    
    // Add message metadata
    const messageData = {
      ...processedMessage,
      sender: fromId,
      recipient: toId,
      timestamp: Date.now(),
      id: uuidv4()
    };
    
    // Send via P2P
    await p2pManager.sendMessage(messageData);
    
    res.status(201).json(messageData);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get messages
app.get('/api/chat/messages/:userId/:friendId', async (req, res) => {
  try {
    const { userId, friendId } = req.params;
    
    // Check if users exist
    if (!users.has(userId) || !users.has(friendId)) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get message history from P2P storage
    const p2pManager = getP2PManager(userId);
    const messages = await p2pManager.getMessages(friendId);
    
    res.json(messages);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Failed to get messages' });
  }
});

// Translate text endpoint
app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLanguage } = req.body;
    const translatedText = await translateText(text, targetLanguage);
    res.json({ translatedText });
  } catch (error) {
    console.error('Translation API error:', error);
    res.status(500).json({ error: 'Translation failed' });
  }
});

// Speech to text endpoint
app.post('/api/speech-to-text', async (req, res) => {
  try {
    const { audioBuffer } = req.body;
    const transcribedText = await speechToText(Buffer.from(audioBuffer, 'base64'));
    res.json({ transcribedText });
  } catch (error) {
    console.error('Speech to text API error:', error);
    res.status(500).json({ error: 'Speech to text failed' });
  }
});

// Text to speech endpoint
app.post('/api/text-to-speech', async (req, res) => {
  try {
    const { text, language } = req.body;
    const audioBuffer = await textToSpeech(text, language);
    res.json({ audioBuffer });
  } catch (error) {
    console.error('Text to speech API error:', error);
    res.status(500).json({ error: 'Text to speech failed' });
  }
});

// Periodic cleanup for expired OTPs
setInterval(() => {
  const now = Date.now();
  for (const [email, otpData] of otps.entries()) {
    if (otpData.expiresAt < now) {
      otps.delete(email);
    }
  }
}, 15 * 60 * 1000); // Run every 15 minutes

// Add a cleanup function for P2P when shutting down
function cleanupP2P() {
  console.log('Closing all P2P connections...');
  for (const [userId, manager] of p2pManagers) {
    manager.disconnect().catch(err => {
      console.error(`Error disconnecting user ${userId} from P2P network:`, err);
    });
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  cleanupP2P();
  setTimeout(() => {
    console.log('Shutting down server...');
    process.exit(0);
  }, 500);
});

process.on('SIGTERM', () => {
  cleanupP2P();
  if (appInsights) {
    appInsights.flush({ isAppCrashing: false });
  }
  setTimeout(() => {
    console.log('Azure shutdown signal received, gracefully shutting down...');
    process.exit(0);
  }, 1000);
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Catch-all route handler for client-side routing
app.get('*', (req, res) => {
  // Serve index.html for any routes not handled by the server
  if (fs.existsSync(path.join(__dirname, '../frontend/build/index.html'))) {
    // For production build
    res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
  } else {
    // For development
    res.sendFile(path.join(__dirname, '../frontend/public/index.html'));
  }
}); 