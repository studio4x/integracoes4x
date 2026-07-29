# Integrações Studio 4x

Página estática para executar o **WhatsApp Embedded Signup** da Meta no modo de coexistência com o WhatsApp Business App.

## Configuração pública usada

- App ID: `1471972893861151`
- Configuration ID: `1655842242183536`
- Graph API: `v25.0`
- Recurso solicitado: `whatsapp_business_app_onboarding`
- Domínio planejado: `https://integracoes.studio4x.com.br`
- Backend planejado: `https://webhook.studio4x.com.br/webhook/whatsapp-embedded-signup`

> O App Secret e os tokens da Meta não devem ser adicionados a este repositório. Eles ficarão somente no n8n.

## Arquivos

- `index.html`: interface da página de conexão.
- `styles.css`: layout responsivo.
- `app.js`: inicialização do SDK da Meta e abertura do Embedded Signup.
- `.htaccess`: HTTPS, proteção de diretórios e cabeçalhos básicos.
- `robots.txt`: impede indexação em mecanismos de busca.

## Implantação pelo Git Version Control do cPanel

1. Crie o subdomínio `integracoes.studio4x.com.br` com uma raiz de documento própria.
2. No cPanel, abra **Git Version Control**.
3. Clone este repositório na pasta definida como raiz do subdomínio.
4. Use a branch `main`.
5. Confirme que `index.html` está diretamente na raiz pública do subdomínio.
6. Ative o certificado SSL do subdomínio.
7. Acesse `https://integracoes.studio4x.com.br` e confira se a página é carregada.

Em atualizações futuras, use **Update from Remote** no cPanel para baixar os novos commits da branch `main`.

## Requisitos na Meta

No produto **Facebook Login for Business**:

- SDK JavaScript ativado;
- domínio permitido: `integracoes.studio4x.com.br`;
- configuração com o produto WhatsApp Cloud API;
- ativo `Contas do WhatsApp`;
- permissões `whatsapp_business_management` e `whatsapp_business_messaging`.

## Backend ainda necessário

A página envia o código de autorização e os IDs retornados pela Meta para:

```text
POST https://webhook.studio4x.com.br/webhook/whatsapp-embedded-signup
```

O workflow do n8n deverá:

1. validar a origem e o payload;
2. trocar o código de autorização por um token no servidor;
3. recuperar e confirmar os ativos autorizados;
4. inscrever o aplicativo na WABA;
5. devolver um JSON de sucesso para a página.

Formato de resposta esperado pela página:

```json
{
  "success": true,
  "wabaId": "123456789",
  "phoneNumberId": "987654321"
}
```

A conexão só será concluída depois que esse workflow estiver publicado e com CORS configurado para `https://integracoes.studio4x.com.br`.

## Segurança

- Não registrar o código de autorização em logs desnecessários.
- Não expor App Secret, tokens ou credenciais no frontend.
- Restringir o CORS do webhook ao domínio da página.
- Armazenar os tokens de forma protegida no backend.
- Não realizar o onboarding definitivo do número principal antes de testar o fluxo completo.
