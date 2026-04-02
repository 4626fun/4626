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

Run linked migrations to set up/update tables:

```bash
# from repo root
pnpm -C frontend db:migrate
```

The `db:migrate` script is the single migration entrypoint and runs:

```bash
pnpm -C .. dlx supabase@latest migration up --linked
```

## Security

- Use Row Level Security (RLS)
- Never expose service key to client
- Use anon key for public operations
