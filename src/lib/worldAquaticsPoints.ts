import type { Course, Gender } from '../types';
import { timeToSeconds } from './utils';

// World Aquatics 2026 base times. Each base time represents 1,000 points.
// Source: World Aquatics Points, valid through 2026 (LCM and SCM tables).
const baseTimes: Record<Course, Record<Gender, Record<string, number>>> = {
  LCM: {
    Men: {
      '50m Freestyle': 20.91, '100m Freestyle': 46.40, '200m Freestyle': 102.00,
      '400m Freestyle': 219.96, '800m Freestyle': 452.12, '1500m Freestyle': 870.67,
      '50m Backstroke': 23.55, '100m Backstroke': 51.60, '200m Backstroke': 111.92,
      '50m Breaststroke': 25.95, '100m Breaststroke': 56.88, '200m Breaststroke': 125.48,
      '50m Butterfly': 22.27, '100m Butterfly': 49.45, '200m Butterfly': 110.34,
      '200m Medley': 112.69, '400m Medley': 242.50,
    },
    Women: {
      '50m Freestyle': 23.61, '100m Freestyle': 51.71, '200m Freestyle': 112.23,
      '400m Freestyle': 234.18, '800m Freestyle': 484.12, '1500m Freestyle': 920.48,
      '50m Backstroke': 26.86, '100m Backstroke': 57.13, '200m Backstroke': 123.14,
      '50m Breaststroke': 29.16, '100m Breaststroke': 64.13, '200m Breaststroke': 137.55,
      '50m Butterfly': 24.43, '100m Butterfly': 54.60, '200m Butterfly': 121.81,
      '200m Medley': 125.70, '400m Medley': 263.65,
    },
  },
  SCM: {
    Men: {
      '50m Freestyle': 19.90, '100m Freestyle': 44.84, '200m Freestyle': 98.61,
      '400m Freestyle': 212.25, '800m Freestyle': 440.46, '1500m Freestyle': 846.88,
      '50m Backstroke': 22.11, '100m Backstroke': 48.16, '200m Backstroke': 105.12,
      '50m Breaststroke': 24.95, '100m Breaststroke': 55.28, '200m Breaststroke': 119.52,
      '50m Butterfly': 21.32, '100m Butterfly': 47.68, '200m Butterfly': 106.85,
      '200m Medley': 108.88, '400m Medley': 234.81,
    },
    Women: {
      '50m Freestyle': 22.83, '100m Freestyle': 49.93, '200m Freestyle': 109.36,
      '400m Freestyle': 230.25, '800m Freestyle': 474.00, '1500m Freestyle': 908.24,
      '50m Backstroke': 25.23, '100m Backstroke': 54.02, '200m Backstroke': 117.33,
      '50m Breaststroke': 28.37, '100m Breaststroke': 62.36, '200m Breaststroke': 132.50,
      '50m Butterfly': 23.72, '100m Butterfly': 52.71, '200m Butterfly': 119.32,
      '200m Medley': 121.63, '400m Medley': 255.48,
    },
  },
};

function normalizeEvent(event: string): string {
  return event.trim().replace(/individual medley/i, 'Medley');
}

export function getWorldAquaticsBaseTime(event: string, gender: Gender, course: string): number | null {
  if (course !== 'LCM' && course !== 'SCM') return null;
  return baseTimes[course][gender][normalizeEvent(event)] ?? null;
}

export function getWorldAquaticsPoints(input: {
  event: string;
  gender: Gender;
  course: string;
  time: string;
}): number | null {
  return pointsFromBaseTime(getWorldAquaticsBaseTime(input.event, input.gender, input.course), input.time);
}

export function pointsFromBaseTime(baseTime: number | null, time: string): number | null {
  const swimTime = timeToSeconds(time);
  if (!baseTime || !Number.isFinite(swimTime) || swimTime <= 0) return null;
  return Math.trunc(1000 * (baseTime / swimTime) ** 3);
}
