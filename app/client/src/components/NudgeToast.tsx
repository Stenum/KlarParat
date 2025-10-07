type NudgeToastProps = {
  text: string;
  visible: boolean;
};

export function NudgeToast({ text, visible }: NudgeToastProps) {
  if (!visible) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: '2rem',
        left: '50%',
        transform: 'translateX(-50%)',
        background: '#fbbf24',
        color: '#1f2937',
        padding: '1rem 1.5rem',
        borderRadius: '999px',
        boxShadow: '0 15px 30px rgba(251, 191, 36, 0.4)',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}
    >
      {text}
    </div>
  );
}
