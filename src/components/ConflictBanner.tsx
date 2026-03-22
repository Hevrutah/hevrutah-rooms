import React from 'react';
import type { Conflict } from '../types';

interface Props {
  conflicts: Conflict[];
}

const DAY_NAMES = ['יום ראשון', 'יום שני', 'יום שלישי', 'יום רביעי', 'יום חמישי', 'יום שישי', 'שבת'];

function dayKey(isoDate: string): string {
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

function dayLabel(isoDate: string): string {
  const d = new Date(isoDate);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${DAY_NAMES[d.getDay()]} ${dd}/${mm}`;
}

export const ConflictBanner: React.FC<Props> = ({ conflicts }) => {
  if (conflicts.length === 0) return null;

  // Group conflicts by calendar date of first event's start
  const groups: Map<string, { label: string; items: Conflict[] }> = new Map();
  for (const c of conflicts) {
    const key = dayKey(c.events[0].start);
    if (!groups.has(key)) {
      groups.set(key, { label: dayLabel(c.events[0].start), items: [] });
    }
    groups.get(key)!.items.push(c);
  }

  // Sort groups by date
  const sortedKeys = Array.from(groups.keys()).sort();

  return (
    <div style={{
      background: '#fef2f2',
      border: '1px solid #fecaca',
      borderRadius: 8,
      marginBottom: 12,
      direction: 'rtl',
      overflow: 'hidden',
    }}>
      <div style={{
        background: '#dc2626',
        color: 'white',
        padding: '8px 14px',
        fontSize: 13,
        fontWeight: 700,
      }}>
        ⚠️ התנגשויות הזמנה ({conflicts.length})
      </div>

      <div style={{ padding: '8px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {sortedKeys.map(key => {
          const group = groups.get(key)!;
          return (
            <div key={key}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#dc2626', marginBottom: 4 }}>
                {group.label}:
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {group.items.map((c, i) => (
                  <div key={i} style={{
                    fontSize: 13,
                    color: '#7f1d1d',
                    paddingRight: 8,
                    borderRight: '2px solid #fca5a5',
                  }}>
                    <strong>{c.roomName}</strong>
                    {' | '}
                    {c.time}
                    {' | '}
                    <strong>{c.events[0].summary}</strong>
                    {' ↔ '}
                    <strong>{c.events[1].summary}</strong>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
