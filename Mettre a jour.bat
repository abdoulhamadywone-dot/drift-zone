@echo off
chcp 65001 >nul
title Drift Zone - Mise a jour
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0maj.ps1"
pause
