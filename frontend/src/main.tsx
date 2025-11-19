import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { WalletContextProvider } from './contexts/WalletContextProvider';
import './index.css';
import App from './App';
import { Buffer } from 'buffer';

// Polyfill Buffer for browser
window.Buffer = Buffer;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletContextProvider>
      <App />
    </WalletContextProvider>
  </StrictMode>,
);
