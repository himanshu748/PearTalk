# PearTalk

A P2P chat application with multilingual support. PearTalk allows users to communicate in their preferred language while automatically translating messages to the recipient's language.

## Features

- User registration with email and OTP verification
- Unique ID assignment for each user
- Friend management system
- Real-time text chat with automatic translation
- Voice message recording with translation
- Support for 10 most spoken languages
- P2P architecture for direct communication

## Tech Stack

- **Backend**: Node.js, Express.js
- **Frontend**: Pure HTML, CSS, and JavaScript (no build process required)
- **Translation**: Azure AI Services for text translation and speech services
- **Authentication**: Email-based OTP system

## Prerequisites

- Node.js (v14 or later)
- npm (v6 or later)
- Azure AI Services account with Translator and Speech services

## Quick Setup

The easiest way to get started is to use our setup script:

```
node setup.js
```

This will:
1. Create a sample `.env` file if one doesn't exist
2. Install all dependencies
3. Provide instructions to start the application

## Manual Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/peartalk.git
   cd peartalk
   ```

2. Install dependencies for all packages:
   ```
   npm run install:all
   ```

3. Configure environment variables:
   - Copy `.env.example` to `.env` in the backend directory
   - Update with your actual credentials:
   ```
   # Server Configuration
   PORT=8000
   NODE_ENV=development

   # Azure AI Services Credentials
   AZURE_AI_ENDPOINT=your_azure_endpoint
   AZURE_SPEECH_TO_TEXT_ENDPOINT=your_speech_to_text_endpoint
   AZURE_TEXT_TO_SPEECH_ENDPOINT=your_text_to_speech_endpoint
   AZURE_API_KEY=your_azure_api_key

   # Email Configuration
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASS=your_email_app_password

   # P2P Configuration
   P2P_STORAGE_PATH=./data
   ```

## Running the Application

1. Start the server:
   ```
   npm start
   ```

2. Open http://localhost:8000 in your browser to use the application.

This project uses direct HTML/JS integration where the backend serves the frontend files directly, making development easier and deployment simpler.

## Deployment

### Option 1: Deploy to Render

1. **Prepare Your Repository**:
   - Push your code to a GitHub repository
   - Make sure sensitive information is in `.env` and not committed

2. **Create a Web Service on Render**:
   - Sign up or log in at [render.com](https://render.com)
   - Click "New" and select "Web Service"
   - Connect to your GitHub repository
   - Configure the service:
     - **Name**: `peartalk` (or your preferred name)
     - **Environment**: `Node`
     - **Build Command**: `npm install && npm run install:all`
     - **Start Command**: `node backend/server.js`
     - **Plan**: Free (or select your preferred plan)

3. **Set Environment Variables**:
   - In your service dashboard, go to "Environment"
   - Add all variables from your `.env` file
   - Set `NODE_ENV=production`

4. **Deploy**:
   - Render will automatically build and deploy your application
   - You'll get a URL like `https://peartalk.onrender.com`

### Option 2: Deploy to Azure

1. **Prepare Your Application**:
   - Ensure your code is in a GitHub repository

2. **Deploy to Azure App Service**:
   - Sign in to the [Azure Portal](https://portal.azure.com)
   - Create a new "Web App" resource
   - Configure the basics:
     - **Name**: `peartalk` (this will be part of your URL)
     - **Publish**: Code
     - **Runtime stack**: Node.js
     - **Operating System**: Linux
     - **Region**: Choose the closest to your users
     - **Plan**: Free tier (F1) for demos or choose an appropriate plan

3. **Set Up Deployment**:
   - Under "Deployment", choose "GitHub" as the source
   - Connect to your GitHub account and select your repository
   - Configure continuous deployment

4. **Configure Environment Variables**:
   - Go to "Configuration" under Settings
   - Add application settings for all variables from your `.env` file
   - Set `NODE_ENV=production`

5. **Custom Domain (Optional)**:
   - Under "Custom domains", you can add your own domain name

## Usage Guide

### Registration

1. Open the application and enter your email and select your preferred language.
2. Click "Register" to receive an OTP via email.
3. Enter the OTP to verify your account.
4. Your unique ID will be displayed - save this for future logins and to share with friends.

### Login

1. Use the "Login" option if you already have an account.
2. Enter your unique ID.
3. An OTP will be sent to your registered email.
4. Enter the OTP to log in.

### Adding Friends

1. Click the "Add Friend" button in the chat interface.
2. Enter your friend's unique ID.
3. Your friend will receive a friend request notification.
4. Once accepted, you can start chatting.

### Chatting

1. Select a friend from your friends list.
2. Type a message and press enter or click the send button.
3. Your message will be automatically translated to your friend's preferred language.
4. For voice messages, click the microphone icon, speak, and click the stop icon when done.

## Project Structure

```
peartalk/
├── backend/
│   ├── server.js         # Main server file with API endpoints
│   ├── package.json      # Backend dependencies
│   └── .env              # Environment variables
├── frontend/
│   ├── public/
│   │   ├── index.html    # HTML template
│   │   ├── app.js        # JavaScript file
│   │   └── styles.css    # CSS styles
│   └── package.json      # Frontend dependencies
├── package.json          # Root package.json with scripts
└── setup.js              # Setup assistant script
```

## Architecture

PearTalk uses a true peer-to-peer architecture:

- **Backend Server**: Handles user management, authentication, friend requests, and acts as a signaling server to establish P2P connections.
- **True P2P Communication**: Direct peer-to-peer communication between users using Hyperswarm and Hypercore for message exchange without server intermediation.
- **Local Storage**: Messages are stored in a distributed append-only log using Hypercore and Hyperbee.
- **Azure AI Services**: Provides real-time translation and speech processing capabilities.
- **Frontend**: Pure HTML, CSS, and JavaScript for a sleek UI without complex build systems.

## P2P Technology Stack

PearTalk uses a cutting-edge P2P stack powered by Holepunch:

- **Hyperswarm**: Discovery and connection between peers
- **Hypercore**: Append-only log for message history
- **Hyperbee**: B-tree database built on Hypercore for message indexing
- **Secretstream**: End-to-end encrypted peer connections
- **NAT Traversal**: Automatic handling of firewalls and NAT

## Advantages of HTML/JS Integration

- **Simplicity**: Direct integration of HTML, CSS, and JavaScript without build tools.
- **Easy to Understand**: Clear separation of concerns with HTML for structure, CSS for styling, and JS for functionality.
- **Quick Development**: See changes immediately without complex build processes.
- **Simple Deployment**: Backend serves the frontend files directly.
- **Better Performance**: Smaller bundle size without framework overhead.

## Limitations

- For demo purposes, this application uses in-memory storage for user data. In a production environment, it would use a database.
- Voice message quality may vary based on network conditions.

## License

MIT 