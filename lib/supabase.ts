import { createClient } from '@supabase/supabase-js';
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
export const supabase = createClient(url, key);
export type Participant = { id:string; first_name:string; last_name:string; phone:string; player_code:string; team:string; flag:string; points:number; wins:number; losses:number; goals_for:number; goals_against:number; created_at:string };
export type Match = { id:string; round:number; slot:number; team_a:string|null; team_b:string|null; score_a:number; score_b:number; winner:string|null; updated_at:string };
export type AppSetting = { id:number; registration_locked:boolean; picks_locked:boolean; title:string; game_one_label:string; updated_at:string };
export type GamePick = { id:string; participant_id:string; game_id:string; game_label:string; selected_team:'Canada'|'South Africa'; selected_flag:string; locked:boolean; created_at:string; updated_at:string };
export type LiveEvent = { id:string; event_type:string; title:string; message:string; created_at:string };
