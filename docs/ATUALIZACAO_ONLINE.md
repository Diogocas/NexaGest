# NexaGest 9.0.1 — Sistema de atualização online

Esta versão prepara o NexaGest para verificar versões pela internet usando um arquivo `latest.json`.

## Arquivos publicados no seu site

Publique no seu site ou hospedagem:

```txt
/nexagest/latest.json
/nexagest/NexaGest-Setup.exe
```

## Exemplo de latest.json

```json
{
  "latestVersion": "9.0.2",
  "channel": "stable",
  "notes": "Correções e melhorias do NexaGest.",
  "installer": "NexaGest-Setup.exe",
  "downloadUrl": "https://seusite.com.br/nexagest/NexaGest-Setup.exe",
  "releaseUrl": "https://seusite.com.br/nexagest/"
}
```

## Como configurar no NexaGest

1. Abra Configurações.
2. Entre em Comercialização, licença e atualização.
3. Informe a URL do manifesto, por exemplo:

```txt
https://seusite.com.br/nexagest/latest.json
```

4. Clique em `Salvar licença`.
5. Clique em `Verificar atualização agora`.

## Funcionamento

- O NexaGest compara a versão instalada com `latestVersion`.
- Se houver versão nova, mostra as notas.
- Ao confirmar, baixa `NexaGest-Setup.exe` para a pasta Downloads e abre o instalador.
- Se a internet falhar, o sistema usa o manifesto local `updates/latest.json` como fallback.

## Observação

O instalador continua sendo gerado com:

```powershell
npm install --foreground-scripts
npm run dist:win
```

O arquivo final permanece:

```txt
NexaGest-Setup.exe
```
