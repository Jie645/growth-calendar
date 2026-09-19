@echo off
cd /d "%~dp0"
start "" http://localhost:8000/?v=6
python -m http.server 8000


