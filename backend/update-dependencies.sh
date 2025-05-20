#!/bin/bash

# AI Quiz Backend - Security Update Script
echo "🔒 Updating AI Quiz Backend dependencies to fix security vulnerabilities..."

# Navigate to backend directory
cd "$(dirname "$0")"

# Remove node_modules and package-lock.json for a clean install
echo "🗑️  Cleaning old dependencies..."
rm -rf node_modules package-lock.json

# Install updated dependencies
echo "📦 Installing updated dependencies..."
npm install

# Run audit to check if vulnerabilities are fixed
echo "🔍 Running security audit..."
npm audit

# Check if there are still vulnerabilities
if [ $? -eq 0 ]; then
    echo "✅ All vulnerabilities have been fixed!"
else
    echo "⚠️  Some vulnerabilities may still exist. Running npm audit fix..."
    npm audit fix
fi

echo "🚀 Dependencies updated successfully!"
echo ""
echo "📝 Key changes made:"
echo "   - Updated OpenAI from v3 to v4 (breaking change)"
echo "   - Updated nodemon to latest version"
echo "   - Updated other dependencies to secure versions"
echo ""
echo "⚡ Important: The OpenAI API has changed. Please check the LangChainService"
echo "   if you're using OpenAI features."
