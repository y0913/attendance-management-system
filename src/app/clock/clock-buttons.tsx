'use client';

import { useTransition } from 'react';
import type { TimeClockType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { punchClockAction } from './actions';
import type { ClockState } from '@/lib/data/time-clocks';

interface Props {
  state: ClockState;
}

const PRIMARY_LABEL: Record<TimeClockType, string> = {
  clock_in: '出勤',
  clock_out: '退勤',
  break_start: '休憩開始',
  break_end: '休憩終了',
};

const ALL_BUTTONS: TimeClockType[] = [
  'clock_in',
  'clock_out',
  'break_start',
  'break_end',
];

const ENABLED_BY_STATE: Record<ClockState, TimeClockType[]> = {
  not_clocked_in: ['clock_in'],
  working: ['clock_out', 'break_start'],
  on_break: ['break_end'],
  clocked_out: [],
};

export function ClockButtons({ state }: Props) {
  const [pending, startTransition] = useTransition();

  const punch = (type: TimeClockType) => {
    startTransition(async () => {
      await punchClockAction({ type });
    });
  };

  const enabled = ENABLED_BY_STATE[state];

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      {ALL_BUTTONS.map((type) => {
        const isEnabled = enabled.includes(type);
        return (
          <Button
            key={type}
            size="lg"
            variant={type === 'clock_out' ? 'destructive' : 'default'}
            className="h-20 flex-1 text-xl font-semibold sm:min-w-[140px]"
            disabled={pending || !isEnabled}
            onClick={() => punch(type)}
          >
            {PRIMARY_LABEL[type]}
          </Button>
        );
      })}
    </div>
  );
}
