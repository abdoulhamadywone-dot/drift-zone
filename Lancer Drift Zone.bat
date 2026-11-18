@echo off
chcp 65001 >nul
title Drift Zone
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js est introuvable. Installe-le depuis https://nodejs.org puis relance. & pause & exit /b)
node serveur.js
pause
