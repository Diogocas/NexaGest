# NexaGest 9.1 — Licenciamento Online

Esta versão prepara o NexaGest para ativação online por servidor próprio.

## Como funciona

O aplicativo continua aceitando licença local/offline, mas agora possui os botões:

- **Ativar online**
- **Validar online**

A tela fica em **Configurações > Comercialização, licença e atualização**.

## Endpoints esperados

Configure no NexaGest a URL base do servidor, por exemplo:

```txt
https://api.seudominio.com/licensing
```

O NexaGest chama:

```txt
POST /activate
POST /validate
```

## Payload de ativação

```json
{
  "app": "NexaGest",
  "version": "9.1.0",
  "action": "activate",
  "licenseKey": "NEXA-XXXX-XXXX-XXXX",
  "owner": "Cliente",
  "email": "cliente@email.com",
  "plan": "Profissional",
  "deviceId": "id-da-maquina",
  "hostname": "PC-CLIENTE",
  "platform": "win32",
  "arch": "x64"
}
```

## Resposta esperada

```json
{
  "ok": true,
  "status": "active",
  "label": "Licença ativa",
  "plan": "Profissional",
  "owner": "Cliente",
  "email": "cliente@email.com",
  "expiresAt": "2027-06-28",
  "token": "token-opcional"
}
```

## Atualização automática

A atualização automática usa o padrão do `electron-updater`:

- `NexaGest-Setup.exe`
- `latest.yml`
- `NexaGest-Setup.exe.blockmap`

Esses arquivos devem ser anexados em uma Release do GitHub.

## Observação importante

Se a versão instalada for igual à versão da última Release, o NexaGest mostrará que está atualizado. Para aparecer atualização, a Release publicada no GitHub precisa ter versão maior que a instalada.
