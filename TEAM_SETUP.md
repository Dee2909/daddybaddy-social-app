# 👥 Team Setup Instructions

## 🚀 Quick Start for New Team Members

### 1. Prerequisites
Before starting, ensure you have:
- **Node.js 18+** - [Download here](https://nodejs.org/)
- **Git** - [Download here](https://git-scm.com/)
- **Code Editor** - VS Code recommended
- **Supabase Account** - [Sign up here](https://supabase.com/)

### 2. Repository Access
Ask the project lead for:
- GitHub repository access
- Supabase project credentials
- Team communication channels (Slack/Discord/etc.)

### 3. Initial Setup
```bash
# 1. Clone the repository
git clone [REPOSITORY_URL]
cd "DaddyBaddy Social App"

# 2. Run the team setup script
npm run team:setup

# 3. Configure environment variables
cp .env.example .env
# Edit .env with your Supabase credentials

# 4. Start development
npm run dev
```

### 4. Verify Setup
- Frontend should open at http://localhost:3000
- Backend API should be running at http://localhost:3001
- You should see the DaddyBaddy landing page

## 🔧 Development Environment

### VS Code Extensions (Recommended)
Install these extensions for better development experience:
- **ES7+ React/Redux/React-Native snippets**
- **TypeScript Importer**
- **Prettier - Code formatter**
- **ESLint**
- **Auto Rename Tag**
- **Bracket Pair Colorizer**
- **GitLens**

### VS Code Settings
Create `.vscode/settings.json`:
```json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

## 🗄️ Database Setup

### 1. Supabase Project
- Create a new Supabase project
- Get your project URL and API key
- Update `.env` file with credentials

### 2. Database Schema
Run these SQL scripts in your Supabase SQL editor:

1. **Initial Schema** - `supabase-schema.sql`
2. **Phone Support** - `update-schema-phone.sql`

### 3. Row Level Security (RLS)
Ensure RLS policies are enabled for all tables:
- `users` table
- `battles` table
- `posts` table
- `messages` table

## 🎯 First Tasks

### For Frontend Developers:
1. **Explore Components** - Check out `Client/src/components/`
2. **Study Pages** - Review `Client/src/pages/`
3. **Understand Hooks** - Look at `Client/src/hooks/`
4. **Test UI** - Make small UI improvements

### For Backend Developers:
1. **Study Routes** - Check `server/routes.ts`
2. **Database Operations** - Review `server/supabaseStorage.ts`
3. **Authentication** - Understand `server/auth.ts`
4. **API Testing** - Test endpoints with curl/Postman

### For Full-Stack Developers:
1. **End-to-End Flow** - Test complete user journey
2. **Integration** - Work on frontend-backend integration
3. **Features** - Implement new features
4. **Bug Fixes** - Fix any issues you find

## 🔄 Daily Workflow

### Morning Routine:
```bash
# 1. Pull latest changes
git checkout develop
git pull origin develop

# 2. Start development
npm run dev

# 3. Check for any issues
npm run type-check
```

### During Development:
```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add your feature description"

# Push and create PR
git push origin feature/your-feature-name
```

### End of Day:
```bash
# Commit any remaining work
git add .
git commit -m "wip: work in progress on feature"

# Push to your branch
git push origin feature/your-feature-name
```

## 🐛 Common Issues & Solutions

### Port Already in Use
```bash
# Kill existing processes
pkill -f "tsx server"
pkill -f "vite"

# Or use different ports
PORT=3002 npm run dev:server
```

### Database Connection Issues
- Check Supabase credentials in `.env`
- Verify database schema is applied
- Check RLS policies are enabled

### TypeScript Errors
```bash
# Check for errors
npm run type-check

# Fix import issues
# Check shared/types.ts for correct types
```

### Git Issues
```bash
# Reset to clean state
git stash
git checkout develop
git pull origin develop

# Start fresh
git checkout -b feature/new-feature
```

## 📞 Getting Help

### Team Communication:
- **GitHub Issues** - For bugs and feature requests
- **Pull Requests** - For code reviews
- **Team Chat** - For quick questions
- **Daily Standups** - For progress updates

### Documentation:
- **DEVELOPMENT.md** - Detailed development guide
- **TEAM_GUIDELINES.md** - Team collaboration rules
- **Code Comments** - Inline documentation

### Escalation:
1. Try to solve the issue yourself
2. Ask team members for help
3. Create GitHub issue if needed
4. Escalate to project lead if urgent

## 🎯 Success Checklist

Before considering yourself "set up":
- [ ] Can clone and run the project locally
- [ ] Can make changes and see them in browser
- [ ] Can create and push feature branches
- [ ] Can test API endpoints
- [ ] Understand the project structure
- [ ] Have access to team communication channels
- [ ] Know who to ask for help

## 🚀 Next Steps

Once you're set up:
1. **Introduce yourself** to the team
2. **Pick your first task** from the backlog
3. **Start coding** and ask questions
4. **Contribute** to team discussions
5. **Help others** when you can

---

**Welcome to the team! Let's build something amazing! 🎉**

**Need help? Don't hesitate to ask! We're all here to support each other.**
