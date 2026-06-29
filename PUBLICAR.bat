@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set "DEFAULT_VERSION=13.1.0"
set "REPO_URL=https://github.com/Diogocas/NexaGest.git"

rem Pasta onde este PUBLICAR.bat esta
set "ORIGEM=%~dp0"
if "%ORIGEM:~-1%"=="\" set "ORIGEM=%ORIGEM:~0,-1%"

rem Pasta NexaGest-GitHub ao lado da pasta do projeto
for %%I in ("%ORIGEM%\..") do set "BASE=%%~fI"
set "DESTINO=%BASE%\NexaGest-GitHub"

echo ==================================================
echo NEXAGEST - PUBLICADOR PRO
echo ==================================================
echo.
echo Este script publica SOMENTE o codigo no GitHub.
echo Ele NAO envia node_modules, dist, instaladores ou arquivos temporarios.
echo O instalador deve ser enviado depois em GitHub Releases.
echo.
echo Origem detectada : %ORIGEM%
echo Destino detectado: %DESTINO%
echo.

if not exist "%ORIGEM%\package.json" (
  echo ERRO: este PUBLICAR.bat precisa ficar dentro da pasta do projeto NexaGest.
  echo Nao encontrei package.json em: %ORIGEM%
  pause
  exit /b 1
)

if not exist "%DESTINO%" (
  echo A pasta NexaGest-GitHub ainda nao existe.
  echo Clonando repositorio oficial em:
  echo %DESTINO%
  echo.
  git clone "%REPO_URL%" "%DESTINO%"
  if errorlevel 1 (
    echo.
    echo ERRO ao clonar o repositorio.
    echo Verifique sua internet, Git instalado e acesso ao GitHub.
    pause
    exit /b 1
  )
)

if not exist "%DESTINO%\.git" (
  echo ERRO: a pasta NexaGest-GitHub existe, mas NAO e um repositorio Git.
  echo.
  echo Caminho com problema:
  echo %DESTINO%
  echo.
  echo Para corrigir com seguranca:
  echo 1. Renomeie ou apague essa pasta NexaGest-GitHub.
  echo 2. Execute este PUBLICAR.bat novamente.
  echo 3. Ele vai clonar o repositorio correto automaticamente.
  pause
  exit /b 1
)

echo Versao para publicar (ex.: %DEFAULT_VERSION%):
set /p VERSION=
if "%VERSION%"=="" set "VERSION=%DEFAULT_VERSION%"

echo Mensagem do commit (Enter para padrao):
set /p COMMIT_MSG=
if "%COMMIT_MSG%"=="" set "COMMIT_MSG=NexaGest %VERSION%"

echo.
echo Origem : %ORIGEM%
echo Destino: %DESTINO%
echo Versao : %VERSION%
echo Commit : %COMMIT_MSG%
echo.
echo Pastas permitidas: build, docs, src, updates, tools
echo Arquivos permitidos: package.json, package-lock.json, GERAR-INSTALADOR.bat, PUBLICAR.bat, README.md, .gitignore
echo.
set /p CONFIRMA=Continuar com a copia segura? (S/N): 
if /I not "%CONFIRMA%"=="S" (
  echo Publicacao cancelada.
  pause
  exit /b 0
)

echo.
echo Restaurando repositorio de destino para o estado limpo do GitHub...
pushd "%DESTINO%"

git rebase --abort >nul 2>&1
git merge --abort >nul 2>&1
git remote set-url origin "%REPO_URL%" >nul 2>&1
git fetch origin
if errorlevel 1 (
  popd
  echo.
  echo ERRO ao atualizar informacoes do GitHub.
  pause
  exit /b 1
)

git checkout main >nul 2>&1
if errorlevel 1 git checkout -B main origin/main

git reset --hard origin/main
if errorlevel 1 (
  popd
  echo.
  echo ERRO ao limpar o repositorio de destino.
  pause
  exit /b 1
)

git clean -fdx
if errorlevel 1 (
  popd
  echo.
  echo ERRO ao remover arquivos temporarios do destino.
  pause
  exit /b 1
)
popd

echo.
echo Limpando destino, preservando somente a pasta .git...
for /d %%D in ("%DESTINO%\*") do (
  if /I not "%%~nxD"==".git" rd /s /q "%%D"
)
for %%F in ("%DESTINO%\*") do (
  if /I not "%%~nxF"==".git" del /f /q "%%F" >nul 2>&1
)

echo.
echo Gravando .gitignore seguro no destino...
(
  echo node_modules/
  echo dist/
  echo release/
  echo out/
  echo *.exe
  echo *.msi
  echo *.zip
  echo *.7z
  echo *.rar
  echo *.log
  echo *.db
  echo *.sqlite
  echo *.sqlite3
  echo .env
  echo .DS_Store
  echo Thumbs.db
) > "%DESTINO%\.gitignore"

echo.
echo Copiando arquivos permitidos...
for %%D in (build docs src updates tools) do (
  if exist "%ORIGEM%\%%D" robocopy "%ORIGEM%\%%D" "%DESTINO%\%%D" /MIR /XD node_modules dist release out .git /XF *.exe *.msi *.zip *.7z *.rar *.log *.db *.sqlite *.sqlite3 .env >nul
)

for %%F in (package.json package-lock.json GERAR-INSTALADOR.bat PUBLICAR.bat README.md) do (
  if exist "%ORIGEM%\%%F" copy /Y "%ORIGEM%\%%F" "%DESTINO%\%%F" >nul
)

echo.
echo Validando se arquivos proibidos entraram no destino...
if exist "%DESTINO%\node_modules" goto PROIBIDO
if exist "%DESTINO%\dist" goto PROIBIDO
if exist "%DESTINO%\release" goto PROIBIDO
if exist "%DESTINO%\out" goto PROIBIDO
dir /b /s "%DESTINO%\*.exe" "%DESTINO%\*.msi" "%DESTINO%\*.zip" "%DESTINO%\*.7z" "%DESTINO%\*.rar" >nul 2>&1
if not errorlevel 1 goto PROIBIDO

goto GIT

:PROIBIDO
echo.
echo ERRO: arquivos proibidos foram encontrados no destino.
echo A publicacao foi interrompida para proteger o GitHub.
pause
exit /b 1

:GIT
pushd "%DESTINO%"
echo.
echo Status do Git:
git status --short

echo.
set /p DO_PUSH=Fazer commit e push agora? (S/N): 
if /I not "%DO_PUSH%"=="S" (
  popd
  echo Publicacao preparada, mas commit/push cancelado.
  pause
  exit /b 0
)

set "HAS_CHANGES="
for /f "delims=" %%A in ('git status --porcelain') do set "HAS_CHANGES=1"
if not defined HAS_CHANGES (
  echo.
  echo Nenhuma alteracao para publicar.
  popd
  pause
  exit /b 0
)

git add .
git commit -m "%COMMIT_MSG%"
if errorlevel 1 (
  popd
  echo.
  echo ERRO ao criar commit.
  pause
  exit /b 1
)

git push origin main
if errorlevel 1 (
  popd
  echo.
  echo ERRO ao enviar para o GitHub.
  echo Se o GitHub pedir login, confirme sua conta no Git Credential Manager e tente novamente.
  pause
  exit /b 1
)

popd
echo.
echo Publicacao concluida com sucesso.
echo Versao publicada: %VERSION%
pause
exit /b 0
