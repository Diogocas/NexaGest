# NexaGest — GitHub Releases

A partir da versão 9.0.3, o NexaGest usa o `electron-updater` com o arquivo `latest.yml` gerado automaticamente pelo `electron-builder`.

## Arquivos da Release

Em cada Release do GitHub, envie:

- `NexaGest-Setup.exe`
- `latest.yml`
- `NexaGest-Setup.exe.blockmap`

Não envie a pasta `dist/` para o repositório.

## Tag recomendada

Use tags no padrão:

```txt
v9.0.3
v9.0.4
v9.1.0
```

## Observação importante

Para clientes finais, os arquivos da Release precisam estar acessíveis sem token privado. Se o repositório for privado, o cliente não conseguirá baixar a atualização diretamente pelo GitHub sem autenticação.
