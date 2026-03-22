import React from 'react';
import type { WeekStats, RoomCalendar } from '../types';

interface Props {
  stats: WeekStats;
  rooms: RoomCalendar[];
}

export const StatsBar: React.FC<Props> = ({ stats, rooms }) => {
  return (
    <div style={{
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      direction: 'rtl',
      background: '#f8fafc',
      border: '1px solid #e2e8f0',
      borderRadius: 8,
      padding: '10px 16px',
      marginBottom: 12,
      alignItems: 'center',
    }}>
      <span style={{ fontWeight: 700, fontSize: 14 }}>📊 סטטיסטיקות:</span>

      <span style={{ fontSize: 13 }}>
        סה"כ היום: <strong>{stats.totalToday}</strong>
      </span>


      {rooms.map((room) => (
        <span key={room.id} style={{ fontSize: 12, color: '#475569' }}>
          {room.name}: <strong>{stats.roomOccupancy[room.id] ?? 0}%</strong>
        </span>
      ))}
    </div>
  );
};
