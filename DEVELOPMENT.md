# DaddyBaddy Social App - Development Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Git
- Supabase account

### Environment Setup
1. Clone the repository
2. Copy `.env.example` to `.env` and fill in your values
3. Install dependencies: `npm install`
4. Start development: `npm run dev`

## 🏗️ Project Structure

```
DaddyBaddy Social App/
├── Client/                 # Frontend (React + TypeScript)
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/         # Page components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utilities and API client
├── server/                # Backend (Express + TypeScript)
│   ├── routes.ts          # API route definitions
│   ├── authRoutes.ts      # Authentication routes
│   └── supabaseStorage.ts # Database operations
├── shared/                # Shared types and utilities
└── Documents/             # Project documentation

```

## 🔧 Development Commands

```bash
# Install dependencies
npm install

# Start development (frontend + backend)
npm run dev

# Start only frontend
npm run dev:client

# Start only backend
npm run dev:server

# Build for production
npm run build

# Type checking
npm run type-check

# Linting
npm run lint
```

## 🌐 Environment Variables

Create a `.env` file with:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# JWT Secret
JWT_SECRET=your_jwt_secret

# Email Configuration (optional)
EMAIL_USER=your_email
EMAIL_PASS=your_email_password

# Server Configuration
PORT=3001
NODE_ENV=development
```

## 🗄️ Database Setup

1. Create a Supabase project
2. Run the SQL schema from `supabase-schema.sql`
3. Update RLS policies from `update-schema-phone.sql`
4. Configure environment variables

## 🎯 Development Workflow

### Branch Strategy
- `main` - Production-ready code
- `develop` - Integration branch
- `feature/feature-name` - Feature development
- `bugfix/bug-description` - Bug fixes

### Git Workflow
1. Create feature branch from `develop`
2. Make changes and commit
3. Push branch and create Pull Request
4. Code review and merge to `develop`
5. Deploy from `develop` to `main`

## 👥 Team Roles & Responsibilities

### Frontend Developers
- Work in `Client/src/` directory
- Focus on UI/UX components and pages
- Ensure responsive design
- Handle client-side state management

### Backend Developers
- Work in `server/` directory
- API endpoint development
- Database operations
- Authentication and security

### Full-Stack Developers
- Work across both frontend and backend
- Integration between client and server
- End-to-end feature development

## 🐛 Common Issues & Solutions

### Port Conflicts
- Frontend runs on port 3000
- Backend runs on port 3001
- If ports are busy, kill processes: `pkill -f "tsx server"`

### Database Connection Issues
- Check Supabase credentials in `.env`
- Verify database schema is applied
- Check RLS policies

### TypeScript Errors
- Run `npm run type-check` to identify issues
- Ensure all imports are correct
- Check type definitions in `shared/types.ts`

## 📝 Code Standards

### TypeScript
- Use strict typing
- Define interfaces in `shared/types.ts`
- Avoid `any` types when possible

### React
- Use functional components with hooks
- Follow naming conventions (PascalCase for components)
- Keep components small and focused

### API Design
- RESTful endpoints
- Consistent error handling
- Proper HTTP status codes
- Input validation

## 🔐 Security Guidelines

- Never commit `.env` files
- Use environment variables for secrets
- Validate all inputs
- Implement proper authentication
- Follow OWASP guidelines

## 📊 Testing

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

## 🚀 Deployment

### Development
- Use `npm run dev` for local development
- Frontend: http://localhost:3000
- Backend: http://localhost:3001

### Production
- Build: `npm run build`
- Deploy to your hosting platform
- Configure production environment variables

## 📞 Support & Communication

- Use GitHub Issues for bug reports
- Use Pull Requests for code reviews
- Document all changes in commit messages
- Keep the team updated on progress

## 🔄 Regular Maintenance

- Update dependencies regularly
- Review and refactor code
- Update documentation
- Monitor performance
- Security audits

---

**Happy Coding! 🎉**
