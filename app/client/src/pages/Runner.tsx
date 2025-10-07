import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { TaskCard } from '../components/TaskCard.js';
import { NudgeToast } from '../components/NudgeToast.js';
import { MedalView } from '../components/MedalView.js';
import { ensureAudioContext, playAudioFromUrl } from '../lib/audio.js';
import { useApi } from '../hooks/useApi.js';

interface SessionTask {
  id: string;
  taskId: string;
  status: string;
  orderIndex: number;
  plannedSecs: number;
  actualSecs: number | null;
  task?: { title: string; emoji: string | null };
}

interface SessionResponse {
  id: string;
  child: { id: string; name: string };
  routine: { id: string; title: string };
  tasks: SessionTask[];
  status: string;
  windowStart: string;
  windowEnd: string;
  reward: string | null;
}

export function RunnerPage() {
  const [sessionId, setSessionId] = useState('');
  const [joinedSessionId, setJoinedSessionId] = useState<string | null>(null);
  const [audioReady, setAudioReady] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const api = useApi();

  const sessionQuery = useQuery<SessionResponse>({
    queryKey: ['session', joinedSessionId],
    enabled: Boolean(joinedSessionId),
    queryFn: () => api(`/api/session/${joinedSessionId}`, { method: 'GET' }),
  });

  const currentTask = useMemo(() => {
    const tasks = sessionQuery.data?.tasks ?? [];
    return tasks.find((task) => task.status !== 'done') ?? null;
  }, [sessionQuery.data]);

  const completeTask = useMutation({
    mutationFn: async () => {
      if (!joinedSessionId || !currentTask) return;
      try {
        const result = await api(`/api/session/${joinedSessionId}/completeTask`, {
          method: 'POST',
          body: JSON.stringify({ taskId: currentTask.taskId }),
        });
        if (result?.ttsUrl) {
          try {
            await playAudioFromUrl(result.ttsUrl);
          } catch (error) {
            console.warn('Kunne ikke afspille lyd', error);
          }
        }
        setToast(result?.speechText ?? null);
      } catch (error: any) {
        setToast(error?.message ?? 'Kunne ikke afslutte opgaven');
      }
      await queryClient.invalidateQueries({ queryKey: ['session', joinedSessionId] });
    },
  });

  const nudge = useMutation({
    mutationFn: async () => {
      if (!joinedSessionId) return;
      try {
        const result = await api(`/api/session/${joinedSessionId}/nudge`, { method: 'POST', body: JSON.stringify({}) });
        if (result?.ttsUrl) {
          try {
            await playAudioFromUrl(result.ttsUrl);
          } catch (error) {
            console.warn('Kunne ikke afspille lyd', error);
          }
        }
        setToast(result?.speechText ?? null);
      } catch (error: any) {
        setToast(error?.message ?? 'Ingen påmindelse endnu');
      }
    },
  });

  const finish = useMutation({
    mutationFn: async () => {
      if (!joinedSessionId) return;
      try {
        const result = await api(`/api/session/${joinedSessionId}/finish`, { method: 'POST', body: JSON.stringify({}) });
        if (result?.ttsUrl) {
          try {
            await playAudioFromUrl(result.ttsUrl);
          } catch (error) {
            console.warn('Kunne ikke afspille lyd', error);
          }
        }
        setToast(result?.speechText ?? null);
      } catch (error: any) {
        setToast(error?.message ?? 'Kunne ikke afslutte sessionen');
      }
      await queryClient.invalidateQueries({ queryKey: ['session', joinedSessionId] });
    },
  });

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  const reward = sessionQuery.data?.reward ?? null;

  return (
    <div className="container" style={{ maxWidth: '640px' }}>
      <h1 style={{ fontSize: '2rem' }}>KlarParat</h1>
      {!audioReady && (
        <button
          className="primary-button"
          onClick={async () => {
            await ensureAudioContext();
            setAudioReady(true);
          }}
        >
          Aktiver lyd
        </button>
      )}

      {!joinedSessionId && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!sessionId) return;
            setJoinedSessionId(sessionId.trim());
          }}
          style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginTop: '2rem' }}
        >
          <input
            value={sessionId}
            onChange={(event) => setSessionId(event.target.value)}
            placeholder="Session ID"
            style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5f5', flex: 1 }}
          />
          <button className="primary-button" type="submit">
            Start
          </button>
        </form>
      )}

      {sessionQuery.data && (
        <section className="card" style={{ marginTop: '2rem' }}>
          <header style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ margin: 0 }}>{sessionQuery.data.child.name}</h2>
            <p style={{ margin: '0.5rem 0 0 0' }}>{sessionQuery.data.routine.title}</p>
          </header>

          {currentTask ? (
            <div style={{ textAlign: 'center' }}>
              <TaskCard
                title={currentTask.task?.title ?? 'Opgave'}
                emoji={currentTask.task?.emoji}
                plannedSeconds={currentTask.plannedSecs}
                actualSeconds={currentTask.actualSecs ?? undefined}
                isActive
              />
              <button
                className="primary-button"
                style={{ marginTop: '1rem' }}
                onClick={() => completeTask.mutate()}
                disabled={completeTask.isPending}
              >
                Færdig
              </button>
              <div style={{ marginTop: '1rem' }}>
                <button className="primary-button" onClick={() => nudge.mutate()} disabled={nudge.isPending}>
                  Brug venlig påmindelse
                </button>
              </div>
            </div>
          ) : reward ? (
            <MedalView tier={reward as 'gold' | 'silver' | 'bronze'} />
          ) : (
            <div style={{ textAlign: 'center' }}>
              <p>Alle opgaver er klaret. Klar til afslutning?</p>
              <button className="primary-button" onClick={() => finish.mutate()} disabled={finish.isPending}>
                Afslut morgenrutinen
              </button>
            </div>
          )}
        </section>
      )}

      <NudgeToast text={toast ?? ''} visible={Boolean(toast)} />
    </div>
  );
}
