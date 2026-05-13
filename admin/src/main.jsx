import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import './index.css'
import { App } from './App.jsx'
import { createAdminQueryClient } from './lib/queryClient.js'
import { AdminSocketSync } from './realtime/AdminSocketSync.jsx'

function Root() {
  const [client] = useState(() => createAdminQueryClient())
  return (
    <QueryClientProvider client={client}>
      <BrowserRouter>
        <AdminSocketSync />
        <App />
      </BrowserRouter>
      <Toaster richColors position="top-right" theme="dark" closeButton />
    </QueryClientProvider>
  )
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>
)
