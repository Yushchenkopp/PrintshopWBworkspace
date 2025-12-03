import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

console.log("Main script executing...");

const rootElement = document.getElementById('root');
console.log("Root element:", rootElement);

if (!rootElement) {
  console.error("FATAL: Root element not found!");
  document.body.innerHTML = '<h1 style="color:red; font-size: 50px;">FATAL ERROR: ROOT NOT FOUND</h1>';
} else {
  try {
    const root = createRoot(rootElement);
    console.log("React Root created, rendering...");
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    );
    console.log("Render called");
  } catch (e) {
    console.error("Error during render:", e);
    document.body.innerHTML = `<h1 style="color:red;">RENDER ERROR: ${e}</h1>`;
  }
}
