# NexaGest 12.0.0 — Revisão Final Comercial

Versão focada em finalização, diagnóstico e prontidão comercial do sistema desktop, sem dependência de Mobile, API online ou serviços pagos.

## Principais ajustes

- Versão atualizada para 12.0.0.
- `PUBLICAR.bat` atualizado para 12.0.0.
- `package.json` e `src/config.js` atualizados.
- Tela de Diagnóstico com checklist de prontidão comercial.
- Exportação de checklist comercial em TXT.
- Documentação de checklist comercial criada em `docs/`.
- Revisão do texto de comercialização, licença e atualização.
- Mantido foco local/offline para evitar custo com servidor ou API.

## Documentos importantes

- `docs/VERSAO_12_0_REVISAO_FINAL_COMERCIAL.md`
- `docs/CHECKLIST_COMERCIAL_12_0.md`
- `docs/PRIMEIRO_USO.md`
- `docs/BUILD_INSTALLER.md`
- `docs/GITHUB_RELEASES.md`

## Como testar

```bash
npm install
npm start
```

## Como gerar instalador

```bash
npm run dist:win
```

## Como publicar

Use:

```bat
PUBLICAR.bat
```

A versão padrão do publicador está configurada como `12.0.0`.
