# 🚀 GitHub Repository Setup Guide

## Step 1: Create GitHub Repository

### Option A: Using GitHub Website
1. Go to [GitHub.com](https://github.com)
2. Click **"New repository"**
3. Repository name: `daddybaddy-social-app`
4. Description: `Photo battle platform - React + TypeScript + Supabase`
5. Set to **Private** (recommended for team projects)
6. Don't initialize with README (we already have files)
7. Click **"Create repository"**

### Option B: Using GitHub CLI (if installed)
```bash
# Install GitHub CLI first: https://cli.github.com/
gh repo create daddybaddy-social-app --private --description "Photo battle platform - React + TypeScript + Supabase"
```

## Step 2: Connect Local Repository to GitHub

```bash
# Navigate to your project directory
cd "DaddyBaddy Social App"

# Initialize Git (if not already done)
git init

# Add all files
git add .

# Create initial commit
git commit -m "Initial commit: DaddyBaddy Social App with team setup"

# Add GitHub remote
git remote add origin https://github.com/YOUR_USERNAME/daddybaddy-social-app.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 3: Add Team Members

1. Go to your repository on GitHub
2. Click **Settings** → **Manage access**
3. Click **Invite a collaborator**
4. Add each team member's GitHub username or email
5. Set permission level to **Write** (allows them to push changes)
6. They'll receive an invitation email

## Step 4: Team Members Join

Each team member should:

1. **Accept the GitHub invitation** (check email)
2. **Clone the repository:**
   ```bash
   git clone https://github.com/YOUR_USERNAME/daddybaddy-social-app.git
   cd daddybaddy-social-app
   ```

3. **Run team setup:**
   ```bash
   npm run team:setup
   ```

4. **Configure environment:**
   ```bash
   # Copy environment template
   cp .env.example .env
   
   # Edit .env with Supabase credentials
   # (You'll need to share these with your team)
   ```

5. **Start development:**
   ```bash
   npm run dev
   ```

## Step 5: Development Workflow

### Daily Workflow for Team Members:
```bash
# 1. Pull latest changes
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/their-feature-name

# 3. Make changes and commit
git add .
git commit -m "feat: add their feature description"

# 4. Push and create Pull Request
git push origin feature/their-feature-name
# Then create PR on GitHub website
```

### For You (Project Lead):
```bash
# Review Pull Requests on GitHub
# Merge approved changes
# Deploy to production when ready
```

## 🔐 Sharing Sensitive Information

### Supabase Credentials
Create a secure way to share:
1. **Encrypted message** (Signal, WhatsApp)
2. **Password manager** (1Password, LastPass)
3. **Secure document** (Google Docs with restricted access)

### Environment Variables Template
```env
# Share this template with your team
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
JWT_SECRET=your_jwt_secret_here
EMAIL_USER=your_email_here
EMAIL_PASS=your_email_password_here
PORT=3001
NODE_ENV=development
```

## 📱 VS Code Live Share (Optional)

For real-time collaboration:
1. Install **Live Share** extension in VS Code
2. Start a Live Share session
3. Share the session link with team members
4. Work together in real-time

## 🎯 Next Steps

1. **Create the GitHub repository**
2. **Add your team members**
3. **Share Supabase credentials securely**
4. **Schedule team kickoff meeting**
5. **Assign initial tasks**

---

**Need help with any of these steps? Let me know!**
