"use strict";

/**
 * Configuração pública do Embedded Signup.
 * O App Secret e os tokens nunca devem ser adicionados a este arquivo.
 */
const CONFIG = Object.freeze({
  appId: "1471972893861151",
  configurationId: "1655842242183536",
  graphApiVersion: "v25.0",
  backendWebhookUrl: "https://webhook.studio4x.com.br/webhook/whatsapp-embedded-signup",
  allowedMetaOrigins: new Set([
    "https://www.facebook.com",
    "https://web.facebook.com"
  ])
});

const state = {
  sdkReady: false,
  authorizationCode: null,
  sessionInfo: null,
  submissionStarted: false
};

const elements = {
  connectButton: document.getElementById("connect-button"),
  buttonLabel: document.getElementById("button-label"),
  statusIndicator: document.getElementById("status-indicator"),
  statusTitle: document.getElementById("status-title"),
  statusMessage: document.getElementById("status-message"),
  resultDetails: document.getElementById("result-details"),
  resultWaba: document.getElementById("result-waba"),
  resultPhone: document.getElementById("result-phone"),
  currentYear: document.getElementById("current-year")
};

function setStatus(type, title, message) {
  const allowedTypes = new Set(["loading", "ready", "working", "success", "error"]);
  const safeType = allowedTypes.has(type) ? type : "loading";

  elements.statusIndicator.className = `status-indicator is-${safeType}`;
  elements.statusTitle.textContent = title;
  elements.statusMessage.textContent = message;
}

function setButton({ disabled, label }) {
  elements.connectButton.disabled = disabled;
  elements.buttonLabel.textContent = label;
}

function resetSessionState() {
  state.authorizationCode = null;
  state.sessionInfo = null;
  state.submissionStarted = false;
  elements.resultDetails.hidden = true;
}

function parseMetaMessage(rawData) {
  if (typeof rawData === "object" && rawData !== null) {
    return rawData;
  }

  if (typeof rawData !== "string") {
    return null;
  }

  try {
    return JSON.parse(rawData);
  } catch {
    return null;
  }
}

function normalizeSessionData(data) {
  if (!data || typeof data !== "object") {
    return {};
  }

  return {
    wabaId: data.waba_id ?? data.wabaId ?? null,
    phoneNumberId: data.phone_number_id ?? data.phoneNumberId ?? null,
    businessId: data.business_id ?? data.businessId ?? null
  };
}

window.addEventListener("message", (event) => {
  if (!CONFIG.allowedMetaOrigins.has(event.origin)) {
    return;
  }

  const payload = parseMetaMessage(event.data);
  if (!payload || payload.type !== "WA_EMBEDDED_SIGNUP") {
    return;
  }

  switch (payload.event) {
    case "FINISH":
    case "FINISH_ONLY_WABA":
      state.sessionInfo = normalizeSessionData(payload.data);
      setStatus(
        "working",
        "Autorização recebida",
        "A Meta confirmou os ativos do WhatsApp. Estamos finalizando a conexão segura."
      );
      void tryCompleteSignup();
      break;

    case "CANCEL":
      resetSessionState();
      setStatus(
        "ready",
        "Conexão não concluída",
        "O processo foi cancelado antes da conclusão. Você pode iniciar novamente quando estiver pronto."
      );
      setButton({ disabled: false, label: "Conectar WhatsApp Business" });
      break;

    case "ERROR":
      resetSessionState();
      setStatus(
        "error",
        "Não foi possível concluir",
        "A Meta informou um erro durante a autorização. Verifique os dados selecionados e tente novamente."
      );
      setButton({ disabled: false, label: "Tentar novamente" });
      break;

    default:
      break;
  }
});

async function submitAuthorizationToBackend() {
  const response = await fetch(CONFIG.backendWebhookUrl, {
    method: "POST",
    mode: "cors",
    credentials: "omit",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      source: "studio4x_whatsapp_embedded_signup",
      authorizationCode: state.authorizationCode,
      sessionInfo: state.sessionInfo,
      appId: CONFIG.appId,
      configurationId: CONFIG.configurationId,
      redirectOrigin: window.location.origin,
      requestedFeature: "whatsapp_business_app_onboarding"
    })
  });

  const responseText = await response.text();
  let responseBody = {};

  if (responseText) {
    try {
      responseBody = JSON.parse(responseText);
    } catch {
      throw new Error("O backend retornou uma resposta inválida.");
    }
  }

  if (!response.ok || responseBody.success !== true) {
    const message = typeof responseBody.message === "string"
      ? responseBody.message
      : "O backend não conseguiu concluir a configuração.";
    throw new Error(message);
  }

  return responseBody;
}

async function tryCompleteSignup() {
  if (
    state.submissionStarted ||
    !state.authorizationCode ||
    !state.sessionInfo
  ) {
    return;
  }

  state.submissionStarted = true;
  setButton({ disabled: true, label: "Finalizando conexão…" });
  setStatus(
    "working",
    "Finalizando",
    "Estamos validando a autorização e configurando a conta do WhatsApp no servidor da Studio 4x."
  );

  try {
    const result = await submitAuthorizationToBackend();
    const wabaId = result.wabaId ?? state.sessionInfo.wabaId ?? "Conectada";
    const phoneNumberId = result.phoneNumberId ?? state.sessionInfo.phoneNumberId ?? "Conectado";

    elements.resultWaba.textContent = String(wabaId);
    elements.resultPhone.textContent = String(phoneNumberId);
    elements.resultDetails.hidden = false;

    setStatus(
      "success",
      "WhatsApp conectado",
      "A autorização foi concluída. O número está pronto para as próximas configurações da integração."
    );
    setButton({ disabled: true, label: "Conexão concluída" });

    // O código de autorização é descartado assim que o backend conclui a troca.
    state.authorizationCode = null;
  } catch (error) {
    state.submissionStarted = false;
    state.authorizationCode = null;

    const message = error instanceof Error
      ? error.message
      : "Não foi possível concluir a configuração no servidor.";

    setStatus(
      "error",
      "Falha na finalização",
      `${message} Inicie a autorização novamente para gerar um novo código.`
    );
    setButton({ disabled: false, label: "Tentar novamente" });
  }
}

function launchEmbeddedSignup() {
  if (!state.sdkReady || typeof window.FB === "undefined") {
    setStatus(
      "error",
      "Serviço indisponível",
      "O serviço da Meta ainda não foi carregado. Atualize a página e tente novamente."
    );
    return;
  }

  resetSessionState();
  setButton({ disabled: true, label: "Aguardando autorização…" });
  setStatus(
    "working",
    "Autorização em andamento",
    "Conclua as etapas na janela oficial da Meta que será aberta."
  );

  window.FB.login((response) => {
    const code = response?.authResponse?.code;

    if (!code) {
      resetSessionState();
      setStatus(
        "ready",
        "Autorização não concluída",
        "A Meta não retornou um código de autorização. Você pode iniciar o processo novamente."
      );
      setButton({ disabled: false, label: "Conectar WhatsApp Business" });
      return;
    }

    state.authorizationCode = code;
    void tryCompleteSignup();
  }, {
    config_id: CONFIG.configurationId,
    response_type: "code",
    override_default_response_type: true,
    extras: {
      setup: {},
      featureType: "whatsapp_business_app_onboarding",
      sessionInfoVersion: "3"
    }
  });
}

window.fbAsyncInit = function fbAsyncInit() {
  window.FB.init({
    appId: CONFIG.appId,
    autoLogAppEvents: true,
    xfbml: true,
    version: CONFIG.graphApiVersion
  });

  state.sdkReady = true;
  setStatus(
    "ready",
    "Pronto para conectar",
    "O serviço oficial da Meta foi carregado. Clique no botão para iniciar a autorização."
  );
  setButton({ disabled: false, label: "Conectar WhatsApp Business" });
};

elements.connectButton.addEventListener("click", launchEmbeddedSignup);
elements.currentYear.textContent = String(new Date().getFullYear());

// Evita que a interface fique indefinidamente em carregamento quando o SDK for bloqueado.
window.setTimeout(() => {
  if (!state.sdkReady) {
    setStatus(
      "error",
      "Não foi possível carregar a Meta",
      "Verifique bloqueadores de conteúdo, cookies de terceiros e a conexão com a internet. Depois, atualize a página."
    );
    setButton({ disabled: true, label: "Serviço da Meta indisponível" });
  }
}, 12000);
