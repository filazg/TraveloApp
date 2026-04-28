@echo off
REM Stop and remove all TraveloApp services from PM2.
cd /d "%~dp0"
pm2 delete ecosystem.config.js
pm2 status
