import React, { useState, useEffect } from 'react';
import type { UserInfo } from '../types';

interface AppUser {
  id: string;
  name: string;
  username: string;
  role: 'admin' | 'therapist';
  therapistName: string | null;
}

interface Props {
  jwt: string;
  user: UserInfo;
  onClose: () => void;
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'מנהל',
  therapist: 'מטפל',
};

export const AdminPage: React.FC<Props> = ({ jwt, user, onClose }) => {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'therapist'>('therapist');
  const [saving, setSaving] = useState(false);
  const [saveNote, setSaveNote] = useState<string | null>(null);

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
    setSaving(true);
    setSaveNote(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        name: newName, username: newUsername, password: newPassword, role: newRole,
        therapistName: newRole === 'therapist' ? newName : null,
      };
      const res = await fetch('/api/auth/users', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 202 && data.message === 'MANUAL_SAVE_REQUIRED') {
        setSaveNote(JSON.stringify(data.user, null, 2));
      } else if (!res.ok) {
        throw new Error(data.error || 'שגיאה ביצירת משתמש');
      } else {
        setNewName(''); setNewUsername(''); setNewPassword('');
        setNewRole('therapist');
        setShowForm(false);
        fetchUsers();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`למחוק את המשתמש "${name}"?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/auth/users?id=${id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (res.status === 202 && data.message === 'MANUAL_SAVE_REQUIRED') {
        setSaveNote(`נא למחוק ידנית את המשתמש עם id "${id}" מקובץ data/users.json ולפרוס מחדש.`);
      } else if (!res.ok) {
        throw new Error(data.error || 'שגיאה במחיקה');
      } else {
        fetchUsers();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: 14, fontFamily: 'inherit',
    direction: 'rtl', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', direction: 'rtl', fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 100%)',
        color: 'white', padding: '12px 24px',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 20 }}>⚙️</span>
        <span style={{ fontWeight: 800, fontSize: 18 }}>ניהול משתמשים</span>
        <button
          onClick={onClose}
          style={{
            marginRight: 'auto', padding: '6px 16px',
            background: 'rgba(255,255,255,0.15)', color: 'white',
            border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6,
            fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          ← חזרה ללוח
        </button>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 680 }}>
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '10px 14px', borderRadius: 7, marginBottom: 16, fontSize: 13 }}>
            {error}
          </div>
        )}

        {saveNote && (
          <div style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', padding: '12px 14px', borderRadius: 7, marginBottom: 16, fontSize: 12 }}>
            <strong>שינוי ידני נדרש</strong> – יש להוסיף/להסיר ידנית מ-data/users.json ולפרוס מחדש:<br />
            <pre style={{ marginTop: 8, background: '#fef9c3', padding: 8, borderRadius: 4, overflowX: 'auto', fontSize: 11 }}>{saveNote}</pre>
            <button onClick={() => setSaveNote(null)} style={{ marginTop: 4, fontSize: 12, cursor: 'pointer', background: 'none', border: 'none', color: '#92400e', textDecoration: 'underline' }}>סגור</button>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b' }}>
            משתמשי המערכת ({users.length})
          </h2>
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              padding: '8px 18px', background: '#2563eb', color: 'white',
              border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            + הוסף משתמש
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleAdd} style={{
            background: 'white', borderRadius: 10, padding: 20,
            border: '1px solid #e2e8f0', marginBottom: 20,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15, color: '#1e293b' }}>משתמש חדש</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>שם (יופיע בלוח)</label>
                <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} required placeholder="לדוגמה: ד״ר כהן" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>תפקיד</label>
                <select style={inputStyle} value={newRole} onChange={e => setNewRole(e.target.value as 'admin' | 'therapist')}>
                  <option value="therapist">מטפל</option>
                  <option value="admin">מנהל</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>שם משתמש</label>
                <input style={inputStyle} value={newUsername} onChange={e => setNewUsername(e.target.value)} required placeholder="לדוגמה: cohen" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 3 }}>סיסמה ראשונית</label>
                <input type="password" style={inputStyle} value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="סיסמה" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="submit" disabled={saving} style={{ padding: '8px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {saving ? 'שומר...' : 'צור משתמש'}
              </button>
              <button type="button" onClick={() => setShowForm(false)} style={{ padding: '8px 16px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                ביטול
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div style={{ color: '#94a3b8', textAlign: 'center', padding: 24 }}>טוען...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {users.map(u => (
              <div key={u.id} style={{
                background: 'white', borderRadius: 8, padding: '12px 16px',
                border: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: u.role === 'admin' ? '#dbeafe' : '#f0fdf4',
                  color: u.role === 'admin' ? '#1d4ed8' : '#15803d',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: 14, flexShrink: 0,
                }}>
                  {u.name.charAt(0)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: '#1e293b' }}>{u.name}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    @{u.username} · {ROLE_LABELS[u.role]}
                    {u.therapistName && <span style={{ marginRight: 6, color: '#7c3aed' }}>· 📅 {u.therapistName}</span>}
                  </div>
                </div>
                {u.username !== user.username ? (
                  <button
                    onClick={() => handleDelete(u.id, u.name)}
                    style={{
                      padding: '5px 12px', background: '#fef2f2', color: '#dc2626',
                      border: '1px solid #fecaca', borderRadius: 5, fontSize: 12,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    מחק
                  </button>
                ) : (
                  <span style={{ fontSize: 11, color: '#94a3b8', padding: '5px 12px' }}>אתה</span>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
