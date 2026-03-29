import React, { useState, useEffect } from 'react';
import type { CalendarEvent, RoomCalendar, UserInfo } from '../types';
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  deleteCalendarEventSeries,
  deleteCalendarEventAndFollowing,
  type RecurringOptions,
} from '../googleCalendar';

// 30-minute time slots from 07:00 to 20:00
const TIME_SLOTS: string[] = [];
for (let h = 7; h <= 20; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 20) TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

export type ModalState =
  | { mode: 'create'; room: RoomCalendar; day: Date; hour: number }
  | { mode: 'edit'; event: CalendarEvent; room: RoomCalendar }
  | null;

interface Props {
  state: ModalState;
  rooms: RoomCalendar[];
  accessToken: string;
  jwt: string;
  user: UserInfo;
  onClose: () => void;
  onSaved: () => void;
}


function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const EventModal: React.FC<Props> = ({ state, rooms, accessToken, jwt, user, onClose, onSaved }) => {
  const [name, setName] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [dateVal, setDateVal] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'>('WEEKLY');
  const [recurringUntil, setRecurringUntil] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [therapistNames, setTherapistNames] = useState<string[]>([]);

  // Fetch therapist names from DB (admin only)
  useEffect(() => {
    if (!user.isAdmin) return;
    fetch('/api/auth/users', { headers: { Authorization: `Bearer ${jwt}` } })
      .then(r => r.json())
      .then((users: Array<{ therapistName: string | null }>) => {
        setTherapistNames(users.filter(u => u.therapistName).map(u => u.therapistName as string));
      })
      .catch(() => {});
  }, [user.isAdmin, jwt]);

  useEffect(() => {
    if (!state) return;
    setError(null);
    setSaving(false);
    setDeleting(false);
    setDeleteDialog(false);

    const pad = (n: number) => String(n).padStart(2, '0');
    if (state.mode === 'edit') {
      setName(state.event.summary);
      setSelectedRoomId(state.event.calendarId);
      const s = new Date(state.event.start);
      const e = new Date(state.event.end);
      setDateVal(toDateInputValue(s));
      setStartTime(`${pad(s.getHours())}:${pad(s.getMinutes())}`);
      setEndTime(`${pad(e.getHours())}:${pad(e.getMinutes())}`);
      setRecurring(false);
      setRecurringFreq('WEEKLY');
      setRecurringUntil('');
    } else {
      setName(user.isAdmin ? '' : (user.therapistName ?? ''));
      setSelectedRoomId(state.room.id || state.room.name);
      const s = new Date(state.day);
      setDateVal(toDateInputValue(s));
      setStartTime(`${pad(state.hour)}:00`);
      setEndTime(`${pad(state.hour + 1)}:00`);
      setRecurring(false);
      setRecurringFreq('WEEKLY');
      const defaultUntil = new Date();
      defaultUntil.setMonth(defaultUntil.getMonth() + 3);
      setRecurringUntil(toDateInputValue(defaultUntil));
    }
  }, [state, user]);

  if (!state) return null;

  const isEdit = state.mode === 'edit';
  const editEventId = isEdit ? state.event.id : '';
  const editEventSummary = isEdit ? state.event.summary : '';
  const isRecurringEvent = isEdit && state.event.isRecurring;
  const masterEventId = isEdit ? (state.event.recurringEventId ?? '') : '';

  // Use selectedRoomId for create; for edit, room is always the event's calendar
  const roomId = isEdit ? state.event.calendarId : selectedRoomId;
  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const roomDisplayName = isEdit
    ? state.room.name
    : (selectedRoom?.name ?? state.room.name);

  // Permission: admin can edit anything; therapist can only edit their own events
  // Trim both sides to avoid whitespace mismatches
  const myName = user.therapistName?.trim() ?? '';
  const eventName = editEventSummary.trim();
  const isMyEvent = !!myName && myName === eventName;

  const canEdit = !isEdit || user.isAdmin || isMyEvent;
  const canDelete = isEdit && (user.isAdmin || isMyEvent);

  async function handleSave() {
    if (!name.trim()) { setError('יש להזין שם מטפל'); return; }
    if (!selectedRoomId) { setError('יש לבחור חדר'); return; }
    const startISO = new Date(`${dateVal}T${startTime}`).toISOString();
    const endISO   = new Date(`${dateVal}T${endTime}`).toISOString();
    if (new Date(endISO) <= new Date(startISO)) { setError('שעת סיום חייבת להיות אחרי שעת התחלה'); return; }

    setSaving(true);
    setError(null);
    try {
      if (isEdit) {
        await updateCalendarEvent(accessToken, roomId, editEventId, name.trim(), startISO, endISO);
      } else {
        const recurringOptions: RecurringOptions = recurring
          ? { freq: recurringFreq, until: recurringUntil || undefined }
          : null;
        await createCalendarEvent(accessToken, roomId, name.trim(), startISO, endISO, recurringOptions);
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה לא ידועה');
    } finally {
      setSaving(false);
    }
  }

  function handleDeleteClick() {
    if (!isEdit) return;
    if (isRecurringEvent) {
      setDeleteDialog(true);
    } else {
      if (!confirm(`למחוק את "${editEventSummary}"?`)) return;
      performDelete('single');
    }
  }

  async function performDelete(mode: 'single' | 'following' | 'series') {
    setDeleting(true);
    setDeleteDialog(false);
    setError(null);
    try {
      if (mode === 'series' && masterEventId) {
        await deleteCalendarEventSeries(accessToken, roomId, masterEventId);
      } else if (mode === 'following' && masterEventId && isEdit && state && state.mode === 'edit') {
        await deleteCalendarEventAndFollowing(accessToken, roomId, editEventId, masterEventId, state.event.start);
      } else {
        await deleteCalendarEvent(accessToken, roomId, editEventId);
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה בעת מחיקה');
    } finally {
      setDeleting(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 13, fontWeight: 600,
    color: '#374151', marginBottom: 4, direction: 'rtl',
  };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    border: '1px solid #d1d5db', borderRadius: 6,
    fontSize: 14, fontFamily: 'inherit',
    direction: 'rtl', boxSizing: 'border-box',
  };
  const disabledInputStyle: React.CSSProperties = {
    ...inputStyle,
    background: '#f1f5f9', color: '#64748b', cursor: 'not-allowed',
  };

  // Read-only view for therapists viewing another therapist's event
  if (isEdit && !canEdit) {
    return (
      <div
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        onClick={onClose}
      >
        <div
          style={{ background: 'white', borderRadius: 12, padding: 28, width: 360, maxWidth: '95vw', direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
          onClick={e => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b' }}>פגישה</h2>
            <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: '#374151' }}>
            <div><strong>מטפל:</strong> {editEventSummary}</div>
            <div><strong>חדר:</strong> {state.room.name}</div>
            <div><strong>התחלה:</strong> {new Date(state.event.start).toLocaleString('he-IL')}</div>
            <div><strong>סיום:</strong> {new Date(state.event.end).toLocaleString('he-IL')}</div>
            {isRecurringEvent && <div style={{ fontSize: 12, color: '#6366f1' }}>🔁 פגישה חוזרת</div>}
          </div>
          <div style={{ marginTop: 16, padding: '8px 10px', background: '#fef9c3', borderRadius: 6, fontSize: 12, color: '#92400e' }}>
            אין הרשאה לערוך פגישה זו
          </div>
          <button
            onClick={onClose}
            style={{ marginTop: 16, width: '100%', padding: '9px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 7, fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            סגור
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        style={{ background: 'white', borderRadius: 12, padding: 28, width: 420, maxWidth: '95vw', direction: 'rtl', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#1e293b' }}>
            {isEdit ? '✏️ עריכת פגישה' : '➕ הזמנת חדר'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Room selection */}
          <div>
            <label style={labelStyle}>חדר</label>
            {isEdit ? (
              // In edit mode: show room as read-only (moving events between rooms requires delete+create)
              <input style={disabledInputStyle} value={roomDisplayName} disabled readOnly />
            ) : (
              <select
                style={inputStyle}
                value={selectedRoomId}
                onChange={e => setSelectedRoomId(e.target.value)}
              >
                {/* Use resolved rooms if available, else fall back to the clicked room */}
                {rooms.some(r => r.id)
                  ? rooms.filter(r => r.id).map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))
                  : <option value={state.room.id || state.room.name}>{state.room.name}</option>
                }
              </select>
            )}
          </div>

          {/* Therapist name field */}
          <div>
            <label style={labelStyle}>שם המטפל</label>
            {user.isAdmin ? (
              <select
                style={inputStyle}
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
              >
                <option value="">— בחר מטפל —</option>
                {/* Include current event name if not already in the fetched list */}
                {name && !therapistNames.includes(name) && (
                  <option key="__current__" value={name}>{name}</option>
                )}
                {therapistNames.map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            ) : myName ? (
              // Therapist: show their own name as locked text
              <input
                style={disabledInputStyle}
                value={myName}
                disabled
                readOnly
              />
            ) : (
              // Therapist account has no therapistName configured
              <div style={{ padding: '8px 10px', background: '#fef9c3', border: '1px solid #fde68a', borderRadius: 6, fontSize: 13, color: '#92400e' }}>
                חשבונך אינו מקושר לשם מטפל. פנה למנהל המערכת.
              </div>
            )}
          </div>

          <div>
            <label style={labelStyle}>תאריך</label>
            <input type="date" style={inputStyle} value={dateVal} onChange={e => setDateVal(e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={labelStyle}>שעת התחלה</label>
              <select style={inputStyle} value={startTime} onChange={e => setStartTime(e.target.value)}>
                {/* Show current value if it's not a standard slot (e.g., imported event) */}
                {startTime && !TIME_SLOTS.includes(startTime) && (
                  <option value={startTime}>{startTime}</option>
                )}
                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>שעת סיום</label>
              <select style={inputStyle} value={endTime} onChange={e => setEndTime(e.target.value)}>
                {endTime && !TIME_SLOTS.includes(endTime) && (
                  <option value={endTime}>{endTime}</option>
                )}
                {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Recurring — only on create */}
          {!isEdit && (
            <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, fontWeight: 600, color: '#374151', direction: 'rtl', userSelect: 'none' }}>
                <input
                  type="checkbox"
                  checked={recurring}
                  onChange={e => setRecurring(e.target.checked)}
                  style={{ width: 17, height: 17, cursor: 'pointer', accentColor: '#2563eb' }}
                />
                🔁 פגישה חוזרת
              </label>

              {recurring && (
                <div style={{ marginTop: 12, background: '#f0f7ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div>
                    <label style={labelStyle}>חזרה כל:</label>
                    <select
                      style={inputStyle}
                      value={recurringFreq}
                      onChange={e => setRecurringFreq(e.target.value as 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY')}
                    >
                      <option value="WEEKLY">שבועי</option>
                      <option value="BIWEEKLY">דו-שבועי</option>
                      <option value="MONTHLY">חודשי</option>
                    </select>
                  </div>
                  <div>
                    <label style={labelStyle}>עד תאריך:</label>
                    <input
                      type="date"
                      style={inputStyle}
                      value={recurringUntil}
                      onChange={e => setRecurringUntil(e.target.value)}
                      min={toDateInputValue(new Date())}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* In edit mode: show recurring badge if event is recurring */}
          {isEdit && isRecurringEvent && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#ede9fe', borderRadius: 6, fontSize: 13, color: '#6d28d9' }}>
              🔁 פגישה חוזרת
            </div>
          )}
        </div>

        {/* Delete dialog for recurring events */}
        {deleteDialog && (
          <div style={{ marginTop: 18, padding: '14px', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#9a3412', marginBottom: 10 }}>
              זוהי פגישה חוזרת. מה ברצונך למחוק?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={() => performDelete('single')}
                disabled={deleting}
                style={{ padding: '8px 12px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}
              >
                מחק רק פגישה זו
              </button>
              <button
                onClick={() => performDelete('following')}
                disabled={deleting}
                style={{ padding: '8px 12px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}
              >
                מחק את כל הפגישות הבאות
              </button>
              <button
                onClick={() => performDelete('series')}
                disabled={deleting}
                style={{ padding: '8px 12px', background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}
              >
                מחק את כל הסדרה
              </button>
              <button
                onClick={() => setDeleteDialog(false)}
                style={{ padding: '8px 12px', background: 'none', color: '#94a3b8', border: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!deleteDialog && (
          <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSave}
                disabled={saving || (!user.isAdmin && !myName)}
                style={{
                  padding: '9px 20px', background: '#2563eb', color: 'white',
                  border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600,
                  cursor: (saving || (!user.isAdmin && !myName)) ? 'not-allowed' : 'pointer',
                  opacity: (saving || (!user.isAdmin && !myName)) ? 0.5 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {saving ? 'שומר...' : isEdit ? 'שמור שינויים' : 'צור פגישה'}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '9px 16px', background: 'white', color: '#374151',
                  border: '1px solid #d1d5db', borderRadius: 7, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                ביטול
              </button>
            </div>

            {canDelete && (
              <button
                onClick={handleDeleteClick}
                disabled={deleting}
                style={{
                  padding: '9px 16px', background: '#fef2f2', color: '#dc2626',
                  border: '1px solid #fecaca', borderRadius: 7, fontSize: 14,
                  cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1,
                  fontFamily: 'inherit',
                }}
              >
                {deleting ? 'מוחק...' : '🗑 מחק'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
