import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.tsx'
import AppAuth0Provider from './auth/AppAuth0Provider'
import { queryClient } from './lib/queryClient'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AppAuth0Provider>
        <App />
      </AppAuth0Provider>
    </QueryClientProvider>
  </StrictMode>,
)
