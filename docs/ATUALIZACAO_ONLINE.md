# Atualização Online do NexaGest

A atualização online foi padronizada na versão 9.0.3 usando `electron-updater`.

## Gerar uma nova versão

```powershell
npm install --foreground-scripts
npm run dist:win
```

## Publicar no GitHub Releases

Anexe na Release:

```txt
NexaGest-Setup.exe
latest.yml
NexaGest-Setup.exe.blockmap
```

O NexaGest lê o `latest.yml`, compara a versão instalada e permite baixar/instalar a atualização.
