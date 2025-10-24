#!/bin/bash

echo "🚀 Starting PlexCash Mobile Development Server..."

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "⚠️  Warning: Node.js version $NODE_VERSION detected. This project requires Node.js 20+."
    echo "   Please update Node.js: https://nodejs.org/"
    echo "   Continuing anyway, but you may encounter issues..."
fi

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Update Expo to the expected version
echo "🔧 Checking Expo version..."
npx expo install --fix

# Clear cache and start fresh
echo "🧹 Clearing cache and starting development server..."
npx expo start --clear --tunnel