@echo off
chcp 65001 >nul
title NexaGest - latest.yml

echo A partir da versão 9.0.3 não é necessário criar latest.json manualmente.
echo.
echo O electron-builder cria automaticamente o arquivo:
echo dist\latest.yml
echo.
echo Na Release do GitHub, envie:
echo - dist\NexaGest-Setup.exe
echo - dist\latest.yml
echo - dist\NexaGest-Setup.exe.blockmap
echo.
pause
