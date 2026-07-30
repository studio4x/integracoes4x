import fs from 'node:fs';
import path from 'node:path';

const workflowPath = path.resolve(
  process.cwd(),
  'n8n/workflows/evolucao-clinica/whatsapp-cloud-webhook-router.json',
);

const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const normalizeNode = workflow.nodes?.find((node) => node.name === 'Normalizar eventos');

if (!normalizeNode?.parameters) {
  throw new Error('Node "Normalizar eventos" não encontrado no workflow.');
}

normalizeNode.parameters.jsCode = String.raw`const payload = $json.body && typeof $json.body === 'object' ? $json.body : {};
const entries = Array.isArray(payload.entry) ? payload.entry : [];
const webhookReceivedAt = $json.receivedAt || new Date().toISOString();
const normalized = [];

const toIsoTimestamp = (value, fallback) => {
  const text = String(value || '').trim();

  if (/^\d{10,13}$/.test(text)) {
    const numericValue = Number(text);
    const date = new Date(text.length === 10 ? numericValue * 1000 : numericValue);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  if (text) {
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) return date.toISOString();
  }

  return fallback;
};

const fingerprint = (value) => {
  const input = typeof value === 'string' ? value : JSON.stringify(value ?? null);
  let hash = 2166136261;

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(16).padStart(8, '0');
};

const pushEvent = ({
  eventType,
  destination,
  field,
  entryId,
  value,
  message = null,
  statusObject = null,
  contact = null,
  coexistencePayload = null
}) => {
  const metadata = value?.metadata && typeof value.metadata === 'object' ? value.metadata : {};
  const messageId = String(message?.id || statusObject?.id || '').trim() || null;
  const status = String(statusObject?.status || '').trim().toLowerCase() || null;
  const rawValue = statusObject || message || coexistencePayload || value;
  const receivedAt = toIsoTimestamp(
    statusObject?.timestamp || message?.timestamp || coexistencePayload?.timestamp || value?.timestamp,
    webhookReceivedAt
  );
  const eventSubject = messageId
    ? fingerprint(messageId) + ':' + messageId.slice(-48)
    : fingerprint(rawValue);
  const eventKey = [
    'evolucao-clinica',
    eventType,
    entryId || 'no-entry',
    metadata.phone_number_id || 'no-phone-number',
    eventSubject,
    eventType === 'message_status' ? status || 'unknown-status' : field || 'no-field',
    eventType === 'message_status' ? receivedAt : ''
  ].filter(Boolean).join(':').slice(0, 255);

  normalized.push({
    json: {
      tenant: 'evolucao-clinica',
      source: 'meta-whatsapp-cloud-api',
      eventType,
      destination,
      eventKey,
      field,
      receivedAt,
      wabaId: entryId || null,
      phoneNumberId: metadata.phone_number_id || null,
      displayPhoneNumber: metadata.display_phone_number || null,
      messageId,
      senderPhone: message?.from || contact?.wa_id || null,
      recipientPhone: statusObject?.recipient_id || null,
      message,
      status: eventType === 'message_status' ? status : null,
      contacts: contact ? [contact] : [],
      coexistencePayload,
      rawValue
    }
  });
};

for (const entry of entries) {
  const entryId = String(entry?.id || '').trim() || null;
  const changes = Array.isArray(entry?.changes) ? entry.changes : [];

  for (const change of changes) {
    const field = String(change?.field || 'unknown').trim() || 'unknown';
    const value = change?.value && typeof change.value === 'object' ? change.value : {};

    if (field === 'messages') {
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const statuses = Array.isArray(value.statuses) ? value.statuses : [];
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];

      for (const message of messages) {
        const contact = contacts.find((item) => item?.wa_id === message?.from) || contacts[0] || null;
        pushEvent({
          eventType: 'inbound_message',
          destination: 'chatbot',
          field,
          entryId,
          value,
          message,
          contact
        });
      }

      for (const statusObject of statuses) {
        const statusName = String(statusObject?.status || '').trim().toLowerCase();

        if (['sent', 'delivered', 'read', 'failed'].includes(statusName)) {
          pushEvent({
            eventType: 'message_status',
            destination: 'platform',
            field,
            entryId,
            value,
            statusObject
          });
        } else {
          pushEvent({
            eventType: 'unclassified_whatsapp_event',
            destination: 'log',
            field,
            entryId,
            value,
            statusObject
          });
        }
      }

      if (!messages.length && !statuses.length) {
        pushEvent({
          eventType: 'messages_event_without_message_or_status',
          destination: 'log',
          field,
          entryId,
          value
        });
      }

      continue;
    }

    if (field === 'smb_message_echoes') {
      pushEvent({
        eventType: 'business_app_echo',
        destination: 'platform',
        field,
        entryId,
        value,
        coexistencePayload: value
      });
      continue;
    }

    if (field === 'history' || field === 'smb_app_state_sync') {
      pushEvent({
        eventType: 'coexistence_sync',
        destination: 'platform',
        field,
        entryId,
        value,
        coexistencePayload: value
      });
      continue;
    }

    pushEvent({
      eventType: 'unclassified_whatsapp_event',
      destination: 'log',
      field,
      entryId,
      value
    });
  }
}

if (!normalized.length) {
  normalized.push({
    json: {
      tenant: 'evolucao-clinica',
      source: 'meta-whatsapp-cloud-api',
      eventType: 'invalid_or_empty_payload',
      destination: 'log',
      eventKey: 'evolucao-clinica:invalid:' + Date.now(),
      field: null,
      receivedAt: webhookReceivedAt,
      wabaId: null,
      phoneNumberId: null,
      messageId: null,
      status: null,
      rawValue: payload
    }
  });
}

return normalized;`;

const secretsNote = workflow.nodes?.find((node) => node.name === 'Segredos necessários');
if (secretsNote?.parameters?.content) {
  secretsNote.parameters.content = secretsNote.parameters.content.replace(
    '`EVOLUCAO_CLINICA_WHATSAPP_EVENTS_TOKEN` (opcional)',
    '`EVOLUCAO_CLINICA_WHATSAPP_EVENTS_TOKEN`',
  );
}

fs.writeFileSync(workflowPath, `${JSON.stringify(workflow)}\n`, 'utf8');
console.log(`Workflow atualizado: ${workflowPath}`);
