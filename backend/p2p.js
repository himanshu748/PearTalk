/**
 * P2P Communication Module for PearTalk
 * Implements real peer-to-peer communication using Hyperswarm and Hypercore
 */

const Hyperswarm = require('hyperswarm');
const Hypercore = require('hypercore');
const Corestore = require('corestore');
const Secretstream = require('secretstream');
const Hyperbee = require('hyperbee');
const b4a = require('b4a');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');
const compact = require('compact-encoding');

// A class for managing P2P connections and message exchange
class P2PManager extends EventEmitter {
  constructor(options = {}) {
    super();
    this.userId = options.userId;
    this.storageDirectory = options.storageDirectory || path.join(__dirname, 'data', 'p2p');
    this.topics = new Map(); // Map of topics (chat rooms) to their discovery keys
    this.connections = new Map(); // Map of peer IDs to their connection state
    this.pendingMessages = new Map(); // Messages waiting to be delivered
    this.messageHandlers = new Map(); // Handlers for different message types
    
    // Ensure storage directory exists
    if (!fs.existsSync(this.storageDirectory)) {
      fs.mkdirSync(this.storageDirectory, { recursive: true });
    }
    
    // Initialize the hypercore storage
    this.store = new Corestore(path.join(this.storageDirectory, 'cores'));
    
    // Initialize the swarm for peer discovery
    this.swarm = new Hyperswarm();
    
    // Handle new connections
    this.swarm.on('connection', (socket, peerInfo) => this._handleConnection(socket, peerInfo));
    
    // Setup message database
    this._setupMessageDB();
    
    // Register message handlers
    this._registerMessageHandlers();
  }
  
  // Initialize the message database
  async _setupMessageDB() {
    const core = this.store.get({ name: 'messages' });
    this.messagesDB = new Hyperbee(core, {
      keyEncoding: compact.string,
      valueEncoding: compact.json
    });
    await this.messagesDB.ready();
    
    // Create necessary indexes
    await this._ensureIndex('sender');
    await this._ensureIndex('recipient');
    await this._ensureIndex('timestamp');
  }
  
  // Ensure an index exists
  async _ensureIndex(name) {
    try {
      await this.messagesDB.sub(name).ready();
    } catch (error) {
      console.error(`Error creating ${name} index:`, error);
    }
  }
  
  // Register message handlers for different types of messages
  _registerMessageHandlers() {
    // Text message handler
    this.messageHandlers.set('text', async (message, sender) => {
      this.emit('message', {
        type: 'text',
        content: message.content,
        sender: message.sender,
        recipient: message.recipient,
        timestamp: message.timestamp
      });
      
      // Store the message
      await this._storeMessage(message);
    });
    
    // Voice message handler
    this.messageHandlers.set('voice', async (message, sender) => {
      this.emit('message', {
        type: 'voice',
        content: message.content,
        transcription: message.transcription,
        originalTranscription: message.originalTranscription,
        sender: message.sender,
        recipient: message.recipient,
        timestamp: message.timestamp
      });
      
      // Store the message
      await this._storeMessage(message);
    });
  }
  
  // Store a message in the database
  async _storeMessage(message) {
    try {
      const key = `${message.timestamp}-${crypto.randomBytes(8).toString('hex')}`;
      await this.messagesDB.put(key, message);
      
      // Update sender index
      await this.messagesDB.sub('sender').put(`${message.sender}-${key}`, { key });
      
      // Update recipient index
      await this.messagesDB.sub('recipient').put(`${message.recipient}-${key}`, { key });
      
      // Update timestamp index
      await this.messagesDB.sub('timestamp').put(`${message.timestamp}-${key}`, { key });
    } catch (error) {
      console.error('Error storing message:', error);
    }
  }
  
  // Handle a new connection from a peer
  _handleConnection(socket, peerInfo) {
    const peerIdHex = b4a.toString(peerInfo.publicKey, 'hex');
    console.log(`New connection from peer: ${peerIdHex}`);
    
    // Set up encrypted stream
    const stream = new Secretstream(socket, {
      publicKey: peerInfo.publicKey,
      handshake: false // Handshake already done by Hyperswarm
    });
    
    // Store the connection
    this.connections.set(peerIdHex, {
      stream,
      socket,
      peerInfo,
      lastSeen: Date.now()
    });
    
    // Handle messages from this peer
    stream.on('data', data => {
      try {
        const message = JSON.parse(data.toString());
        this._handleMessage(message, peerIdHex);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    });
    
    // Handle stream closing
    stream.on('close', () => {
      console.log(`Connection closed with peer: ${peerIdHex}`);
      this.connections.delete(peerIdHex);
    });
    
    // Handle stream errors
    stream.on('error', error => {
      console.error(`Error with peer ${peerIdHex}:`, error);
      this.connections.delete(peerIdHex);
    });
    
    // Deliver any pending messages to this peer
    this._deliverPendingMessages(peerIdHex);
    
    // Notify about the new connection
    this.emit('peer-connected', peerIdHex);
  }
  
  // Handle an incoming message
  async _handleMessage(message, sender) {
    if (!message || !message.type) {
      console.error('Invalid message format');
      return;
    }
    
    // Handle the message based on its type
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      await handler(message, sender);
    } else {
      console.warn(`Unknown message type: ${message.type}`);
    }
  }
  
  // Deliver any pending messages to a newly connected peer
  _deliverPendingMessages(peerId) {
    const pendingForPeer = this.pendingMessages.get(peerId) || [];
    if (pendingForPeer.length === 0) return;
    
    const connection = this.connections.get(peerId);
    if (!connection) return;
    
    console.log(`Delivering ${pendingForPeer.length} pending messages to peer: ${peerId}`);
    
    pendingForPeer.forEach(message => {
      connection.stream.write(JSON.stringify(message));
    });
    
    // Clear pending messages for this peer
    this.pendingMessages.delete(peerId);
  }
  
  // Connect to the P2P network
  async connect() {
    console.log('Connecting to the P2P network...');
    
    // Make sure we have a valid user ID
    if (!this.userId) {
      throw new Error('User ID is required for P2P communication');
    }
    
    // Create a discovery key for the user's public profile
    const userTopic = crypto.createHash('sha256')
      .update(`peartalk-user-${this.userId}`)
      .digest();
    
    // Join the swarm with this topic
    this.swarm.join(userTopic, { server: true, client: true });
    
    console.log(`Joined P2P network with user ID: ${this.userId}`);
    console.log(`User topic: ${b4a.toString(userTopic, 'hex')}`);
    
    // Store the topic
    this.topics.set('user', userTopic);
    
    return true;
  }
  
  // Disconnect from the P2P network
  async disconnect() {
    console.log('Disconnecting from P2P network...');
    
    // Leave all topics
    for (const [name, topic] of this.topics) {
      this.swarm.leave(topic);
    }
    
    // Close all connections
    for (const [peerId, connection] of this.connections) {
      connection.stream.end();
    }
    
    // Clear state
    this.topics.clear();
    this.connections.clear();
    this.pendingMessages.clear();
    
    return true;
  }
  
  // Join a chat room (creates a topic for this conversation)
  async joinChat(friendId) {
    // Create a unique topic for this chat (consistent for both peers)
    const participants = [this.userId, friendId].sort();
    const chatTopic = crypto.createHash('sha256')
      .update(`peartalk-chat-${participants.join('-')}`)
      .digest();
      
    // Join the swarm with this topic
    this.swarm.join(chatTopic, { server: true, client: true });
    
    // Store the topic
    this.topics.set(`chat-${friendId}`, chatTopic);
    
    console.log(`Joined chat with ${friendId}, topic: ${b4a.toString(chatTopic, 'hex')}`);
    
    return true;
  }
  
  // Leave a chat
  async leaveChat(friendId) {
    const topicKey = `chat-${friendId}`;
    const topic = this.topics.get(topicKey);
    
    if (topic) {
      this.swarm.leave(topic);
      this.topics.delete(topicKey);
      console.log(`Left chat with ${friendId}`);
      return true;
    }
    
    return false;
  }
  
  // Send a message to a peer
  async sendMessage(message) {
    if (!message.recipient) {
      throw new Error('Message recipient is required');
    }
    
    // Add sender and timestamp if not present
    message.sender = message.sender || this.userId;
    message.timestamp = message.timestamp || Date.now();
    
    // Try to send directly if peer is connected
    const recipientPeerId = await this._resolvePeerId(message.recipient);
    const connection = recipientPeerId ? this.connections.get(recipientPeerId) : null;
    
    if (connection) {
      connection.stream.write(JSON.stringify(message));
      console.log(`Message sent directly to peer: ${recipientPeerId}`);
    } else {
      // Store as pending if peer is not connected
      if (!this.pendingMessages.has(recipientPeerId)) {
        this.pendingMessages.set(recipientPeerId, []);
      }
      this.pendingMessages.get(recipientPeerId).push(message);
      console.log(`Message queued for later delivery to peer: ${recipientPeerId}`);
    }
    
    // Store the message locally
    await this._storeMessage(message);
    
    return true;
  }
  
  // Resolve a user ID to a peer ID (public key)
  async _resolvePeerId(userId) {
    // In a real implementation, this would involve a discovery mechanism
    // For now, we'll use a simple hashing approach for demo purposes
    // In a production app, you'd want a proper DHT-based discovery
    
    // Create a deterministic "peer ID" from the user ID
    // NOTE: This is just for demonstration - real apps need proper peer discovery
    const hash = crypto.createHash('sha256').update(userId).digest('hex');
    return hash;
  }
  
  // Get message history for a conversation
  async getMessages(friendId, limit = 50) {
    const messages = [];
    
    // Query messages where this user is sender or recipient
    const userIsRecipient = this.messagesDB.sub('recipient').createReadStream({
      gte: `${this.userId}-`,
      lt: `${this.userId}~`
    });
    
    for await (const { value } of userIsRecipient) {
      const message = await this.messagesDB.get(value.key);
      if (message.value && message.value.sender === friendId) {
        messages.push(message.value);
      }
    }
    
    const userIsSender = this.messagesDB.sub('sender').createReadStream({
      gte: `${this.userId}-`,
      lt: `${this.userId}~`
    });
    
    for await (const { value } of userIsSender) {
      const message = await this.messagesDB.get(value.key);
      if (message.value && message.value.recipient === friendId) {
        messages.push(message.value);
      }
    }
    
    // Sort by timestamp
    messages.sort((a, b) => a.timestamp - b.timestamp);
    
    // Limit results
    return messages.slice(-limit);
  }
}

module.exports = P2PManager; 