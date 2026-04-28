@echo off
REM Start TraveloApp services via PM2 in the correct order.
REM Requires: npm install -g pm2

cd /d "%~dp0"

echo [1/2] Starting travelo-control-service first...
pm2 start ecosystem.config.js --only travelo-control-service
if errorlevel 1 goto :err

echo Waiting 5s for control-service to warm up...
timeout /t 5 /nobreak >nul

echo [2/2] Starting remaining services...
pm2 start ecosystem.config.js
if errorlevel 1 goto :err

echo.
pm2 status
echo.
echo Done. Useful commands:
echo   pm2 logs             - tail all logs
echo   pm2 logs ^<name^>      - tail one service
echo   pm2 restart ^<name^>   - restart one
echo   stop-all.bat         - stop everything
goto :eof

:err
echo.
echo Startup failed. Is PM2 installed?  npm install -g pm2
exit /b 1
