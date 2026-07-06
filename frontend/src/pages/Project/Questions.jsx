import React, { useEffect, useRef, useState } from 'react';
import { api } from '../../api.js';

export default function Questions({ project }) {
  const [questions, setQuestions] = useState([]);
  const [input, setInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [answeringId, setAnsweringId] = useState(null);
  const [answerInput, setAnswerInput] = useState('');
  const [answeringSubmitting, setAnsweringSubmitting] = useState(false);
  const [animatingId, setAnimatingId] = useState(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    api.getQuestions(project.id).then(setQuestions).catch(() => {});
  }, [project.id]);

  async function submitQuestion(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setSubmitting(true);
    try {
      const q = await api.createQuestion(project.id, { question: input.trim() });
      setQuestions(prev => [...prev, q]);
      setInput('');
    } catch (err) { alert(err.message); }
    finally { setSubmitting(false); }
  }

  async function submitAnswer(qid) {
    if (!answerInput.trim()) return;
    setAnsweringSubmitting(true);
    try {
      const updated = await api.answerQuestion(project.id, qid, { answer: answerInput.trim() });
      setAnimatingId(qid);
      setTimeout(() => {
        setQuestions(prev => prev.map(q => q.id === qid ? updated : q));
        setAnimatingId(null);
        setAnsweringId(null);
        setAnswerInput('');
      }, 500);
    } catch (err) { alert(err.message); }
    finally { setAnsweringSubmitting(false); }
  }

  async function deleteQuestion(qid) {
    if (!confirm('Remove this question?')) return;
    await api.deleteQuestion(project.id, qid);
    setQuestions(prev => prev.filter(q => q.id !== qid));
  }

  const unanswered = questions.filter(q => !q.answer);
  const answered = questions.filter(q => q.answer);

  // Once day 1 arrives (device-local time), new questions are closed
  const projectStarted = (() => {
    if (!project?.start_date) return false;
    const today = new Date(new Date().toLocaleDateString('en-CA') + 'T12:00:00');
    return new Date(project.start_date.slice(0, 10) + 'T12:00:00') <= today;
  })();
  const pocMember = (project.crewAssignments || []).find(a => a.crewMember && a.crewMember.id === project.poc_crew_member_id)?.crewMember || null;
  const pocName = pocMember ? [pocMember.preferred_first_name || pocMember.first_name, pocMember.preferred_last_name || pocMember.last_name].filter(Boolean).join(' ') || pocMember.name : null;

  return (
    <div style={{ maxWidth:1000 }}>
      {/* Ask field */}
      {projectStarted ? (
        <div style={{ border:'1.5px solid rgba(239,68,68,0.7)', borderRadius:8, padding:'14px 16px', marginBottom:28, background:'var(--bg2)' }}>
          <div style={{ fontSize:13, fontWeight:600, color:'#ef4444' }}>
            Project has Started, question feature has been disabled. Please reach out to the Field Producer for any questions.
          </div>
          {(pocName || pocMember?.phone) && (
            <div style={{ fontSize:13, color:'var(--text)', marginTop:8 }}>
              {pocName && <span style={{ fontWeight:600 }}>{pocName}</span>}
              {pocName && pocMember?.phone && ' · '}
              {pocMember?.phone && <a href={`tel:${pocMember.phone}`} style={{ color:'var(--orange)' }}>{pocMember.phone}</a>}
            </div>
          )}
        </div>
      ) : (
      <form onSubmit={submitQuestion} style={{ display:'flex', gap:10, marginBottom:28, alignItems:'flex-start' }}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitQuestion(e); } }}
          placeholder="Type a question…"
          rows={2}
          style={{ flex:1, resize:'vertical', fontFamily:'inherit', fontSize:13 }}
        />
        <button className="btn btn-primary" type="submit" disabled={submitting || !input.trim()} style={{ flexShrink:0, alignSelf:'flex-end' }}>
          {submitting ? 'Submitting…' : 'Submit'}
        </button>
      </form>
      )}

      {/* Two-column layout */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
        {/* Unanswered */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--muted)', marginBottom:10 }}>
            Unanswered ({unanswered.length})
          </div>
          {unanswered.length === 0 && (
            <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic', padding:'12px 0' }}>No open questions.</div>
          )}
          {unanswered.map(q => (
            <QuestionTile
              key={q.id}
              q={q}
              isAnswering={answeringId === q.id}
              answerInput={answerInput}
              setAnswerInput={setAnswerInput}
              onStartAnswer={() => { setAnsweringId(q.id); setAnswerInput(''); }}
              onCancelAnswer={() => { setAnsweringId(null); setAnswerInput(''); }}
              onSubmitAnswer={() => submitAnswer(q.id)}
              submitting={answeringSubmitting}
              animating={animatingId === q.id}
              onDelete={() => deleteQuestion(q.id)}
            />
          ))}
        </div>

        {/* Answered */}
        <div>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--muted)', marginBottom:10 }}>
            Answered ({answered.length})
          </div>
          {answered.length === 0 && (
            <div style={{ fontSize:12, color:'var(--muted)', fontStyle:'italic', padding:'12px 0' }}>No answered questions yet.</div>
          )}
          {answered.map(q => (
            <AnsweredTile key={q.id} q={q} onDelete={() => deleteQuestion(q.id)}
              onSaveAnswer={answer => api.answerQuestion(project.id, q.id, { answer }).then(updated => setQuestions(prev => prev.map(x => x.id === q.id ? updated : x)))}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function QuestionTile({ q, isAnswering, answerInput, setAnswerInput, onStartAnswer, onCancelAnswer, onSubmitAnswer, submitting, animating, onDelete }) {
  return (
    <div style={{
      border: '1.5px solid rgba(239,68,68,0.5)',
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 10,
      background: 'var(--bg2)',
      position: 'relative',
      opacity: animating ? 0 : 1,
      transform: animating ? 'translateX(40px)' : 'none',
      transition: animating ? 'opacity 0.4s, transform 0.4s' : 'none',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
        <div style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444', flexShrink:0, marginTop:4 }} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, color:'var(--text)', marginBottom: isAnswering ? 10 : 0 }}>{q.question}</div>
          {isAnswering ? (
            <div>
              <textarea
                value={answerInput}
                onChange={e => setAnswerInput(e.target.value)}
                placeholder="Type your answer…"
                rows={3}
                autoFocus
                style={{ width:'100%', boxSizing:'border-box', fontFamily:'inherit', fontSize:12, resize:'vertical', marginBottom:8 }}
              />
              <div style={{ display:'flex', gap:8 }}>
                <button
                  className="btn btn-sm"
                  disabled={submitting || !answerInput.trim()}
                  onClick={onSubmitAnswer}
                  style={{ background:'#22c55e', color:'#fff', border:'none', fontWeight:600 }}
                >
                  {submitting ? 'Saving…' : 'Submit Answer'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={onCancelAnswer}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-ghost btn-sm" style={{ marginTop:6, fontSize:11 }} onClick={onStartAnswer}>Answer</button>
          )}
        </div>
        <button onClick={onDelete} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, flexShrink:0 }}>✕</button>
      </div>
    </div>
  );
}

function AnsweredTile({ q, onDelete, onSaveAnswer }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(q.answer);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!editVal.trim()) return;
    setSaving(true);
    try {
      await onSaveAnswer(editVal.trim());
      setEditing(false);
    } finally { setSaving(false); }
  }

  return (
    <div style={{
      border: '1.5px solid rgba(34,197,94,0.5)',
      borderRadius: 8,
      padding: '12px 14px',
      marginBottom: 10,
      background: 'var(--bg2)',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
        <div style={{ color:'#22c55e', fontSize:14, flexShrink:0, marginTop:1 }}>✓</div>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)', marginBottom:6 }}>{q.question}</div>
          {editing ? (
            <div>
              <textarea
                value={editVal}
                onChange={e => setEditVal(e.target.value)}
                rows={3}
                autoFocus
                style={{ width:'100%', boxSizing:'border-box', fontFamily:'inherit', fontSize:12, resize:'vertical', marginBottom:8 }}
              />
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn btn-sm" disabled={saving || !editVal.trim()} onClick={save} style={{ background:'#22c55e', color:'#fff', border:'none', fontWeight:600 }}>
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(false); setEditVal(q.answer); }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ fontSize:12, color:'var(--muted)', lineHeight:1.5, marginBottom:6 }}>{q.answer}</div>
              <button className="btn btn-ghost btn-sm" style={{ fontSize:11 }} onClick={() => setEditing(true)}>Edit Answer</button>
            </div>
          )}
        </div>
        <button onClick={onDelete} style={{ background:'none', border:'none', color:'var(--muted)', cursor:'pointer', fontSize:11, flexShrink:0 }}>✕</button>
      </div>
    </div>
  );
}
