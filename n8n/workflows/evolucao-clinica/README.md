# Evolução Clínica — WhatsApp Cloud API

Workflow exclusivo da WABA do Evolução Clínica.

## Workflow

- Arquivo: `whatsapp-cloud-webhook-router.json`
- Nome no n8n: `Evolução Clínica - WhatsApp Cloud API - Receptor e Roteador`
- Endpoint: `/webhook/evolucao-clinica-whatsapp-cloud-events`
- Estado inicial: inativo

## Variáveis necessárias no n8n

```text
EVOLUCAO_CLINICA_WHATSAPP_WEBHOOK_VERIFY_TOKEN
EVOLUCAO_CLINICA_WHATSAPP_APP_SECRET
EVOLUCAO_CLINICA_CHATBOT_WEBHOOK_URL
EVOLUCAO_CLINICA_CHATBOT_ROUTER_TOKEN
EVOLUCAO_CLINICA_WHATSAPP_EVENTS_URL
EVOLUCAO_CLINICA_WHATSAPP_EVENTS_TOKEN
```

Os tokens de roteamento são opcionais, mas recomendados. Nenhum segredo deve ser gravado no JSON ou no GitHub.

## Roteamento

- mensagens recebidas: chatbot do Evolução Clínica;
- status de mensagens: plataforma Evolução Clínica;
- ecos do WhatsApp Business App: plataforma Evolução Clínica;
- sincronização da coexistência: plataforma Evolução Clínica;
- eventos não classificados: log interno do workflow.

## Associação com a WABA

Para manter este workflow exclusivo do Evolução Clínica quando o mesmo aplicativo Meta atender outras empresas, a inscrição da WABA deve utilizar um callback alternativo no endpoint `/{WABA_ID}/subscribed_apps`, informando este callback e o mesmo token de verificação configurado no n8n.

Essa associação deve ser feita somente depois que o workflow estiver configurado, publicado e com o endpoint de verificação funcionando.
