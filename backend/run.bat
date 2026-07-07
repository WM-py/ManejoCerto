@echo off
REM Sobe o servidor de ingestao do WhatsApp (Manejo Certo).
REM Duplo-clique neste arquivo OU rode: run.bat
cd /d %~dp0
call venv\Scripts\activate.bat
echo Iniciando servidor em http://127.0.0.1:8000 ...
uvicorn main:app --reload --port 8000
