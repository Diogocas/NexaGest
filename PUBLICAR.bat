@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

cls
echo ==================================================
echo              NEXAGEST - PUBLICADOR PRO
echo ==================================================
echo.
echo Este script publica SOMENTE o codigo no GitHub.
echo Ele NAO envia node_modules, dist, instaladores ou arquivos temporarios.
echo O instalador deve ser enviado depois em GitHub Releases.
echo.

set "SOURCE=%~dp0"
set "SOURCE=%SOURCE:~0,-1%"
for %%I in ("%SOURCE%\..") do set "PARENT=%%~fI"

set "REPO=%PARENT%\NexaGest-GitHub"
if exist "%USERPROFILE%\OneDrive\Desktop\NexaGest-GitHub\.git" set "REPO=%USERPROFILE%\OneDrive\Desktop\NexaGest-GitHub"
if exist "%USERPROFILE%\Desktop\NexaGest-GitHub\.git" set "REPO=%USERPROFILE%\Desktop\NexaGest-GitHub"

echo Origem detectada : %SOURCE%
echo Destino detectado: %REPO%
echo.

if /I "%REPO%"=="%SOURCE%" (
  echo ERRO: a pasta de publicacao nao pode ser a mesma pasta do projeto principal.
  pause
  exit /b 1
)

if not exist "%REPO%" (
  echo A pasta NexaGest-GitHub ainda nao existe.
  echo.
  echo Clonando repositorio oficial em:
  echo %REPO%
  echo.
  git clone https://github.com/Diogocas/NexaGest.git "%REPO%"
  if errorlevel 1 (
    echo.
    echo ERRO ao clonar o repositorio.
    echo Verifique internet, login do GitHub e permissao no repositorio.
    pause
    exit /b 1
  )
)

if not exist "%REPO%\.git" (
  echo.
  echo ERRO: a pasta NexaGest-GitHub existe, mas nao possui .git.
  echo Caminho: %REPO%
  echo.
  echo Para corrigir:
  echo 1. Renomeie ou apague essa pasta NexaGest-GitHub
  echo 2. Execute este PUBLICAR.bat novamente
  echo 3. O script vai clonar o repositorio correto automaticamente
  echo.
  echo IMPORTANTE: este script nao usa git init para evitar conflitos.
  pause
  exit /b 1
)

set /p VERSION=Versao para publicar (ex.: 13.1.0): 
if "%VERSION%"=="" set "VERSION=13.1.0"

set /p MSG=Mensagem do commit (Enter para padrao): 
if "%MSG%"=="" set "MSG=NexaGest %VERSION%"

echo.
echo Origem : %SOURCE%
echo Destino: %REPO%
echo Versao : %VERSION%
echo Commit : %MSG%
echo.
echo Pastas permitidas: build, docs, src, updates, tools
echo Arquivos permitidos: package.json, package-lock.json, GERAR-INSTALADOR.bat, PUBLICAR.bat, README.md, .gitignore
echo.
set /p CONFIRM_COPY=Continuar com a copia segura? (S/N): 
if /I not "%CONFIRM_COPY%"=="S" (
  echo Publicacao cancelada.
  pause
  exit /b 0
)

echo.
echo Atualizando repositorio de destino...
pushd "%REPO%"

git rebase --abort >nul 2>nul
git merge --abort >nul 2>nul

git fetch origin
if errorlevel 1 (
  echo.
  echo ERRO ao buscar atualizacoes do GitHub.
  popd
  pause
  exit /b 1
)

git reset --hard origin/main
if errorlevel 1 (
  echo.
  echo ERRO ao restaurar repositorio local para origin/main.
  popd
  pause
  exit /b 1
)

git clean -fd
if errorlevel 1 (
  echo.
  echo ERRO ao limpar arquivos nao rastreados no repositorio de destino.
  popd
  pause
  exit /b 1
)

popd

echo.
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
if exist "%SOURCE%\tools" robocopy "%SOURCE%\tools" "%REPO%\tools" /MIR /XD node_modules dist .git /XF *.log >nul
if errorlevel 8 goto copia_erro

copy /Y "%SOURCE%\package.json" "%REPO%\package.json" >nul
if exist "%SOURCE%\package-lock.json" copy /Y "%SOURCE%\package-lock.json" "%REPO%\package-lock.json" >nul
if exist "%SOURCE%\GERAR-INSTALADOR.bat" copy /Y "%SOURCE%\GERAR-INSTALADOR.bat" "%REPO%\GERAR-INSTALADOR.bat" >nul
if exist "%SOURCE%\PUBLICAR.bat" copy /Y "%SOURCE%\PUBLICAR.bat" "%REPO%\PUBLICAR.bat" >nul
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

git push -u origin main
if errorlevel 1 (
  echo.
  echo ERRO ao enviar para o GitHub.
  echo Se o GitHub pedir login, confirme sua conta no Git Credential Manager e tente novamente.
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
if /I "%OPEN_RELEASE%"=="S" start "" "https://github.com/Diogocas/NexaGest/releases/new?tag=v%VERSION%"

pause
exit /b 0

:copia_erro
echo.
echo ERRO ao copiar arquivos com robocopy.
echo Verifique permissoes e caminhos.
pause
exit /b 1
