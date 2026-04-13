import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  UserInfo, AirtableReferralData,
  ReferralPipelineRecord, ReferralStage, ReferralDecision, ReferralNote,
} from '../../types';

// ── Combined type ────────────────────────────────────────────────

interface Referral {
  // Airtable data
  airtableId: string;
  name: string;
  age: number | null;
  gender: string;
  school: string;
  grade: string;
  referralReason: string;
  parent1Name: string;
  parent1Phone: string;
  parent1WhatsApp: string;
  parent2Name: string;
  parent2Phone: string;
  parent2WhatsApp: string;
  address: string;
  intakeSummary: string;
  therapist: string;
  intakeSentToHaya: boolean;
  individualTherapyStatus: string;
  referralStatus: string;
  groupStatus: string;
  date: string;
  createdTime: string;
  // Pipeline data (null = not yet synced to our DB)
  pipelineId: string | null;
  stage: ReferralStage;
  assignedTo: string | null;
  assignedName: string | null;
  notes: ReferralNote[];
  decision: ReferralDecision;
  intakeDate: string | null;
  importedAt: string;
  updatedAt: string;
}

interface Props {
  jwt: string;
  user: UserInfo;
  onClose: () => void;
}

// ── Stage config ─────────────────────────────────────────────────

const STAGES: { key: ReferralStage; label: string; short: string; color: string; bg: string }[] = [
  { key: 'new',              label: 'יצירת קשר',  short: 'ממתין לשיבוץ',    color: '#3b82f6', bg: '#eff6ff' },
  { key: 'assigned',         label: 'שיוך',        short: 'שויך',             color: '#f59e0b', bg: '#fffbeb' },
  { key: 'intake_scheduled', label: 'אינטיק',      short: 'אינטייק מתוחמן',  color: '#8b5cf6', bg: '#f5f3ff' },
  { key: 'intake_done',      label: 'סיכום',       short: 'אינטייק בוצע',    color: '#06b6d4', bg: '#ecfeff' },
  { key: 'decided',          label: 'סגירה',       short: 'סגור',             color: '#22c55e', bg: '#f0fdf4' },
];

const DECISION_LABELS: Record<NonNullable<ReferralDecision>, { label: string; color: string }> = {
  private:     { label: 'טיפול פרטני בחברותא',  color: '#22c55e' },
  group:       { label: 'טיפול קבוצתי בחברותא', color: '#14b8a6' },
  no_continue: { label: 'ההפנייה לא ממשיכה',     color: '#6b7280' },
};

// ── Helpers ───────────────────────────────────────────────────────

function stageIndex(s: ReferralStage) { return STAGES.findIndex(x => x.key === s); }

function formatTs(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })
    + ' ' + d.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
}

function daysSince(iso: string) {
  if (!iso) return 0;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function emptyReferral(at: AirtableReferralData): Referral {
  const now = new Date().toISOString();
  return {
    ...at,
    pipelineId: null,
    stage: 'new',
    assignedTo: null,
    assignedName: null,
    notes: [],
    decision: null,
    intakeDate: null,
    importedAt: now,
    updatedAt: now,
  };
}

function mergeReferrals(
  atRecs: AirtableReferralData[],
  pipeline: ReferralPipelineRecord[],
): Referral[] {
  return atRecs.map(at => {
    const p = pipeline.find(r => r.airtableId === at.airtableId);
    if (!p) return emptyReferral(at);
    return {
      ...at,
      pipelineId: p.id,
      stage: p.stage,
      assignedTo: p.assignedTo,
      assignedName: p.assignedName,
      notes: p.notes,
      decision: p.decision,
      intakeDate: p.intakeDate,
      importedAt: p.importedAt,
      updatedAt: p.updatedAt,
    };
  });
}

// ── Main component ────────────────────────────────────────────────

export function ReferralsPage({ jwt, user, onClose }: Props) {
  const [atRecs, setAtRecs]               = useState<AirtableReferralData[]>([]);
  const [pipeline, setPipeline]           = useState<ReferralPipelineRecord[]>([]);
  const [loading, setLoading]             = useState(true);
  const [syncing, setSyncing]             = useState(false);
  const [error, setError]                 = useState<string | null>(null);
  const [selectedId, setSelectedId]       = useState<string | null>(null); // airtableId
  const [activeTab, setActiveTab]         = useState<'details' | 'chat'>('details');
  const [stageFilter, setStageFilter]     = useState<ReferralStage | 'all'>('all');

  // Detail panel state
  const [chatMsg, setChatMsg]             = useState('');
  const [sendingChat, setSendingChat]     = useState(false);
  const [savingStage, setSavingStage]     = useState(false);
  const [intakeDate, setIntakeDate]       = useState('');
  const [savingIntake, setSavingIntake]   = useState(false);
  const [savingDecision, setSavingDecision] = useState(false);
  const [assignUser, setAssignUser]       = useState('');
  const [savingAssign, setSavingAssign]   = useState(false);
  const [therapists, setTherapists]       = useState<{username:string;name:string}[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Fetch ─────────────────────────────────────────────────────

  const fetchAirtable = useCallback(async () => {
    try {
      const r = await fetch('/api/airtable/referrals', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (r.ok) {
        const data = await r.json();
        setAtRecs(Array.isArray(data) ? data : []);
        setError(null);
      } else {
        const d = await r.json().catch(() => ({}));
        setError(d.error || 'שגיאה בטעינת נתוני Airtable');
      }
    } catch { setError('לא ניתן להתחבר ל-Airtable'); }
  }, [jwt]);

  const fetchPipeline = useCallback(async () => {
    try {
      const r = await fetch('/api/referrals', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (r.ok) {
        const data = await r.json();
        setPipeline(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
  }, [jwt]);

  const fetchTherapists = useCallback(async () => {
    try {
      const r = await fetch('/api/auth/users', {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      if (r.ok) {
        const data = await r.json();
        const list = (data.users || data || []) as {username:string;name:string;role:string}[];
        setTherapists(list.filter(u => u.role === 'admin' || u.role === 'hevrutah'));
      }
    } catch { /* ignore */ }
  }, [jwt]);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchAirtable(), fetchPipeline(), fetchTherapists()])
      .finally(() => setLoading(false));
  }, [fetchAirtable, fetchPipeline, fetchTherapists]);

  // Sync = re-fetch from Airtable
  async function handleSync() {
    setSyncing(true);
    await fetchAirtable();
    await fetchPipeline();
    setSyncing(false);
  }

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [selectedId, activeTab, pipeline]);

  // ── Merge ─────────────────────────────────────────────────────

  const referrals = mergeReferrals(atRecs, pipeline);

  const filtered = stageFilter === 'all'
    ? referrals
    : referrals.filter(r => r.stage === stageFilter);

  const selected = referrals.find(r => r.airtableId === selectedId) ?? null;

  // ── Ensure pipeline record exists (auto-create on first interaction) ──

  async function ensurePipelineRecord(airtableId: string): Promise<string | null> {
    // Check if already exists
    const existing = pipeline.find(p => p.airtableId === airtableId);
    if (existing) return existing.id;

    // Create new pipeline record
    const r = await fetch('/api/referrals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify({ airtableId }),
    });
    if (!r.ok) {
      // If 409, someone else already created it — re-fetch
      if (r.status === 409) {
        await fetchPipeline();
        return pipeline.find(p => p.airtableId === airtableId)?.id ?? null;
      }
      return null;
    }
    const created: ReferralPipelineRecord = await r.json();
    setPipeline(prev => [...prev, created]);
    return created.id;
  }

  // ── Update pipeline record ────────────────────────────────────

  async function updateReferral(airtableId: string, patch: Record<string, unknown>) {
    const id = await ensurePipelineRecord(airtableId);
    if (!id) { alert('שגיאה ביצירת רשומה'); return; }

    const r = await fetch(`/api/referrals/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify(patch),
    });
    if (r.ok) {
      const updated: ReferralPipelineRecord = await r.json();
      setPipeline(prev => prev.map(p => p.id === id ? updated : p));
    } else {
      const d = await r.json().catch(() => ({}));
      alert(d.error || 'שגיאה בשמירה');
    }
  }

  async function changeStage(airtableId: string, stage: ReferralStage) {
    setSavingStage(true);
    await updateReferral(airtableId, { stage });
    setSavingStage(false);
  }

  async function assignTherapist(airtableId: string, username: string) {
    if (!username) return;
    const t = therapists.find(x => x.username === username);
    setSavingAssign(true);
    await updateReferral(airtableId, {
      assignedTo: username,
      assignedName: t?.name ?? username,
      stage: 'assigned',
    });
    setSavingAssign(false);
    setAssignUser('');
  }

  async function saveIntakeDate(airtableId: string) {
    if (!intakeDate) return;
    setSavingIntake(true);
    await updateReferral(airtableId, { intakeDate, stage: 'intake_scheduled' });
    setSavingIntake(false);
  }

  async function setDecision(airtableId: string, decision: ReferralDecision) {
    setSavingDecision(true);
    await updateReferral(airtableId, { decision, stage: 'decided' });
    setSavingDecision(false);
  }

  async function sendChatMsg(airtableId: string) {
    if (!chatMsg.trim()) return;
    setSendingChat(true);
    await updateReferral(airtableId, { note: chatMsg.trim() });
    setChatMsg('');
    setSendingChat(false);
  }

  // ── Counts ────────────────────────────────────────────────────

  const stageCounts = STAGES.reduce((acc, s) => {
    acc[s.key] = referrals.filter(r => r.stage === s.key).length;
    return acc;
  }, {} as Record<string, number>);

  const unassigned = referrals.filter(r => !r.assignedTo).length;

  // ── Card ──────────────────────────────────────────────────────

  function ReferralCard({ r }: { r: Referral }) {
    const stage = STAGES.find(s => s.key === r.stage)!;
    const days = daysSince(r.importedAt);
    const stale = days > 7 && r.stage !== 'decided';
    const isSelected = selectedId === r.airtableId;
    return (
      <div
        onClick={() => {
          setSelectedId(isSelected ? null : r.airtableId);
          setActiveTab('details');
          setIntakeDate(r.intakeDate ?? '');
          setAssignUser(r.assignedTo ?? '');
        }}
        style={{
          background: isSelected ? '#eff6ff' : 'white',
          border: `2px solid ${isSelected ? '#3b82f6' : stale ? '#fca5a5' : '#e2e8f0'}`,
          borderRadius: 10, padding: '12px 14px', cursor: 'pointer',
          marginBottom: 8, transition: 'all .15s',
          boxShadow: isSelected ? '0 0 0 3px rgba(59,130,246,.15)' : '0 1px 3px rgba(0,0,0,.07)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: '#1e293b' }}>{r.name}</span>
          <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: stage.bg, color: stage.color }}>
            {stage.short}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
          {r.age  && <span style={badge('#f1f5f9','#475569')}>{r.age} שנים</span>}
          {r.gender && <span style={badge('#f1f5f9','#475569')}>{r.gender}</span>}
          {r.grade  && <span style={badge('#f1f5f9','#475569')}>{r.grade}</span>}
          {r.school && <span style={badge('#fff7ed','#c2410c')}>{r.school}</span>}
        </div>

        {r.referralReason && (
          <div style={{
            fontSize: 12, color: '#64748b', marginBottom: 6,
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          }}>
            {r.referralReason}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: r.assignedName ? '#1e293b' : '#ef4444', fontWeight: 500 }}>
            {r.assignedName ? `🧑‍⚕️ ${r.assignedName}` : '⚠️ לא שויך'}
          </span>
          <span style={{ fontSize: 11, color: stale ? '#ef4444' : '#94a3b8', fontWeight: stale ? 700 : 400 }}>
            {days === 0 ? 'היום' : `לפני ${days} ימים`}{stale ? ' ⚠️' : ''}
          </span>
        </div>

        {r.notes.length > 0 && (
          <div style={{ marginTop: 5, fontSize: 11, color: '#94a3b8' }}>
            💬 {r.notes.length} הודעות בדיון
          </div>
        )}

        {r.decision && (
          <div style={{
            marginTop: 5, fontSize: 11, fontWeight: 600,
            color: DECISION_LABELS[r.decision as NonNullable<ReferralDecision>].color,
          }}>
            ✓ {DECISION_LABELS[r.decision as NonNullable<ReferralDecision>].label}
          </div>
        )}
      </div>
    );
  }

  // ── Stage progress bar ────────────────────────────────────────

  function StageProgress({ stage }: { stage: ReferralStage }) {
    const idx = stageIndex(stage);
    return (
      <div style={{ display: 'flex', alignItems: 'center', direction: 'ltr', margin: '12px 0 4px' }}>
        {STAGES.map((s, i) => {
          const done = i < idx;
          const active = i === idx;
          return (
            <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: done ? '#22c55e' : active ? s.color : '#e2e8f0',
                  color: (done || active) ? 'white' : '#94a3b8',
                  fontSize: 12, fontWeight: 700,
                  border: active ? `3px solid ${s.color}` : '2px solid transparent',
                  boxShadow: active ? `0 0 0 3px ${s.color}33` : 'none',
                }}>
                  {done ? '✓' : i + 1}
                </div>
                <div style={{
                  fontSize: 10, marginTop: 3, whiteSpace: 'nowrap',
                  color: active ? s.color : done ? '#22c55e' : '#94a3b8',
                  fontWeight: active ? 700 : 400,
                }}>
                  {s.label}
                </div>
              </div>
              {i < STAGES.length - 1 && (
                <div style={{
                  height: 2, flex: 1, marginBottom: 16,
                  background: done ? '#22c55e' : '#e2e8f0',
                }} />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Detail panel ──────────────────────────────────────────────

  function DetailPanel({ r }: { r: Referral }) {
    return (
      <div style={{
        width: 450, minWidth: 380, background: '#f8fafc',
        borderRight: '1px solid #e2e8f0',
        display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', background: 'white', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>{r.name}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {r.age    && <span style={badge('#eff6ff','#3b82f6')}>גיל {r.age}</span>}
                {r.gender && <span style={badge('#f5f3ff','#7c3aed')}>{r.gender}</span>}
                {r.grade  && <span style={badge('#f0fdf4','#16a34a')}>{r.grade}</span>}
                {r.school && <span style={badge('#fff7ed','#c2410c')}>{r.school}</span>}
              </div>
            </div>
            <button
              onClick={() => setSelectedId(null)}
              style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8', padding: 4 }}
            >✕</button>
          </div>

          {/* Stage progress */}
          <StageProgress stage={r.stage} />

          {/* Quick status buttons */}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', paddingBottom: 8, justifyContent: 'flex-end' }}>
            {STAGES.map(s => (
              <button key={s.key} disabled={savingStage} onClick={() => changeStage(r.airtableId, s.key)} style={{
                padding: '3px 10px', fontSize: 11, borderRadius: 20, cursor: 'pointer',
                background: r.stage === s.key ? s.color : 'transparent',
                color: r.stage === s.key ? 'white' : s.color,
                border: `1.5px solid ${s.color}`, fontWeight: 600, fontFamily: 'inherit',
              }}>
                {s.short}
              </button>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', background: 'white', borderBottom: '2px solid #e2e8f0' }}>
          {(['details','chat'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              flex: 1, padding: '10px 0', fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', background: 'none', border: 'none', cursor: 'pointer',
              color: activeTab === tab ? '#3b82f6' : '#64748b',
              borderBottom: `2.5px solid ${activeTab === tab ? '#3b82f6' : 'transparent'}`,
              marginBottom: -2,
            }}>
              {tab === 'details' ? '📋 פרטים' : `💬 דיון (${r.notes.length})`}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '14px 18px',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}>

          {/* ── DETAILS TAB ── */}
          {activeTab === 'details' && (
            <>
              {r.referralReason && (
                <Card title="סיבת הפנייה">
                  <p style={{ margin: 0, fontSize: 13, color: '#334155', lineHeight: 1.6 }}>{r.referralReason}</p>
                </Card>
              )}

              <Card title="פרטי קשר">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <tbody>
                    {r.parent1Phone && <ContactRow label={r.parent1Name || 'הורה 1'} phone={r.parent1Phone} wa={r.parent1WhatsApp} />}
                    {r.parent2Phone && <ContactRow label={r.parent2Name || 'הורה 2'} phone={r.parent2Phone} wa={r.parent2WhatsApp} />}
                    {r.address && <InfoRow label="כתובת" value={r.address} />}
                    {r.date    && <InfoRow label="תאריך פנייה" value={r.date} />}
                  </tbody>
                </table>
              </Card>

              <Card title="שיוך לפסיכולוג">
                {r.assignedName ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 22 }}>🧑‍⚕️</span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{r.assignedName}</span>
                    <span style={badge('#f0fdf4','#16a34a')}>שויך</span>
                  </div>
                ) : (
                  <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 10 }}>עדיין לא שויך לפסיכולוג</div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <select
                    value={assignUser}
                    onChange={e => setAssignUser(e.target.value)}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit' }}
                  >
                    <option value="">{r.assignedName ? 'שנה פסיכולוג...' : 'בחר פסיכולוג...'}</option>
                    {therapists.map(t => (
                      <option key={t.username} value={t.username}>{t.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => assignTherapist(r.airtableId, assignUser)}
                    disabled={savingAssign || !assignUser}
                    style={actionBtn(savingAssign || !assignUser ? '#cbd5e1' : '#3b82f6')}
                  >
                    {savingAssign ? '...' : 'שייך'}
                  </button>
                </div>
              </Card>

              <Card title="אינטייק">
                {r.intakeDate && (
                  <div style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>📅</span>
                    <span style={{ fontWeight: 600, color: '#1e293b', fontSize: 14 }}>
                      {new Date(r.intakeDate).toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: 'long' })}
                    </span>
                    <span style={badge('#f5f3ff','#7c3aed')}>מתוחמן</span>
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="date"
                    value={intakeDate}
                    onChange={e => setIntakeDate(e.target.value)}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 6, border: '1px solid #cbd5e1', fontSize: 13, fontFamily: 'inherit' }}
                  />
                  <button onClick={() => saveIntakeDate(r.airtableId)} disabled={savingIntake || !intakeDate} style={actionBtn(savingIntake || !intakeDate ? '#cbd5e1' : '#8b5cf6')}>
                    {savingIntake ? '...' : r.intakeDate ? 'עדכן' : 'קבע'}
                  </button>
                </div>

                {r.intakeSummary && (
                  <div style={{ marginTop: 10, padding: '8px 10px', background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, color: '#334155', lineHeight: 1.6 }}>
                    <div style={{ fontWeight: 600, color: '#475569', fontSize: 11, marginBottom: 4 }}>סיכום מ-Airtable:</div>
                    {r.intakeSummary}
                  </div>
                )}
                {r.intakeSentToHaya && (
                  <div style={{ marginTop: 6, color: '#22c55e', fontSize: 12, fontWeight: 600 }}>✓ נשלח להייה</div>
                )}
              </Card>

              {/* Decision — show from intake_done onwards */}
              {(r.stage === 'intake_done' || r.stage === 'decided') && (
                <Card title="החלטה סופית">
                  {r.decision ? (
                    <div style={{
                      padding: '10px 14px', borderRadius: 8,
                      background: DECISION_LABELS[r.decision as NonNullable<ReferralDecision>].color + '22',
                      border: `1.5px solid ${DECISION_LABELS[r.decision as NonNullable<ReferralDecision>].color}`,
                      color: DECISION_LABELS[r.decision as NonNullable<ReferralDecision>].color,
                      fontWeight: 700, fontSize: 14,
                    }}>
                      ✓ {DECISION_LABELS[r.decision as NonNullable<ReferralDecision>].label}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {(Object.entries(DECISION_LABELS) as [NonNullable<ReferralDecision>, {label:string;color:string}][]).map(([key, {label, color}]) => (
                        <button key={key} disabled={savingDecision} onClick={() => setDecision(r.airtableId, key)} style={{
                          padding: '10px 14px', borderRadius: 8, border: `1.5px solid ${color}`,
                          background: 'white', color, fontWeight: 600, fontSize: 13,
                          cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right',
                        }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </Card>
              )}

              <Card title="היסטוריה">
                <div style={{ fontSize: 12, color: '#64748b' }}>
                  {r.pipelineId ? (
                    <>
                      <div>📥 יצירת קשר: {formatTs(r.importedAt)}</div>
                      {r.updatedAt !== r.importedAt && <div style={{ marginTop: 2 }}>✏️ עדכון אחרון: {formatTs(r.updatedAt)}</div>}
                    </>
                  ) : (
                    <div style={{ color: '#94a3b8' }}>טרם בוצעה פעולה על הפנייה זו</div>
                  )}
                </div>
              </Card>
            </>
          )}

          {/* ── CHAT TAB ── */}
          {activeTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 0 }}>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 12 }}>
                {r.notes.length === 0 && (
                  <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 50 }}>
                    <div style={{ fontSize: 36, marginBottom: 10 }}>💬</div>
                    <div style={{ fontSize: 14 }}>אין הודעות עדיין</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>כל אנשי הצוות יכולים לכתוב כאן לאורך כל הדרך</div>
                  </div>
                )}

                {r.notes.map((note: ReferralNote) => {
                  const isMe = note.author === user.username;
                  return (
                    <div key={note.id} style={{
                      display: 'flex',
                      flexDirection: isMe ? 'row-reverse' : 'row',
                      alignItems: 'flex-end', gap: 8,
                    }}>
                      {/* Avatar */}
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        background: isMe ? '#3b82f6' : '#8b5cf6',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: 13,
                      }}>
                        {note.authorName.charAt(0)}
                      </div>

                      <div style={{ maxWidth: '72%' }}>
                        {!isMe && (
                          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 2, paddingRight: 4 }}>
                            {note.authorName}
                          </div>
                        )}
                        <div style={{
                          padding: '9px 13px',
                          borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                          background: isMe ? '#3b82f6' : 'white',
                          color: isMe ? 'white' : '#1e293b',
                          fontSize: 13, lineHeight: 1.55,
                          border: isMe ? 'none' : '1px solid #e2e8f0',
                          boxShadow: '0 1px 3px rgba(0,0,0,.07)',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                        }}>
                          {note.content}
                        </div>
                        <div style={{
                          fontSize: 10, color: '#94a3b8', marginTop: 3,
                          textAlign: isMe ? 'left' : 'right',
                          paddingInline: 4,
                        }}>
                          {formatTs(note.timestamp)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 10, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                <textarea
                  value={chatMsg}
                  onChange={e => setChatMsg(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMsg(r.airtableId); } }}
                  placeholder="כתוב הודעה לצוות... (Enter לשליחה, Shift+Enter לשורה חדשה)"
                  rows={2}
                  style={{
                    flex: 1, padding: '9px 12px', borderRadius: 10,
                    border: '1.5px solid #cbd5e1', fontSize: 13,
                    fontFamily: 'inherit', resize: 'none', outline: 'none', lineHeight: 1.5,
                  }}
                />
                <button
                  onClick={() => sendChatMsg(r.airtableId)}
                  disabled={sendingChat || !chatMsg.trim()}
                  style={{
                    padding: '10px 16px', borderRadius: 10, border: 'none',
                    background: chatMsg.trim() ? '#3b82f6' : '#e2e8f0',
                    color: chatMsg.trim() ? 'white' : '#94a3b8',
                    fontSize: 18, cursor: chatMsg.trim() ? 'pointer' : 'default',
                    lineHeight: 1, transition: 'all .15s',
                  }}
                >
                  ➤
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Page render ───────────────────────────────────────────────

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#f1f5f9', display: 'flex', flexDirection: 'column',
      fontFamily: "'Segoe UI', 'Arial', sans-serif", direction: 'rtl', zIndex: 100,
    }}>

      {/* Header */}
      <div style={{
        background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 100%)',
        color: 'white', padding: '10px 20px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontWeight: 800, fontSize: 18 }}>📋 מערכת הפניות</span>

        {/* Live stats */}
        <div style={{ display: 'flex', gap: 6 }}>
          <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: 'rgba(255,255,255,.2)' }}>
            {referrals.length} הפניות
          </span>
          {unassigned > 0 && (
            <span style={{ fontSize: 11, padding: '2px 10px', borderRadius: 20, background: 'rgba(239,68,68,.7)' }}>
              ⚠️ {unassigned} לא שויכו
            </span>
          )}
        </div>

        <div style={{ marginRight: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* Sync button — visible to all, syncs from Airtable */}
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '5px 14px', fontSize: 12, background: 'rgba(255,255,255,.15)',
              color: 'white', border: '1px solid rgba(255,255,255,.35)',
              borderRadius: 6, cursor: syncing ? 'default' : 'pointer',
              fontWeight: 600, fontFamily: 'inherit',
              opacity: syncing ? .7 : 1,
            }}
          >
            {syncing ? '⟳ מסנכרן...' : '🔄 רענן מ-Airtable'}
          </button>
          <button onClick={onClose} style={{
            padding: '4px 14px', fontSize: 12, background: 'rgba(255,255,255,.15)', color: 'white',
            border: '1px solid rgba(255,255,255,.3)', borderRadius: 5, cursor: 'pointer', fontFamily: 'inherit',
          }}>
            ← חזרה
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 16px', fontSize: 13, flexShrink: 0 }}>
          ❌ {error}
        </div>
      )}

      {/* Airtable info bar */}
      {!error && !loading && (
        <div style={{ background: '#f0fdf4', borderBottom: '1px solid #bbf7d0', padding: '6px 16px', fontSize: 12, color: '#166534', flexShrink: 0 }}>
          ✓ {referrals.length} הפניות מסומנות "להעביר לקלוד" נטענו מ-Airtable — הרשומות מתעדכנות אוטומטית
        </div>
      )}

      {/* Stage filter tabs */}
      <div style={{ background: 'white', borderBottom: '1px solid #e2e8f0', flexShrink: 0, overflowX: 'auto' }}>
        <div style={{ display: 'flex', padding: '0 16px' }}>
          {[
            { key: 'all' as const, label: 'הכל', color: '#64748b', count: referrals.length },
            ...STAGES.map(s => ({ key: s.key, label: s.label, color: s.color, count: stageCounts[s.key] ?? 0 })),
          ].map(t => (
            <button key={t.key} onClick={() => setStageFilter(t.key)} style={{
              padding: '10px 14px', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              color: stageFilter === t.key ? t.color : '#94a3b8',
              borderBottom: `2.5px solid ${stageFilter === t.key ? t.color : 'transparent'}`,
              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {t.label}
              {t.count > 0 && (
                <span style={{
                  fontSize: 10, padding: '1px 6px', borderRadius: 10,
                  background: stageFilter === t.key ? t.color : '#e2e8f0',
                  color: stageFilter === t.key ? 'white' : '#64748b',
                }}>{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Cards */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
          {loading && (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 80, fontSize: 15 }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>⟳</div>
              טוען הפניות מ-Airtable...
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', marginTop: 80 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>
                {stageFilter === 'all' ? '📭' : '✅'}
              </div>
              <div style={{ fontSize: 15 }}>
                {stageFilter === 'all'
                  ? 'אין הפניות מסומנות "להעביר לקלוד" ב-Airtable'
                  : 'אין הפניות בשלב זה'}
              </div>
              {stageFilter === 'all' && (
                <div style={{ fontSize: 13, marginTop: 8, color: '#94a3b8' }}>
                  סמן "להעביר לקלוד" על רשומה ב-Airtable ולחץ "רענן"
                </div>
              )}
            </div>
          )}

          <div style={{
            display: 'grid',
            gridTemplateColumns: selectedId ? '1fr' : 'repeat(auto-fill, minmax(290px, 1fr))',
            gap: 0,
          }}>
            {filtered.map(r => <ReferralCard key={r.airtableId} r={r} />)}
          </div>
        </div>

        {/* Detail panel */}
        {selected && <DetailPanel r={selected} />}
      </div>
    </div>
  );
}

// ── Style helpers ─────────────────────────────────────────────────

function badge(bg: string, color: string): React.CSSProperties {
  return { display: 'inline-block', padding: '1px 8px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: bg, color };
}

function actionBtn(bg: string): React.CSSProperties {
  return {
    padding: '6px 14px', background: bg, color: 'white',
    border: 'none', borderRadius: 6, cursor: bg === '#cbd5e1' ? 'default' : 'pointer',
    fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
  };
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: 'white', borderRadius: 10, padding: '12px 14px',
      border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,.05)',
    }}>
      <div style={{ fontWeight: 700, color: '#475569', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: .5 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ContactRow({ label, phone, wa }: { label: string; phone: string; wa: string }) {
  return (
    <tr>
      <td style={{ padding: '3px 6px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', width: 90, fontSize: 13 }}>{label}</td>
      <td style={{ padding: '3px 6px', fontSize: 13 }}>
        <a href={`tel:${phone}`} style={{ color: '#3b82f6', textDecoration: 'none' }}>{phone}</a>
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" style={{ marginRight: 8, fontSize: 17 }} title="פתח WhatsApp">💬</a>
        )}
      </td>
    </tr>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: '3px 6px', color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap', width: 90, fontSize: 13 }}>{label}</td>
      <td style={{ padding: '3px 6px', color: '#334155', fontSize: 13 }}>{value}</td>
    </tr>
  );
}
