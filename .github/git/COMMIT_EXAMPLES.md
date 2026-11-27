# Commit Examples - Project Best Practices

This document provides practical examples of commits following the project's Conventional Commits standard.

## Quick Reference

| Type | Purpose | Example |
|------|---------|---------|
| `feat` | New feature | `feat(auth): add device fingerprint validation` |
| `fix` | Bug fix | `fix(login): handle missing user-agent header` |
| `refactor` | Code improvement | `refactor(jwt): extract validation into separate method` |
| `test` | Test changes | `test(auth): add refresh token rotation tests` |
| `docs` | Documentation | `docs: update API documentation` |
| `chore` | Maintenance | `chore(deps): update EntityFramework Core` |
| `style` | Code formatting | `style: fix indentation in auth service` |
| `perf` | Performance | `perf(db): add index to user queries` |
| `ci` | CI/CD changes | `ci: add GitHub Actions workflow` |

## Example 1: Small Feature Commit

```
feat(fingerprint): add device fingerprint validation

Validate device fingerprints on each request to detect unauthorized access.
```

**What this does:**
- Clear type: `feat`
- Clear scope: `fingerprint`
- Short description: exactly what was added
- No unnecessary details in the subject

## Example 2: Small Refactoring Commit

```
refactor(jwt): extract JTI validation into separate method
```

**What this does:**
- Type: `refactor` (code improvement, not a new feature)
- Scope: `jwt` (area of code affected)
- Subject: what was done (extracted logic)
- No long description needed - it's clear from the subject

## Example 3: Bug Fix Commit

```
fix(login): handle missing user-agent header gracefully

Use device ID as fallback when User-Agent header is empty.
Prevents login failures and security gaps.
```

**What this does:**
- Type: `fix` (bug fix)
- Scope: `login` (which endpoint/service)
- Short description: what the fix does
- Body explains why the fix was needed (optional but helpful for non-trivial fixes)

## Example 4: Test Commit

```
test(auth): add refresh token rotation tests

Add integration tests to verify refresh token rotation and invalidation.
```

**What this does:**
- Type: `test` (only test files changed)
- Scope: `auth` (which feature area)
- Description: what tests were added

## Example 5: Documentation Commit

```
docs: update device fingerprint implementation guide

Document device fingerprint generation and validation process.
```

**What this does:**
- Type: `docs` (documentation only)
- No scope needed (applies to whole project)
- Description: what documentation was updated

## Example 6: Dependency Update Commit

```
chore(deps): update EntityFramework Core to 9.0.0
```

**What this does:**
- Type: `chore` (maintenance, not a feature or fix)
- Scope: `deps` (dependencies)
- Description: what was updated and the new version

## ❌ What NOT to Do

```
❌ feat: made some changes to auth
❌ feat: fixed bugs and added features
❌ feat(api): add fingerprint validation, update JWT, fix role assignment, refactor services
❌ Updated stuff
❌ WIP: work in progress
```

**Problems with these:**
- Vague descriptions
- Multiple unrelated changes in one commit
- Inconsistent capitalization
- Unclear scope

## 🎯 Best Practices

1. **One logical change per commit**
   - If you're fixing an issue AND refactoring, make two commits
   - If you're adding feature X AND fixing bug Y, make two commits

2. **Use imperative mood**
   - ✅ "add authentication" (not "added authentication")
   - ✅ "fix login issue" (not "fixed login issue")

3. **Keep subject line short**
   - Aim for 60-72 characters
   - Max 100 if absolutely necessary
   - No period at the end

4. **Capitalize scope**
   - `feat(Auth)` ✅
   - `feat(auth)` ✅
   - Use lowercase for consistency with the project

5. **Use body for context (if needed)**
   - Explain WHY the change was made, not HOW
   - Leave a blank line between subject and body
   - Wrap at 100 characters

## Project Scopes

Use these scopes when applicable:

```
auth          - Authentication services and login flow
jwt           - JWT token generation and validation
fingerprint   - Device fingerprint features
migration     - Database migrations
db            - Database context and repositories
dto           - Data transfer objects
test          - Test utilities and helpers
role          - Role and permission management
api           - API endpoints and controllers
user          - User service and management
credential    - Credential management
provider      - Provider management
config        - Configuration and settings
deps          - Dependencies and packages
```

## Workflow Example

```bash
# View what has changed
git status

# Stage only related files
git add src/auth/LoginService.cs src/auth/ILoginService.cs

# Commit with focused message
git commit -m "refactor(auth): extract login validation into separate method"

# If you have more unrelated changes
git add src/jwt/JwtService.cs
git commit -m "refactor(jwt): simplify token validation"

# View your commits
git log --oneline -5
```

## Commit Message Template

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Subject Line
- Type must be one of: feat, fix, refactor, test, docs, style, chore, perf, ci
- Scope should be lowercase and relate to the changed area
- Subject should be imperative mood and describe what the commit does
- No period at the end

### Body (Optional)
- Explain why the change was made
- Explain what was changed and why
- Separate from subject with blank line
- Wrap at 100 characters

### Footer (Optional)
- Reference issues: `Fixes #123`, `Closes #456`
- Breaking changes: `BREAKING CHANGE: description of what breaks`

## Tools & Commands

```bash
# View recent commits
git log --oneline -10

# View detailed commit info
git show <commit-hash>

# View commits by type
git log --oneline | grep "^.*feat"
git log --oneline | grep "^.*fix"
git log --oneline | grep "^.*refactor"

# Amend last commit message
git commit --amend -m "new message"

# View diff before committing
git diff
git diff --staged
```

---

**Remember**: Small, focused commits make it easier to:
- Review changes
- Understand history
- Revert if needed
- Track bugs
- Collaborate with team

For more details, see `.github/agent/Git/Commit.instructions.md`

