# Monorepo Development Setup Guide

## Problem

How to configure dependencies so that:
- **During development**: Packages use the current local code (workspace links)
- **When published**: Packages reference specific published versions

## Solution: npm Workspaces

npm Workspaces automatically handles this for you! Here's how to set it up:

### Step 1: Configure Root package.json

Add a `workspaces` field to your root `package.json`:

```json
{
  "name": "@zrcni/distributed-saga",
  "version": "0.0.5-alpha.1",
  "workspaces": [
    "packages/*",
    "examples/*"
  ],
  "scripts": {
    "build:all": "npm run build --workspaces --if-present",
    "clean:all": "npm run clean --workspaces --if-present",
    "install:all": "npm install"
  }
}
```

### Step 2: Keep Version References in Package Dependencies

In your packages, keep the version numbers in dependencies:

**packages/express/package.json:**
```json
{
  "name": "@zrcni/distributed-saga-board-express",
  "version": "0.0.5-alpha.2",
  "dependencies": {
    "@zrcni/distributed-saga-board-api": "^0.0.5-alpha.1",
    "@zrcni/distributed-saga-board-ui": "^0.0.5-alpha.2",
    "ejs": "^3.1.9"
  },
  "peerDependencies": {
    "@zrcni/distributed-saga": "^0.0.5-alpha.1"
  }
}
```

**packages/api/package.json:**
```json
{
  "name": "@zrcni/distributed-saga-board-api",
  "version": "0.0.5-alpha.1",
  "peerDependencies": {
    "@zrcni/distributed-saga": "^0.0.5-alpha.1"
  }
}
```

### Step 3: Install Dependencies

Run from the root:

```bash
npm install
```

**What happens:**
- npm automatically creates symlinks in `node_modules` for workspace packages
- During development: `packages/express/node_modules/@zrcni/distributed-saga-board-api` → `../../api`
- When published: Users get the actual published version based on the version in package.json

### Step 4: Verify Workspace Links

Check that workspace links are created:

```bash
ls -la packages/express/node_modules/@zrcni/
```

You should see symlinks like:
```
distributed-saga-board-api -> ../../../api
distributed-saga-board-ui -> ../../../ui
```

## How It Works

### During Development

1. **npm install** sees workspace packages and creates symlinks
2. Your code imports: `import { SagaAdapter } from '@zrcni/distributed-saga-board-api'`
3. Node resolves this to: `packages/api/src/index.ts` (via symlink)
4. You get live code updates without rebuilding

### During Publishing

1. **npm publish** reads the version from `dependencies` in package.json
2. Published package has: `"@zrcni/distributed-saga-board-api": "^0.0.5-alpha.1"`
3. Users who install your package get the published version from npm registry
4. No workspace symlinks exist for end users

## Benefits

✅ **Automatic**: No manual linking needed  
✅ **DX**: Hot reload works across packages  
✅ **Correct versions**: Published packages reference proper versions  
✅ **Type safety**: TypeScript sees the actual source code  
✅ **No special scripts**: Works with standard npm commands  

## Common Commands

### Install all dependencies
```bash
npm install
```

### Build all packages
```bash
npm run build --workspaces --if-present
```

### Build specific package
```bash
npm run build --workspace=packages/api
```

### Run tests across all packages
```bash
npm test --workspaces --if-present
```

### Add dependency to specific package
```bash
npm install express --workspace=packages/express
```

## Example: Adding a New Package Dependency

If `packages/express` needs to use `packages/api`:

1. **Add to package.json** (with version):
   ```json
   {
     "dependencies": {
       "@zrcni/distributed-saga-board-api": "^0.0.5-alpha.1"
     }
   }
   ```

2. **Run npm install** from root:
   ```bash
   npm install
   ```

3. **Import in code**:
   ```typescript
   import { SagaAdapter } from '@zrcni/distributed-saga-board-api'
   ```

4. **During development**: Uses local `packages/api/src`
5. **When published**: Uses published version `^0.0.5-alpha.1`

## Version Management

### Keep Versions in Sync

When releasing:

1. Update version in all relevant packages
2. Update dependency versions to match
3. Run `npm install` to update lock file
4. Commit changes
5. Publish packages

### Automated with Changesets (Recommended)

Install changesets for automated version management:

```bash
npm install -D @changesets/cli
npx changeset init
```

Create a changeset:
```bash
npx changeset
```

Version and publish:
```bash
npx changeset version
npx changeset publish
```

## Troubleshooting

### Workspace Links Not Created?

```bash
# Remove all node_modules
rm -rf node_modules packages/*/node_modules

# Reinstall
npm install
```

### TypeScript Can't Find Types?

Ensure your tsconfig.json includes workspace packages:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@zrcni/distributed-saga-board-api": ["packages/api/src"],
      "@zrcni/distributed-saga-board-express": ["packages/express/src"],
      "@zrcni/distributed-saga-board-ui": ["packages/ui/src"]
    }
  }
}
```

### Example Not Using Local Code?

For examples, you can use either:

**Option 1: Workspaces (Recommended)**
Add to root package.json:
```json
{
  "workspaces": ["packages/*", "examples/*"]
}
```

**Option 2: tsconfig-paths (Current approach)**
```json
// examples/with-express-dashboard/tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@zrcni/distributed-saga-board-api": ["../../packages/api/src"],
      "@zrcni/distributed-saga-board-express": ["../../packages/express/src"]
    }
  }
}
```

Run with:
```bash
ts-node -r tsconfig-paths/register index.ts
```

## Alternative: Using Wildcards (Not Recommended)

❌ **Don't use `"*"` in dependencies:**
```json
{
  "dependencies": {
    "@zrcni/distributed-saga-board-api": "*"  // DON'T DO THIS
  }
}
```

**Why?** When published, this allows ANY version, which can cause breaking changes.

## Best Practice Summary

1. ✅ Use npm workspaces in root package.json
2. ✅ Keep specific version ranges in dependencies
3. ✅ Run `npm install` from root
4. ✅ Let npm handle workspace linking automatically
5. ✅ Update versions together when releasing
6. ✅ Use changesets for version management
7. ❌ Don't use `*` versions
8. ❌ Don't use `file:` or `link:` protocols in dependencies

## Current Status

Your repository is almost ready! Just need to add the `workspaces` field:

```json
{
  "name": "@zrcni/distributed-saga",
  "workspaces": [
    "packages/*",
    "examples/*"
  ]
}
```

Then run:
```bash
npm install
```

And you're done! 🎉
