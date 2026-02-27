---
title: Domain Setup
sidebar_position: 3
---

# Domain Setup

Configure custom domains for your 4626 deployment.

## Vercel Setup

1. Add domain in Vercel project settings
2. Configure DNS records
3. Enable HTTPS

## DNS Configuration

| Type | Name | Value |
|------|------|-------|
| A | @ | 76.76.21.21 |
| CNAME | www | cname.vercel-dns.com |

## SSL Certificate

Vercel automatically provisions SSL certificates.

## Environment Variables

Update `VITE_APP_URL` for production:

```bash
VITE_APP_URL=https://yourdomain.com
```
