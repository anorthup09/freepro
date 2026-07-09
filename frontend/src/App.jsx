import React, { createContext, useContext, useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Projects from './pages/Projects.jsx';
import CrewCalendar from './pages/CrewCalendar.jsx';
import Project from './pages/Project/index.jsx';
import TalentCallSheets from './pages/Project/TalentCallSheets.jsx';
import CrewViews from './pages/CrewViews.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div className="login-wrap">
          <div className="login-box" style={{ textAlign:'center' }}>
            <div className="login-logo">Free<em>Pro</em></div>
            <div style={{ fontSize:14, fontWeight:700, margin:'14px 0 6px' }}>Something went wrong</div>
            <div style={{ fontSize:11, color:'var(--muted)', lineHeight:1.5, overflowWrap:'anywhere' }}>{String(this.state.error?.message || this.state.error)}</div>
            <button className="btn btn-primary btn-sm" style={{ marginTop:16 }} onClick={() => window.location.reload()}>Reload</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function PendingApproval({ setUser }) {
  return (
    <div className="login-wrap">
      <div className="login-box" style={{ textAlign:'center' }}>
        <div className="login-logo">Free<em>Pro</em></div>
        <div style={{ fontSize:14, fontWeight:700, margin:'14px 0 6px' }}>Account awaiting approval</div>
        <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.6 }}>
          Your account was created but doesn't have access yet.<br />
          Ask an admin to approve you, then sign in again.
        </div>
        <button className="btn btn-ghost btn-sm" style={{ marginTop:16 }}
          onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>
          Sign out
        </button>
      </div>
    </div>
  );
}
import Share from './pages/Share.jsx';
import ContractSign from './pages/ContractSign.jsx';
import Hub from './pages/Hub.jsx';
import Finance from './pages/Finance.jsx';
import FinanceProject from './pages/FinanceProject.jsx';
import BudgetShare from './pages/BudgetShare.jsx';
import FinanceReport from './pages/FinanceReport.jsx';
import MfaSetup from './pages/MfaSetup.jsx';
import FinanceOverview from './pages/FinanceOverview.jsx';
import Pipeline from './pages/Pipeline.jsx';
import Avo from './pages/Avo.jsx';
import AvoEdit from './pages/AvoEdit.jsx';
import AvoGantt from './pages/AvoGantt.jsx';
import AvoProject from './pages/AvoProject.jsx';
import GanttShare from './pages/GanttShare.jsx';
import Team from './pages/Team.jsx';
import CallSheetEmails from './pages/Project/CallSheetEmails.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import ProjectView, { ProjectViewDetail } from './pages/ProjectView.jsx';
import ClientHub from './pages/ClientHub.jsx';
import ClientPortal from './pages/ClientPortal.jsx';
import Reports from './pages/Reports.jsx';
import InvoiceSearch from './pages/InvoiceSearch.jsx';
import VccReport, { VccProjectPage } from './pages/VccReport.jsx';
import { api } from './api.js';

export const AuthContext = createContext(null);
export function useAuth() { return useContext(AuthContext); }

export default function App() {
  const [realUser, setUser] = useState(undefined); // undefined = loading
  // Admin role preview: browse the platform as another role (UI-only — the
  // API still sees the admin token, but every route guard and menu follows
  // the previewed role).
  const [preview, setPreviewState] = useState(() => localStorage.getItem('fp_role_preview') || '');
  const setPreview = r => {
    setPreviewState(r || '');
    if (r) localStorage.setItem('fp_role_preview', r); else localStorage.removeItem('fp_role_preview');
  };
  const user = realUser && realUser.role === 'ADMIN' && preview ? { ...realUser, role: preview, previewing: true } : realUser;

  useEffect(() => {
    const t = localStorage.getItem('fp_token');
    if (!t) { setUser(null); return; }
    api.me().then(setUser).catch(() => { localStorage.removeItem('fp_token'); setUser(null); });
  }, []);

  if (realUser === undefined) return null; // splash

  return (
    <ErrorBoundary>
    <AuthContext.Provider value={{ user, setUser, realUser, preview, setPreview }}>
      {realUser?.role === 'ADMIN' && preview && (
        <div style={{ position:'sticky', top:0, zIndex:400, background:'#2a1a4a', borderBottom:'1px solid #a78bfa',
          display:'flex', alignItems:'center', justifyContent:'center', gap:14, padding:'7px 14px' }}>
          <span style={{ fontSize:12, fontWeight:800, color:'#c9b8f5' }}>👁 Previewing as {preview}</span>
          <button onClick={() => setPreview('')}
            style={{ background:'#a78bfa', border:'none', color:'#14092e', borderRadius:14, padding:'3px 14px', fontSize:11, fontWeight:800, cursor:'pointer' }}>
            Exit Preview
          </button>
        </div>
      )}
      {user?.role === 'PENDING' ? <PendingApproval setUser={setUser} /> : (realUser && (['ADMIN','PRODUCER'].includes(realUser.role) || realUser.mfa_required === true) && realUser.mfa_enabled === false) ? <MfaSetup /> : (
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={user ? <Hub /> : <Navigate to="/login" />} />
        <Route path="/projects" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <Projects />) : <Navigate to="/login" />} />
        <Route path="/crew-calendar" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : user.role === 'FINANCE' ? <Navigate to="/" /> : <CrewCalendar />) : <Navigate to="/login" />} />
        <Route path="/finance" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : <Finance />) : <Navigate to="/login" />} />
        <Route path="/pipeline" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : <Pipeline />) : <Navigate to="/login" />} />
        <Route path="/finance/overview" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : <FinanceOverview />) : <Navigate to="/login" />} />
        <Route path="/finance/report" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : <FinanceReport />) : <Navigate to="/login" />} />
        <Route path="/finance/:pid" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : <FinanceProject />) : <Navigate to="/login" />} />
        <Route path="/crew-views" element={user ? <CrewViews /> : <Navigate to="/login" />} />
        <Route path="/projects/:id" element={user ? (user.role === 'CREW' ? <Navigate to="/crew-views" /> : user.role === 'FINANCE' ? <Navigate to="/" /> : <Project />) : <Navigate to="/login" />} />
        <Route path="/projects/:id/talent-callsheets" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : <TalentCallSheets />) : <Navigate to="/login" />} />
        <Route path="/projects/:id/emails" element={user ? <CallSheetEmails /> : <Navigate to="/login" />} />
        <Route path="/reports" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/" /> : <Reports />) : <Navigate to="/login" />} />
        <Route path="/reports/vcc" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/" /> : <VccReport />) : <Navigate to="/login" />} />
        <Route path="/reports/vcc/:pid" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/" /> : <VccProjectPage />) : <Navigate to="/login" />} />
        <Route path="/reports/invoices" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/" /> : <InvoiceSearch />) : <Navigate to="/login" />} />
        <Route path="/project-view" element={user ? (['CREW','AGENCY','FINANCE'].includes(user.role) ? <Navigate to="/" /> : <ProjectView />) : <Navigate to="/login" />} />
        <Route path="/project-view/client/:client" element={user ? (['CREW','AGENCY','FINANCE'].includes(user.role) ? <Navigate to="/" /> : <ClientHub />) : <Navigate to="/login" />} />
        <Route path="/project-view/:pid" element={user ? (['CREW','AGENCY','FINANCE'].includes(user.role) ? <Navigate to="/" /> : <ProjectViewDetail />) : <Navigate to="/login" />} />
        <Route path="/team" element={user ? <Team /> : <Navigate to="/login" />} />
        <Route path="/avo" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <Avo />) : <Navigate to="/login" />} />
        <Route path="/avo/gantt" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <AvoGantt />) : <Navigate to="/login" />} />
        <Route path="/avo/project/:id" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <AvoProject />) : <Navigate to="/login" />} />
        <Route path="/avo/:id" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <AvoEdit />) : <Navigate to="/login" />} />
        <Route path="/gantt/:token" element={<GanttShare />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/share/:token" element={<Share />} />
        <Route path="/contract/:token" element={<ContractSign />} />
        <Route path="/budget/:token" element={<BudgetShare />} />
        <Route path="/client/:client" element={<ClientPortal />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      )}
    </AuthContext.Provider>
    </ErrorBoundary>
  );
}
