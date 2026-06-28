# NexaGest 8.3.1 — Build & Installer

Esta versão corrige o empacotamento com electron-builder.

## O que mudou

- `electron` foi movido de `dependencies` para `devDependencies`, como o electron-builder exige.
- O Electron continua sendo instalado normalmente para desenvolvimento, porque `npm install` instala devDependencies por padrão.
- Scripts de build adicionados:
  - `npm run dist:win` — gera instalador NSIS e portátil.
  - `npm run dist:portable` — gera somente portátil.
  - `npm run build:installer` — instala dependências e gera instalador.

## Como gerar o instalador no Windows

```powershell
npm install --foreground-scripts
npm run dist:win
```

Os arquivos serão gerados na pasta:

```text
dist/
```

## Observação

Os avisos `deprecated` e `vulnerabilities` do npm não impedem o build. Não use `npm audit fix --force` sem testar, pois pode trocar dependências nativas como SQLite.
