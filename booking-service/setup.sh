#!/bin/bash

# Booking Service Setup Script
# Run this to set up the development environment

set -e

echo "🚀 Setting up Booking Service..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker Desktop and try again."
    exit 1
fi

# Create .env if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cp .env.example .env
fi

# Start infrastructure
echo "🐳 Starting PostgreSQL and Redis..."
docker compose up -d postgres redis

# Wait for services to be healthy
echo "⏳ Waiting for services to be ready..."
sleep 5

# Check service health
echo "🏥 Checking service health..."
docker compose ps

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "🗄 Running database migrations..."
npx prisma migrate dev --name init

echo ""
echo "✅ Setup complete!"
echo ""
echo "📡 Start the service with: npm run dev"
echo "🌐 API will be available at: http://localhost:3000"
echo "🏥 Health check: http://localhost:3000/health"
echo ""
echo "🧪 Run tests with: npm test"
echo "🧪 Run concurrency tests with: npm run test:concurrency"
