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
  canManageCalendar: boolean; // admin, coordinator, or secretary can manage all events
  therapistName: string | null; // matched against event summary for permission checks
  airtableAccess?: boolean;
}

export interface AirtableReferralData {
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
}

export type ReferralStage = 'new' | 'assigned' | 'intake_scheduled' | 'intake_done' | 'decided';
export type ReferralDecision = 'private' | 'group' | 'no_continue' | null;

export interface ReferralNote {
  id: string;
  author: string;
  authorName: string;
  content: string;
  timestamp: string;
}

export interface ReferralPipelineRecord {
  id: string;
  airtableId: string;
  stage: ReferralStage;
  assignedTo: string | null;
  assignedName: string | null;
  notes: ReferralNote[];
  decision: ReferralDecision;
  intakeDate: string | null;
  importedAt: string;
  updatedAt: string;
}

export interface Referral extends AirtableReferralData, ReferralPipelineRecord {}

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
