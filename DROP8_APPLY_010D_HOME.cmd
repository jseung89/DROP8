@echo off
chcp 65001 >nul
setlocal

cd /d "%~dp0"

echo ==============================================
echo DROP 8 Refactor 010D Home Patch
echo 현재 폴더: %CD%
echo ==============================================
echo.

if not exist "DROP8_refactor_010D_angle_aware_portal_visibility_hotfix_patch.ts" (
  echo [오류] 010D TS 패치 파일이 현재 폴더에 없습니다.
  echo 이 CMD와 TS 파일을 DROP8 프로젝트 최상위 폴더에 함께 넣어주세요.
  pause
  exit /b 1
)

if not exist "package.json" (
  echo [오류] package.json이 없습니다.
  echo 이 CMD와 TS 파일을 DROP8 프로젝트 최상위 폴더로 옮겨주세요.
  pause
  exit /b 1
)

node --experimental-strip-types "DROP8_refactor_010D_angle_aware_portal_visibility_hotfix_patch.ts"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo [실패] 패치 적용 중 오류가 발생했습니다. 오류 코드를 확인하세요: %EXIT_CODE%
) else (
  echo [완료] 010D 패치 적용 및 자동 검증이 끝났습니다.
  echo 실행 명령: corepack pnpm dev:lan
)
echo.
pause
exit /b %EXIT_CODE%
