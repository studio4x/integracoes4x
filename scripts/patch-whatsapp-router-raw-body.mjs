import fs from 'node:fs';
import path from 'node:path';

const workflowPath = path.resolve(
  process.cwd(),
  'n8n/workflows/evolucao-clinica/whatsapp-cloud-webhook-router.json',
);

const workflow = JSON.parse(fs.readFileSync(workflowPath, 'utf8'));
const signatureNode = workflow.nodes?.find((node) => node.name === 'Validar assinatura Meta');

if (!signatureNode?.parameters?.jsCode) {
  throw new Error('Node "Validar assinatura Meta" não encontrado no workflow.');
}

const oldBlock = String.raw`const rawBase64 = $binary?.data?.data || '';
if (!rawBase64) {
  result.signatureError = 'O corpo bruto da requisição não foi disponibilizado pelo Webhook node.';
  return [{ json: result }];
}

try {
  const rawBody = Buffer.from(rawBase64, 'base64');
  let expectedHex = '';`;

const newBlock = String.raw`let rawBody = null;
try {
  rawBody = await this.helpers.getBinaryDataBuffer(0, 'data');
} catch {
  rawBody = null;
}

if (!rawBody || !rawBody.length) {
  result.signatureError = 'O corpo bruto da requisição não foi disponibilizado pelo Webhook node.';
  return [{ json: result }];
}

try {
  let expectedHex = '';`;

const currentCode = signatureNode.parameters.jsCode;

if (currentCode.includes(oldBlock)) {
  signatureNode.parameters.jsCode = currentCode.replace(oldBlock, newBlock);
} else if (!currentCode.includes("this.helpers.getBinaryDataBuffer(0, 'data')")) {
  throw new Error('Trecho esperado para leitura do corpo bruto não foi encontrado.');
}

fs.writeFileSync(workflowPath, `${JSON.stringify(workflow)}\n`, 'utf8');
console.log(`Workflow atualizado: ${workflowPath}`);
