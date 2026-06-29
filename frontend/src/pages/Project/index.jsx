import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../api.js';
import Overview from './Overview.jsx';
import Schedule from './Schedule.jsx';
import Crew from './Crew.jsx';
import Deliverables from './Deliverables.jsx';
import Travel from './Travel.jsx';

const TABS = [
  { id: 'overview',      label: 'Overview' },
  { id: 'schedule',      label: 'Schedule' },
  { id: 'crew',          label: 'Crew' },
  { id: 'deliverables',  label: 'Deliverables' },
  { id: 'travel',        label: 'Travel' },
];

export default function Project() {
  const { id } = useParams();
  const nav = useNavigate();
  const [project, setProject] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    api.getProject(id).then(setProject).catch(() => nav('/'));
  }, [id]);

  if (!project) return null;

  const STATUS_PILL = { PLANNING:'amber', ACTIVE:'green', WRAPPED:'purple', DELIVERED:'green', ARCHIVED:'' };

  return (
    <>
      <nav className="nav">
        <Link to="/" className="logo">Free<em>-Pro</em></Link>
        <div className="tabs">
          {TABS.map(t => (
            <button key={t.id} className={`tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        <span className={`live pill ${STATUS_PILL[project.status] || ''}`} style={{ marginLeft:'auto' }}>
          {project.status.replace(/_/g,' ')}
        </span>
      </nav>

      <div className="wrap">
        {tab === 'overview'     && <Overview     project={project} setProject={setProject} />}
        {tab === 'schedule'     && <Schedule     project={project} />}
        {tab === 'crew'         && <Crew         project={project} />}
        {tab === 'deliverables' && <Deliverables project={project} />}
        {tab === 'travel'       && <Travel       project={project} />}
      </div>
    </>
  );
}
