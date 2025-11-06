# Vercel CLI Commands

Quick reference for Vercel deployment and management commands.

## Prerequisites

The Vercel CLI is installed as a dev dependency. You can run commands using `npx vercel` or use the npm scripts below.

## NPM Scripts (Recommended)

### Deployment
```bash
npm run vercel:preview   # Deploy to preview environment (feature branches)
npm run vercel:deploy    # Deploy to production
```

### Monitoring
```bash
npm run vercel:logs              # View recent logs (all deployments)
npm run vercel:logs:production   # View production logs only
npm run vercel:env               # List environment variables
npm run vercel:inspect           # Get detailed deployment info
```

### Cache Management
```bash
npm run cache:stats        # View current cache statistics (local dev only)
npm run cache:invalidate   # Invalidate all ingredient caches (local dev only)
```

**Note:** Cache commands require dev server running (`npm run dev`)

## Direct Vercel CLI Commands

### Authentication
```bash
npx vercel login          # Login to Vercel account
npx vercel whoami         # Check current user
```

### Deployment
```bash
npx vercel                # Deploy to preview
npx vercel --prod         # Deploy to production
npx vercel ls             # List all deployments
npx vercel rm [url]       # Remove a deployment
```

### Logs and Monitoring
```bash
npx vercel logs [url]           # View logs for specific deployment
npx vercel logs --prod          # View production logs
npx vercel logs --follow        # Stream logs in real-time
npx vercel inspect [url]        # Get detailed deployment info
```

### Environment Variables
```bash
npx vercel env ls               # List all environment variables
npx vercel env add              # Add new environment variable
npx vercel env rm [name]        # Remove environment variable
npx vercel env pull             # Download env vars to .env.local
```

### Domains
```bash
npx vercel domains ls           # List all domains
npx vercel domains add [domain] # Add a new domain
```

### Projects
```bash
npx vercel projects ls          # List all projects
npx vercel link                 # Link local directory to Vercel project
```

## Common Workflows

### Deploy Feature Branch for Testing
```bash
git checkout -b feature/my-feature
# Make changes...
git push origin feature/my-feature
npm run vercel:preview
# Get preview URL, test, then merge to main
```

### View Production Errors
```bash
npm run vercel:logs:production
```

### Invalidate Cache After Database Migration
```bash
# Option 1: Via API (requires app running)
npm run cache:invalidate

# Option 2: Force redeployment (always works)
git commit --allow-empty -m "Clear cache"
git push origin main
```

### Check Deployment Status
```bash
npx vercel ls
npx vercel inspect [deployment-url]
```

## Cache Invalidation API

### Endpoints

**POST /api/admin/invalidate-cache**
- Invalidates all ingredient caches (GRAS, NDI, ODI)
- Requires authentication
- Returns: `{ success: true, message: "...", timestamp: "..." }`

**GET /api/admin/invalidate-cache**
- Returns current cache statistics
- Requires authentication
- Returns cache age, expiration time, and validity status

### When to Use Cache Invalidation

1. **After Database Migrations** - When you update ingredient data in Supabase
2. **After Importing New Data** - When adding new GRAS/NDI/ODI ingredients
3. **Troubleshooting** - When you suspect stale cache is causing issues

### Cache Behavior

- **TTL**: 24 hours (defined in `lib/ingredient-cache.ts`)
- **Storage**: In-memory (per Vercel serverless function instance)
- **Auto-refresh**: Happens automatically when cache expires or server restarts
- **Manual clear**: Use API endpoint or trigger redeployment

## Troubleshooting

### "Command not found: vercel"
Run `npm install` to ensure Vercel CLI is installed as dev dependency.

### Cache invalidation not working
- Check if dev server is running (`npm run dev`)
- For production: trigger a redeployment instead
- Verify you're authenticated when calling the API

### Environment variables not updating
```bash
npx vercel env pull       # Pull latest from Vercel
# Or update directly in Vercel Dashboard and redeploy
```

## Additional Resources

- [Vercel CLI Documentation](https://vercel.com/docs/cli)
- [Vercel Deployment Documentation](https://vercel.com/docs/deployments/overview)
- [Environment Variables Guide](https://vercel.com/docs/projects/environment-variables)
