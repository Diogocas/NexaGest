# NexaGest 9.3.1 — Publicador PRO

O `PUBLICAR.bat` deve ficar na pasta principal do projeto NexaGest, não dentro da pasta `NexaGest-GitHub`.

## O que ele publica

Ele copia para `NexaGest-GitHub` somente:

- `build/`
- `docs/`
- `src/`
- `updates/`
- `package.json`
- `package-lock.json`
- `GERAR-INSTALADOR.bat`
- `PUBLICAR.bat`
- `README.md`, se existir
- `.gitignore` seguro

## O que ele não publica

Ele bloqueia/ignora:

- `node_modules/`
- `dist/`
- instaladores `.exe`
- `.blockmap`
- `.zip`
- logs
- arquivos `.env`
- scripts antigos de `latest.json`

## Fluxo correto

1. Desenvolva e teste na pasta principal `NexaGest`.
2. Clique em `PUBLICAR.bat`.
3. Informe a versão, por exemplo `9.3.1`.
4. Confirme a cópia segura.
5. Confirme commit e push.
6. Gere o instalador com `GERAR-INSTALADOR.bat` ou `npm run dist:win`.
7. Crie a Release no GitHub e anexe somente:
   - `NexaGest-Setup.exe`
   - `latest.yml`
   - `NexaGest-Setup.exe.blockmap`

## Observação

O instalador nunca deve ser enviado no código do repositório. Ele deve ir apenas em GitHub Releases.
