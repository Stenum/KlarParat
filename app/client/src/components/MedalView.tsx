const medalCopy: Record<string, { title: string; description: string }> = {
  gold: { title: 'Guld', description: 'I holdt planen flot hele vejen.' },
  silver: { title: 'Sølv', description: 'Næsten hele vejen på tid. God energi!' },
  bronze: { title: 'Bronze', description: 'I kom igennem morgenen med fint mod.' },
};

type MedalViewProps = {
  tier: 'gold' | 'silver' | 'bronze';
};

export function MedalView({ tier }: MedalViewProps) {
  const copy = medalCopy[tier];
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>{copy.title}</h1>
      <p>{copy.description}</p>
    </div>
  );
}
