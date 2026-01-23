import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import MainApp from './MainApp.tsx'
import { ModalProvider } from './contexts/ModalContext.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ModalProvider>
      <MainApp />
    </ModalProvider>
  </StrictMode>,
)
