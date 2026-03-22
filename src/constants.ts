export const ROOM_CALENDARS = [
  { name: 'החדר האפור', id: '' },
  { name: 'החדר של יעד', id: '' },
  { name: 'חדר אמצעי', id: '' },
  { name: 'חדר חדש', id: '' },
  { name: 'חדר קבוצות', id: '' },
  { name: 'חדר שמאלי', id: '' },
];

export const HOURS_START = 7;
export const HOURS_END = 20;
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

