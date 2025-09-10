# 👥 Team Collaboration Guidelines

## 🎯 Project Overview
**DaddyBaddy Social App** - A photo battle platform where users can challenge friends and vote on photos.

## 🏗️ Architecture
- **Frontend**: React + TypeScript + Vite
- **Backend**: Express + TypeScript + Supabase
- **Database**: PostgreSQL (via Supabase)
- **Authentication**: JWT + Custom Auth

## 👥 Team Structure

### Recommended Roles:
1. **Project Lead** - Overall coordination and architecture decisions
2. **Frontend Lead** - UI/UX and React components
3. **Backend Lead** - API development and database design
4. **Full-Stack Developer 1** - Feature integration
5. **Full-Stack Developer 2** - Feature integration
6. **DevOps/Deployment** - Infrastructure and deployment
7. **QA/Testing** - Testing and quality assurance

## 🔄 Development Workflow

### 1. Getting Started
```bash
# Clone the repository
git clone [repository-url]
cd "DaddyBaddy Social App"

# Run team setup
npm run team:setup

# Start development
npm run dev
```

### 2. Branch Strategy
```
main (production)
├── develop (integration)
    ├── feature/authentication
    ├── feature/battle-system
    ├── feature/user-profiles
    ├── feature/chat-system
    └── bugfix/login-issue
```

### 3. Feature Development Process
1. **Create Feature Branch**
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Development**
   - Make small, focused commits
   - Write descriptive commit messages
   - Test your changes locally

3. **Code Review**
   ```bash
   git push origin feature/your-feature-name
   # Create Pull Request on GitHub
   ```

4. **Merge to Develop**
   - Get at least 1 approval
   - Resolve any conflicts
   - Merge and delete feature branch

## 📁 File Organization

### Frontend (`Client/src/`)
```
components/          # Reusable UI components
├── ui/             # Basic UI components (buttons, inputs)
├── BattleCard.tsx  # Battle-specific components
├── PostCard.tsx    # Post-specific components
└── UserCard.tsx    # User-specific components

pages/              # Page components
├── Home.tsx        # Main feed page
├── Profile.tsx     # User profile page
├── Create.tsx      # Battle creation page
├── BattleDetail.tsx # Battle details page
├── Chats.tsx       # Chat page
└── Ranking.tsx     # Leaderboard page

hooks/              # Custom React hooks
├── useAuth.ts      # Authentication hook
├── useWebSocket.ts # WebSocket hook
└── use-toast.ts    # Toast notifications

lib/                # Utilities
├── queryClient.ts  # API client
├── authUtils.ts    # Auth utilities
└── utils.ts        # General utilities
```

### Backend (`server/`)
```
routes.ts           # Main API routes
authRoutes.ts       # Authentication routes
supabaseStorage.ts  # Database operations
auth.ts            # Auth middleware
index.ts           # Server entry point
```

### Shared (`shared/`)
```
types.ts           # TypeScript type definitions
```

## 🎨 Code Standards

### TypeScript
- Use strict typing
- Define interfaces in `shared/types.ts`
- Avoid `any` types
- Use meaningful variable names

### React Components
```typescript
// Good example
interface UserCardProps {
  user: User;
  onSelect?: (user: User) => void;
  isSelected?: boolean;
}

export function UserCard({ user, onSelect, isSelected = false }: UserCardProps) {
  // Component logic
}
```

### API Endpoints
```typescript
// Good example
app.get('/api/users/search', isAuthenticated, async (req: any, res) => {
  try {
    const { q } = req.query;
    const currentUserId = req.user.id;
    const users = await storage.searchUsers(q as string, currentUserId);
    res.json(users);
  } catch (error) {
    console.error("Error searching users:", error);
    res.status(500).json({ message: "Failed to search users" });
  }
});
```

## 🔐 Security Guidelines

### Environment Variables
- Never commit `.env` files
- Use different credentials for each environment
- Rotate secrets regularly

### Authentication
- Always validate user input
- Use proper JWT token handling
- Implement rate limiting

### Database
- Use parameterized queries
- Implement proper RLS policies
- Validate all data before storage

## 🧪 Testing Strategy

### Manual Testing
- Test all user flows
- Verify responsive design
- Check error handling
- Test authentication flows

### API Testing
```bash
# Test authentication
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"test@example.com","password":"password"}'

# Test user search
curl -X GET "http://localhost:3000/api/users/search?q=test" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## 📝 Documentation

### Code Documentation
- Comment complex logic
- Document API endpoints
- Update README files
- Keep team docs updated

### Commit Messages
```
feat: add user search functionality
fix: resolve authentication token issue
docs: update API documentation
refactor: improve component structure
test: add unit tests for auth utils
```

## 🚀 Deployment

### Development
- Use `npm run dev` for local development
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Staging
- Deploy to staging environment
- Test with real data
- Get team approval

### Production
- Deploy from `main` branch
- Monitor performance
- Handle errors gracefully

## 🐛 Bug Reporting

### Bug Report Template
```
**Bug Description**
Brief description of the bug

**Steps to Reproduce**
1. Go to...
2. Click on...
3. See error

**Expected Behavior**
What should happen

**Actual Behavior**
What actually happens

**Environment**
- OS: [e.g., macOS, Windows, Linux]
- Browser: [e.g., Chrome, Firefox, Safari]
- Version: [e.g., 1.0.0]

**Screenshots**
If applicable, add screenshots

**Additional Context**
Any other relevant information
```

## 📞 Communication

### Daily Standups
- What did you work on yesterday?
- What are you working on today?
- Any blockers or issues?

### Weekly Reviews
- Review completed features
- Plan upcoming work
- Address any concerns

### Emergency Issues
- Use GitHub Issues for bugs
- Tag relevant team members
- Escalate if needed

## 🎯 Success Metrics

### Code Quality
- No TypeScript errors
- All tests passing
- Code reviews completed
- Documentation updated

### Team Collaboration
- Regular communication
- Clear task assignments
- Timely code reviews
- Knowledge sharing

## 🔄 Continuous Improvement

### Regular Retrospectives
- What went well?
- What could be improved?
- Action items for next sprint

### Learning Opportunities
- Share new technologies
- Code review sessions
- Pair programming
- Knowledge sharing sessions

---

**Remember: We're a team! Let's build something amazing together! 🚀**
