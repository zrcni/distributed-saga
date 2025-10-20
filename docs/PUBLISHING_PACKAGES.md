# Publishing Guide for Dashboard Packages

This document explains how to publish the `@zrcni/distributed-saga-board-api` and `@zrcni/distributed-saga-board-express` packages to GitHub Packages.

## Prerequisites

1. **GitHub Token**: You need a GitHub Personal Access Token with `write:packages` and `read:packages` permissions
2. **Authentication**: The `.npmrc` file in each package already contains the auth token configuration
3. **Build Tools**: Ensure TypeScript is installed and configured

## Package Configuration

Both packages are now configured for publishing with:

- ✅ `publishConfig` pointing to GitHub Packages registry
- ✅ `repository` field with proper directory path
- ✅ `files` array specifying what to include in the published package
- ✅ `prepublishOnly` script to build before publishing
- ✅ `.npmignore` to exclude source files and dev artifacts
- ✅ README files with documentation

## Publishing Steps

### 1. Update Version

Before publishing, update the version in `package.json`:

```bash
# For api package
cd packages/api
npm version patch  # or minor, or major

# For express package
cd packages/express
npm version patch  # or minor, or major
```

### 2. Build the Packages

The `prepublishOnly` script will automatically build, but you can test manually:

```bash
# Build api package
cd packages/api
npm run build

# Build express package
cd packages/express
npm run build
```

### 3. Publish to GitHub Packages

```bash
# Publish api package
cd packages/api
npm publish

# Publish express package
cd packages/express
npm publish
```

## Publishing Order

⚠️ **Important**: Publish in this order to respect dependencies:

1. **First**: `@zrcni/distributed-saga-board-api` (no internal dependencies)
2. **Second**: `@zrcni/distributed-saga-board-express` (depends on api and ui)

## What Gets Published

Each package includes only:
- `dist/` - Compiled JavaScript and TypeScript declarations
- `README.md` - Package documentation

Excluded from the published package:
- `src/` - Source TypeScript files
- `tsconfig.json` - TypeScript configuration
- `.npmrc` - NPM configuration with auth token
- `node_modules/` - Dependencies
- Development and test files

## Verifying the Package

Before publishing, you can preview what will be included:

```bash
cd packages/api
npm pack --dry-run

cd packages/express
npm pack --dry-run
```

## Installing Published Packages

Once published, users can install them:

```bash
# Install both packages
npm install @zrcni/distributed-saga-board-api @zrcni/distributed-saga-board-express

# Or just the express package (which will pull in api as a dependency)
npm install @zrcni/distributed-saga-board-express
```

Users will need to configure their `.npmrc` to authenticate with GitHub Packages:

```properties
//npm.pkg.github.com/:_authToken=YOUR_GITHUB_TOKEN
@zrcni:registry=https://npm.pkg.github.com
```

## Troubleshooting

### Authentication Failed

Ensure your `.npmrc` has a valid GitHub token:
```properties
//npm.pkg.github.com/:_authToken=YOUR_TOKEN_HERE
@zrcni:registry=https://npm.pkg.github.com
```

### Build Errors

Clean and rebuild:
```bash
npm run clean
npm run build
```

### Version Already Exists

You cannot republish the same version. Update the version:
```bash
npm version patch
```

## Automated Publishing (Optional)

You can set up GitHub Actions to publish automatically on release:

```yaml
# .github/workflows/publish-packages.yml
name: Publish Packages

on:
  release:
    types: [created]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
          registry-url: 'https://npm.pkg.github.com'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Publish api package
        run: |
          cd packages/api
          npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
      
      - name: Publish express package
        run: |
          cd packages/express
          npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

## Version Management

Current versions:
- `@zrcni/distributed-saga-board-api`: 0.0.1
- `@zrcni/distributed-saga-board-express`: 0.0.1

Follow semantic versioning:
- **Patch** (0.0.X): Bug fixes
- **Minor** (0.X.0): New features, backward compatible
- **Major** (X.0.0): Breaking changes

## Dependencies

The express package depends on:
- `@zrcni/distributed-saga-board-api`: ^0.0.1
- `@zrcni/distributed-saga-board-ui`: ^0.0.1
- `ejs`: ^3.1.9

Ensure the UI package is also published before publishing the express package.
