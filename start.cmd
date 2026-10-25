@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22.12+ is required. Install it, then retry. 1>&2
  exit /b 1
)
node "%~dp0scripts\start.mjs" %*
exit /b %errorlevel%
