import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { AppSettingsProvider } from './context/AppSettingsContext'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import DietPage from './pages/DietPage'
import MacroTrackerPage from './pages/MacroTrackerPage'
import WaterPage from './pages/WaterPage'
import FoodDatabasePage from './pages/FoodDatabasePage'
import ProfilePage from './pages/ProfilePage'
import ChatPage from './pages/ChatPage'
import DocumentsPage from './pages/DocumentsPage'
import ProgressPage from './pages/ProgressPage'
import ActivityPage from './pages/ActivityPage'
import StatisticsPage from './pages/StatisticsPage'
import WellnessPage from './pages/WellnessPage'
import DietitianChatPage from './pages/DietitianChatPage'
import BottomNav from './components/BottomNav'
import LoadingScreen from './components/LoadingScreen'
import InstallBanner from './components/InstallBanner'
import { NotificationProvider } from './context/NotificationContext'
import OfflineBar from './components/OfflineBar'

function PrivateRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  return children
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <LoadingScreen />
  if (user) return <Navigate to="/" replace />
  return children
}

function PatientRoute({ children }) {
  const { user, loading, isDietitian } = useAuth()
  if (loading) return <LoadingScreen />
  if (!user) return <Navigate to="/login" replace />
  if (isDietitian) return <Navigate to="/dietitian/chat" replace />
  return children
}

function AppInner() {
  const { user, isDietitian, refreshProfile } = useAuth()

  // When connectivity is restored, refresh profile and let pages react to auth state
  async function handleReconnect() {
    if (user) await refreshProfile()
  }

  return (
    <NotificationProvider user={user}>
      <OfflineBar onReconnect={handleReconnect} />
      <InstallBanner />
      {user && !isDietitian && <BottomNav />}
      <div className={user && !isDietitian ? 'app-content' : 'app-content-public'}>
        <Routes>
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
          <Route path="/dietitian/chat" element={<PrivateRoute><DietitianChatPage /></PrivateRoute>} />
          <Route path="/" element={<PatientRoute><DashboardPage /></PatientRoute>} />
          <Route path="/dieta" element={<PatientRoute><DietPage /></PatientRoute>} />
          <Route path="/macro" element={<PatientRoute><MacroTrackerPage /></PatientRoute>} />
          <Route path="/acqua" element={<PatientRoute><WaterPage /></PatientRoute>} />
          <Route path="/alimenti" element={<PatientRoute><FoodDatabasePage /></PatientRoute>} />
          <Route path="/chat" element={<PatientRoute><ChatPage /></PatientRoute>} />
          <Route path="/documenti" element={<PatientRoute><DocumentsPage /></PatientRoute>} />
          <Route path="/progressi" element={<PatientRoute><ProgressPage /></PatientRoute>} />
          <Route path="/attivita" element={<PatientRoute><ActivityPage /></PatientRoute>} />
          <Route path="/statistiche" element={<PatientRoute><StatisticsPage /></PatientRoute>} />
          <Route path="/benessere" element={<PatientRoute><WellnessPage /></PatientRoute>} />
          <Route path="/profilo" element={<PatientRoute><ProfilePage /></PatientRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </NotificationProvider>
  )
}

export default function App() {
  return (
    <AppSettingsProvider>
      <AppInner />
    </AppSettingsProvider>
  )
}
