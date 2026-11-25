import { parseScenario, simulate } from './src/model.ts';

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function respond(response, status, value) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(value));
}

async function readBody(request) {
  const MAX_BYTES = 2048;
  const contentType = request.headers['content-type']?.split(';')[0].trim();
  if (contentType !== 'application/json') throw new RequestError(415, 'Send application/json.');
  const chunks = [];
  let bytes = 0;
  for await (const part of request.iterator({ destroyOnReturn: false })) {
    bytes += part.length;
    if (bytes > MAX_BYTES) throw new RequestError(413, 'Scenario is too large.');
    chunks.push(part);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new RequestError(400, 'Invalid JSON.');
  }
}

export async function deliveryApi(request, response, next) {
  if (request.url?.split('?')[0] !== '/api/deliver') {
    next();
    return;
  }
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST');
    respond(response, 405, { error: 'Use POST for a delivery scenario.' });
    return;
  }
  try {
    const body = await readBody(request);
    const scenario = parseScenario(body);
    respond(response, 200, simulate(scenario));
  } catch (error) {
    respond(response, error instanceof RequestError ? error.status : 400, { error: error.message });
  }
}
