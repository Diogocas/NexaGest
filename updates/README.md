# Atualizações do NexaGest

A partir da versão 9.0.3 o NexaGest usa o fluxo padrão do `electron-updater`.

Os arquivos de atualização são gerados automaticamente em `dist/` quando você roda:

```powershell
npm run dist:win
```

Na Release do GitHub envie estes arquivos:

- `NexaGest-Setup.exe`
- `latest.yml`
- `NexaGest-Setup.exe.blockmap`

Não envie a pasta `dist/` para o repositório.
