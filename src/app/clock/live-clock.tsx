'use client';

import { useEffect, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { ja } from 'date-fns/locale';
import { JST_TIMEZONE } from '@/lib/calc/constants';

export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-1 py-4">
      <p className="text-3xl font-semibold tabular-nums">
        {now
          ? formatInTimeZone(now, JST_TIMEZONE, 'M月d日 (EEE)', { locale: ja })
          : ' '}
      </p>
      <p className="text-6xl font-bold tabular-nums tracking-tight">
        {now ? formatInTimeZone(now, JST_TIMEZONE, 'HH:mm:ss') : '--:--:--'}
      </p>
    </div>
  );
}
