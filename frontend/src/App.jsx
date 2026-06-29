import React, { createContext, useContext, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Projects from './pages/Projects.jsx';
import Project from './pages/Project/index.jsx';
import { api } from './api.js';

export const AuthContext = createContext(null);
export function useAuth() { return useContext(AuthContext); }

export default function App() {
  const [user, setUser] = useState(undefined); // undefined = loading

  useEffect(() => {
    const t = localStorage.getItem('fp_token');
    if (!t) { setUser(null); return; }
    api.me().then(setUser).catch(() => { localStorage.removeItem('fp_token'); setUser(null); });
  }, []);

  if (user === undefined) return null; // splash

  return (
    <AuthContext.Provider value={{ user, setUser }}>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={user ? <Projects /> : <Navigate to="/login" />} />
        <Route path="/projects/:id" element={user ? <Project /> : <Navigate to="/login" />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </AuthContext.Provider>
  );
}
