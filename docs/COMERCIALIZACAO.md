# NexaGest 8.3 — Comercialização

Esta versão prepara o projeto para distribuição comercial.

## Gerar instalador no Windows

```powershell
npm install --foreground-scripts
npm run dist:win
```

O instalador será gerado na pasta `dist/`.

## Atualizações

A base de atualização local usa `updates/latest.json`. Para atualização online real, hospede um manifesto semelhante em um servidor próprio e conecte a tela de licença/atualização à API.

## Licenciamento

A versão 8.3 inclui validação local/offline inicial. Para venda em escala, recomenda-se ativação online com conta/e-mail, assinatura e token com renovação periódica.

## 9.0.1 — Atualização online

A versão 9.0.1 adiciona verificação por manifesto online, download do instalador e fallback local.
Consulte `docs/ATUALIZACAO_ONLINE.md`.
