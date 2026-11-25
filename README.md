# Webhook Playground

Send a test event to a local endpoint and see why the sender retries, stops, or acknowledges delivery. The default scenario starts with a 503, applies the event but loses the second response, then acknowledges the retry. Turn off duplicate detection and run it again: the effect is applied twice.

## Run it

Node.js 24 or newer.

~~~sh
npm ci
npm run dev
~~~

Open the URL printed by Vite. To try the built UI and its local API, run `npm run build` and `npm start`. A static-only deployment cannot run the API.

## How the demo behaves

- The React form makes one HTTP POST to the local Node endpoint. It does not send to a third party.
- The endpoint replays up to three simulated attempts at 0, 1, and 3 seconds on a virtual clock. A 429, 503, or lost response gets retried; a 400 stops the run.
- With duplicate detection on, the receiver applies the first effect for an event ID and ignores subsequent attempts with that ID. State is scoped to one demo run; this is not a persistent idempotency store.

Run `npm test` to verify the scenarios and the HTTP route. The receiver is intentionally a model, not a production webhook ingestion service.
