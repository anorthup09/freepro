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
import ResetPassword from './pages/ResetPassword.jsx';
import ProjectView, { ProjectViewDetail } from './pages/ProjectView.jsx';
import Reports from './pages/Reports.jsx';
import InvoiceSearch from './pages/InvoiceSearch.jsx';
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
    <ErrorBoundary>
    <AuthContext.Provider value={{ user, setUser }}>
      {user?.role === 'PENDING' ? <PendingApproval setUser={setUser} /> : (user && (['ADMIN','PRODUCER'].includes(user.role) || user.mfa_required === true) && user.mfa_enabled === false) ? <MfaSetup /> : (
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={user ? <Hub /> : <Navigate to="/login" />} />
        <Route path="/projects" element={user ? <Projects /> : <Navigate to="/login" />} />
        <Route path="/crew-calendar" element={user ? (user.role === 'CREW' ? <Navigate to="/crew-views" /> : <CrewCalendar />) : <Navigate to="/login" />} />
        <Route path="/finance" element={user ? (user.role === 'CREW' ? <Navigate to="/crew-views" /> : <Finance />) : <Navigate to="/login" />} />
        <Route path="/pipeline" element={user ? (user.role === 'CREW' ? <Navigate to="/crew-views" /> : <Pipeline />) : <Navigate to="/login" />} />
        <Route path="/finance/overview" element={user ? (user.role === 'CREW' ? <Navigate to="/crew-views" /> : <FinanceOverview />) : <Navigate to="/login" />} />
        <Route path="/finance/report" element={user ? (user.role === 'CREW' ? <Navigate to="/crew-views" /> : <FinanceReport />) : <Navigate to="/login" />} />
        <Route path="/finance/:pid" element={user ? (user.role === 'CREW' ? <Navigate to="/crew-views" /> : <FinanceProject />) : <Navigate to="/login" />} />
        <Route path="/crew-views" element={user ? <CrewViews /> : <Navigate to="/login" />} />
        <Route path="/projects/:id" element={user ? (user.role === 'CREW' ? <Navigate to="/crew-views" /> : <Project />) : <Navigate to="/login" />} />
        <Route path="/projects/:id/talent-callsheets" element={user ? (user.role === 'CREW' ? <Navigate to="/crew-views" /> : <TalentCallSheets />) : <Navigate to="/login" />} />
        <Route path="/reports" element={user ? (user.role === 'CREW' ? <Navigate to="/" /> : <Reports />) : <Navigate to="/login" />} />
        <Route path="/reports/invoices" element={user ? (user.role === 'CREW' ? <Navigate to="/" /> : <InvoiceSearch />) : <Navigate to="/login" />} />
        <Route path="/project-view" element={user ? (user.role === 'CREW' ? <Navigate to="/" /> : <ProjectView />) : <Navigate to="/login" />} />
        <Route path="/project-view/:pid" element={user ? (user.role === 'CREW' ? <Navigate to="/" /> : <ProjectViewDetail />) : <Navigate to="/login" />} />
        <Route path="/team" element={user ? <Team /> : <Navigate to="/login" />} />
        <Route path="/avo" element={user ? <Avo /> : <Navigate to="/login" />} />
        <Route path="/avo/gantt" element={user ? <AvoGantt /> : <Navigate to="/login" />} />
        <Route path="/avo/project/:id" element={user ? <AvoProject /> : <Navigate to="/login" />} />
        <Route path="/avo/:id" element={user ? <AvoEdit /> : <Navigate to="/login" />} />
        <Route path="/gantt/:token" element={<GanttShare />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/share/:token" element={<Share />} />
        <Route path="/contract/:token" element={<ContractSign />} />
        <Route path="/budget/:token" element={<BudgetShare />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      )}
    </AuthContext.Provider>
    </ErrorBoundary>
  );
}
