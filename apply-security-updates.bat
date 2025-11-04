@echo off
REM Security Update Script for glean-system-assessment
REM This script applies critical security updates identified in the security audit

echo ================================================
echo Applying Security Updates for glean-system-assessment
echo ================================================
echo.

REM Step 1: Clean install to ensure correct versions
echo Step 1: Removing node_modules and package-lock.json...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del package-lock.json

REM Step 2: Install dependencies with exact versions
echo.
echo Step 2: Installing dependencies with secure versions...
call npm install

REM Step 3: Verify systeminformation version
echo.
echo Step 3: Verifying systeminformation version (should be 5.23.7+)...
call npm list systeminformation

REM Step 4: Verify chalk version
echo.
echo Step 4: Verifying chalk version (should be exactly 5.3.0)...
call npm list chalk

REM Step 5: Run security audit
echo.
echo Step 5: Running npm audit...
call npm audit --production

REM Step 6: Run security tests
echo.
echo Step 6: Running security test suite...
call npm run test:security

REM Step 7: Generate audit report
echo.
echo Step 7: Generating detailed audit report...
call npm audit --json > security-audit-results.json

echo.
echo ================================================
echo Security Update Complete!
echo ================================================
echo.
echo Results:
echo 1. Dependencies updated to secure versions
echo 2. Audit results saved to security-audit-results.json
echo 3. Security tests executed
echo.
echo Recommendations:
echo - Review security-audit-results.json for any remaining issues
echo - Commit these changes with message: "chore: apply security updates for CVE-2024-56334 and chalk supply chain"
echo - Run "npm run security:check" regularly
echo.
pause