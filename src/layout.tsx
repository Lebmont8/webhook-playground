import type { ReactNode } from 'react';

export function Page({ children }: { children: ReactNode }) {
  return <main>
    <header className="masthead">
      <h1>Webhook Playground</h1>
      <p>Send a local test event, change the receiver’s responses, and see what gets retried or applied twice.</p>
    </header>
    {children}
  </main>;
}

export function Metric({ label, children }: { label: string; children: ReactNode }) {
  return <div><dt>{label}</dt><dd>{children}</dd></div>;
}
