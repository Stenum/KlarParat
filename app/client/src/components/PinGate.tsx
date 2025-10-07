import { useState } from 'react';

type PinGateProps = {
  onUnlock(pin: string): void;
  title?: string;
};

export function PinGate({ onUnlock, title = 'Forældre adgang' }: PinGateProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="container">
      <div className="card" style={{ textAlign: 'center' }}>
        <h1>{title}</h1>
        <p>Indtast PIN for at fortsætte.</p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(event) => {
            setPin(event.target.value);
            setError(null);
          }}
          style={{
            fontSize: '1.5rem',
            padding: '0.75rem',
            borderRadius: '12px',
            border: '1px solid #cbd5f5',
            textAlign: 'center',
            width: '100%',
            maxWidth: '280px',
            margin: '1rem auto',
            display: 'block',
          }}
        />
        {error && <p style={{ color: '#dc2626' }}>{error}</p>}
        <button
          className="primary-button"
          onClick={() => {
            if (pin.trim().length < 4) {
              setError('PIN skal have fire cifre.');
              return;
            }
            onUnlock(pin.trim());
          }}
        >
          Lås op
        </button>
      </div>
    </div>
  );
}
