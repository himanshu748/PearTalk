import React, { useState, useEffect, useRef } from 'react';
import {
  Container,
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Badge,
  Alert,
  CircularProgress,
  Tooltip,
  Card,
  CardContent,
} from '@mui/material';
import {
  Send as SendIcon,
  Mic as MicIcon,
  Stop as StopIcon,
  PersonAdd as PersonAddIcon,
  Notifications as NotificationsIcon,
  Refresh as RefreshIcon,
  VolumeUp as VolumeUpIcon,
} from '@mui/icons-material';
import axios from 'axios';

// API URLs
const API_URL = 'http://localhost:8000/api';

// Supported languages
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
  { code: 'fr', name: 'French' },
];

// Main App Component
function App() {
  // User state
  const [email, setEmail] = useState('');
  const [language, setLanguage] = useState('en');
  const [uniqueId, setUniqueId] = useState(localStorage.getItem('userId'));
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState(localStorage.getItem('userId') ? 'chat' : 'register');
  const [userInfo, setUserInfo] = useState(null);
  
  // Chat state
  const [friends, setFriends] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isAddFriendDialogOpen, setIsAddFriendDialogOpen] = useState(false);
  const [friendId, setFriendId] = useState('');
  const [notificationsDialogOpen, setNotificationsDialogOpen] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Refs
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const messagesEndRef = useRef(null);
  
  // Effect to load user data on initial load
  useEffect(() => {
    if (uniqueId && step === 'chat') {
      loadUserData();
    }
  }, [uniqueId, step]);
  
  // Effect to scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Effect to load messages when friend is selected
  useEffect(() => {
    if (selectedFriend) {
      fetchMessages();
      // Set up interval to refresh messages
      const interval = setInterval(fetchMessages, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedFriend]);
  
  // Load user data, friends and pending requests
  const loadUserData = async () => {
    try {
      setIsLoading(true);
      await fetchFriends();
      await fetchPendingRequests();
      setIsLoading(false);
    } catch (error) {
      setError('Failed to load user data');
      setIsLoading(false);
    }
  };
  
  // Fetch messages between user and selected friend
  const fetchMessages = async () => {
    if (!uniqueId || !selectedFriend) return;
    
    try {
      const response = await axios.get(`${API_URL}/chat/messages/${uniqueId}/${selectedFriend.id}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };
  
  // Fetch user's friends
  const fetchFriends = async () => {
    try {
      const response = await axios.get(`${API_URL}/friends/${uniqueId}`);
      setFriends(response.data);
    } catch (error) {
      console.error('Error fetching friends:', error);
    }
  };
  
  // Fetch pending friend requests
  const fetchPendingRequests = async () => {
    try {
      const response = await axios.get(`${API_URL}/friend-requests/${uniqueId}`);
      setPendingRequests(response.data);
    } catch (error) {
      console.error('Error fetching friend requests:', error);
    }
  };
  
  // Handle registration
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/register`, {
        email,
        preferredLanguage: language
      });
      
      setUniqueId(response.data.uniqueId);
      setStep('verify');
      setIsLoading(false);
    } catch (error) {
      setError(error.response?.data?.error || 'Registration failed');
      setIsLoading(false);
    }
  };
  
  // Handle OTP verification
  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/verify-otp`, {
        uniqueId,
        otp
      });
      
      localStorage.setItem('userId', uniqueId);
      setUserInfo(response.data);
      setStep('chat');
      setIsLoading(false);
    } catch (error) {
      setError(error.response?.data?.error || 'OTP verification failed');
      setIsLoading(false);
    }
  };
  
  // Handle login
  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      setIsLoading(true);
      const response = await axios.post(`${API_URL}/request-otp`, {
        uniqueId
      });
      
      setStep('verify');
      setIsLoading(false);
    } catch (error) {
      setError(error.response?.data?.error || 'User not found');
      setIsLoading(false);
    }
  };
  
  // Handle logout
  const handleLogout = () => {
    localStorage.removeItem('userId');
    setUniqueId('');
    setUserInfo(null);
    setStep('register');
    setFriends([]);
    setPendingRequests([]);
    setSelectedFriend(null);
    setMessages([]);
  };
  
  // Handle sending a message
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!newMessage.trim() || !selectedFriend) return;
    
    try {
      await axios.post(`${API_URL}/chat/message`, {
        fromId: uniqueId,
        toId: selectedFriend.id,
        message: {
          type: 'text',
          content: newMessage
        }
      });
      
      setNewMessage('');
      fetchMessages();
    } catch (error) {
      console.error('Error sending message:', error);
      setError('Failed to send message');
    }
  };
  
  // Handle sending a friend request
  const handleSendFriendRequest = async () => {
    try {
      await axios.post(`${API_URL}/friend-request`, {
        fromId: uniqueId,
        toId: friendId
      });
      
      setFriendId('');
      setIsAddFriendDialogOpen(false);
      setError('');
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to send friend request');
    }
  };
  
  // Handle responding to a friend request
  const handleRespondToFriendRequest = async (fromId, status) => {
    try {
      await axios.post(`${API_URL}/friend-request/respond`, {
        userId: uniqueId,
        fromId,
        status
      });
      
      if (status === 'accepted') {
        fetchFriends();
      }
      
      fetchPendingRequests();
      setNotificationsDialogOpen(false);
    } catch (error) {
      console.error('Error responding to friend request:', error);
      setError('Failed to respond to friend request');
    }
  };
  
  // Start recording audio
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunks.current.push(e.data);
        }
      };
      
      mediaRecorder.current.onstop = async () => {
        const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
        const reader = new FileReader();
        
        reader.onloadend = async () => {
          try {
            const base64Audio = reader.result.split(',')[1];
            
            await axios.post(`${API_URL}/chat/message`, {
              fromId: uniqueId,
              toId: selectedFriend.id,
              message: {
                type: 'voice',
                content: base64Audio
              }
            });
            
            fetchMessages();
          } catch (error) {
            console.error('Error sending voice message:', error);
            setError('Failed to send voice message');
          }
        };
        
        reader.readAsDataURL(audioBlob);
      };
      
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setError('Failed to start recording');
    }
  };
  
  // Stop recording audio
  const stopRecording = () => {
    if (mediaRecorder.current) {
      mediaRecorder.current.stop();
      setIsRecording(false);
      
      // Stop all audio tracks
      mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
    }
  };
  
  // Play audio message
  const playAudio = (audioBase64) => {
    const audio = new Audio(`data:audio/mp3;base64,${audioBase64}`);
    audio.play();
  };
  
  // Render Registration Form
  const renderRegistrationForm = () => {
    return (
      <Box component="form" onSubmit={handleRegister} sx={{ mt: 2 }}>
        <TextField
          fullWidth
          required
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          margin="normal"
        />
        
        <FormControl fullWidth margin="normal">
          <InputLabel>Preferred Language</InputLabel>
          <Select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            label="Preferred Language"
            required
          >
            {languages.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                {lang.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Register'}
        </Button>
        
        <Button
          fullWidth
          variant="text"
          onClick={() => setStep('login')}
        >
          Already have an ID? Login
        </Button>
      </Box>
    );
  };
  
  // Render Login Form
  const renderLoginForm = () => {
    return (
      <Box component="form" onSubmit={handleLogin} sx={{ mt: 2 }}>
        <TextField
          fullWidth
          required
          label="Your Unique ID"
          value={uniqueId || ''}
          onChange={(e) => setUniqueId(e.target.value)}
          margin="normal"
        />
        
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Login'}
        </Button>
        
        <Button
          fullWidth
          variant="text"
          onClick={() => setStep('register')}
        >
          Don't have an ID? Register
        </Button>
      </Box>
    );
  };
  
  // Render OTP Verification Form
  const renderOTPForm = () => {
    return (
      <Box component="form" onSubmit={handleVerifyOTP} sx={{ mt: 2 }}>
        <Alert severity="info" sx={{ mb: 2 }}>
          An OTP has been sent to your email. Please check your inbox.
        </Alert>
        
        <TextField
          fullWidth
          required
          label="Enter OTP"
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          margin="normal"
        />
        
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Verify OTP'}
        </Button>
      </Box>
    );
  };
  
  // Render Chat UI
  const renderChatUI = () => {
    return (
      <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <Box sx={{ 
          p: 2, 
          backgroundColor: 'primary.main', 
          color: 'white',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Typography variant="h6">PearTalk</Typography>
          <Box>
            <IconButton 
              color="inherit" 
              onClick={() => setIsAddFriendDialogOpen(true)}
              sx={{ ml: 1 }}
            >
              <PersonAddIcon />
            </IconButton>
            <Badge badgeContent={pendingRequests.length} color="error">
              <IconButton 
                color="inherit" 
                onClick={() => setNotificationsDialogOpen(true)}
                sx={{ ml: 1 }}
              >
                <NotificationsIcon />
              </IconButton>
            </Badge>
            <IconButton 
              color="inherit" 
              onClick={loadUserData}
              sx={{ ml: 1 }}
            >
              <RefreshIcon />
            </IconButton>
            <Button 
              color="inherit" 
              onClick={handleLogout}
              sx={{ ml: 1 }}
            >
              Logout
            </Button>
          </Box>
        </Box>
        
        {/* Main Chat Area */}
        <Box sx={{ 
          display: 'flex', 
          flexGrow: 1,
          height: 'calc(100% - 64px)',
          overflow: 'hidden'
        }}>
          {/* Friends List */}
          <Paper sx={{ 
            width: 300, 
            overflow: 'auto',
            borderRadius: 0,
            borderRight: '1px solid rgba(0, 0, 0, 0.12)'
          }}>
            <Typography variant="subtitle1" sx={{ p: 2, fontWeight: 'bold' }}>
              Friends ({friends.length})
            </Typography>
            <Divider />
            {friends.length === 0 ? (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  No friends yet. Add friends using their unique ID.
                </Typography>
                <Button 
                  variant="outlined" 
                  startIcon={<PersonAddIcon />}
                  onClick={() => setIsAddFriendDialogOpen(true)}
                  sx={{ mt: 1 }}
                >
                  Add Friend
                </Button>
              </Box>
            ) : (
              <List>
                {friends.map((friend) => (
                  <ListItem 
                    key={friend.id}
                    button
                    selected={selectedFriend?.id === friend.id}
                    onClick={() => setSelectedFriend(friend)}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: 'primary.main' }}>
                        {friend.email.charAt(0).toUpperCase()}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText 
                      primary={friend.email} 
                      secondary={`Language: ${languages.find(l => l.code === friend.preferredLanguage)?.name || friend.preferredLanguage}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
          
          {/* Chat Messages */}
          <Box sx={{ 
            flexGrow: 1, 
            display: 'flex', 
            flexDirection: 'column',
            height: '100%'
          }}>
            {selectedFriend ? (
              <>
                {/* Chat Header */}
                <Box sx={{ 
                  p: 2, 
                  borderBottom: '1px solid rgba(0, 0, 0, 0.12)',
                  display: 'flex',
                  alignItems: 'center'
                }}>
                  <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                    {selectedFriend.email.charAt(0).toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1">{selectedFriend.email}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Speaking {languages.find(l => l.code === selectedFriend.preferredLanguage)?.name || selectedFriend.preferredLanguage}
                    </Typography>
                  </Box>
                </Box>
                
                {/* Messages */}
                <Box sx={{ 
                  flexGrow: 1, 
                  overflow: 'auto',
                  p: 2,
                  backgroundColor: 'background.default'
                }}>
                  {messages.length === 0 ? (
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      height: '100%'
                    }}>
                      <Typography color="text.secondary">
                        Start your conversation with {selectedFriend.email}
                      </Typography>
                    </Box>
                  ) : (
                    messages.map((message) => (
                      <Box 
                        key={message.id}
                        sx={{ 
                          display: 'flex',
                          justifyContent: message.fromId === uniqueId ? 'flex-end' : 'flex-start',
                          mb: 2
                        }}
                      >
                        <Card 
                          sx={{ 
                            maxWidth: '70%',
                            backgroundColor: message.fromId === uniqueId ? 'primary.light' : 'background.paper'
                          }}
                        >
                          <CardContent sx={{ p: 1, '&:last-child': { pb: 1 } }}>
                            {message.type === 'text' && (
                              <Box>
                                <Typography variant="body1">{message.content}</Typography>
                                {message.originalContent && message.fromId !== uniqueId && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    Original: {message.originalContent}
                                  </Typography>
                                )}
                              </Box>
                            )}
                            
                            {message.type === 'voice' && (
                              <Box>
                                <Button 
                                  startIcon={<VolumeUpIcon />}
                                  onClick={() => playAudio(message.content)}
                                  variant="outlined"
                                  size="small"
                                >
                                  Play Voice
                                </Button>
                                {message.transcription && (
                                  <Typography variant="body2" sx={{ mt: 1 }}>
                                    Transcript: {message.transcription}
                                  </Typography>
                                )}
                                {message.originalTranscription && message.fromId !== uniqueId && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                    Original: {message.originalTranscription}
                                  </Typography>
                                )}
                              </Box>
                            )}
                            
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                              {new Date(message.timestamp).toLocaleTimeString()}
                            </Typography>
                          </CardContent>
                        </Card>
                      </Box>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </Box>
                
                {/* Message Input */}
                <Box 
                  component="form"
                  onSubmit={handleSendMessage}
                  sx={{ 
                    p: 2, 
                    borderTop: '1px solid rgba(0, 0, 0, 0.12)',
                    backgroundColor: 'background.paper',
                    display: 'flex'
                  }}
                >
                  <TextField
                    fullWidth
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={isRecording}
                    sx={{ mr: 1 }}
                  />
                  <Tooltip title={isRecording ? "Stop Recording" : "Record Voice Message"}>
                    <IconButton 
                      color={isRecording ? "error" : "primary"}
                      onClick={isRecording ? stopRecording : startRecording}
                    >
                      {isRecording ? <StopIcon /> : <MicIcon />}
                    </IconButton>
                  </Tooltip>
                  <IconButton 
                    color="primary" 
                    type="submit"
                    disabled={!newMessage.trim() || isRecording}
                  >
                    <SendIcon />
                  </IconButton>
                </Box>
              </>
            ) : (
              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center',
                height: '100%',
                backgroundColor: 'background.default',
                p: 2
              }}>
                <Box sx={{ textAlign: 'center' }}>
                  <Typography variant="h6" gutterBottom>
                    Welcome to PearTalk!
                  </Typography>
                  <Typography paragraph>
                    Select a friend from the list to start chatting or add new friends.
                  </Typography>
                  <Typography variant="subtitle2" gutterBottom>
                    Your Unique ID:
                  </Typography>
                  <Box sx={{ 
                    backgroundColor: 'background.paper',
                    p: 2,
                    border: '1px dashed',
                    borderColor: 'primary.main',
                    borderRadius: 1,
                    mb: 2
                  }}>
                    <Typography variant="body1">
                      {uniqueId}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Share this ID with your friends so they can add you
                    </Typography>
                  </Box>
                  <Button 
                    variant="contained"
                    startIcon={<PersonAddIcon />}
                    onClick={() => setIsAddFriendDialogOpen(true)}
                  >
                    Add Friend
                  </Button>
                </Box>
              </Box>
            )}
          </Box>
        </Box>
        
        {/* Add Friend Dialog */}
        <Dialog 
          open={isAddFriendDialogOpen} 
          onClose={() => setIsAddFriendDialogOpen(false)}
        >
          <DialogTitle>Add Friend</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              margin="dense"
              label="Friend's Unique ID"
              fullWidth
              value={friendId}
              onChange={(e) => setFriendId(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setIsAddFriendDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSendFriendRequest}>Add</Button>
          </DialogActions>
        </Dialog>
        
        {/* Notifications Dialog */}
        <Dialog
          open={notificationsDialogOpen}
          onClose={() => setNotificationsDialogOpen(false)}
        >
          <DialogTitle>Notifications</DialogTitle>
          <DialogContent>
            {pendingRequests.length === 0 ? (
              <Typography>No new friend requests</Typography>
            ) : (
              <List>
                {pendingRequests.map((request) => (
                  <ListItem key={request.from}>
                    <ListItemText
                      primary={request.fromEmail}
                      secondary={`Sent at ${new Date(request.createdAt).toLocaleString()}`}
                    />
                    <Button
                      color="primary"
                      onClick={() => handleRespondToFriendRequest(request.from, 'accepted')}
                    >
                      Accept
                    </Button>
                    <Button
                      color="error"
                      onClick={() => handleRespondToFriendRequest(request.from, 'rejected')}
                    >
                      Reject
                    </Button>
                  </ListItem>
                ))}
              </List>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setNotificationsDialogOpen(false)}>Close</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  };
  
  return (
    <Container maxWidth={step === 'chat' ? false : 'xs'} disableGutters={step === 'chat'}>
      {step !== 'chat' && (
        <Box sx={{ 
          mt: 8, 
          display: 'flex', 
          flexDirection: 'column',
          alignItems: 'center'
        }}>
          <Typography component="h1" variant="h4" gutterBottom>
            PearTalk
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            P2P Chat with Multilingual Support
          </Typography>
          <Paper sx={{ p: 3, width: '100%' }}>
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            
            {step === 'register' && renderRegistrationForm()}
            {step === 'login' && renderLoginForm()}
            {step === 'verify' && renderOTPForm()}
          </Paper>
        </Box>
      )}
      
      {step === 'chat' && renderChatUI()}
    </Container>
  );
}

export default App; 