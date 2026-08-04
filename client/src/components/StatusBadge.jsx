const LABELS = {
  available: 'Available',
  checked_out: 'Checked Out',
  under_repair: 'Under Repair',
  retired: 'Retired',
  active: 'Active',
  returned: 'Returned',
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const CLASS_MAP = {
  available: 'badge-available',
  active: 'badge-checked_out',
  checked_out: 'badge-checked_out',
  in_progress: 'badge-checked_out',
  under_repair: 'badge-under_repair',
  open: 'badge-under_repair',
  retired: 'badge-retired',
  returned: 'badge-available',
  completed: 'badge-available',
  cancelled: 'badge-retired',
};

export default function StatusBadge({ status }) {
  const cls = CLASS_MAP[status] || 'badge bg-neutral-100 text-neutral-700';
  return <span className={cls}>{LABELS[status] || status}</span>;
}
