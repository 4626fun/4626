---
title: Supabase Setup
sidebar_position: 4
---

# Supabase Setup

Configure Supabase for backend services.

## Create Project

1. Create account at [supabase.com](https://supabase.com)
2. Create new project
3. Copy connection strings

## Environment Variables

```bash
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
```

## Database Schema

Run migrations to set up tables:

```bash
pnpm supabase db push
```

## Security

- Use Row Level Security (RLS)
- Never expose service key to client
- Use anon key for public operations
