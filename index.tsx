
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Fix: Access document through the window object to resolve "Cannot find name 'document'" TypeScript error
const rootElement = (window as any).document.getElementById('root');
if (!rootElement) {
  throw new Error("No se pudo encontrar el elemento raíz para montar la aplicación.");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
