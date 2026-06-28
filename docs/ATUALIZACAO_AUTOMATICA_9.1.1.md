# NexaGest 9.1.1 — Limpeza e atualização ajustada

## O que mudou

- Removido o fluxo antigo de `latest.json`.
- O NexaGest usa o padrão do `electron-updater`: `latest.yml`.
- A verificação automática roda na abertura quando `autoUpdate` está ativo.
- A tela de Comercialização informa melhor quando GitHub Releases não está acessível.
- Removido o script antigo `CRIAR-LATEST-GITHUB-EXEMPLO.bat`.

## Importante sobre GitHub privado

O aplicativo instalado no computador do cliente não consegue ler Releases de um repositório privado sem autenticação.

Para atualização automática funcionar de forma simples, use uma destas opções:

1. Repositório privado para o código + repositório público separado só para Releases.
2. Um servidor próprio de atualização.
3. Um endpoint público que entrega `latest.yml`, `NexaGest-Setup.exe` e `.blockmap`.

## Arquivos da Release

Anexe somente:

- `NexaGest-Setup.exe`
- `latest.yml`
- `NexaGest-Setup.exe.blockmap`

Não envie `dist/`, `win-unpacked/`, `node_modules/` ou o código-fonte na Release.
