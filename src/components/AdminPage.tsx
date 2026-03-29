import React, { useState, useEffect } from 'react';
import type { UserInfo } from '../types';

interface AppUser {
  id: string;
  name: string;
  username: string;
  email: string | null;
  role: 'admin' | 'hevrutah' | 'external';
  therapistName: string | null;
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

export const AdminPage: React.FC<Props> = ({ jwt, user, onClose }) => {
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
  const [editPassword, setEditPassword] = useState('');
  const [editPasswordConfirm, setEditPasswordConfirm] = useState('');
  const [editSaving, setEditSaving] = useState(false);

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
      if (editPassword) body.password = editPassword;
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
    if (!confirm(`למחוק את המשתמש "${name}"?`)) return;
    setError(null);
    try {
      const res = await fetch(`/api/auth/users?id=${id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'שגיאה במחיקה');
      if (editUser?.id === id) setEditUser(null);
      fetchUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'שגיאה');
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', direction: 'rtl', fontFamily: "'Segoe UI', 'Arial', sans-serif" }}>
      {/* Header */}
      <div style={{ background: 'linear-gradient(90deg, #1e3a5f 0%, #2563eb 100%)', color: 'white', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 20 }}>⚙️</span>
        <span style={{ fontWeight: 800, fontSize: 18 }}>ניהול משתמשים</span>
        <button onClick={onClose} style={{ marginRight: 'auto', padding: '6px 16px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          ← חזרה ללוח
        </button>
      </div>

      <div style={{ padding: '24px 28px', maxWidth: 720 }}>
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
              <input type="email" style={inputStyle} value={editEmail} onChange={e => setEditEmail(e.target.value)} placeholder="user@example.com" />
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

            <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>שינוי סיסמה (השאר ריק לשמירה)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 3 }}>סיסמה חדשה</label>
                  <input type="password" style={inputStyle} value={editPassword} onChange={e => setEditPassword(e.target.value)} placeholder="סיסמה חדשה" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 3 }}>אימות</label>
                  <input
                    type="password"
                    style={{ ...inputStyle, borderColor: editPasswordConfirm && editPassword !== editPasswordConfirm ? '#f87171' : '#d1d5db' }}
                    value={editPasswordConfirm}
                    onChange={e => setEditPasswordConfirm(e.target.value)}
                    placeholder="הכנס שוב"
                  />
                </div>
              </div>
              {editPasswordConfirm && editPassword !== editPasswordConfirm && (
                <div style={{ color: '#dc2626', fontSize: 12, marginTop: 4 }}>הסיסמאות אינן תואמות</div>
              )}
            </div>

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
              <button type="submit" disabled={editSaving || (!!editPasswordConfirm && editPassword !== editPasswordConfirm)}
                style={{ padding: '8px 20px', background: '#2563eb', color: 'white', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                {editSaving ? 'שומר...' : 'שמור שינויים'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
