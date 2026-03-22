import { useState, useEffect, useCallback, useRef } from 'react';
import type { RoomCalendar, Conflict } from './types';
import { fetchAllRoomEvents } from './googleCalendar';
import { detectConflicts } from './utils';
import { REFRESH_INTERVAL_MS } from './constants';

export function useCalendarData(accessToken: string | null, startDate: Date, endDate: Date) {
  const [rooms, setRooms] = useState<RoomCalendar[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTs = startDate.getTime();
  const endTs   = endDate.getTime();

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const start       = new Date(startTs);
      const extendedEnd = new Date(endTs);
      extendedEnd.setDate(extendedEnd.getDate() + 1);

      const data = await fetchAllRoomEvents(accessToken, start, extendedEnd);
      setRooms(data);
      setConflicts(detectConflicts(data));
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message || 'שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  }, [accessToken, startTs, endTs]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!accessToken) return;
    timerRef.current = setInterval(fetchData, REFRESH_INTERVAL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [accessToken, fetchData]);

  return { rooms, conflicts, loading, error, lastRefresh, refetch: fetchData };
}
