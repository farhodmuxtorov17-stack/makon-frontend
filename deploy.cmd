@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo.
echo ===============================================
echo   MAKON - GitHub Pages ga chiqarish
echo ===============================================
echo.
echo Repozitoriya: farhodmuxtorov17-stack/makon-frontend
echo.
echo Push paytida so'raladi:
echo    Username - farhodmuxtorov17-stack
echo    Password - GitHub tokeningiz
echo.
pause

git push -u origin main --force
if errorlevel 1 (
  echo.
  echo Push bajarilmadi. Login yoki tokenni tekshiring.
  pause
  exit /b 1
)

echo.
echo ===============================================
echo   Push bajarildi
echo ===============================================
echo.
echo Endi bir marta sozlash kerak:
echo    1. https://github.com/farhodmuxtorov17-stack/makon-frontend/settings/pages
echo    2. Source - GitHub Actions
echo.
echo Yigilish jarayoni (~3 daqiqa):
echo    https://github.com/farhodmuxtorov17-stack/makon-frontend/actions
echo.
echo Tayyor bo'lgach havola:
echo    https://farhodmuxtorov17-stack.github.io/makon-frontend/
echo.
pause
