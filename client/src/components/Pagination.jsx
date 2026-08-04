export default function Pagination({ page, pageSize, total, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-1 py-3 text-sm text-neutral-600">
      <span>
        Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}
      </span>
      <div className="flex gap-1">
        <button
          className="btn-secondary px-3 py-1.5"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Prev
        </button>
        <span className="px-3 py-1.5">
          Page {page} of {totalPages}
        </span>
        <button
          className="btn-secondary px-3 py-1.5"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
