# Supabase Setup Instructions

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up/Login and create a new project
3. Choose a region close to your users
4. Set a strong database password
5. Wait for the project to be created

## 2. Get Project Credentials

1. Go to your project dashboard
2. Navigate to Settings > API
3. Copy the following values:
   - **Project URL** (SUPABASE_URL)
   - **anon public** key (SUPABASE_ANON_KEY)
   - **service_role** key (SUPABASE_SERVICE_ROLE_KEY)

## 3. Set Environment Variables

Create a `.env` file in the project root with:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Server Configuration
PORT=3000
NODE_ENV=development

# JWT Secret (for production, use a strong secret)
JWT_SECRET=your-super-secret-jwt-key-change-in-production
```

## 4. Set Up Database Schema

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase-schema.sql`
4. Run the SQL script to create all tables and policies

## 5. Configure Authentication

1. Go to Authentication > Settings in your Supabase dashboard
2. Configure your site URL (e.g., `http://localhost:3000`)
3. Add any additional redirect URLs if needed

## 6. Test the Setup

1. Start the development server: `npm run dev`
2. Visit `http://localhost:3000`
3. Try registering a new user
4. Check the Supabase dashboard to see the data

## 7. Production Considerations

- Use environment variables for all secrets
- Set up proper RLS policies for your use case
- Configure CORS settings
- Set up database backups
- Monitor usage and performance

## Troubleshooting

- **Connection issues**: Check your environment variables
- **RLS errors**: Verify your Row Level Security policies
- **CORS errors**: Update your site URL in Supabase settings
- **Type errors**: Make sure all imports are updated to use `@shared/types`
