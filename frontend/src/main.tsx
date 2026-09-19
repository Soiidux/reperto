import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import { Toaster } from './components/ui/sonner'
import {useDoctorStore } from '@/store/doctorStore'
import { ErrorBoundary } from './components/ErrorBoundary'


useDoctorStore.getState().fetchDoctors();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
      <Toaster />
    </ErrorBoundary>
  </StrictMode>,
)
