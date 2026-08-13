import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import CristovaoApp from './CristovaoApp';
import './styles.css';
import './sourceIntelligence.css';
import './intelligence.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CristovaoApp />
  </StrictMode>,
);
