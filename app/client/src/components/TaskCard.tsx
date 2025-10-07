import { clsx } from 'clsx';

type TaskCardProps = {
  title: string;
  emoji?: string | null;
  plannedSeconds?: number;
  actualSeconds?: number | null;
  isActive?: boolean;
};

export function TaskCard({ title, emoji, plannedSeconds, actualSeconds, isActive }: TaskCardProps) {
  const progress = plannedSeconds
    ? Math.min(1, (actualSeconds ?? 0) / plannedSeconds)
    : 0;
  return (
    <div
      className={clsx('card', isActive && 'task-active')}
      style={{
        marginBottom: '1rem',
        border: isActive ? '3px solid #2563eb' : '1px solid #e2e8f0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {emoji && <span style={{ fontSize: '2.5rem' }}>{emoji}</span>}
        <div>
          <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.6rem' }}>{title}</h2>
          {plannedSeconds && (
            <ProgressBar progress={progress} plannedSeconds={plannedSeconds} actualSeconds={actualSeconds ?? undefined} />
          )}
        </div>
      </div>
    </div>
  );
}

type ProgressBarProps = {
  progress: number;
  plannedSeconds: number;
  actualSeconds?: number;
};

function ProgressBar({ progress, plannedSeconds, actualSeconds }: ProgressBarProps) {
  return (
    <div>
      <div style={{ height: '12px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, progress * 100)}%`, height: '100%', background: '#34d399' }} />
      </div>
      <small style={{ color: '#475569' }}>
        Plan: {plannedSeconds}s {actualSeconds ? `• Faktisk: ${actualSeconds}s` : null}
      </small>
    </div>
  );
}
