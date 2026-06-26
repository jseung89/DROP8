@echo off
setlocal EnableExtensions
chcp 65001 >nul
cd /d "%~dp0"

set "SHIM_DIR=%TEMP%\drop8-pnpm-shim-%RANDOM%-%RANDOM%"
mkdir "%SHIM_DIR%" >nul 2>&1
(
  echo @echo off
  echo corepack pnpm %%*
) > "%SHIM_DIR%\pnpm.cmd"
set "PATH=%SHIM_DIR%;%PATH%"

where corepack >nul 2>&1
if errorlevel 1 (
  echo [DROP 8] Corepack을 찾을 수 없습니다. Node.js 22 이상을 설치해 주세요.
  rmdir /s /q "%SHIM_DIR%" >nul 2>&1
  pause
  exit /b 1
)

call pnpm dev:lan
set "EXIT_CODE=%ERRORLEVEL%"
rmdir /s /q "%SHIM_DIR%" >nul 2>&1

if not "%EXIT_CODE%"=="0" (
  echo.
  echo [DROP 8] LAN 서버가 종료되었습니다. 오류 코드: %EXIT_CODE%
  pause
)
exit /b %EXIT_CODE%
