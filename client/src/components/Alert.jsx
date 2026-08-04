export default function Alert({ type = 'error', message, onClose }) {
  if (!message) return null;

  // Only three semantic tones exist in this app: danger (errors/destructive
  // consequences), success (confirmations), and informational (brand blue,
  // used for neutral notices that aren't errors or confirmations).
  const styles =
    type === 'error'
      ? 'bg-danger-50 text-danger-700 border-danger-200'
      : type === 'success'
      ? 'bg-success-50 text-success-700 border-success-200'
      : 'bg-brand-50 text-brand-700 border-brand-200';

  return (
    <div className={`border rounded-lg px-4 py-3 text-sm mb-4 flex items-start justify-between gap-4 ${styles}`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="opacity-60 hover:opacity-100 leading-none">
          &times;
        </button>
      )}
    </div>
  );
}
