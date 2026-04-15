import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './store/authSync' // activates real-time Firestore subscriptions on auth changes
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
