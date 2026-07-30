# Templates de workflows do n8n

Os arquivos e orientações desta pasta servem como base para novas integrações. Esta pasta não é monitorada pelo deploy automático.

## Criar um roteador para outra empresa

1. Copie `n8n/workflows/evolucao-clinica/whatsapp-cloud-webhook-router.json` para:

```text
n8n/workflows/<slug-da-empresa>/whatsapp-cloud-webhook-router.json
```

2. Substitua no arquivo copiado:

- `Evolução Clínica` pelo nome da empresa;
- `evolucao-clinica` pelo slug da empresa;
- `EVOLUCAO_CLINICA_` por um prefixo exclusivo;
- `evolucao-clinica-whatsapp-cloud-events` por um caminho exclusivo;
- o valor de `tenant` pelo slug da empresa;
- remova `deployment.previousNames`, salvo quando estiver renomeando um workflow existente.

3. Crie variáveis exclusivas no servidor do n8n:

```text
<EMPRESA>_WHATSAPP_WEBHOOK_VERIFY_TOKEN
<EMPRESA>_WHATSAPP_APP_SECRET
<EMPRESA>_CHATBOT_WEBHOOK_URL
<EMPRESA>_CHATBOT_ROUTER_TOKEN
<EMPRESA>_WHATSAPP_EVENTS_URL
<EMPRESA>_WHATSAPP_EVENTS_TOKEN
```

4. Faça o commit do novo JSON. O GitHub Actions criará ou atualizará automaticamente o workflow no n8n.

5. Mantenha o workflow inativo até configurar os segredos, destinos e testes.

6. Associe a WABA ao endpoint exclusivo usando o callback alternativo de `/{WABA_ID}/subscribed_apps`.

Cada empresa deve possuir endpoint, token de verificação, App Secret, destinos e logs independentes.
