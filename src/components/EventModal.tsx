import React, { useState, useEffect } from 'react';
import type { CalendarEvent, RoomCalendar, UserInfo } from '../types';
import {
  createRoomEvent,
  updateRoomEvent,
  updateRoomEventSeries,
  deleteRoomEvent,
  deleteRoomEventSeries,
  deleteRoomEventAndFollowing,
  type RecurringOptions,
} from '../roomsApi';
import type { Tenant } from '../types';

// 30-minute time slots from 07:00 to 22:00
const TIME_SLOTS: string[] = [];
for (let h = 7; h <= 22; h++) {
  TIME_SLOTS.push(`${String(h).padStart(2, '0')}:00`);
  if (h < 22) TIME_SLOTS.push(`${String(h).padStart(2, '0')}:30`);
}

export type ModalState =
  | { mode: 'create'; room: RoomCalendar; day: Date; hour: number }
  | { mode: 'edit'; event: CalendarEvent; room: RoomCalendar }
  | { mode: 'duplicate'; event: CalendarEvent; room: RoomCalendar }
  | null;

interface Props {
  state: ModalState;
  rooms: RoomCalendar[];
  jwt: string;
  user: UserInfo;
  onClose: () => void;
  onSaved: () => void;
  onDuplicate?: (state: ModalState) => void;
}


function toDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const EventModal: React.FC<Props> = ({ state, rooms, jwt, user, onClose, onSaved, onDuplicate }) => {
  const [name, setName] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [dateVal, setDateVal] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [recurring, setRecurring] = useState(false);
  const [recurringFreq, setRecurringFreq] = useState<'WEEKLY' | 'BIWEEKLY' | 'MONTHLY'>('WEEKLY');
  const [recurringUntil, setRecurringUntil] = useState('');
  const [recurringNoEnd, setRecurringNoEnd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [updateDialog, setUpdateDialog] = useState(false);
  const [pendingSave, setPendingSave] = useState<{ name: string; startISO: string; endISO: string } | null>(null);
  const [therapistNames, setTherapistNames] = useState<string[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');

  // Fetch therapist list + tenants every time the modal opens
  // Both fetched from portal API (shared JWT_SECRET ensures the token is valid there too)
  useEffect(() => {
    if (!state || !user.canManageCalendar) return;
    fetch('https://hevrutah-portal.vercel.app/api/users/therapists')
      .then(r => r.json())
      .then((names: string[]) => setTherapistNames(names))
      .catch(() => {});
    fetch('/api/rooms?_action=tenants')
      .then(r => r.ok ? r.json() : [])
      .then((data: Tenant[]) => setTenants(data))
      .catch(() => {});
  }, [state, user.canManageCalendar]);

  useEffect(() => {
    if (!state) return;
    setError(null);
    setSaving(false);
    setDeleting(false);
    setDeleteDialog(false);
    setUpdateDialog(false);
    setPendingSave(null);
    setSelectedTenantId('');

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
    } else if (state.mode === 'duplicate') {
      // Pre-fill everything from the original event, date left for user to change
      setName(state.event.summary);
      setSelectedRoomId(state.event.calendarId);
      const s = new Date(state.event.start);
      const e = new Date(state.event.end);
      setDateVal(toDateInputValue(s));
      setStartTime(`${pad(s.getHours())}:${pad(s.getMinutes())}`);
      setEndTime(`${pad(e.getHours())}:${pad(e.getMinutes())}`);
      setRecurring(false);
      setRecurringFreq('WEEKLY');
      setRecurringNoEnd(false);
      const defaultUntil = new Date();
      defaultUntil.setMonth(defaultUntil.getMonth() + 3);
      setRecurringUntil(toDateInputValue(defaultUntil));
    } else {
      setName((user.isAdmin || user.canManageCalendar) ? '' : (user.therapistName ?? ''));
      setSelectedRoomId(state.room.id || state.room.name);
      const s = new Date(state.day);
      setDateVal(toDateInputValue(s));
      setStartTime(`${pad(state.hour)}:00`);
      setEndTime(`${pad(state.hour + 1)}:00`);
      setRecurring(false);
      setRecurringFreq('WEEKLY');
      setRecurringNoEnd(false);
      const defaultUntil = new Date();
      defaultUntil.setMonth(defaultUntil.getMonth() + 3);
      setRecurringUntil(toDateInputValue(defaultUntil));
    }
  }, [state, user]);

  if (!state) return null;

  const isEdit = state.mode === 'edit';
  const isDuplicate = state.mode === 'duplicate';
  const editEventId = isEdit ? state.event.id : '';
  const editEventSummary = (isEdit || isDuplicate) ? state.event.summary : '';
  const isRecurringEvent = isEdit && state.event.isRecurring;
  const masterEventId = isEdit ? (state.event.recurringEventId ?? '') : '';

  const roomId = selectedRoomId || (isEdit ? state.event.calendarId : '');
  const selectedRoom = rooms.find(r => r.id === selectedRoomId);
  const roomDisplayName = selectedRoom?.name ?? (isEdit ? state.room.name : state.room.name);

  // Permission: admin/coordinator/secretary can edit anything; therapist can only edit their own events
  const myName = user.therapistName?.trim() ?? '';
  const eventName = editEventSummary.trim();
  const isMyEvent = !!myName && myName === eventName;
  const canManageAll = user.isAdmin || user.canManageCalendar;

  const canEdit = !isEdit || canManageAll || isMyEvent;
  const canDelete = isEdit && (canManageAll || isMyEvent);

  async function handleSave() {
    const effectiveName = name.trim();
    const effectiveTenantId: string | null = selectedTenantId || null;
    if (!effectiveName) { setError('יש להזין שם'); return; }
    if (!selectedRoomId && !isEdit) { setError('יש לבחור חדר'); return; }
    const startISO = new Date(`${dateVal}T${startTime}`).toISOString();
    const endISO   = new Date(`${dateVal}T${endTime}`).toISOString();
    if (new Date(endISO) <= new Date(startISO)) { setError('שעת סיום חייבת להיות אחרי שעת התחלה'); return; }

    // If editing a recurring event — ask user which occurrences to update
    if (isEdit && isRecurringEvent) {
      setPendingSave({ name: effectiveName, startISO, endISO });
      setUpdateDialog(true);
      return;
    }

    await doSave(effectiveName, startISO, endISO, 'single', effectiveTenantId);
  }

  async function doSave(saveName: string, startISO: string, endISO: string, mode: 'single' | 'series', tenantId?: string | null) {
    setSaving(true);
    setError(null);
    setUpdateDialog(false);
    try {
      if (isEdit) {
        if (mode === 'series' && masterEventId) {
          await updateRoomEventSeries(jwt, masterEventId, saveName, startTime, endTime);
        } else {
          const movedRoom = selectedRoomId !== state.event.calendarId ? selectedRoomId : undefined;
          await updateRoomEvent(jwt, editEventId, saveName, startISO, endISO, movedRoom);
        }
      } else {
        // create or duplicate — both call createRoomEvent
        const recurringOptions: RecurringOptions = recurring
          ? { freq: recurringFreq, until: recurringNoEnd ? undefined : (recurringUntil || undefined) }
          : null;
        await createRoomEvent(jwt, roomId, saveName, startISO, endISO, recurringOptions, tenantId);
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
        await deleteRoomEventSeries(jwt, masterEventId);
      } else if (mode === 'following' && masterEventId && isEdit && state && state.mode === 'edit') {
        await deleteRoomEventAndFollowing(jwt, editEventId, masterEventId, state.event.start);
      } else {
        await deleteRoomEvent(jwt, editEventId);
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
            {isEdit ? '✏️ עריכת פגישה' : isDuplicate ? '📋 שכפול פגישה' : '➕ הזמנת חדר'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94a3b8' }}>✕</button>
        </div>

        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '8px 12px', borderRadius: 6, fontSize: 13, marginBottom: 14 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Room selection — editable both in create and edit mode */}
          <div>
            <label style={labelStyle}>חדר</label>
            <select
              style={inputStyle}
              value={selectedRoomId}
              onChange={e => setSelectedRoomId(e.target.value)}
            >
              {rooms.some(r => r.id)
                ? rooms.filter(r => r.id).map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))
                : <option value={state.room.id || state.room.name}>{state.room.name}</option>
              }
            </select>
          </div>

          {/* Name field — therapists + tenants in one datalist */}
          <div>
            <label style={labelStyle}>שם</label>
            {canManageAll ? (
              <>
                <input
                  type="text"
                  list="name-suggestions"
                  style={inputStyle}
                  value={name}
                  onChange={e => {
                    const val = e.target.value;
                    setName(val);
                    const matched = tenants.find(t => t.name === val);
                    setSelectedTenantId(matched?.id ?? '');
                  }}
                  placeholder="הקלד שם חופשי או בחר מהרשימה..."
                  autoFocus
                  autoComplete="off"
                />
                <datalist id="name-suggestions">
                  {therapistNames.map(n => <option key={n} value={n} />)}
                  {tenants.map(t => <option key={`t-${t.id}`} value={t.name} label={`🏢 ${t.name}`} />)}
                </datalist>
                {selectedTenantId && (
                  <div style={{ fontSize: 11, color: '#0369a1', marginTop: 3 }}>🏢 שוכר</div>
                )}
              </>
            ) : myName ? (
              <input style={disabledInputStyle} value={myName} disabled readOnly />
            ) : (
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
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#374151', direction: 'rtl', userSelect: 'none' as const, marginBottom: 6 }}>
                      <input
                        type="checkbox"
                        checked={recurringNoEnd}
                        onChange={e => setRecurringNoEnd(e.target.checked)}
                        style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#2563eb' }}
                      />
                      ללא תאריך סיום
                    </label>
                    {!recurringNoEnd && (
                      <>
                        <label style={labelStyle}>עד תאריך:</label>
                        <input
                          type="date"
                          style={inputStyle}
                          value={recurringUntil}
                          onChange={e => setRecurringUntil(e.target.value)}
                          min={toDateInputValue(new Date())}
                        />
                      </>
                    )}
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

        {/* Update dialog for recurring events */}
        {updateDialog && pendingSave && (
          <div style={{ marginTop: 18, padding: '14px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#1e40af', marginBottom: 10 }}>
              זוהי פגישה חוזרת. מה ברצונך לעדכן?
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button
                onClick={() => doSave(pendingSave.name, pendingSave.startISO, pendingSave.endISO, 'single', null)}
                disabled={saving}
                style={{ padding: '8px 12px', background: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}
              >
                עדכן רק פגישה זו
              </button>
              <button
                onClick={() => doSave(pendingSave.name, pendingSave.startISO, pendingSave.endISO, 'series', null)}
                disabled={saving}
                style={{ padding: '8px 12px', background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe', borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}
              >
                עדכן את כל הסדרה
              </button>
              <button
                onClick={() => { setUpdateDialog(false); setPendingSave(null); }}
                style={{ padding: '8px 12px', background: 'none', color: '#94a3b8', border: 'none', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'right' }}
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!deleteDialog && !updateDialog && (
          <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleSave}
                disabled={saving || (!canManageAll && !myName)}
                style={{
                  padding: '9px 20px', background: '#2563eb', color: 'white',
                  border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600,
                  cursor: (saving || (!user.isAdmin && !myName)) ? 'not-allowed' : 'pointer',
                  opacity: (saving || (!canManageAll && !myName)) ? 0.5 : 1,
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

            {isEdit && canManageAll && onDuplicate && (
              <button
                onClick={() => onDuplicate({ mode: 'duplicate', event: state.event, room: state.room })}
                style={{
                  padding: '9px 16px', background: '#f0fdf4', color: '#16a34a',
                  border: '1px solid #bbf7d0', borderRadius: 7, fontSize: 14,
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                📋 שכפל
              </button>
            )}
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
