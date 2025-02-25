// Azure startup script
console.log('Starting PearTalk on Azure...');

// Create a symbolic link for proper path resolution if needed
const fs = require('fs');
const path = require('path');

// Ensure data directory exists
const dataDir = path.join(__dirname, 'backend', 'data');
if (!fs.existsSync(dataDir)) {
  console.log('Creating data directory at:', dataDir);
  fs.mkdirSync(dataDir, { recursive: true });
}

// Start the application
require('./backend/server.js'); 