import { Hypercore, Network } from '@pear/bare'
import { ChatClient, ChatMessage } from '@azure/communication-chat'
import { AzureCommunicationTokenCredential } from '@azure/communication-common'
import { CommunicationIdentityClient } from '@azure/communication-identity'

class ChatRoom {
  constructor() {
    this.core = null
    this.network = null
    this.username = localStorage.getItem('username') || 'User' + Math.random().toString(36).slice(2, 7)
    this.messageCallback = null
    this.connectionCallback = null
    this.peers = new Set()
    this.language = localStorage.getItem('language') || 'en'
    
    // Azure-specific properties
    this.azureChatClient = null
    this.azureChatThreadClient = null
    this.userId = null
    this.accessToken = null
  }

  async translateText(text, targetLang) {
    try {
      const endpoint = process.env.AZURE_AI_SERVICES_ENDPOINT
      const response = await fetch(`${endpoint}/translate?api-version=3.0&to=${targetLang}`, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': process.env.AZURE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify([{ text }])
      })

      if (!response.ok) throw new Error('Translation failed')
      const data = await response.json()
      return data[0].translations[0].text
    } catch (err) {
      console.error('Translation error:', err)
      return text // Return original text if translation fails
    }
  }

  async initializeAzure() {
    try {
      // Initialize Azure Communication Services
      const identityClient = new CommunicationIdentityClient(process.env.AZURE_COMMUNICATION_CONNECTION_STRING)
      
      // Create a user and get token
      const user = await identityClient.createUser()
      this.userId = user.communicationUserId
      const tokenResponse = await identityClient.getToken(user, ["chat"])
      this.accessToken = tokenResponse.token

      // Initialize chat client
      const credential = new AzureCommunicationTokenCredential(this.accessToken)
      this.azureChatClient = new ChatClient(process.env.AZURE_CHAT_ENDPOINT, credential)
      
      return true
    } catch (err) {
      console.error('Azure init error:', err)
      return false
    }
  }

  async initialize(roomKey = null) {
    try {
      // Initialize P2P
      this.core = new Hypercore(roomKey || 'chat-' + Date.now())
      await this.core.ready()

      // Set up P2P networking
      this.network = new Network(this.core)
      
      this.network.on('peer-add', peer => {
        this.peers.add(peer)
        this.updateConnectionStatus()
      })

      this.network.on('peer-remove', peer => {
        this.peers.delete(peer)
        this.updateConnectionStatus()
      })

      // Initialize Azure in parallel
      const azureInitialized = await this.initializeAzure()
      if (azureInitialized) {
        // Create or join Azure chat thread
        if (!roomKey) {
          const createChatThreadResult = await this.azureChatClient.createChatThread({
            topic: "PearTalk Chat"
          })
          this.azureChatThreadClient = this.azureChatClient.getChatThreadClient(createChatThreadResult.chatThread.id)
        } else {
          this.azureChatThreadClient = this.azureChatClient.getChatThreadClient(roomKey)
        }

        // Start receiving Azure messages
        this.azureChatClient.startRealtimeNotifications()
        this.azureChatClient.on("chatMessageReceived", (e) => {
          this.handleAzureMessage(e)
        })
      }

      // Load existing messages
      await this.loadHistory()

      // Listen for new P2P messages
      this.core.on('append', () => this.loadLatest())

      return this.core.key.toString('hex')
    } catch (err) {
      console.error('Init error:', err)
      throw err
    }
  }

  async handleAzureMessage(e) {
    const message = {
      text: e.message.content.message,
      user: e.sender.displayName || 'Unknown User',
      time: new Date(e.message.createdOn).getTime()
    }
    this.displayMessage(message)
  }

  async sendMessage(text) {
    if (!text.trim()) return false
    try {
      const msg = {
        text: text.trim(),
        user: this.username,
        time: Date.now(),
        originalLang: this.language,
        translations: {}
      }

      // Pre-translate to common languages
      const commonLangs = ['en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'hi']
      for (const lang of commonLangs) {
        if (lang !== this.language) {
          msg.translations[lang] = await this.translateText(text, lang)
        }
      }

      // Send via P2P
      await this.core.append(JSON.stringify(msg))

      // Send via Azure if available
      if (this.azureChatThreadClient) {
        await this.azureChatThreadClient.sendMessage({ content: text })
      }

      return true
    } catch (err) {
      console.error('Send error:', err)
      return false
    }
  }

  async loadHistory() {
    try {
      const length = this.core.length
      if (length === 0) return

      // Load last 50 messages or all if less
      const start = Math.max(0, length - 50)
      for (let i = start; i < length; i++) {
        const data = await this.core.get(i)
        await this.processMessage(JSON.parse(data.toString()))
      }
    } catch (err) {
      console.error('History load error:', err)
    }
  }

  async loadLatest() {
    try {
      const data = await this.core.get(this.core.length - 1)
      await this.processMessage(JSON.parse(data.toString()))
    } catch (err) {
      console.error('Load error:', err)
    }
  }

  async processMessage(msg) {
    // Translate if needed and not already translated
    if (msg.originalLang !== this.language && !msg.translations[this.language]) {
      msg.translations[this.language] = await this.translateText(msg.text, this.language)
    }

    if (this.messageCallback) {
      this.messageCallback(msg)
    }
  }

  displayMessage(msg) {
    if (this.messageCallback) {
      this.messageCallback(msg)
    }
  }

  updateConnectionStatus() {
    if (this.connectionCallback) {
      this.connectionCallback({
        connected: this.peers.size > 0 || (this.azureChatThreadClient != null),
        peerCount: this.peers.size,
        hasAzure: this.azureChatThreadClient != null
      })
    }
  }

  setLanguage(lang) {
    this.language = lang
    localStorage.setItem('language', lang)
    // Reload messages to update translations
    this.loadHistory()
  }

  onMessage(callback) {
    this.messageCallback = callback
  }

  onConnection(callback) {
    this.connectionCallback = callback
    this.updateConnectionStatus()
  }

  async cleanup() {
    try {
      // Cleanup P2P
      if (this.network) {
        await this.network.destroy()
      }
      if (this.core) {
        await this.core.close()
      }

      // Cleanup Azure
      if (this.azureChatClient) {
        await this.azureChatClient.stopRealtimeNotifications()
      }
    } catch (err) {
      console.error('Cleanup error:', err)
    }
  }
}

// Export for window
window.chatRoom = new ChatRoom()