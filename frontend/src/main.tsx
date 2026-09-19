import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { Toaster } from './components/ui/sonner'
import { toast } from "sonner"
import {useDoctorStore } from '@/store/doctorStore'
import { ErrorBoundary } from './components/ErrorBoundary'


useDoctorStore.getState().fetchDoctors();

// Global safety net: React error boundaries only catch crashes during
// render. Anything that throws *outside* React (event handlers, async
// code, timers) used to blank the whole site with no message. Show a
// toast instead so the problem is visible and reportable.
const reportGlobalError = (message: string, detail?: unknown) => {
  console.error("[Global error]", message, detail);
  toast.error(`Unexpected error: ${message}`);
};

window.addEventListener("error", (event) => {
  const message =
    event.error instanceof Error ? event.error.message : (event.message || "Unknown error");
  reportGlobalError(message, event.error ?? event);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event.reason;
  const message =
    reason instanceof Error ? reason.message : String(reason ?? "Unknown error");
  reportGlobalError(message, reason);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster />
    </ErrorBoundary>
  </StrictMode>,
)