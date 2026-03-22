import React from 'react';

interface Props {
  onToday: () => void;
  loading: boolean;
  lastRefresh: Date | null;
}

export const WeekNav: React.FC<Props> = ({ onToday, loading, lastRefresh }) => {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, direction: 'rtl', marginBottom: 8, flexWrap: 'wrap' }}>
      <button
        style={{
          padding: '6px 14px', borderRadius: 6,
          background: '#3b82f6', color: 'white', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
        }}
        onClick={onToday}
      >
        קפוץ להיום
      </button>

      {loading && <span style={{ fontSize: 12, color: '#64748b' }}>⟳ טוען...</span>}
      {lastRefresh && !loading && (
        <span style={{ fontSize: 11, color: '#94a3b8' }}>
          עודכן: {lastRefresh.toLocaleTimeString('he-IL')}
        </span>
      )}
    </div>
  );
};
