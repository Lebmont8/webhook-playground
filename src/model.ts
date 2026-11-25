export const eventTypes = ['invoice.paid', 'order.created', 'subscription.updated'] as const;
export const responses = [
  ['200', '200 OK'],
  ['204', '204 No Content'],
  ['400', '400 Bad Request'],
  ['429', '429 Too Many Requests'],
  ['503', '503 Service Unavailable'],
  ['lost', 'Timeout after applying event'],
] as const;

export type EventType = typeof eventTypes[number];
export type ResponseCode = typeof responses[number][0];
export type Scenario = {
  eventId: string;
  eventType: EventType;
  plan: ResponseCode[];
  deduplicate: boolean;
};
export type Attempt = {
  number: number;
  at: number;
  response: ResponseCode;
  action: string;
  next: string;
};

export function parseScenario(value: unknown): Scenario {
  if (typeof value !== 'object' || value === null) throw new Error('Expected an event scenario.');
  const item = value as Record<string, unknown>;
  const { eventId, eventType, plan, deduplicate } = item;
  if (typeof eventId !== 'string' || !/^[a-zA-Z0-9_-]{3,40}$/.test(eventId)) {
    throw new Error('Use 3–40 letters, numbers, hyphens or underscores for the event ID.');
  }
  if (!eventTypes.some(type => type === eventType)) throw new Error('Select a supported event type.');
  if (!Array.isArray(plan) || plan.length !== 3 ||
      !plan.every(code => responses.some(([allowed]) => allowed === code))) {
    throw new Error('Select a response for each of the three attempts.');
  }
  if (typeof deduplicate !== 'boolean') throw new Error('Deduplication must be on or off.');
  return { eventId, eventType: eventType as EventType, plan, deduplicate };
}

export function simulate(scenario: Scenario) {
  const times = [0, 1, 3];
  const seen = new Set<string>();
  const attempts: Attempt[] = [];
  let effects = 0;
  for (const [index, response] of scenario.plan.entries()) {
    const accepted = response === '200' || response === '204';
    const reachedHandler = accepted || response === 'lost';
    let action = 'No effect';
    if (reachedHandler) {
      if (scenario.deduplicate && seen.has(scenario.eventId)) {
        action = 'Duplicate ignored';
      } else {
        effects++;
        seen.add(scenario.eventId);
        action = 'Effect applied';
      }
    }
    const retryable = response === '429' || response === '503' || response === 'lost';
    let next = 'Acknowledged';
    if (!accepted) {
      next = !retryable ? 'Stopped: permanent failure'
        : index + 1 === times.length ? 'Stopped: retry limit'
        : 'Retry at +' + times[index + 1] + ' s';
    }
    attempts.push({ number: index + 1, at: times[index], response, action, next });
    if (!retryable) break;
  }
  return {
    eventId: scenario.eventId, eventType: scenario.eventType,
    attempts, effects, outcome: attempts.at(-1)!.next,
  };
}
export type Report = ReturnType<typeof simulate>;
