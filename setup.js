/**
 * PearTalk Setup Script
 * This script helps users set up the PearTalk application quickly.
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n====================================');
console.log('🍐 PearTalk - Setup Assistant');
console.log('====================================\n');

console.log('This script will help you set up PearTalk.\n');

// Check if .env file exists
const envFile = path.join(__dirname, 'backend', '.env');
const envExists = fs.existsSync(envFile);

if (!envExists) {
  console.log('❓ Would you like to create a .env file with sample configuration? (y/n)');
  rl.question('> ', (answer) => {
    if (answer.toLowerCase() === 'y') {
      createEnvFile();
    }
    
    installDependencies();
  });
} else {
  console.log('✅ .env file already exists.\n');
  installDependencies();
}

function createEnvFile() {
  console.log('\n📝 Creating .env file...');
  
  const envContent = `# Server Configuration
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
P2P_STORAGE_PATH=./data`;

  fs.writeFileSync(envFile, envContent);
  console.log('✅ .env file created. Please update it with your credentials before running the app.\n');
}

function installDependencies() {
  console.log('\n📦 Installing dependencies...');
  console.log('This may take a few minutes...\n');
  
  try {
    execSync('npm run install:all', { stdio: 'inherit' });
    console.log('\n✅ Dependencies installed successfully!\n');
    
    console.log('====================================');
    console.log('🎉 PearTalk is ready to use!');
    console.log('====================================');
    console.log('\nTo start the application:');
    console.log('1. Update the .env file with your Azure and email credentials');
    console.log('2. Run `npm start` to start the server');
    console.log('3. Open http://localhost:8000 in your browser\n');
    
    rl.close();
  } catch (error) {
    console.error('\n❌ Error installing dependencies:', error.message);
    console.log('\nPlease try running `npm run install:all` manually.\n');
    rl.close();
  }
} 