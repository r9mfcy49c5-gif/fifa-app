create table if not exists participants (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  phone text not null,
  player_code text not null,
  team text not null,
  flag text not null,
  points integer not null default 0,
  wins integer not null default 0,
  losses integer not null default 0,
  goals_for integer not null default 0,
  goals_against integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  round integer not null,
  slot integer not null,
  team_a text,
  team_b text,
  score_a integer not null default 0,
  score_b integer not null default 0,
  winner text,
  updated_at timestamptz not null default now()
);

create table if not exists app_settings (
  id integer primary key default 1,
  registration_locked boolean not null default false,
  title text not null default 'Lytle Lemon FIFA Project',
  updated_at timestamptz not null default now(),
  constraint single_settings_row check (id = 1)
);

insert into app_settings (id, registration_locked, title)
values (1, false, 'Lytle Lemon FIFA Project')
on conflict (id) do nothing;

alter table participants add column if not exists wins integer not null default 0;
alter table participants add column if not exists losses integer not null default 0;
alter table participants add column if not exists goals_for integer not null default 0;
alter table participants add column if not exists goals_against integer not null default 0;

-- Important: player_code is intentionally NOT unique. Duplicate 4-digit player codes are allowed.

do $$ begin
  alter publication supabase_realtime add table participants;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table matches;
exception when duplicate_object then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table app_settings;
exception when duplicate_object then null;
end $$;


create table if not exists game_picks (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid references participants(id) on delete cascade,
  game_id text not null default 'game-1-canada-south-africa',
  game_label text not null default 'Game 1: Canada vs South Africa',
  selected_team text not null check (selected_team in ('Canada','South Africa')),
  selected_flag text not null,
  locked boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (participant_id, game_id)
);

alter table app_settings add column if not exists picks_locked boolean not null default false;
alter table app_settings add column if not exists game_one_label text not null default 'Game 1: Canada vs South Africa';

do $$ begin
  alter publication supabase_realtime add table game_picks;
exception when duplicate_object then null;
end $$;

create table if not exists live_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

do $$ begin
  alter publication supabase_realtime add table live_events;
exception when duplicate_object then null;
end $$;
