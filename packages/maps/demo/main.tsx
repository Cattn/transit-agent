// Demo entry. The two MapLibre lines below are the setup every app using @transit/maps/web needs once.
import 'maplibre-gl/dist/maplibre-gl.css';
import { setWorkerUrl } from 'maplibre-gl';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './demo.css';

setWorkerUrl(workerUrl); // MapLibre v6: without this the map stays blank

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
