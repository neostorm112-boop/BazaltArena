import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthProvider.jsx'
import { ProtectedRoute } from './auth/ProtectedRoute.jsx'
import { LoginPage } from './pages/LoginPage.jsx'
import { HallOfFamePage } from './pages/HallOfFamePage.jsx'
import { MainScreen } from './pages/MainScreen.jsx'
import { DocumentationPage } from './pages/DocumentationPage.jsx'
import { ProfilePage } from './pages/ProfilePage.jsx'
import { SocketSync } from './realtime/SocketSync.jsx'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketSync />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <MainScreen />
              </ProtectedRoute>
            }
          />
          <Route
            path="/hall"
            element={
              <ProtectedRoute>
                <HallOfFamePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/docs"
            element={
              <ProtectedRoute>
                <DocumentationPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
