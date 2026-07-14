@echo off
title Runway - Budget Planner
echo Starting Runway at http://localhost:4173 ...
echo Close this window to stop the app.
start "" http://localhost:4173
C:\Python314\python.exe -m http.server 4173 --directory "%~dp0"
