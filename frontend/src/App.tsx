import { BrowserRouter, Routes, Route } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import { ProtectedRoute } from './components/ProtectedRoute';
import './App.css'
import Login from './pages/Login';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<RootLayout />}>
          <Route path="/" />
          <Route path="/login" element={<Login />} />
          
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
