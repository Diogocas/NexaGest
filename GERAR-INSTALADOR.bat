@echo off
chcp 65001 >nul
title NexaGest - Gerar instalador

echo ======================================
echo      NexaGest - Gerar Instalador
echo ======================================
echo.

echo Instalando dependencias...
call npm install --foreground-scripts
if errorlevel 1 (
  echo.
  echo ERRO ao instalar dependencias.
  pause
  exit /b 1
)

echo.
echo Gerando NexaGest-Setup.exe...
call npm run dist:win
if errorlevel 1 (
  echo.
  echo ERRO ao gerar instalador.
  pause
  exit /b 1
)

echo.
echo ======================================
echo Instalador gerado em: dist\NexaGest-Setup.exe
echo ======================================
pause
