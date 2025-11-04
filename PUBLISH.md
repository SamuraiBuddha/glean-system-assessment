# Publishing to npm

## Prerequisites

1. **npm Account**: Create one at https://www.npmjs.com/signup if you don't have one
2. **Login to npm**: Run `npm login` in terminal

## Publishing Steps

### First Time Publishing

1. **Initialize Git Repository**:
```bash
cd C:\Users\JordanEhrig\Documents\GitHub\glean-system-assessment
git init
git add .
git commit -m "Initial commit"
```

2. **Login to npm**:
```bash
npm login
# Enter your username, password, and email
```

3. **Test Package Locally** (optional but recommended):
```bash
# Pack the module
npm pack

# Test in another directory
cd ../test-project
npm install ../glean-system-assessment/glean-system-assessment-1.0.0.tgz
```

4. **Publish to npm**:
```bash
# For first publish (public package)
npm publish --access public

# Or using the script
npm run publish:npm
```

### Subsequent Updates

1. **Update Version**:
```bash
# Patch version (1.0.0 -> 1.0.1)
npm version patch

# Minor version (1.0.0 -> 1.1.0)
npm version minor

# Major version (1.0.0 -> 2.0.0)
npm version major
```

2. **Commit Changes**:
```bash
git add .
git commit -m "Version bump to x.x.x"
```

3. **Publish**:
```bash
npm publish
```

## Verify Publication

After publishing, verify at:
- https://www.npmjs.com/package/glean-system-assessment

Test installation:
```bash
# In a new directory
npm install glean-system-assessment
npx glean-assess
```

## Package Name Availability

Before publishing, check if name is available:
```bash
npm view glean-system-assessment
# If it returns "404 Not Found", the name is available
```

## Alternative Names (if taken)

If `glean-system-assessment` is taken, consider:
- `@yourusername/glean-system-assessment` (scoped package)
- `system-glean`
- `glean-assess`
- `system-assessment-glean`
- `universal-system-glean`

To use a scoped package:
1. Update package.json: `"name": "@yourusername/glean-system-assessment"`
2. Publish: `npm publish --access public`

## Troubleshooting

### "You need to be logged in"
```bash
npm login
```

### "Package name too similar to existing packages"
- Choose a different name
- Use a scoped package

### "Cannot publish over previously published version"
```bash
npm version patch
npm publish
```

### "No README data"
- Ensure README.md exists and is not in .npmignore

## Best Practices

1. **Test before publishing**: Always test the package locally
2. **Semantic versioning**: Follow major.minor.patch conventions
3. **Update README**: Keep documentation current
4. **Tag releases**: Use git tags for versions
```bash
git tag v1.0.0
git push origin --tags
```

## Quick Publish Script

Create `publish.ps1` for Windows:
```powershell
# publish.ps1
$version = Read-Host "Version type (patch/minor/major)"
npm version $version
git add .
git commit -m "Version bump"
npm publish
git push origin main --tags
Write-Host "Published successfully!" -ForegroundColor Green
```

Run with:
```bash
powershell -ExecutionPolicy Bypass -File publish.ps1
```