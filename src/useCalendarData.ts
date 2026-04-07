import { useState, useEffect, useCallback, useRef } from 'react';
import type { RoomCalendar, Conflict } from './types';
import { fetchRoomEvents } from './roomsApi';
import { detectConflicts } from './utils';
import { REFRESH_INTERVAL_MS } from './constants';

export function useCalendarData(jwt: string, startDate: Date, endDate: Date) {
  const [rooms, setRooms] = useState<RoomCalendar[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTs = startDate.getTime();
  const endTs   = endDate.getTime();

  const fetchData = useCallback(async () => {
    if (!jwt) return;
    setLoading(true);
    setError(null);
    try {
      const start       = new Date(startTs);
      const extendedEnd = new Date(endTs);
      extendedEnd.setDate(extendedEnd.getDate() + 1);

      const data = await fetchRoomEvents(jwt, start, extendedEnd);
      setRooms(data);
      setConflicts(detectConflicts(data));
      setLastRefresh(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  }, [jwt, startTs, endTs]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!jwt) return;
    timerRef.current = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [jwt, fetchData]);

  return { rooms, conflicts, loading, error, lastRefresh, refetch: fetchData };
}
