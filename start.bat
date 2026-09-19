@echo off
cd /d "%~dp0"
start "" http://localhost:8000/?v=5
python -m http.server 8000

