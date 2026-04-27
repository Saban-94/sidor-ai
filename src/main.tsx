import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ToastProvider } from './providers/ToastProvider';
import { SyncProvider } from './providers/SyncProvider';
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <SyncProvider>
          <App />
        </SyncProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
);
