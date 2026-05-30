import React, { useState, useEffect } from 'react';
import type { UserInfo, Tenant, CalendarEvent } from '../types';
import { getTenants, createTenant, updateTenant, deleteTenant, fetchRoomEvents } from '../roomsApi';

interface AppUser {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: 'admin' | 'hevrutah' | 'external';
  therapistName: string | null;
  airtableAccess: boolean;
}

interface Props {
  jwt: string;
  user: UserInfo;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'מנהל',
  hevrutah: 'מטפל חברותא',
  external: 'מטפל חיצוני',
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 10px',
  border: '1px solid #d1d5db', borderRadius: 6,
  fontSize: 14, fontFamily: 'inherit',
  direction: 'rtl', boxSizing: 'border-box',
};

type AdminTab = 'users' | 'tenants' | 'report';

export const AdminPage: React.FC<Props> = ({ jwt, user, onClose }) => {
  const [tab, setTab] = useState<AdminTab>('users');

  const tabBtn = (t: AdminTab, label: string) => (
    <button onClick={() => setTab(t)} style={{
      background: 'none', border: 'none', cursor: 'pointer',
      padding: '8px 18px', fontSize: 14, fontWeight: 600,
      color: tab === t ? '#1e3a5f' : '#94a3b8',
      borderBottom: '2px solid ' + (tab === t ? '#2563eb' : 'transparent'),
      fontFamily: 'inherit', marginBottom: -1,
    }}>
      {label}
    </button>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', direction: 'rtl', fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 100%)', color: 'white', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>⚙️</span>
        <span style={{ fontWeight: 800, fontSize: 18 }}>ניהול</span>
        <button onClick={onClose} style={{ marginRight: 'auto', padding: '6px 16px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          ← חזרה ללוח
        </button>
      </div>

      {/* Tabs */}
      <div style={{ borderBottom: '1px solid #e2e8f0', padding: '0 24px', background: 'white', display: 'flex', gap: 4 }}>
        {tabBtn('users', '👥 משתמשים')}
        {tabBtn('tenants', '🏢 שוכרים')}
        {tabBtn('report', '📊 דוח שוכרים')}
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 780 }}>
        {tab === 'users' && <UsersTab jwt={jwt} user={user} />}
        {tab === 'tenants' && <TenantsTab jwt={jwt} />}
        {tab === 'report' && <TenantReportTab jwt={jwt} />}
      </div>
    </div>
  );
};

// ── Tenants Tab ───────────────────────────────────────────────────────────────

const TenantsTab: React.FC<{ jwt: string }> = ({ jwt }) => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  async function load() {
    setLoading(true);
    try { setTenants(await getTenants(jwt)); }
    catch (e) { setError(e instanceof Error ? e.message : 'שגיאה'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const t = await createTenant(jwt, newName.trim());
      setTenants(prev => [...prev, t]);
      setNewName('');
    } catch (e) { setError(e instanceof Error ? e.message : 'שגיאה'); }
    finally { setAdding(false); }
  }

  async function handleUpdate(id: string) {
    if (!editName.trim()) return;
    try {
      await updateTenant(jwt, id, editName.trim());
      setTenants(prev => prev.map(t => t.id === id ? { ...t, name: editName.trim() } : t));
      setEditId(null);
    } catch (e) { setError(e instanceof Error ? e.message : 'שגיאה'); }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`למחוק את השוכר "${name}"?`)) return;
    try {
      await deleteTenant(jwt, id);
      setTenants(prev => prev.filter(t => t.id !== id));
    } catch (e) { setError(e instanceof Error ? e.message : 'שגיאה'); }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b' }}>שוכרים ({tenants.length})</h2>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 7, marginBottom: 14, fontSize: 13 }}>
          {error}<button onClick={() => setError(null)} style={{ float: 'left', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626' }}>✕</button>
        </div>
      )}

      {/* Add form */}
      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="שם השוכר..."
          style={{ ...inputStyle, flex: 1 }}
          required
        />
        <button type="submit" disabled={adding || !newName.trim()} style={{ padding: '8px 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
          + הוסף
        </button>
      </form>

      {loading ? (
        <div style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>טוען...</div>
      ) : tenants.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🏢</div>
          עדיין אין שוכרים — הוסף את הראשון למעלה
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tenants.map(t => (
            <div key={t.id} style={{ background: 'white', borderRadius: 8, padding: '12px 16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#f0f9ff', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                🏢
              </div>
              {editId === t.id ? (
                <>
                  <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inputStyle, flex: 1 }} autoFocus />
                  <button onClick={() => void handleUpdate(t.id)} style={{ padding: '5px 12px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>שמור</button>
                  <button onClick={() => setEditId(null)} style={{ padding: '5px 12px', background: '#f1f5f9', color: '#374151', border: 'none', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>ביטול</button>
                </>
              ) : (
                <>
                  <div style={{ flex: 1, fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{t.name}</div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => { setEditId(t.id); setEditName(t.name); }} style={{ padding: '5px 12px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>✏️ ערוך</button>
                    <button onClick={() => void handleDelete(t.id, t.name)} style={{ padding: '5px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>מחק</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ── Tenant Report Tab ─────────────────────────────────────────────────────────

const TenantReportTab: React.FC<{ jwt: string }> = ({ jwt }) => {
  const now = new Date();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

  useEffect(() => {
    getTenants(jwt).then(setTenants).catch(() => {});
  }, []);

  async function generateReport() {
    if (!selectedTenantId) { setError('יש לבחור שוכר'); return; }
    setLoading(true); setError(null);
    try {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59);
      const rooms = await fetchRoomEvents(jwt, start, end);
      const allEvents: CalendarEvent[] = rooms.flatMap(r => r.events);
      setEvents(allEvents.filter(e => e.tenantId === selectedTenantId));
    } catch (e) { setError(e instanceof Error ? e.message : 'שגיאה'); }
    finally { setLoading(false); }
  }

  // Summary calculations
  const byRoom: Record<string, { count: number; hours: number }> = {};
  let totalHours = 0;
  for (const e of events) {
    const h = (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3_600_000;
    byRoom[e.roomName] = byRoom[e.roomName] ?? { count: 0, hours: 0 };
    byRoom[e.roomName].count++;
    byRoom[e.roomName].hours += h;
    totalHours += h;
  }

  const selectedTenant = tenants.find(t => t.id === selectedTenantId);

  return (
    <div>
      <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#1e293b' }}>דוח שימוש חודשי — שוכרים</h2>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 7, marginBottom: 14, fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>שוכר</label>
          <select value={selectedTenantId} onChange={e => setSelectedTenantId(e.target.value)} style={{ ...inputStyle, width: 180 }}>
            <option value="">— בחר שוכר —</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>חודש</label>
          <select value={month} onChange={e => setMonth(Number(e.target.value))} style={{ ...inputStyle, width: 130 }}>
            {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>שנה</label>
          <select value={year} onChange={e => setYear(Number(e.target.value))} style={{ ...inputStyle, width: 100 }}>
            {[now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <button onClick={() => void generateReport()} disabled={loading} style={{ padding: '9px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', alignSelf: 'flex-end' }}>
          {loading ? 'טוען...' : 'הצג דוח'}
        </button>
      </div>

      {/* Results */}
      {events.length > 0 && selectedTenant && (
        <div>
          {/* Summary cards */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
            <div style={{ background: '#eff6ff', borderRadius: 10, padding: '14px 20px', minWidth: 140, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#1d4ed8' }}>{events.length}</div>
              <div style={{ fontSize: 12, color: '#3b82f6', marginTop: 2 }}>הזמנות</div>
            </div>
            <div style={{ background: '#f0fdf4', borderRadius: 10, padding: '14px 20px', minWidth: 140, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#16a34a' }}>{totalHours.toFixed(1)}</div>
              <div style={{ fontSize: 12, color: '#22c55e', marginTop: 2 }}>שעות סה״כ</div>
            </div>
            <div style={{ background: '#fff7ed', borderRadius: 10, padding: '14px 20px', minWidth: 140, textAlign: 'center' }}>
              <div style={{ fontSize: 28, fontWeight: 800, color: '#c2410c' }}>{Object.keys(byRoom).length}</div>
              <div style={{ fontSize: 12, color: '#f97316', marginTop: 2 }}>חדרים שונים</div>
            </div>
          </div>

          {/* Per-room summary */}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>שימוש לפי חדר</h3>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748b' }}>חדר</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b' }}>הזמנות</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b' }}>שעות</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(byRoom).map(([room, s], i) => (
                  <tr key={room} style={{ borderBottom: i < Object.keys(byRoom).length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                    <td style={{ padding: '10px 16px', fontWeight: 600, color: '#1e293b', fontSize: 13 }}>{room}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13 }}>{s.count}</td>
                    <td style={{ padding: '10px 16px', textAlign: 'center', fontSize: 13 }}>{s.hours.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Detailed events */}
          <h3 style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 8 }}>פירוט הזמנות — {MONTH_NAMES[month - 1]} {year}</h3>
          <div style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 10, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748b' }}>תאריך</th>
                  <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#64748b' }}>חדר</th>
                  <th style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12, fontWeight: 600, color: '#64748b' }}>שעות</th>
                </tr>
              </thead>
              <tbody>
                {[...events]
                  .sort((a, b) => a.start.localeCompare(b.start))
                  .map((e, i) => {
                    const s = new Date(e.start);
                    const h = (new Date(e.end).getTime() - new Date(e.start).getTime()) / 3_600_000;
                    const pad = (n: number) => String(n).padStart(2, '0');
                    const dateStr = `${pad(s.getDate())}/${pad(s.getMonth() + 1)}`;
                    const timeStr = `${pad(s.getHours())}:${pad(s.getMinutes())}–${pad(new Date(e.end).getHours())}:${pad(new Date(e.end).getMinutes())}`;
                    return (
                      <tr key={e.id} style={{ borderBottom: i < events.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ padding: '9px 16px', fontSize: 13, color: '#374151' }}>{dateStr} · {timeStr}</td>
                        <td style={{ padding: '9px 16px', fontSize: 13, color: '#374151' }}>{e.roomName}</td>
                        <td style={{ padding: '9px 16px', textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#1e293b' }}>{h.toFixed(1)}</td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && events.length === 0 && selectedTenantId && (
        <div style={{ textAlign: 'center', padding: 40, color: '#94a3b8', fontSize: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>📋</div>
          לא נמצאו הזמנות לשוכר זה בחודש {MONTH_NAMES[month - 1]} {year}
        </div>
      )}
    </div>
  );
};

// ── Users Tab (extracted from original AdminPage) ─────────────────────────────

const UsersTab: React.FC<{ jwt: string; user: UserInfo }> = ({ jwt, user }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add form state
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'hevrutah' | 'external'>('hevrutah');
  const [saving, setSaving] = useState(false);

  // Edit modal state
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'hevrutah' | 'external'>('hevrutah');
const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);

  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` };

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/users', { headers });
      if (!res.ok) throw new Error('שגיאה בטעינת משתמשים');
      setUsers(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== newPasswordConfirm) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          name: newName, username: newUsername, password: newPassword,
          role: newRole, email: newEmail || null,
          therapistName: newRole !== 'admin' ? newName : null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה ביצירת משתמש');
      setNewName(''); setNewUsername(''); setNewEmail('');
      setNewPassword(''); setNewPasswordConfirm('');
      setNewRole('hevrutah');
      setShowForm(false);
      fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setSaving(false);
    }
  }

  function openEdit(u: AppUser) {
    setEditUser(u);
    setEditName(u.name);
    setEditEmail(u.email || '');
    setEditRole(u.role as 'admin' | 'hevrutah' | 'external');
    setShowPasswordChange(false);
    setEditPassword('');
    setEditPasswordConfirm('');
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editPassword && editPassword !== editPasswordConfirm) {
      setError('הסיסמאות אינן תואמות');
      return;
    }
    if (!editUser) return;
    setEditSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { name: editName, email: editEmail || null, role: editRole };
      if (showPasswordChange && editPassword) body.password = editPassword;
      const res = await fetch(`/api/auth/users?id=${editUser.id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה בעדכון');
      setEditUser(null);
      fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    setDeleteConfirm({ id, name });
  }

  async function confirmDelete() {
    if (!deleteConfirm) return;
    setError(null);
    try {
      const res = await fetch(`/api/auth/users?id=${deleteConfirm.id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה במחיקה');
      if (editUser?.id === deleteConfirm.id) setEditUser(null);
      setDeleteConfirm(null);
      fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
      setDeleteConfirm(null);
    }
  }

  return (
    <div>
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 7, marginBottom: 16, fontSize: 13 }}>
            {error}
            <button onClick={() => setError(null)} style={{ float: 'left', background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 14 }}>✕</button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b' }}>משתמשי המערכת ({users.length})</h2>
          <button onClick={() => { setShowForm(v => !v); setError(null); }} style={{ padding: '8px 18px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
            + הוסף משתמש
          </button>
        </div>

        {/* Add user form */}
        {showForm && (
          <form noValidate onSubmit={handleAdd} style={{ background: 'white', borderRadius: 10, padding: 20, border: '1px solid #e2e8f0', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#1e293b' }}>משתמש חדש</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>שם מלא</label>
                <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} required placeholder="לדוגמה: ד״ר כהן" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>תפקיד</label>
                <select style={inputStyle} value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'hevrutah' | 'external')}>
                  <option value="hevrutah">מטפל חברותא</option>
                  <option value="external">מטפל חיצוני</option>
                  <option value="admin">מנהל</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>שם משתמש</label>
                <input style={inputStyle} value={newUsername} onChange={e => setNewUsername(e.target.value)} required placeholder="לדוגמה: cohen" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>כתובת מייל</label>
                <input type="text" autoComplete="off" style={inputStyle} value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@example.com" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>סיסמה</label>
                <input type="password" style={inputStyle} value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="סיסמה" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>אימות סיסמה</label>
                <input
                  type="password"
                  style={{ ...inputStyle, borderColor: newPasswordConfirm && newPassword !== newPasswordConfirm ? '#f87171' : '#d1d5db' }}
                  value={newPasswordConfirm}
                  onChange={e => setNewPasswordConfirm(e.target.value)}
                  required
                  placeholder="הכנס שוב את הסיסמה"
                />
              </div>
            </div>
            {newPasswordConfirm && newPassword !== newPasswordConfirm && (
              <div style={{ color: '#dc2626', fontSize: 12 }}>הסיסמאות אינן תואמות</div>
            )}
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {newEmail ? '📧 פרטי הכניסה יישלחו אוטומטית למייל' : 'אין מייל – פרטי הכניסה לא יישלחו'}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saving || (!!newPasswordConfirm && newPassword !== newPasswordConfirm)} style={{ padding: '8px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'שומר...' : 'צור משתמש'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 16px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                ביטול
              </button>
            </div>
          </form>
        )}

        {/* Users list */}
        {loading ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>טוען...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.map(u => (
              <div key={u.id} style={{ background: 'white', borderRadius: 8, padding: '12px 16px', border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: u.role === 'admin' ? '#dbeafe' : '#f0fdf4', color: u.role === 'admin' ? '#1d4ed8' : '#15803d', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                  {u.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    @{u.username} · {ROLE_LABELS[u.role]}
                    {u.email && <span style={{ marginRight: 6 }}>· 📧 {u.email}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => openEdit(u)} style={{ padding: '5px 12px', background: '#f0f9ff', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✏️ ערוך
                  </button>
                  {u.username !== user.username ? (
                    <button onClick={() => handleDelete(u.id, u.name)} style={{ padding: '5px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 5, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      מחק
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: '#94a3b8', padding: '5px 12px' }}>אתה</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editUser && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, direction: 'rtl' }}>
          <form noValidate onSubmit={handleEdit} style={{ background: 'white', borderRadius: 12, padding: 28, width: 420, maxWidth: '95vw', display: 'flex', flexDirection: 'column', gap: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: 16, color: '#1e293b' }}>עריכת משתמש: {editUser.username}</h3>
              <button type="button" onClick={() => setEditUser(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>שם מלא</label>
              <input style={inputStyle} value={editName} onChange={e => setEditName(e.target.value)} required />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>כתובת מייל</label>
              <input type="text" autoComplete="off" style={inputStyle} value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="user@example.com" />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>תפקיד</label>
              <select style={inputStyle} value={editRole} onChange={e => setEditRole(e.target.value as 'admin' | 'hevrutah' | 'external')}
                disabled={editUser.username === user.username}>
                <option value="hevrutah">מטפל חברותא</option>
                <option value="external">מטפל חיצוני</option>
                <option value="admin">מנהל</option>
              </select>
              {editUser.username === user.username && <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>לא ניתן לשנות תפקיד של עצמך</div>}
            </div>

            {user.isAdmin && <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
              {!showPasswordChange ? (
                <button type="button" onClick={() => setShowPasswordChange(true)}
                  style={{ padding: '7px 14px', background: '#f8fafc', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  🔑 שינוי סיסמה
                </button>
              ) : (
                <>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>סיסמה חדשה</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 3 }}>סיסמה חדשה</label>
                      <input type="password" autoComplete="new-password" style={inputStyle} value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="סיסמה חדשה" autoFocus />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 3 }}>אימות</label>
                      <input type="password" autoComplete="new-password"
                        style={{ ...inputStyle, borderColor: editPasswordConfirm && editPassword !== editPasswordConfirm ? '#f87171' : '#d1d5db' }}
                        value={editPasswordConfirm} onChange={e => setEditPasswordConfirm(e.target.value)} placeholder="הכנס שוב" />
                    </div>
                  </div>
                  {editPasswordConfirm && editPassword !== editPasswordConfirm && (
                    <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>הסיסמאות אינן תואמות</div>
                  )}
                  <button type="button" onClick={() => { setShowPasswordChange(false); setEditPassword(''); setEditPasswordConfirm(''); }}
                    style={{ marginTop: 8, padding: '5px 12px', background: 'white', color: '#64748b', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ✕ ביטול שינוי סיסמה
                  </button>
                </>
              )}
            </div>}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              {editUser.username !== user.username && (
                <button type="button" onClick={() => handleDelete(editUser.id, editUser.name)}
                  style={{ padding: '8px 14px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  מחק משתמש
                </button>
              )}
              <button type="button" onClick={() => setEditUser(null)} style={{ padding: '8px 16px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                ביטול
              </button>
              <button type="submit" disabled={editSaving || (showPasswordChange && !!editPasswordConfirm && editPassword !== editPasswordConfirm)}
                style={{ padding: '8px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {editSaving ? 'שומר...' : 'שמור שינויים'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirmation dialog */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, direction: 'rtl' }}>
          <div style={{ background: 'white', borderRadius: 12, padding: 28, width: 340, maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
            <h3 style={{ margin: '0 0 8px', fontSize: 17, color: '#1e293b' }}>מחיקת משתמש</h3>
            <p style={{ margin: '0 0 20px', fontSize: 14, color: '#64748b' }}>
              האם אתה בטוח שברצונך למחוק את <strong>{deleteConfirm.name}</strong>?<br />
              <span style={{ fontSize: 12 }}>לא ניתן לבטל פעולה זו.</span>
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ padding: '9px 22px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                ביטול
              </button>
              <button onClick={confirmDelete}
                style={{ padding: '9px 22px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                כן, מחק
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
