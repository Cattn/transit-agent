import { useEffect, useState } from 'react';
import { createApiClient, sections } from '@transit/shared';

const api = createApiClient(import.meta.env.VITE_API_URL ?? '');

export default function App() {
  const [status, setStatus] = useState('Connecting to the server…');

  useEffect(() => {
    let active = true;
    api.health().then(() => {
      if (active) setStatus('Server connected');
    }).catch(() => {
      if (active) setStatus('Server unavailable. Start the API and refresh.');
    });
    return () => { active = false; };
  }, []);

  return (
    <main>
      <header>
        <p className="eyebrow">TRANSIT AGENT</p>
        <h1>A better way to get there.</h1>
        <p className="intro">Flights, daily commutes, and bikes. Plan the whole journey around what matters to you.</p>
      </header>
      <section className="sections" aria-label="Trip planning tools">
        {sections.map((section) => (
          <article key={section.id}>
            <h2>{section.title}</h2>
            <p>{section.description}</p>
            <span className="badge">Coming soon</span>
          </article>
        ))}
      </section>
      <footer role="status">{status}</footer>
    </main>
  );
}
