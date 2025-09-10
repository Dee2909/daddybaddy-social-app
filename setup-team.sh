#!/bin/bash

# DaddyBaddy Social App - Team Setup Script
# Run this script to set up the development environment

echo "🚀 Setting up DaddyBaddy Social App for team development..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js $(node -v) detected"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✅ Dependencies installed successfully"

# Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env
    echo "⚠️  Please update .env file with your Supabase credentials"
else
    echo "✅ .env file already exists"
fi

# Create uploads directory
echo "📁 Creating uploads directory..."
mkdir -p uploads

# Set up Git hooks (if .git exists)
if [ -d .git ]; then
    echo "🔧 Setting up Git hooks..."
    
    # Create pre-commit hook
    cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
echo "🔍 Running pre-commit checks..."

# Type checking
npm run type-check
if [ $? -ne 0 ]; then
    echo "❌ TypeScript errors found. Please fix them before committing."
    exit 1
fi

echo "✅ Pre-commit checks passed"
EOF

    chmod +x .git/hooks/pre-commit
    echo "✅ Git hooks configured"
fi

# Create team directories
echo "👥 Creating team directories..."
mkdir -p team-docs
mkdir -p team-docs/meeting-notes
mkdir -p team-docs/design-assets
mkdir -p team-docs/api-docs

# Create team documentation
cat > team-docs/README.md << 'EOF'
# Team Documentation

This directory contains team-specific documentation and assets.

## Structure
- `meeting-notes/` - Meeting notes and decisions
- `design-assets/` - UI/UX designs and mockups
- `api-docs/` - API documentation and examples

## Team Members
1. [Your Name] - [Role]
2. [Team Member 2] - [Role]
3. [Team Member 3] - [Role]
4. [Team Member 4] - [Role]
5. [Team Member 5] - [Role]
6. [Team Member 6] - [Role]
7. [Team Member 7] - [Role]

## Communication
- Use GitHub Issues for bug reports
- Use Pull Requests for code reviews
- Update this file with team member information
EOF

echo "✅ Team directories created"

# Test the setup
echo "🧪 Testing the setup..."
npm run type-check

if [ $? -eq 0 ]; then
    echo "✅ TypeScript compilation successful"
else
    echo "⚠️  TypeScript errors found. Please check the output above."
fi

echo ""
echo "🎉 Setup complete! Next steps:"
echo ""
echo "1. Update .env file with your Supabase credentials"
echo "2. Run 'npm run dev' to start development"
echo "3. Visit http://localhost:3000 for frontend"
echo "4. Visit http://localhost:3001 for backend API"
echo ""
echo "📚 Read DEVELOPMENT.md for detailed development guide"
echo "👥 Update team-docs/README.md with team member information"
echo ""
echo "Happy coding! 🚀"
