import { useState } from 'react';
import type { FormEvent } from 'react';
import { Metric, Page } from './layout.tsx';
import { eventTypes, responses } from './model.ts';
import type { EventType, Report, ResponseCode } from './model.ts';

const responseLabel = Object.fromEntries(responses);

export function App() {
  const [eventId, setEventId] = useState('evt_invoice_01');
  const [eventType, setEventType] = useState<EventType>('invoice.paid');
  const [plan, setPlan] = useState<ResponseCode[]>(['503', 'lost', '200']);
  const [deduplicate, setDeduplicate] = useState(true);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function run(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setReport(null);
    try {
      const response = await fetch('/api/deliver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, eventType, plan, deduplicate }),
      });
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error('The local delivery endpoint did not return JSON.');
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setReport(result);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The delivery run failed.');
    } finally {
      setBusy(false);
    }
  }

  return <Page>
    <form className="panel controls" aria-labelledby="configure" onSubmit={run}>
      <h2 className="wide" id="configure">Configure a delivery</h2>
      <label>Event type
        <select value={eventType} onChange={event => setEventType(event.target.value as EventType)}>
          {eventTypes.map(type => <option key={type}>{type}</option>)}
        </select>
      </label>
      <label>Event ID
        <input type="text" value={eventId} onChange={event => setEventId(event.target.value)}
          required minLength={3} maxLength={40} autoComplete="off" spellCheck={false}
          aria-describedby="id-format" />
      </label>
      <p id="id-format" className="wide hint">Letters, numbers, hyphens, or underscores. Retries reuse the same event ID.</p>
      <fieldset className="responses wide">
        <legend>Receiver responses in order</legend>
        <div>
          {plan.map((code, index) => <label key={index}>Attempt {index + 1}
            <select value={code} onChange={event => {
              const selected = event.target.value as ResponseCode;
              setPlan(current => current.map((value, at) => at === index ? selected : value));
            }}>
              {responses.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
            </select>
          </label>)}
        </div>
      </fieldset>
      <label className="check wide">
        <input type="checkbox" checked={deduplicate} onChange={event => setDeduplicate(event.target.checked)} />
        Ignore repeated event IDs
      </label>
      <div className="actions wide">
        <button type="submit" disabled={busy}>Send test event</button>
        <span role="status">{busy ? 'Running delivery…' : report?.outcome}</span>
      </div>
      <p className="wide hint" role="alert">{error}</p>
    </form>
    {report && <section className="panel events" aria-labelledby="timeline">
      <h2 id="timeline">Delivery timeline</h2>
      <p className="hint"><strong>{report.eventType}</strong> · <code>{report.eventId}</code></p>
      <dl className="summary">
        <Metric label="Effects applied">{report.effects}</Metric>
        <Metric label="Attempts">{report.attempts.length}</Metric>
      </dl>
      <div className="table" role="region" tabIndex={0} aria-labelledby="timeline">
        <table>
          <thead><tr>
            <th scope="col">Attempt</th><th scope="col">Virtual time</th><th scope="col">Response</th>
            <th scope="col">Receiver action</th><th scope="col">Sender decision</th>
          </tr></thead>
          <tbody>{report.attempts.map(attempt => <tr key={attempt.number}>
            <td>{attempt.number}</td><td>+{attempt.at} s</td><td>{responseLabel[attempt.response]}</td>
            <td>{attempt.action}</td><td>{attempt.next}</td>
          </tr>)}</tbody>
        </table>
      </div>
    </section>}
    <p className="note">The local server simulates the receiver and retries at virtual times. No requests go to external endpoints; each run starts with an empty set of event IDs.</p>
  </Page>;
}
