import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PinGate } from '../components/PinGate.js';
import { useApi } from '../hooks/useApi.js';

interface BootstrapResponse {
  children: Array<{ id: string; name: string; birthdate: string | null }>;
  tasks: Array<{ id: string; title: string; emoji: string | null }>;
  routines: Array<{ id: string; title: string; startTime: string; endTime: string }>;
}

export function AdminPage() {
  const [pin, setPin] = useState<string | null>(null);
  const api = useApi(pin ?? undefined);
  const { data, refetch, isLoading, error } = useQuery<BootstrapResponse>({
    queryKey: ['bootstrap', pin],
    enabled: Boolean(pin),
    queryFn: () => api('/api/admin/bootstrap', { method: 'GET' }),
  });

  const createChild = useMutation({
    mutationFn: (payload: { name: string; birthdate?: string | null }) =>
      api('/api/admin/children', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => refetch(),
  });

  const createTask = useMutation({
    mutationFn: (payload: { title: string; emoji?: string; internalDescription?: string }) =>
      api('/api/admin/tasks', { method: 'POST', body: JSON.stringify(payload) }),
    onSuccess: () => refetch(),
  });

  if (!pin) {
    return <PinGate onUnlock={setPin} />;
  }

  return (
    <div className="container">
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1>Administration</h1>
        <button className="primary-button" onClick={() => setPin(null)}>
          Lås
        </button>
      </header>

      {isLoading && <p>Indlæser data…</p>}
      {error && <p style={{ color: '#dc2626' }}>Kunne ikke hente data.</p>}

      {data && (
        <div style={{ display: 'grid', gap: '1.5rem', marginTop: '2rem' }}>
          <section className="card">
            <h2>Børn</h2>
            <ul>
              {data.children.map((child) => (
                <li key={child.id}>{child.name}</li>
              ))}
            </ul>
            <ChildForm onSubmit={(values) => createChild.mutate(values)} loading={createChild.isPending} />
          </section>

          <section className="card">
            <h2>Opgaver</h2>
            <ul>
              {data.tasks.map((task) => (
                <li key={task.id}>
                  {task.emoji} {task.title}
                </li>
              ))}
            </ul>
            <TaskForm onSubmit={(values) => createTask.mutate(values)} loading={createTask.isPending} />
          </section>

          <section className="card">
            <h2>Rutiner</h2>
            <ul>
              {data.routines.map((routine) => (
                <li key={routine.id}>
                  {routine.title} ({routine.startTime}–{routine.endTime})
                </li>
              ))}
            </ul>
            <p>
              Den fulde rutinebygger er endnu ikke komplet i UI’et, men backend understøtter oprettelse, estimater og aktivering.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}

type ChildFormValues = { name: string; birthdate?: string | null };

function ChildForm({ onSubmit, loading }: { onSubmit: (values: ChildFormValues) => void; loading: boolean }) {
  const [name, setName] = useState('');
  const [birthdate, setBirthdate] = useState<string>('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!name) return;
        onSubmit({ name, birthdate: birthdate ? birthdate : null });
        setName('');
        setBirthdate('');
      }}
      style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem', maxWidth: '320px' }}
    >
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Navn"
        required
        style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5f5' }}
      />
      <input
        type="date"
        value={birthdate}
        onChange={(event) => setBirthdate(event.target.value)}
        style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5f5' }}
      />
      <button className="primary-button" type="submit" disabled={loading}>
        Tilføj barn
      </button>
    </form>
  );
}

type TaskFormValues = { title: string; emoji?: string; internalDescription?: string };

function TaskForm({ onSubmit, loading }: { onSubmit: (values: TaskFormValues) => void; loading: boolean }) {
  const [title, setTitle] = useState('');
  const [emoji, setEmoji] = useState('');
  const [note, setNote] = useState('');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (!title) return;
        onSubmit({ title, emoji: emoji || undefined, internalDescription: note || undefined });
        setTitle('');
        setEmoji('');
        setNote('');
      }}
      style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem', maxWidth: '320px' }}
    >
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="Titel"
        required
        style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5f5' }}
      />
      <input
        value={emoji}
        onChange={(event) => setEmoji(event.target.value)}
        placeholder="Emoji"
        style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5f5' }}
      />
      <textarea
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Intern beskrivelse"
        rows={3}
        style={{ padding: '0.75rem', borderRadius: '12px', border: '1px solid #cbd5f5' }}
      />
      <button className="primary-button" type="submit" disabled={loading}>
        Tilføj opgave
      </button>
    </form>
  );
}
