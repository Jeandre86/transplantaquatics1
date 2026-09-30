import type { Event } from '../types';
import { supabase } from './supabase';

export type GoalCourse = 'SCY' | 'SCM' | 'LCM';

export interface AthleteGoal {
  id: string;
  event: Event;
  course: GoalCourse;
  targetTime: string;
  isPublic: boolean;
  createdAt: string;
}

interface GoalRow {
  id: string;
  event: Event;
  course: GoalCourse;
  target_time: string;
  is_public: boolean;
  created_at: string;
}

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured. Add the project URL and publishable key to .env.local.');
  return supabase;
}

export function athleteGoalsErrorMessage(error: unknown): string {
  const message = error && typeof error === 'object' && 'message' in error ? String(error.message) : '';
  if (/athlete_goals|schema cache|relation .* does not exist/i.test(message)) {
    return 'The goals table is not set up in Supabase yet. Run the athlete goals migration in supabase/migrations.';
  }
  return message || 'Could not connect to the goals database. Please try again.';
}

function fromRow(row: GoalRow): AthleteGoal {
  return { id: row.id, event: row.event, course: row.course, targetTime: row.target_time, isPublic: row.is_public, createdAt: row.created_at };
}

export async function loadAthleteGoals(): Promise<AthleteGoal[]> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('athlete_goals')
    .select('id,event,course,target_time,is_public,created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as GoalRow[]).map(fromRow);
}

export async function createAthleteGoal(goal: Pick<AthleteGoal, 'event' | 'course' | 'targetTime' | 'isPublic'>): Promise<AthleteGoal> {
  const client = requireSupabase();
  const { data, error } = await client
    .from('athlete_goals')
    .insert({ event: goal.event, course: goal.course, target_time: goal.targetTime, is_public: goal.isPublic })
    .select('id,event,course,target_time,is_public,created_at')
    .single();
  if (error) throw error;
  return fromRow(data as GoalRow);
}

export async function setAthleteGoalVisibility(id: string, isPublic: boolean): Promise<void> {
  const { error } = await requireSupabase().from('athlete_goals').update({ is_public: isPublic }).eq('id', id);
  if (error) throw error;
}

export async function removeAthleteGoal(id: string): Promise<void> {
  const client = requireSupabase();
  const { error } = await client.from('athlete_goals').delete().eq('id', id);
  if (error) throw error;
}
