import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import App from './App';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

if (!PUBLISHABLE_KEY) {
  rootElement.innerHTML = `
    <main style="min-height:100%;display:grid;place-items:center;padding:24px;font-family:Inter,system-ui,sans-serif;color:#2d2a2e;background:#fcfbf9;">
      <section style="max-width:560px;border:1px solid #e5e7eb;background:white;padding:24px;border-radius:8px;box-shadow:0 12px 30px rgba(0,0,0,.06);">
        <h1 style="margin:0 0 8px;font-size:22px;">Moka is missing frontend config</h1>
        <p style="margin:0;line-height:1.6;color:#5d5a5e;">Add the GitHub Actions secret <strong>VITE_CLERK_PUBLISHABLE_KEY</strong>, then rerun the Firebase Hosting workflow.</p>
      </section>
    </main>
  `;
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
      <App />
    </ClerkProvider>
  </React.StrictMode>
);
