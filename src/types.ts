export interface CalendarEvent {
  id: string;
  summary: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  calendarId: string;
  roomName: string;
  isRecurring: boolean;
  recurringEventId?: string;
  creatorEmail?: string;
}

export type UserRole = 'admin' | 'hevrutah' | 'external';

export interface UserInfo {
  username: string;
  name: string;
  role: UserRole;
  isAdmin: boolean;
  therapistName: string | null; // matched against event summary for permission checks
}

export interface Conflict {
  roomName: string;
  roomId: string;
  time: string;
  events: CalendarEvent[];
}

export interface RoomCalendar {
  id: string;
  name: string;
  events: CalendarEvent[];
}

export interface WeekStats {
  roomOccupancy: Record<string, number>; // roomId -> %
  totalToday: number;
  conflictCount: number;
}
