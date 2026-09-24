import { timeToSeconds } from '../lib/utils';
import type { Event, Course, Gender, AgeGroup } from '../types';

// Mock WTG qualifying standards (time strings, same format as result times)
const WTG_STANDARDS: Partial<Record<Course, Partial<Record<Gender, Partial<Record<Event, string>>>>>> = {
  LCM: {
    Men: {
      '50m Freestyle':           '26.00',
      '100m Freestyle':          '1:02.00',
      '200m Freestyle':          '2:18.00',
      '400m Freestyle':          '4:48.00',
      '800m Freestyle':          '10:10.00',
      '1500m Freestyle':         '19:00.00',
      '50m Backstroke':          '31.00',
      '100m Backstroke':         '1:12.00',
      '200m Backstroke':         '2:38.00',
      '50m Breaststroke':        '35.50',
      '100m Breaststroke':       '1:18.00',
      '200m Breaststroke':       '2:52.00',
      '50m Butterfly':           '30.00',
      '100m Butterfly':          '1:10.00',
      '200m Butterfly':          '2:36.00',
      '200m Individual Medley':  '2:32.00',
      '400m Individual Medley':  '5:20.00',
    },
    Women: {
      '50m Freestyle':           '29.00',
      '100m Freestyle':          '1:10.00',
      '200m Freestyle':          '2:32.00',
      '400m Freestyle':          '5:22.00',
      '800m Freestyle':          '11:20.00',
      '1500m Freestyle':         '21:30.00',
      '50m Backstroke':          '34.50',
      '100m Backstroke':         '1:20.00',
      '200m Backstroke':         '2:52.00',
      '50m Breaststroke':        '40.00',
      '100m Breaststroke':       '1:28.00',
      '200m Breaststroke':       '3:12.00',
      '50m Butterfly':           '33.00',
      '100m Butterfly':          '1:18.00',
      '200m Butterfly':          '2:52.00',
      '200m Individual Medley':  '2:48.00',
      '400m Individual Medley':  '5:52.00',
    },
  },
  SCM: {
    Men: {
      '50m Freestyle':  '24.50',
      '100m Freestyle': '57.00',
      '200m Freestyle': '2:06.00',
      '100m Backstroke': '1:07.00',
      '100m Breaststroke': '1:12.00',
      '100m Butterfly': '1:04.00',
    },
    Women: {
      '50m Freestyle':  '27.50',
      '100m Freestyle': '1:05.00',
      '200m Freestyle': '2:24.00',
      '100m Backstroke': '1:15.00',
      '100m Breaststroke': '1:22.00',
      '100m Butterfly': '1:12.00',
    },
  },
};

interface TimeStandardProps {
  time: string;
  event: Event;
  course: Course;
  gender: Gender;
  ageGroup?: AgeGroup;
}

function formatGap(diffSec: number): string {
  if (diffSec < 60) return `+${diffSec.toFixed(2)}`;
  const m = Math.floor(diffSec / 60);
  const s = (diffSec % 60).toFixed(2).padStart(5, '0');
  return `+${m}:${s}`;
}

export default function TimeStandard({ time, event, course, gender }: TimeStandardProps) {
  const standardStr = WTG_STANDARDS[course]?.[gender]?.[event];
  if (!standardStr) return null;

  const timeSec = timeToSeconds(time);
  const stdSec  = timeToSeconds(standardStr);
  const diff    = timeSec - stdSec;  // negative = faster than standard (qualified)

  if (diff <= 0) {
    // Qualified — green text, no background
    return (
      <span className="font-mono text-xs font-bold" style={{ color: '#16a34a' }}>
        Q
      </span>
    );
  }

  // Not yet qualified — red to signal they missed the standard
  return (
    <span className="font-mono text-xs" style={{ color: '#dc2626' }}>
      {formatGap(diff)}
    </span>
  );
}

// Exported helper so other modules can compute status without rendering
export function getWTGStandardStr(event: Event, course: Course, gender: Gender): string | undefined {
  return WTG_STANDARDS[course]?.[gender]?.[event];
}
