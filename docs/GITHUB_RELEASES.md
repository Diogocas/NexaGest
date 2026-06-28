# NexaGest 9.0.2 — Servidor de versões via GitHub Releases

Esta versão prepara o NexaGest para usar o GitHub Releases como servidor de versões.

## Arquivos da release

Em cada release do GitHub, envie estes assets:

- `NexaGest-Setup.exe`
- `latest.json`
- opcional: `NexaGest-Portable.exe`

## URL recomendada do manifesto

No NexaGest, em Configurações/Comercialização, use:

```txt
https://github.com/USUARIO/REPOSITORIO/releases/latest/download/latest.json
```

Também é possível informar apenas o usuário/org e o repositório. Nesse caso o app usa a API:

```txt
https://api.github.com/repos/USUARIO/REPOSITORIO/releases/latest
```

## Exemplo de latest.json

```json
{
  "version": "9.0.2",
  "latestVersion": "9.0.2",
  "channel": "stable",
  "provider": "github-releases",
  "notes": "Resumo das novidades da versão.",
  "installer": "NexaGest-Setup.exe",
  "downloadUrl": "https://github.com/USUARIO/REPOSITORIO/releases/download/v9.0.2/NexaGest-Setup.exe",
  "releaseUrl": "https://github.com/USUARIO/REPOSITORIO/releases/tag/v9.0.2",
  "publishedAt": "2026-06-28T00:00:00.000Z"
}
```

## Como publicar uma nova versão

1. Atualize a versão no `package.json` e no app.
2. Rode `npm install --foreground-scripts`.
3. Rode `npm run dist:win`.
4. Crie uma release no GitHub com tag, por exemplo `v9.0.2`.
5. Envie `dist/NexaGest-Setup.exe` como asset.
6. Envie um `latest.json` apontando para o instalador.
7. No NexaGest, clique em **Verificar atualização agora**.

## Observação

O GitHub pode redirecionar downloads. A versão 9.0.2 já trata redirecionamentos tanto no manifesto quanto no download.
