'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

type Player = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string;
  player_code: string;
  team: string;
  flag: string;
  points: number;
  wins: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  created_at?: string;
};

type Match = {
  id: string;
  round: string;
  kickoff: string;
  team_a: string;
  flag_a: string;
  team_b: string;
  flag_b: string;
  score_a: number;
  score_b: number;
  winner: string | null;
  status: string;
  minute?: number | null;
  extra_time?: number | null;
  highlights_url?: string | null;
  venue?: string | null;
  updated_at?: string;
};

type Pick = {
  id?: string;
  participant_id: string;
  match_id: string;
  selected_team: string;
  updated_at?: string;
};

type ChatMessage = {
  id: string;
  player_name: string;
  message: string;
  created_at?: string;
};

const ADMIN_PHONE = '7209880163';
const ADMIN_PASSCODE = '3737';
const TOURNAMENT_YEAR = 2026;

const TEAMS: [string, string][] = [
  ['Argentina', '🇦🇷'],
  ['Brazil', '🇧🇷'],
  ['France', '🇫🇷'],
  ['England', '🏴'],
  ['Spain', '🇪🇸'],
  ['Germany', '🇩🇪'],
  ['Portugal', '🇵🇹'],
  ['USA', '🇺🇸'],
  ['Mexico', '🇲🇽'],
  ['Netherlands', '🇳🇱'],
  ['Japan', '🇯🇵'],
  ['Canada', '🇨🇦'],
  ['Morocco', '🇲🇦'],
  ['Belgium', '🇧🇪'],
  ['Colombia', '🇨🇴'],
  ['Paraguay', '🇵🇾'],
  ['Norway', '🇳🇴'],
  ['Sweden', '🇸🇪'],
  ['Ecuador', '🇪🇨'],
  ['Senegal', '🇸🇳'],
  ['Switzerland', '🇨🇭'],
  ['Egypt', '🇪🇬'],
  ['DR Congo', '🇨🇩'],
];

function clean(value: string) {
  return value.replace(/\D/g, '');
}

function smsPhone(value: string) {
  const digits = clean(value);
  if (digits.length === 10) return `+1${digits}`;
  if (digits.startsWith('1')) return `+${digits}`;
  return value;
}

async function sendSMS(phones: string[], message: string) {
  const uniquePhones = [...new Set(phones.filter(Boolean))].map(smsPhone);
  if (!uniquePhones.length) return;

  await fetch('/api/sms', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phones: uniquePhones, message }),
  }).catch(() => {});
}

function normalizeTeamName(team: string) {
  if (team === 'United States') return 'USA';
  return team;
}

function teamPower(team: string) {
  const power: Record<string, number> = {
    Brazil: 92,
    France: 90,
    Spain: 88,
    Germany: 86,
    Argentina: 86,
    England: 84,
    Portugal: 83,
    Netherlands: 82,
    Belgium: 80,
    Colombia: 78,
    Croatia: 78,
    Morocco: 77,
    Japan: 76,
    USA: 76,
    'United States': 76,
    Switzerland: 76,
    Mexico: 75,
    Senegal: 75,
    Canada: 74,
    Sweden: 74,
    Egypt: 74,
    Norway: 73,
    Paraguay: 72,
    Ecuador: 72,
    'DR Congo': 70,
  };

  return power[team] ?? 65;
}

function teamChance(teamA: string, teamB: string) {
  const powerA = teamPower(teamA);
  const powerB = teamPower(teamB);
  const chanceA = Math.round((powerA / (powerA + powerB)) * 100);
  return [chanceA, 100 - chanceA];
}

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function isLiveMatch(match: Match) {
  return (match.status || '').toLowerCase() === 'live';
}

function isScheduledMatch(match: Match) {
  return (match.status || '').toLowerCase() === 'scheduled';
}

function isFinalMatch(match: Match) {
  return (match.status || '').toLowerCase() === 'final';
}

function parseKickoff(kickoff: string) {
  if (!kickoff) return Number.MAX_SAFE_INTEGER;

  const normalized = kickoff
    .replace(/\s+/g, ' ')
    .replace(/(\d)(AM|PM)/gi, '$1 $2')
    .trim();

  const parsed = Date.parse(`${normalized} ${TOURNAMENT_YEAR}`);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

function sortMatchesByKickoff(a: Match, b: Match) {
  const dateSort = parseKickoff(a.kickoff) - parseKickoff(b.kickoff);
  if (dateSort !== 0) return dateSort;
  return String(a.id).localeCompare(String(b.id));
}

function shortTeam(team: string) {
  const map: Record<string, string> = {
    UnitedStates: 'USA',
    'United States': 'USA',
    BosniaandHerzegovina: 'BIH',
    'Bosnia and Herzegovina': 'BIH',
    Argentina: 'ARG',
    Australia: 'AUS',
    Belgium: 'BEL',
    Brazil: 'BRA',
    Canada: 'CAN',
    Colombia: 'COL',
    Croatia: 'CRO',
    'DR Congo': 'COD',
    Ecuador: 'ECU',
    Egypt: 'EGY',
    England: 'ENG',
    France: 'FRA',
    Germany: 'GER',
    Japan: 'JPN',
    Mexico: 'MEX',
    Morocco: 'MAR',
    Netherlands: 'NED',
    Norway: 'NOR',
    Paraguay: 'PAR',
    Portugal: 'POR',
    Senegal: 'SEN',
    Spain: 'ESP',
    Sweden: 'SWE',
    Switzerland: 'SUI',
  };

  return map[team] ?? team.slice(0, 3).toUpperCase();
}

function playerChance(player: Player, players: Player[]) {
  if (!players.length) return 0;

  const max = Math.max(...players.map((p) => p.points || 0), 0);
  const base = (player.points || 0) + 1;
  const total = players.reduce((sum, p) => sum + (p.points || 0) + 1, 0);
  const leaderBonus = (player.points || 0) === max ? 8 : 0;

  return Math.min(99, Math.max(1, Math.round((base / total) * 100 + leaderBonus)));
}

function pickEmoji(match: Match, pick?: Pick) {
  if (!pick) return '▫️';
  if (!isFinalMatch(match) || !match.winner) return '🎟️';
  return pick.selected_team === match.winner ? '🏆😀' : '😞⚽';
}

function pickLabel(match: Match, pick?: Pick) {
  if (!pick) return 'No pick yet';
  if (!isFinalMatch(match) || !match.winner) return `Pick: ${pick.selected_team}`;
  if (pick.selected_team === match.winner) return `Correct: ${pick.selected_team}`;
  return `Missed: ${pick.selected_team}`;
}

function needText(player: Player, matches: Match[], picks: Pick[]) {
  const remaining = matches.find((match) => !isFinalMatch(match));
  if (!remaining) return 'All listed games are final. Watch for admin updates.';

  const pick = picks.find(
    (p) => p.participant_id === player.id && p.match_id === remaining.id
  );

  if (!pick) return `Needs a pick for ${remaining.team_a} vs ${remaining.team_b}`;

  const opponent = pick.selected_team === remaining.team_a ? remaining.team_b : remaining.team_a;
  return `Next need: ${pick.selected_team} over ${opponent}`;
}

function roadToVictory(player: Player, players: Player[], matches: Match[], picks: Pick[]) {
  const playerPicks = picks.filter((pick) => pick.participant_id === player.id);
  const remaining = matches.filter((match) => !isFinalMatch(match));

  const needs = remaining.slice(0, 5).map((match) => {
    const pick = playerPicks.find((p) => p.match_id === match.id);
    if (!pick) return `Pick ${match.team_a} vs ${match.team_b}`;

    const opponent = pick.selected_team === match.team_a ? match.team_b : match.team_a;
    return `${pick.selected_team} over ${opponent}`;
  });

  const rivals = [...players]
    .filter((p) => p.id !== player.id)
    .sort((a, b) => (b.points || 0) - (a.points || 0));

  const rival = rivals[0];
  const current = playerChance(player, players);
  const jump = Math.min(99, current + 20);

  return { needs, rival, jump };
}

function featuredMatches(matches: Match[]) {
  const live = matches.filter(isLiveMatch);
  if (live.length) return live;

  const next = matches.find(isScheduledMatch);
  return next ? [next] : [];
}

export default function Home() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [status, setStatus] = useState('');
  const [flash, setFlash] = useState('');
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [admin, setAdmin] = useState({ phone: '', passcode: '' });
  const [isAdmin, setIsAdmin] = useState(false);
  const [broadcast, setBroadcast] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [tvMode, setTvMode] = useState(false);
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    player_code: '',
    team: 'Argentina',
    flag: '🇦🇷',
  });

  const audioRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    load();

    const channel = supabase
      .channel('corbys-workshop-fifa-final')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants' }, liveUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wc_matches' }, liveUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'match_picks' }, liveUpdate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'fan_messages' }, liveUpdate)
      .subscribe();

    const timer = window.setInterval(load, 2500);
    const onFocus = () => load();
    const onVisible = () => {
      if (!document.hidden) load();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      supabase.removeChannel(channel);
    };
  }, []);

  async function load() {
    const { data: p, error: playerError } = await supabase
      .from('participants')
      .select('*')
      .order('created_at');

    const { data: m, error: matchError } = await supabase.from('wc_matches').select('*');

    const { data: k, error: pickError } = await supabase.from('match_picks').select('*');

    if (playerError || matchError || pickError) {
      setStatus(playerError?.message || matchError?.message || pickError?.message || 'Database error');
      return;
    }

    setPlayers((p || []) as Player[]);
    setMatches(((m || []) as Match[]).sort(sortMatchesByKickoff));
    setPicks((k || []) as Pick[]);

    const { data: c } = await supabase
      .from('fan_messages')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(30);

    setChat(((c || []) as ChatMessage[]).reverse());
  }

  function beep() {
    if (!soundEnabled) return;

    try {
      const browserWindow = window as unknown as {
        AudioContext?: typeof AudioContext;
        webkitAudioContext?: typeof AudioContext;
      };

      const AudioContextClass = browserWindow.AudioContext || browserWindow.webkitAudioContext;
      if (!AudioContextClass) return;

      const ctx = audioRef.current ?? new AudioContextClass();
      audioRef.current = ctx;

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.frequency.value = 880;
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.3);
    } catch {}
  }

  async function liveUpdate() {
    beep();
    setFlash('⚡ LLSN LIVE UPDATE — board refreshed');
    window.setTimeout(() => setFlash(''), 2200);
    await load();
  }

  const me = players.find(
    (player) => clean(player.phone) === clean(form.phone) && player.player_code === form.player_code
  );

  async function savePlayer() {
    if (
      !form.first_name ||
      !form.last_name ||
      clean(form.phone).length < 10 ||
      form.player_code.length !== 4
    ) {
      setStatus('Enter name, mobile number, and 4-digit code.');
      return;
    }

    const phone = clean(form.phone);
    const existing = players.find(
      (player) => clean(player.phone) === phone && player.player_code === form.player_code
    );

    if (existing) {
      const { error } = await supabase
        .from('participants')
        .update({
          first_name: form.first_name,
          last_name: form.last_name,
          team: form.team,
          flag: form.flag,
        })
        .eq('id', existing.id);

      if (error) {
        setStatus(error.message);
        return;
      }

      setStatus('Player updated. Make picks below.');
    } else {
      const { error } = await supabase.from('participants').insert({
        first_name: form.first_name,
        last_name: form.last_name,
        phone,
        player_code: form.player_code,
        team: form.team,
        flag: form.flag,
        points: 0,
        wins: 0,
        losses: 0,
        goals_for: 0,
        goals_against: 0,
      });

      if (error) {
        setStatus(error.message);
        return;
      }

      await sendSMS(
        players.map((player) => player.phone),
        `${form.first_name} joined Lytle Lemon FIFA World Cup Live as ${form.flag} ${form.team}!`
      );

      setStatus('Player saved. Make picks below.');
    }

    await load();
  }

  async function savePick(match: Match, selectedTeam: string) {
    const player = players.find(
      (p) => clean(p.phone) === clean(form.phone) && p.player_code === form.player_code
    );

    if (!player) {
      setStatus('Save player first, or enter the same phone + 4-digit code.');
      return;
    }

    const { error } = await supabase.from('match_picks').upsert(
      {
        participant_id: player.id,
        match_id: match.id,
        selected_team: selectedTeam,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'participant_id,match_id' }
    );

    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus(`Pick saved: ${selectedTeam}`);
    await load();
  }

  async function sendChat() {
    if (!chatText.trim()) return;

    const playerName = me ? `${me.first_name} ${me.last_name}` : 'Fan';

    const { error } = await supabase.from('fan_messages').insert({
      player_name: playerName,
      message: chatText.trim(),
    });

    if (error) {
      setStatus(error.message);
      return;
    }

    setChatText('');
    await load();
  }

  async function recalc() {
    const finals = matches.filter((match) => isFinalMatch(match) && match.winner);

    for (const player of players) {
      let points = 0;
      let wins = 0;
      let losses = 0;

      for (const match of finals) {
        const pick = picks.find((p) => p.participant_id === player.id && p.match_id === match.id);
        if (!pick) continue;

        if (pick.selected_team === match.winner) {
          points += 3;
          wins += 1;
        } else {
          losses += 1;
        }
      }

      await supabase.from('participants').update({ points, wins, losses }).eq('id', player.id);
    }

    await load();
  }

  async function updateMatch(
    match: Match,
    scoreA: number,
    scoreB: number,
    statusValue: string,
    minute = 0,
    highlightsUrl = '',
    extraTime = 0
  ) {
    const winner =
      statusValue === 'final' && scoreA !== scoreB
        ? scoreA > scoreB
          ? match.team_a
          : match.team_b
        : null;

    const { error } = await supabase
      .from('wc_matches')
      .update({
        score_a: scoreA,
        score_b: scoreB,
        status: statusValue,
        winner,
        minute,
        extra_time: extraTime,
        highlights_url: highlightsUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', match.id);

    if (error) {
      setStatus(error.message);
      return;
    }

    await sendSMS(
      players.map((player) => player.phone),
      `LLSN LIVE UPDATE: ${match.flag_a} ${match.team_a} ${scoreA}-${scoreB} ${match.flag_b} ${
        match.team_b
      }${winner ? `. Winner: ${winner}` : ''}`
    );

    await recalc();
    setStatus('Match updated. Leaderboard recalculated.');
  }

  async function broadcastSMS() {
    if (!broadcast.trim()) return;

    await sendSMS(players.map((player) => player.phone), `LLSN BROADCAST: ${broadcast}`);
    setBroadcast('');
    setStatus('Broadcast sent if Twilio is configured.');
  }

  function login() {
    const ok = clean(admin.phone) === ADMIN_PHONE && admin.passcode === ADMIN_PASSCODE;
    setIsAdmin(ok);
    setStatus(ok ? 'Admin open.' : 'Admin login failed.');
  }

  const sortedMatches = useMemo(() => [...matches].sort(sortMatchesByKickoff), [matches]);

  const board = useMemo(
    () =>
      [...players].sort(
        (a, b) => (b.points || 0) - (a.points || 0) || (b.wins || 0) - (a.wins || 0)
      ),
    [players]
  );

  const liveMatches = sortedMatches.filter(isLiveMatch);
  const upcomingMatches = sortedMatches.filter(isScheduledMatch);
  const finalMatches = sortedMatches.filter(isFinalMatch);
  const featured = featuredMatches(sortedMatches);
  const heroMatch = featured[0] || sortedMatches[0];

  const upset = sortedMatches.find((match) => {
    if (!isFinalMatch(match) || !match.winner) return false;
    const [chanceA, chanceB] = teamChance(match.team_a, match.team_b);
    const winnerChance = match.winner === match.team_a ? chanceA : chanceB;
    return winnerChance < 45;
  });

  const tickerItems = [
    liveMatches.length
      ? `🔴 LIVE: ${liveMatches[0].team_a} ${liveMatches[0].score_a ?? 0}-${liveMatches[0].score_b ?? 0} ${liveMatches[0].team_b}`
      : null,
    board[0] ? `🏆 Leader: ${board[0].flag} ${board[0].first_name} — ${board[0].points || 0} pts` : null,
    upcomingMatches[0]
      ? `⏭ Next: ${upcomingMatches[0].team_a} vs ${upcomingMatches[0].team_b} • ${upcomingMatches[0].kickoff}`
      : null,
    upset ? `🚨 Upset Alert: ${upset.winner} shocked the board` : null,
    '🇺🇸 Built in America by Corby’s Workshop™',
    'Technology should serve humanity—not the other way around.',
  ].filter(Boolean) as string[];

  return (
    <main className={tvMode ? 'wrap tvMode' : 'wrap'}>
      <BroadcastHero
        match={heroMatch}
        picks={picks}
        liveCount={liveMatches.length}
        leader={board[0]}
        onEnableSound={() => {
          setSoundEnabled(true);
          setStatus('Sound enabled.');
          beep();
        }}
        onToggleTv={() => setTvMode((value) => !value)}
        tvMode={tvMode}
      />

      <LiveTicker items={tickerItems} />

      {flash && <section className="liveFlash">{flash}</section>}

      <div className="studioGrid">
        <section className="panel xl">
          <div className="panelTitle">
            <span>🔥 Live Center</span>
            <b>{liveMatches.length ? 'ON AIR' : 'STANDBY'}</b>
          </div>

          {liveMatches.length ? (
            liveMatches.map((match) => <GameCard key={match.id} match={match} picks={picks} />)
          ) : (
            <p className="muted">No live match selected yet. Admin can light up the board when the first match starts.</p>
          )}

          {upset && <div className="alert">🚨 Upset alert: {upset.winner} beat the odds!</div>}
        </section>

        <section className="panel">
          <div className="panelTitle">
            <span>🏆 Leaderboard</span>
            <b>LIVE</b>
          </div>

          <div className="leaderStack">
            {board.length ? (
              board.map((player, index) => (
                <button
                  className={`leaderCard rank${index + 1}`}
                  key={player.id}
                  onClick={() => setSelectedPlayer(player)}
                >
                  <span className="rank">{index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`}</span>
                  <span>
                    <strong>
                      {player.flag} {player.first_name} {player.last_name}
                    </strong>
                    <em>
                      {player.team} • W {player.wins || 0} L {player.losses || 0} • {playerChance(player, players)}%
                    </em>
                    <i className="bar"><span style={{ width: `${playerChance(player, players)}%` }} /></i>
                  </span>
                  <b>{player.points || 0}</b>
                </button>
              ))
            ) : (
              <p className="muted">Waiting for players to join.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panelTitle">
            <span>⏭ Upcoming</span>
            <b>ORDERED</b>
          </div>

          <div className="matchList">
            {upcomingMatches.length ? (
              upcomingMatches.map((match) => <UpcomingCard key={match.id} match={match} />)
            ) : (
              <p className="muted">Match schedule ready.</p>
            )}
          </div>
        </section>

        <section className="panel">
          <div className="panelTitle">
            <span>💬 Fan Zone</span>
            <b>LIVE CHAT</b>
          </div>

          <div className="chatBox">
            {chat.length ? (
              chat.map((message) => (
                <div className="chatMsg" key={message.id}>
                  <b>{message.player_name}</b>
                  <span>{message.message}</span>
                </div>
              ))
            ) : (
              <p className="muted">Fan Zone ready.</p>
            )}
          </div>

          <div className="row">
            <input
              placeholder="Talk some friendly trash..."
              value={chatText}
              onChange={(event) => setChatText(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') sendChat();
              }}
            />
            <button onClick={sendChat}>Send</button>
          </div>
        </section>

        <section className="panel">
          <div className="panelTitle">
            <span>👤 Join / Update Player</span>
            <b>FAMILY MODE</b>
          </div>

          <div className="row">
            <input
              placeholder="First name"
              value={form.first_name}
              onChange={(event) => setForm({ ...form, first_name: event.target.value })}
            />
            <input
              placeholder="Last name"
              value={form.last_name}
              onChange={(event) => setForm({ ...form, last_name: event.target.value })}
            />
          </div>

          <div className="row">
            <input
              placeholder="U.S. mobile number"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            <input
              placeholder="4-digit code"
              maxLength={4}
              value={form.player_code}
              onChange={(event) =>
                setForm({ ...form, player_code: event.target.value.replace(/\D/g, '') })
              }
            />
          </div>

          <label className="smallLabel">Tournament team</label>
          <select
            value={form.team}
            onChange={(event) => {
              const team = TEAMS.find((option) => option[0] === event.target.value)!;
              setForm({ ...form, team: team[0], flag: team[1] });
            }}
          >
            {TEAMS.map((team) => (
              <option key={`${team[0]}-${team[1]}`} value={team[0]}>
                {team[1]} {team[0]}
              </option>
            ))}
          </select>

          <button onClick={savePlayer}>Save Player</button>

          {status && <p className="status">{status}</p>}

          <div className="invite">
            <b>Share Link</b>
            <span>"Lytle Lemon FIFA World Cup Live"</span>
          </div>
        </section>
      </div>

      <section className="panel wide">
        <div className="panelTitle">
          <span>⚽ Make / Change Picks</span>
          <b>{me ? `${me.first_name} ACTIVE` : 'LOGIN REQUIRED'}</b>
        </div>

        {!me && <div className="alert">Save player first, then pick every match here.</div>}

        <div className="pickGrid">
          {sortedMatches.map((match) => {
            const pick = me
              ? picks.find((p) => p.participant_id === me.id && p.match_id === match.id)
              : undefined;

            return (
              <div className="pickCard" key={match.id}>
                <div className="pickHeader">
                  <b>{match.round}</b>
                  <span>{isLiveMatch(match) ? '🔴 LIVE' : match.status}</span>
                </div>

                <p>{match.kickoff}</p>

                <div className="miniScore">
                  <span>
                    {match.flag_a} {match.team_a}
                  </span>
                  <b>{match.score_a ?? 0}</b>
                </div>

                <div className="miniScore">
                  <span>
                    {match.flag_b} {match.team_b}
                  </span>
                  <b>{match.score_b ?? 0}</b>
                </div>

                <div className="pickResult">
                  {pickEmoji(match, pick)} {pickLabel(match, pick)}
                </div>

                {match.winner && <div className="winner">Winner: {match.winner}</div>}

                <div className="choiceRow">
                  <button
                    className={pick?.selected_team === match.team_a ? 'selectedChoice' : 'ghost'}
                    onClick={() => savePick(match, match.team_a)}
                  >
                    {match.flag_a} {match.team_a}
                  </button>

                  <button
                    className={pick?.selected_team === match.team_b ? 'selectedChoice' : 'ghost'}
                    onClick={() => savePick(match, match.team_b)}
                  >
                    {match.flag_b} {match.team_b}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="panel wide">
        <div className="panelTitle">
          <span>📺 Full Match Board</span>
          <b>LLSN FINAL</b>
        </div>

        <h3>🔴 Live</h3>
        {liveMatches.length ? liveMatches.map((match) => <GameCard key={`live-${match.id}`} match={match} picks={picks} />) : <p className="muted">No live matches right now.</p>}

        <h3>⏭ Upcoming</h3>
        <div className="matchGrid">
          {upcomingMatches.map((match) => (
            <GameCard key={`upcoming-${match.id}`} match={match} picks={picks} />
          ))}
        </div>

        <h3>✅ Finals</h3>
        <div className="matchGrid">
          {finalMatches.map((match) => (
            <GameCard key={`final-${match.id}`} match={match} picks={picks} />
          ))}
        </div>
      </section>

      {!isAdmin ? (
        <section className="panel wide">
          <div className="panelTitle">
            <span>🎛 Admin Studio</span>
            <b>LOCKED</b>
          </div>

          <div className="row">
            <input
              placeholder="Admin mobile"
              value={admin.phone}
              onChange={(event) => setAdmin({ ...admin, phone: event.target.value })}
            />
            <input
              placeholder="Passcode"
              type="password"
              value={admin.passcode}
              onChange={(event) => setAdmin({ ...admin, passcode: event.target.value })}
            />
            <button onClick={login}>Open Admin</button>
          </div>
        </section>
      ) : (
        <section className="panel wide adminPanel">
          <div className="panelTitle">
            <span>🎛 Admin Broadcast Studio</span>
            <b>CONTROL ROOM</b>
          </div>

          <div className="row">
            <input
              placeholder="Message everyone"
              value={broadcast}
              onChange={(event) => setBroadcast(event.target.value)}
            />
            <button onClick={broadcastSMS}>Send SMS</button>
          </div>

          <div className="adminList">
            {sortedMatches.map((match) => (
              <AdminMatch key={match.id} match={match} save={updateMatch} />
            ))}
          </div>
        </section>
      )}

      {selectedPlayer && (
        <PlayerModal
          player={selectedPlayer}
          players={players}
          matches={sortedMatches}
          picks={picks}
          onClose={() => setSelectedPlayer(null)}
        />
      )}

      <footer className="footer">
        <strong>🏆 Lytle Lemon Sports Network</strong>
        <span>FIFA 1.5 FINAL — Vegas Broadcast Edition</span>
        <span>🇺🇸 Built in America by Corby’s Workshop™</span>
        <span>Technology should serve humanity—not the other way around.</span>
        <span>Powered by Lytle Lemon Technologies</span>
        <span>© 2026 Corby’s Workshop™. All Rights Reserved.</span>
      </footer>
    </main>
  );
}

function BroadcastHero({
  match,
  picks,
  liveCount,
  leader,
  onEnableSound,
  onToggleTv,
  tvMode,
}: {
  match?: Match;
  picks: Pick[];
  liveCount: number;
  leader?: Player;
  onEnableSound: () => void;
  onToggleTv: () => void;
  tvMode: boolean;
}) {
  const [chanceA, chanceB] = match ? teamChance(match.team_a, match.team_b) : [50, 50];
  const totalPicks = match ? picks.filter((pick) => pick.match_id === match.id).length : 0;
  const familyA = match
    ? pct(picks.filter((pick) => pick.match_id === match.id && pick.selected_team === match.team_a).length, totalPicks)
    : 0;
  const familyB = match
    ? pct(picks.filter((pick) => pick.match_id === match.id && pick.selected_team === match.team_b).length, totalPicks)
    : 0;

  if (!match) {
    return (
      <section className="broadcastHero">
        <div className="brandLine">
          <span>🇺🇸 Corby’s Workshop™</span>
          <span>LLSN FINAL BROADCAST</span>
        </div>
        <h1>Lytle Lemon Sports Network</h1>
        <p>Vegas Broadcast Mode Ready</p>
      </section>
    );
  }

  return (
    <section className="broadcastHero">
      <div className="brandLine">
        <span>🇺🇸 Built in America by Corby’s Workshop™</span>
        <span>FIFA 1.5 FINAL</span>
      </div>

      <div className="heroTop">
        <div>
          <p className="eyebrow">{liveCount ? '🔴 LIVE NOW' : '⏭ NEXT UP'}</p>
          <h1>Lytle Lemon Sports Network</h1>
          <p className="subline">Technology should serve humanity—not the other way around.</p>
        </div>

        <div className="heroActions">
          <button className="ghost" onClick={onEnableSound}>🔊 Enable Sound</button>
          <button className="ghost" onClick={onToggleTv}>{tvMode ? 'Exit TV' : '📺 TV Mode'}</button>
        </div>
      </div>

      <div className="scoreStage">
        <div className="heroTeam left">
          <span className="flag">{match.flag_a}</span>
          <b>{shortTeam(match.team_a)}</b>
          <em>{match.team_a}</em>
        </div>

        <div className="heroScore">
          <strong>{match.score_a ?? 0}</strong>
          <span>{isLiveMatch(match) ? `LIVE ${match.minute || 0}'${match.extra_time ? ` +${match.extra_time}` : ''}` : match.status.toUpperCase()}</span>
          <strong>{match.score_b ?? 0}</strong>
        </div>

        <div className="heroTeam right">
          <span className="flag">{match.flag_b}</span>
          <b>{shortTeam(match.team_b)}</b>
          <em>{match.team_b}</em>
        </div>
      </div>

      <div className="heroMeta">
        <span>{match.round}</span>
        <span>{match.kickoff}</span>
        <span>{match.venue || 'LLSN Broadcast Center'}</span>
        <span>{leader ? `Leader: ${leader.flag} ${leader.first_name} ${leader.points || 0} pts` : 'Leaderboard warming up'}</span>
      </div>

      <div className="sportsbookGrid">
        <Meter label={`${match.team_a} win probability`} value={chanceA} />
        <Meter label={`${match.team_b} win probability`} value={chanceB} />
        <Meter label={`Family picks ${match.team_a}`} value={familyA} />
        <Meter label={`Family picks ${match.team_b}`} value={familyB} />
      </div>
    </section>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className="meterBlock">
      <div>
        <span>{label}</span>
        <b>{value}%</b>
      </div>
      <i>
        <span style={{ width: `${value}%` }} />
      </i>
    </div>
  );
}

function LiveTicker({ items }: { items: string[] }) {
  const content = items.length ? items.join('     •     ') : 'LLSN LIVE';

  return (
    <section className="ticker">
      <div>
        <span>{content}</span>
        <span>{content}</span>
      </div>
    </section>
  );
}

function GameCard({ match, picks }: { match: Match; picks: Pick[] }) {
  const [chanceA, chanceB] = teamChance(match.team_a, match.team_b);
  const totalPicks = picks.filter((pick) => pick.match_id === match.id).length;
  const familyA = pct(
    picks.filter((pick) => pick.match_id === match.id && pick.selected_team === match.team_a).length,
    totalPicks
  );
  const familyB = pct(
    picks.filter((pick) => pick.match_id === match.id && pick.selected_team === match.team_b).length,
    totalPicks
  );

  return (
    <article className={`gameCard ${isLiveMatch(match) ? 'liveCard' : ''}`}>
      <div className="gameHeader">
        <span>{match.round}</span>
        <b>{isLiveMatch(match) ? '🔴 LIVE' : match.status}</b>
      </div>

      <div className="gameScore">
        <div>
          <span>{match.flag_a}</span>
          <strong>{match.team_a}</strong>
          <em>{match.score_a ?? 0}</em>
        </div>

        <p>{isLiveMatch(match) ? `${match.minute || 0}'` : 'VS'}</p>

        <div>
          <span>{match.flag_b}</span>
          <strong>{match.team_b}</strong>
          <em>{match.score_b ?? 0}</em>
        </div>
      </div>

      <Meter label={`${match.team_a} power line`} value={chanceA} />
      <Meter label={`${match.team_b} power line`} value={chanceB} />
      <Meter label={`Family picks ${match.team_a}`} value={familyA} />
      <Meter label={`Family picks ${match.team_b}`} value={familyB} />

      {match.winner && <div className="winner">🏆 Winner: {match.winner}</div>}

      {match.highlights_url && (
        <a className="highlightLink" href={match.highlights_url} target="_blank" rel="noreferrer">
          🎥 Watch Highlights
        </a>
      )}
    </article>
  );
}

function UpcomingCard({ match }: { match: Match }) {
  return (
    <div className="upcomingCard">
      <span>⏭</span>
      <div>
        <b>
          {match.flag_a} {match.team_a} vs {match.team_b} {match.flag_b}
        </b>
        <em>
          {match.round} • {match.kickoff}
        </em>
      </div>
      <strong>⚽</strong>
    </div>
  );
}

function PlayerModal({
  player,
  players,
  matches,
  picks,
  onClose,
}: {
  player: Player;
  players: Player[];
  matches: Match[];
  picks: Pick[];
  onClose: () => void;
}) {
  const road = roadToVictory(player, players, matches, picks);

  return (
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modalCard" onClick={(event) => event.stopPropagation()}>
        <button className="ghost" onClick={onClose}>Close</button>

        <h2>
          {player.flag} {player.first_name} {player.last_name}'s Picks
        </h2>

        <p className="muted">
          {player.team} • {player.points || 0} pts • Chance to win: {playerChance(player, players)}%
        </p>

        <div className="alert">🎯 {needText(player, matches, picks)}</div>

        <div className="roadCard">
          <h3>🏆 Road to Victory</h3>
          <ul>
            {road.needs.map((need, index) => (
              <li key={index}>✅ {need}</li>
            ))}
          </ul>
          <p><b>Chance jumps to:</b> {road.jump}%</p>
          <p><b>Most dangerous opponent:</b> {road.rival ? `${road.rival.flag} ${road.rival.first_name}` : 'Nobody yet'}</p>
        </div>

        <div className="modalList">
          {matches.map((match) => {
            const pick = picks.find((p) => p.participant_id === player.id && p.match_id === match.id);

            return (
              <div className="modalPick" key={match.id}>
                <span>
                  <b>
                    {match.flag_a} {match.team_a} {match.score_a ?? 0} - {match.score_b ?? 0} {match.flag_b} {match.team_b}
                  </b>
                  <em>
                    {match.round} • {match.kickoff} • {match.status}
                  </em>
                  <strong>{pickEmoji(match, pick)} {pickLabel(match, pick)}</strong>
                </span>
                <b>{match.winner ? `Winner: ${match.winner}` : 'TBD'}</b>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function AdminMatch({
  match,
  save,
}: {
  match: Match;
  save: (
    match: Match,
    scoreA: number,
    scoreB: number,
    statusValue: string,
    minute: number,
    highlightsUrl: string,
    extraTime?: number
  ) => void;
}) {
  const [scoreA, setScoreA] = useState(match.score_a || 0);
  const [scoreB, setScoreB] = useState(match.score_b || 0);
  const [statusValue, setStatusValue] = useState(match.status || 'scheduled');
  const [minute, setMinute] = useState(match.minute || 0);
  const [extra, setExtra] = useState(match.extra_time || 0);
  const [highlightsUrl, setHighlightsUrl] = useState(match.highlights_url || '');

  useEffect(() => {
    setScoreA(match.score_a || 0);
    setScoreB(match.score_b || 0);
    setStatusValue(match.status || 'scheduled');
    setMinute(match.minute || 0);
    setExtra(match.extra_time || 0);
    setHighlightsUrl(match.highlights_url || '');
  }, [match]);

  return (
    <div className="adminMatch">
      <div>
        <b>{match.flag_a} {match.team_a} vs {match.flag_b} {match.team_b}</b>
        <span>{match.round} • {match.kickoff}</span>
      </div>

      <input type="number" value={scoreA} onChange={(event) => setScoreA(Number(event.target.value))} />
      <input type="number" value={scoreB} onChange={(event) => setScoreB(Number(event.target.value))} />
      <input type="number" placeholder="Minute" value={minute} onChange={(event) => setMinute(Number(event.target.value))} />
      <input type="number" placeholder="Extra" value={extra} onChange={(event) => setExtra(Number(event.target.value))} />

      <select value={statusValue} onChange={(event) => setStatusValue(event.target.value)}>
        <option value="scheduled">Scheduled</option>
        <option value="live">Live</option>
        <option value="final">Final</option>
      </select>

      <input
        placeholder="Highlights URL"
        value={highlightsUrl}
        onChange={(event) => setHighlightsUrl(event.target.value)}
      />

      <button onClick={() => save(match, scoreA, scoreB, statusValue, minute, highlightsUrl, extra)}>
        Update
      </button>
    </div>
  );
}
