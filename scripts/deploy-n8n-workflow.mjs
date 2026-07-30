import { readFile } from 'node:fs/promises';

const baseUrl = (process.env.N8N_BASE_URL ?? '').replace(/\/$/, '');
const apiKey = process.env.N8N_API_KEY ?? '';
const workflowFile = process.env.N8N_WORKFLOW_FILE ?? '';

if (!baseUrl) throw new Error('N8N_BASE_URL não foi configurada.');
if (!apiKey) throw new Error('N8N_API_KEY não foi configurada.');
if (!workflowFile) throw new Error('N8N_WORKFLOW_FILE não foi configurado.');

const source = JSON.parse(await readFile(workflowFile, 'utf8'));

for (const field of ['name', 'nodes', 'connections', 'settings']) {
  if (source[field] === undefined) {
    throw new Error(`O arquivo do workflow não contém o campo obrigatório: ${field}`);
  }
}

const previousNames = Array.isArray(source?.deployment?.previousNames)
  ? source.deployment.previousNames
      .filter((name) => typeof name === 'string')
      .map((name) => name.trim())
      .filter(Boolean)
  : [];
const candidateNames = [...new Set([source.name, ...previousNames])];

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'X-N8N-API-KEY': apiKey,
};

async function n8nRequest(path, options = {}) {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    ...options,
    headers: { ...headers, ...(options.headers ?? {}) },
  });

  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!response.ok) {
    const details = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
    throw new Error(`n8n respondeu HTTP ${response.status} em ${path}:\n${details}`);
  }

  return body;
}

async function findWorkflowsByNames(names) {
  const expectedNames = new Set(names);
  const matches = new Map();
  let cursor;

  do {
    const query = new URLSearchParams({ limit: '100' });
    if (cursor) query.set('cursor', cursor);

    const result = await n8nRequest(`/workflows?${query.toString()}`);
    for (const workflow of result?.data ?? []) {
      if (expectedNames.has(workflow.name)) matches.set(workflow.id, workflow);
    }
    cursor = result?.nextCursor ?? null;
  } while (cursor);

  return [...matches.values()];
}

function mergeRuntimeConfiguration(desiredNodes, currentNodes = []) {
  const currentById = new Map(currentNodes.map((node) => [node.id, node]));
  const currentByName = new Map(currentNodes.map((node) => [node.name, node]));

  return desiredNodes.map((node) => {
    const current = currentById.get(node.id) ?? currentByName.get(node.name);
    if (!current) return node;

    const merged = { ...node };

    // Credenciais são configuradas dentro do n8n e nunca ficam no GitHub.
    if (current.credentials && Object.keys(current.credentials).length > 0) {
      merged.credentials = current.credentials;
    }

    // Mantém a identidade interna do webhook ao atualizar ou renomear o workflow.
    if (current.webhookId) {
      merged.webhookId = current.webhookId;
    }

    return merged;
  });
}

function buildPayload(sourceWorkflow, currentWorkflow = null) {
  return {
    name: sourceWorkflow.name,
    nodes: mergeRuntimeConfiguration(sourceWorkflow.nodes, currentWorkflow?.nodes),
    connections: sourceWorkflow.connections,
    settings: sourceWorkflow.settings,
    ...(sourceWorkflow.staticData ? { staticData: sourceWorkflow.staticData } : {}),
  };
}

const existingMatches = await findWorkflowsByNames(candidateNames);
if (existingMatches.length > 1) {
  const details = existingMatches.map((workflow) => `${workflow.name} (${workflow.id})`).join(', ');
  throw new Error(`Mais de um workflow corresponde ao nome atual ou aos nomes anteriores: ${details}`);
}

const existingSummary = existingMatches[0] ?? null;
let result;
let operation;

if (existingSummary) {
  const current = await n8nRequest(`/workflows/${existingSummary.id}`);
  result = await n8nRequest(`/workflows/${existingSummary.id}`, {
    method: 'PUT',
    body: JSON.stringify(buildPayload(source, current)),
  });
  operation = existingSummary.name === source.name ? 'atualizado' : 'renomeado e atualizado';
} else {
  result = await n8nRequest('/workflows', {
    method: 'POST',
    body: JSON.stringify(buildPayload(source)),
  });
  operation = 'criado';
}

console.log(`Workflow ${operation} com sucesso.`);
console.log(`Nome: ${result.name}`);
console.log(`ID: ${result.id}`);
console.log(`Ativo: ${Boolean(result.active)}`);

if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import('node:fs/promises');
  await appendFile(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## Implantação no n8n',
      '',
      `- **Operação:** ${operation}`,
      `- **Workflow:** ${result.name}`,
      `- **ID:** \`${result.id}\``,
      `- **Ativo:** ${Boolean(result.active) ? 'sim' : 'não'}`,
      '',
      'As credenciais e os identificadores internos dos webhooks configurados no n8n são preservados nas atualizações.',
      '',
    ].join('\n'),
  );
}
