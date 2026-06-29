@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

cls
echo ==================================================
echo              NEXAGEST - PUBLICADOR
echo ==================================================
echo.
echo Este script publica SOMENTE o codigo no GitHub.
echo Ele NAO envia node_modules, dist, instaladores ou arquivos temporarios.
echo O instalador deve ser enviado depois em GitHub Releases.
echo.

set "SOURCE=%~dp0"
set "SOURCE=%SOURCE:~0,-1%"
for %%I in ("%SOURCE%\..") do set "PARENT=%%~fI"

set "DEFAULT_REPO=%PARENT%\NexaGest-GitHub"
if exist "%USERPROFILE%\OneDrive\Desktop\NexaGest-GitHub\.git" set "DEFAULT_REPO=%USERPROFILE%\OneDrive\Desktop\NexaGest-GitHub"
if exist "%USERPROFILE%\Desktop\NexaGest-GitHub\.git" set "DEFAULT_REPO=%USERPROFILE%\Desktop\NexaGest-GitHub"

if exist "%DEFAULT_REPO%\.git" (
  set "REPO=%DEFAULT_REPO%"
) else (
  set /p REPO=Digite o caminho completo da pasta NexaGest-GitHub: 
)

if "%REPO%"=="" (
  echo ERRO: caminho do repositorio vazio.
  pause
  exit /b 1
)

if /I "%REPO%"=="%SOURCE%" (
  echo ERRO: a pasta de publicacao nao pode ser a mesma pasta do projeto principal.
  pause
  exit /b 1
)

if not exist "%REPO%\.git" (
  echo.
  echo ERRO: a pasta informada nao possui .git.
  echo Caminho: %REPO%
  echo.
  echo Use a pasta NexaGest-GitHub ja conectada ao GitHub.
  pause
  exit /b 1
)

set /p VERSION=Versao para publicar (ex.: 12.0.0): 
if "%VERSION%"=="" set "VERSION=12.0.0"

set /p MSG=Mensagem do commit (Enter para padrao): 
if "%MSG%"=="" set "MSG=NexaGest %VERSION%"

echo.
echo Origem : %SOURCE%
echo Destino: %REPO%
echo Versao : %VERSION%
echo Commit : %MSG%
echo.
echo Pastas permitidas: build, docs, src, updates
echo Arquivos permitidos: package.json, package-lock.json, GERAR-INSTALADOR.bat, PUBLICAR.bat, README.md, .gitignore
echo.
set /p CONFIRM_COPY=Continuar com a copia segura? (S/N): 
if /I not "%CONFIRM_COPY%"=="S" (
  echo Publicacao cancelada.
  pause
  exit /b 0
)

echo.
echo Limpando scripts antigos no destino...
if exist "%REPO%\CRIAR-LATEST-GITHUB-EXEMPLO.bat" del /F /Q "%REPO%\CRIAR-LATEST-GITHUB-EXEMPLO.bat"

echo Gravando .gitignore seguro no destino...
(
  echo node_modules/
  echo dist/
  echo *.log
  echo npm-debug.log*
  echo .DS_Store
  echo .env
  echo *.zip
  echo NexaGest-Setup.exe
  echo *.blockmap
) > "%REPO%\.gitignore"

echo.
echo Copiando arquivos permitidos...
if exist "%SOURCE%\build" robocopy "%SOURCE%\build" "%REPO%\build" /MIR /XD node_modules dist .git /XF *.log >nul
if errorlevel 8 goto copia_erro
if exist "%SOURCE%\docs" robocopy "%SOURCE%\docs" "%REPO%\docs" /MIR /XD node_modules dist .git /XF *.log >nul
if errorlevel 8 goto copia_erro
if exist "%SOURCE%\src" robocopy "%SOURCE%\src" "%REPO%\src" /MIR /XD node_modules dist .git /XF *.log >nul
if errorlevel 8 goto copia_erro
if exist "%SOURCE%\updates" robocopy "%SOURCE%\updates" "%REPO%\updates" /MIR /XD node_modules dist .git /XF latest.json latest.github.example.json *.log >nul
if errorlevel 8 goto copia_erro

copy /Y "%SOURCE%\package.json" "%REPO%\package.json" >nul
if exist "%SOURCE%\package-lock.json" copy /Y "%SOURCE%\package-lock.json" "%REPO%\package-lock.json" >nul
if exist "%SOURCE%\GERAR-INSTALADOR.bat" copy /Y "%SOURCE%\GERAR-INSTALADOR.bat" "%REPO%\GERAR-INSTALADOR.bat" >nul
copy /Y "%SOURCE%\PUBLICAR.bat" "%REPO%\PUBLICAR.bat" >nul
if exist "%SOURCE%\README.md" copy /Y "%SOURCE%\README.md" "%REPO%\README.md" >nul

echo.
echo Validando se arquivos proibidos entraram no destino...
if exist "%REPO%\node_modules" (
  echo ERRO: node_modules existe dentro do repositorio de publicacao.
  echo Apague manualmente a pasta: %REPO%\node_modules
  pause
  exit /b 1
)
if exist "%REPO%\dist" (
  echo ERRO: dist existe dentro do repositorio de publicacao.
  echo Apague manualmente a pasta: %REPO%\dist
  pause
  exit /b 1
)

echo.
pushd "%REPO%"
echo Status do Git:
git status --short

echo.
set /p CONFIRM_GIT=Fazer commit e push agora? (S/N): 
if /I not "%CONFIRM_GIT%"=="S" (
  echo Arquivos copiados, mas commit/push cancelado.
  popd
  pause
  exit /b 0
)

git add .
git diff --cached --quiet
if not errorlevel 1 (
  echo.
  echo Nenhuma alteracao para commitar.
  popd
  pause
  exit /b 0
)

git commit -m "%MSG%"
if errorlevel 1 (
  echo.
  echo ERRO ao criar commit.
  popd
  pause
  exit /b 1
)

git push
if errorlevel 1 (
  echo.
  echo ERRO ao enviar para o GitHub.
  popd
  pause
  exit /b 1
)

popd

echo.
echo ==================================================
echo        CODIGO PUBLICADO COM SUCESSO
echo ==================================================
echo.
echo Proximo passo:
echo 1. Gere o instalador na pasta principal com GERAR-INSTALADOR.bat ou npm run dist:win
echo 2. Crie a Release v%VERSION% no GitHub
echo 3. Anexe somente:
echo    - dist\NexaGest-Setup.exe
echo    - dist\latest.yml
echo    - dist\NexaGest-Setup.exe.blockmap
echo.
set /p OPEN_RELEASE=Abrir pagina de Releases no navegador? (S/N): 
if /I "%OPEN_RELEASE%"=="S" start "" "https://github.com/Diogocas/NexaGest/releases/new"

pause
exit /b 0

:copia_erro
echo.
echo ERRO ao copiar arquivos com robocopy.
echo Verifique permissoes e caminhos.
pause
exit /b 1
