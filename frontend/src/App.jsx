import React, { createContext, useContext, useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Projects from './pages/Projects.jsx';
import GearDashboard from './pages/GearDashboard.jsx';
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
import HubShareGate from './pages/HubShareGate.jsx';
import ContractSign from './pages/ContractSign.jsx';
import Hub from './pages/Hub.jsx';
import { SaveIndicator } from './pages/Finance.jsx';
import { FeedbackBoard } from './pages/Hub.jsx';
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
import AvoProject, { AvoShareView } from './pages/AvoProject.jsx';
import GanttShare from './pages/GanttShare.jsx';
import Team from './pages/Team.jsx';
import CallSheetEmails from './pages/Project/CallSheetEmails.jsx';
import CallSheet from './pages/Project/CallSheet.jsx';
import ResetPassword from './pages/ResetPassword.jsx';
import ProjectView, { ProjectViewDetail } from './pages/ProjectView.jsx';
import ClientHub from './pages/ClientHub.jsx';
import ClientPortal from './pages/ClientPortal.jsx';
import Reports from './pages/Reports.jsx';
import InvoiceSearch from './pages/InvoiceSearch.jsx';
import FoodieRecs from './pages/FoodieRecs.jsx';
import ClientInvoiceReport from './pages/ClientInvoiceReport.jsx';
import VccReport, { VccProjectPage } from './pages/VccReport.jsx';
import WaysOfBeing from './pages/WaysOfBeing.jsx';
import MediaMoments from './pages/MediaMoments.jsx';
import { api } from './api.js';
import GearReport from './pages/GearReport.jsx';
import VendorContractReport from './pages/VendorContractReport.jsx';
import HardDrivesReport from './pages/HardDrivesReport.jsx';
import DaysOffReport from './pages/DaysOffReport.jsx';
import SubscriptionsReport from './pages/SubscriptionsReport.jsx';
import DebriefReport from './pages/DebriefReport.jsx';
import DebriefPage from './pages/DebriefPage.jsx';
import InternationalTravel from './pages/InternationalTravel.jsx';
import ResourceLibrary from './pages/ResourceLibrary.jsx';

export const AuthContext = createContext(null);
export function useAuth() { return useContext(AuthContext); }

// Pop-up shown when an email automation fires while Outlook isn't connected
function MailNoticeHost() {
  const [notice, setNotice] = React.useState(null);
  React.useEffect(() => {
    const on = e => setNotice(e.detail?.action || 'This email');
    window.addEventListener('mail-under-construction', on);
    return () => window.removeEventListener('mail-under-construction', on);
  }, []);
  if (!notice) return null;
  return (
    <div onClick={e => e.target === e.currentTarget && setNotice(null)}
      style={{ position:'fixed', inset:0, zIndex:220, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #e6c229', borderRadius:12, padding:'24px 26px', width:'100%', maxWidth:420 }}>
        <div style={{ fontSize:15, fontWeight:800, marginBottom:8 }}>✉ Email Automation — Under Construction</div>
        <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.55 }}>
          {notice} is set up and will send automatically once email goes live.
        </div>
        <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.55, marginTop:8 }}>
          The platform isn't connected to Outlook yet — full integration is planned by the end of July.
          Everything else about this action saved normally.
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setNotice(null)}>Got it</button>
        </div>
      </div>
    </div>
  );
}

// Weekly welcome: shows on a user's first visit each week while the
// platform is in its testing phase.
function DailyTestingNotice({ user }) {
  const loc = useLocation();
  const [show, setShow] = React.useState(false);
  React.useEffect(() => {
    if (!user) return;
    // Key by the week (Sunday-anchored) so it fires once per week, not daily
    const d = new Date();
    d.setDate(d.getDate() - d.getDay());
    const week = d.toDateString();
    if (localStorage.getItem('fp_daily_notice') !== week) {
      localStorage.setItem('fp_daily_notice', week);
      setShow(true);
    }
  }, [user]);
  if (!show || !user || loc.pathname.startsWith('/share') || loc.pathname.startsWith('/gantt') || loc.pathname.startsWith('/avo-share') || loc.pathname.startsWith('/hub-share') || loc.pathname === '/login') return null;
  return (
    <div onClick={e => e.target === e.currentTarget && setShow(false)}
      style={{ position:'fixed', inset:0, zIndex:230, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderTop:'3px solid #e05252', borderRadius:12, padding:'24px 26px', width:'100%', maxWidth:460 }}>
        <div style={{ fontSize:15, fontWeight:800, marginBottom:10 }}>Welcome to the Unbridled Media Platform</div>
        <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6 }}>
          Thank you for testing the new Unbridled Media Online Platform. While the testing phase can be both fun and frustrating, it's important to provide feedback to prepare for a successful launch.
        </div>
        <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6, marginTop:10 }}>
          The little red <b style={{ background:'#e05252', color:'#fff', borderRadius:'50%', padding:'1px 7px', fontSize:11 }}>F</b> button
          in the bottom left corner is for feedback and feature requests — it follows you as you navigate the platform.
        </div>
        <div style={{ fontSize:13, fontWeight:800, lineHeight:1.6, marginTop:10 }}>
          If you run into issues or bugs — please report immediately to Alex Northup to repair.
        </div>
        <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.6, marginTop:10 }}>
          Your timely and honest feedback helps this project improve and succeed.
        </div>
        <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setShow(false)}>Got it</button>
        </div>
      </div>
    </div>
  );
}

// Light/Dark view toggle — persists the choice and stamps data-theme on <html>.
export function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t === 'light' ? 'light' : 'dark');
}
function ThemeToggle() {
  const [theme, setTheme] = useState(() => localStorage.getItem('fp_theme') || 'dark');
  const flip = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next); localStorage.setItem('fp_theme', next); applyTheme(next);
  };
  return (
    <button className="btn btn-ghost btn-sm" onClick={flip} title={`Switch to ${theme === 'light' ? 'dark' : 'light'} view`}>
      {theme === 'light' ? 'Dark view' : 'Light view'}
    </button>
  );
}

// Centered Sign out at the bottom of every signed-in page (public shares excluded)
function SignOutFooter({ user, setUser }) {
  const loc = useLocation();
  const nav = useNavigate();
  const [deleting, setDeleting] = useState(false);
  // On a single project's Project View (/project-view/:pid, not the landing or
  // /project-view/client/:client), admins get a Delete Project action here.
  const m = loc.pathname.match(/^\/project-view\/([^/]+)$/);
  const pid = m && m[1] !== 'client' ? m[1] : null;
  const canDelete = pid && user?.role === 'ADMIN';
  // Project View landing gets a pill toggle here to reveal archived/closed
  // projects (state carried on the URL so the landing page can read it).
  const onProjectLanding = loc.pathname === '/project-view';
  const showClosed = new URLSearchParams(loc.search).get('closed') === '1';
  const toggleClosed = () => nav('/project-view' + (showClosed ? '' : '?closed=1'));

  async function deleteProject() {
    if (!confirm('Permanently delete this project across ALL pages — Finance (budget & VCC), Pre-Production (FreePro shoots), and Post-Production (AvocadoPost) — plus all crew, schedule, gear, and call-sheet data.\n\nThis cannot be undone.')) return;
    setDeleting(true);
    try { await api.deleteProject(pid); nav('/project-view'); }
    catch (e) { alert(e.message); setDeleting(false); }
  }

  if (!user || loc.pathname.startsWith('/share') || loc.pathname.startsWith('/gantt') || loc.pathname.startsWith('/avo-share') || loc.pathname.startsWith('/hub-share') || loc.pathname === '/login') return null;
  return (
    <div className="no-print signout-footer" style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:10, padding:'26px 16px 34px', background:'var(--bg)' }}>
      <ThemeToggle />
      <button className="btn btn-ghost btn-sm" onClick={() => { localStorage.removeItem('fp_token'); setUser(null); }}>
        Sign out
      </button>
      {onProjectLanding && (
        <button type="button" onClick={toggleClosed} role="switch" aria-checked={showClosed}
          title="Show archived & closed projects"
          style={{ display:'inline-flex', alignItems:'center', gap:8, background: showClosed ? 'rgba(232,80,10,0.12)' : 'transparent', border:`1px solid ${showClosed ? 'var(--orange)' : 'var(--border)'}`, color: showClosed ? 'var(--orange)' : 'var(--muted)', borderRadius:999, fontSize:12, fontWeight:600, padding:'5px 12px 5px 10px', cursor:'pointer', whiteSpace:'nowrap' }}>
          <span style={{ position:'relative', width:30, height:16, borderRadius:999, background: showClosed ? 'var(--orange)' : 'var(--border)', flexShrink:0, transition:'background .15s' }}>
            <span style={{ position:'absolute', top:2, left: showClosed ? 16 : 2, width:12, height:12, borderRadius:'50%', background:'#fff', transition:'left .15s' }} />
          </span>
          Archived &amp; Closed
        </button>
      )}
      {canDelete && (
        <button onClick={deleteProject} disabled={deleting} title="Delete this project everywhere (Finance, Pre-Pro, Post-Pro)"
          style={{ background:'transparent', border:'1px solid #e05252', color:'#e05252', borderRadius:6, fontSize:12, fontWeight:700, padding:'6px 12px', cursor: deleting ? 'default' : 'pointer', whiteSpace:'nowrap', opacity: deleting ? 0.5 : 1 }}
          onMouseEnter={e => { if (!e.currentTarget.disabled) { e.currentTarget.style.background = '#e05252'; e.currentTarget.style.color = '#fff'; } }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#e05252'; }}>
          {deleting ? 'Deleting…' : 'Delete Project'}
        </button>
      )}
    </div>
  );
}

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

  useEffect(() => { applyTheme(localStorage.getItem('fp_theme') || 'dark'); }, []);
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
      <SaveIndicator />
      <MailNoticeHost />
      <DailyTestingNotice user={user} />
      {user && <FeedbackBoard variant="fab" />}
      {user?.role === 'PENDING' ? <PendingApproval setUser={setUser} /> : (realUser && (['ADMIN','PRODUCER'].includes(realUser.role) || realUser.mfa_required === true) && realUser.mfa_enabled === false) ? <MfaSetup /> : (
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
        <Route path="/" element={user ? <Hub /> : <Navigate to="/login" />} />
        <Route path="/projects" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <Projects />) : <Navigate to="/login" />} />
        <Route path="/gear/:pid" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <GearDashboard />) : <Navigate to="/login" />} />
        <Route path="/crew-calendar" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <CrewCalendar />) : <Navigate to="/login" />} />
        <Route path="/finance" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : <Finance />) : <Navigate to="/login" />} />
        <Route path="/pipeline" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : <Pipeline />) : <Navigate to="/login" />} />
        <Route path="/finance/overview" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : <FinanceOverview />) : <Navigate to="/login" />} />
        <Route path="/finance/report" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : <FinanceReport />) : <Navigate to="/login" />} />
        <Route path="/finance/:pid" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : <FinanceProject />) : <Navigate to="/login" />} />
        <Route path="/crew-views" element={user ? <CrewViews /> : <Navigate to="/login" />} />
        <Route path="/projects/:id" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <Project />) : <Navigate to="/login" />} />
        <Route path="/projects/:id/debrief" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <DebriefPage />) : <Navigate to="/login" />} />
        <Route path="/projects/:id/talent-callsheets" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : <TalentCallSheets />) : <Navigate to="/login" />} />
        <Route path="/projects/:id/emails" element={user ? <CallSheetEmails /> : <Navigate to="/login" />} />
        <Route path="/projects/:id/call-sheet" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/crew-views" /> : <CallSheet />) : <Navigate to="/login" />} />
        <Route path="/reports" element={user ? <Reports /> : <Navigate to="/login" />} />
        <Route path="/reports/foodie" element={user ? <FoodieRecs /> : <Navigate to="/login" />} />
        <Route path="/reports/international-travel" element={user ? <InternationalTravel /> : <Navigate to="/login" />} />
        <Route path="/reports/gear" element={user ? <GearReport /> : <Navigate to="/login" />} />
        <Route path="/reports/vendor-contracts" element={user ? <VendorContractReport /> : <Navigate to="/login" />} />
        <Route path="/reports/drives" element={user ? <HardDrivesReport /> : <Navigate to="/login" />} />
        <Route path="/reports/days-off" element={user ? (user.role === 'ADMIN' ? <DaysOffReport /> : <Navigate to="/reports" />) : <Navigate to="/login" />} />
        <Route path="/reports/subscriptions" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/reports" /> : <SubscriptionsReport />) : <Navigate to="/login" />} />
        <Route path="/reports/debrief" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/reports" /> : <DebriefReport />) : <Navigate to="/login" />} />
        <Route path="/reports/music-resources" element={user ? <ResourceLibrary kind="music" title="Music Resources" sub="The team's music library — licensing platforms, go-to tracks, and playlists" accent="#e6c229" placeholderTitle="Musicbed / track name / playlist…" placeholderCat="Licensing Platform, Playlists, Tracks…" /> : <Navigate to="/login" />} />
        <Route path="/reports/video-references" element={user ? <ResourceLibrary kind="video" title="Video References" sub="Reference and inspiration videos — style frames, past work, and examples to point clients at" accent="#a78bfa" placeholderTitle="Video name or what it's a reference for…" placeholderCat="Style Reference, Past Work, Inspiration…" /> : <Navigate to="/login" />} />
        <Route path="/reports/vcc" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/" /> : <VccReport />) : <Navigate to="/login" />} />
        <Route path="/reports/vcc/:pid" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/" /> : <VccProjectPage />) : <Navigate to="/login" />} />
        <Route path="/reports/invoices" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/" /> : <InvoiceSearch />) : <Navigate to="/login" />} />
        <Route path="/reports/client-invoices" element={user ? (['CREW','AGENCY'].includes(user.role) ? <Navigate to="/" /> : <ClientInvoiceReport />) : <Navigate to="/login" />} />
        <Route path="/reports/ways-of-being" element={user ? (user.role === 'ADMIN' ? <WaysOfBeing /> : <Navigate to="/reports" />) : <Navigate to="/login" />} />
        <Route path="/reports/media-moments" element={user ? (user.role === 'ADMIN' ? <MediaMoments /> : <Navigate to="/reports" />) : <Navigate to="/login" />} />
        <Route path="/project-view" element={user ? (['CREW','AGENCY','FINANCE'].includes(user.role) ? <Navigate to="/" /> : <ProjectView />) : <Navigate to="/login" />} />
        <Route path="/project-view/client/:client" element={user ? (['CREW','AGENCY','FINANCE'].includes(user.role) ? <Navigate to="/" /> : <ClientHub />) : <Navigate to="/login" />} />
        <Route path="/project-view/:pid" element={user ? <ProjectViewDetail /> : <Navigate to="/login" />} />
        <Route path="/team" element={user ? <Team /> : <Navigate to="/login" />} />
        <Route path="/avo" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <Avo />) : <Navigate to="/login" />} />
        <Route path="/avo/gantt" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <AvoGantt />) : <Navigate to="/login" />} />
        <Route path="/avo/project/:id" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <AvoProject />) : <Navigate to="/login" />} />
        <Route path="/avo-share/:token" element={<AvoShareView />} />
        <Route path="/avo/:id" element={user ? (user.role === 'FINANCE' ? <Navigate to="/" /> : <AvoEdit />) : <Navigate to="/login" />} />
        <Route path="/gantt/:token" element={<GanttShare />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/share/:token" element={<Share />} />
        <Route path="/hub-share/:token" element={<HubShareGate />} />
        <Route path="/contract/:token" element={<ContractSign />} />
        <Route path="/budget/:token" element={<BudgetShare />} />
        <Route path="/client/:client" element={<ClientPortal />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      )}
      <SignOutFooter user={user} setUser={setUser} />
    </AuthContext.Provider>
    </ErrorBoundary>
  );
}
