// Colors per room — order matches ROOM_CALENDARS
export const ROOM_COLORS = [
  '#6b7280', // החדר האפור  — אפור
  '#3b82f6', // החדר של יעד — כחול
  '#8b5cf6', // חדר אמצעי   — סגול
  '#22c55e', // חדר חדש      — ירוק
  '#f97316', // חדר קבוצות  — כתום
  '#ec4899', // חדר שמאלי   — ורוד
];

export const ROOM_CALENDARS = [
  { name: 'החדר האפור', id: '' },
  { name: 'החדר של יעד', id: '' },
  { name: 'חדר אמצעי', id: '' },
  { name: 'חדר חדש', id: '' },
  { name: 'חדר קבוצות', id: '' },
  { name: 'חדר שמאלי', id: '' },
];

export const HOURS_START = 7;
export const HOURS_END = 22;
export const REFRESH_INTERVAL_MS = 60_000;

// Full calendar scope required for calendarList.list + events CRUD
export const GOOGLE_SCOPES = 'https://www.googleapis.com/auth/calendar';

// Predefined therapist names used in calendar events — edit this list to add/remove therapists
export const THERAPIST_NAMES: string[] = [
  'יעד מידן',
  'מטפל א',
  'מטפל ב',
  'מטפל ג',
];

