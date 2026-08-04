import { useEffect, useState, useRef } from 'react';
import Layout from '../components/Layout';
import Alert from '../components/Alert';
import Modal from '../components/Modal';
import * as api from '../api/api';
import { errMsg } from '../api/api';

function formatSize(bytes) {
  if (bytes == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0, n = bytes;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(1)} ${units[i]}`;
}

export default function Backup() {
  const [backups, setBackups] = useState([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [creating, setCreating] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState(null); // { type: 'existing'|'upload', filename?, file? }
  const [restoring, setRestoring] = useState(false);
  const [restoredNotice, setRestoredNotice] = useState(false);
  const fileRef = useRef(null);

  const load = () => {
    api.listBackups().then((res) => setBackups(res.data)).catch((err) => setError(errMsg(err)));
  };

  useEffect(() => { load(); }, []);

  const doCreate = async () => {
    setCreating(true);
    setError('');
    try {
      await api.createBackup();
      setSuccess('Manual backup created successfully.');
      load();
    } catch (err) { setError(errMsg(err)); } finally { setCreating(false); }
  };

  const doDownload = async (filename) => {
    try {
      await api.downloadBackupFile(filename);
    } catch (err) { setError(errMsg(err)); }
  };

  const confirmRestore = async () => {
    setRestoring(true);
    setError('');
    try {
      if (restoreTarget.type === 'upload') {
        const formData = new FormData();
        formData.append('backupFile', restoreTarget.file);
        await api.restoreBackup(formData);
      } else {
        await api.restoreFromExisting(restoreTarget.filename);
      }
      setRestoreTarget(null);
      setRestoredNotice(true);
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setRestoring(false);
    }
  };

  return (
    <Layout
      title="Backup & Restore"
      subtitle="Automatic monthly backups, plus manual backup and restore"
      actions={<button className="btn-primary" disabled={creating} onClick={doCreate}>{creating ? 'Backing up…' : '+ Create Backup Now'}</button>}
    >
      <Alert message={error} onClose={() => setError('')} />
      <Alert type="success" message={success} onClose={() => setSuccess('')} />

      <div className="card p-5 mb-6">
        <h3 className="font-semibold text-neutral-900 mb-2">Restore from Uploaded File</h3>
        <p className="text-sm text-neutral-500 mb-3">Select a previously downloaded .db backup file to restore. This will overwrite the current database.</p>
        <div className="flex items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".db"
            className="text-sm"
            onChange={(e) => {
              const file = e.target.files[0];
              if (file) setRestoreTarget({ type: 'upload', file });
            }}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-neutral-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Filename</th>
              <th className="text-left px-4 py-3">Type</th>
              <th className="text-left px-4 py-3">Created</th>
              <th className="text-left px-4 py-3">Size</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {backups.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-neutral-400">No backups yet.</td></tr>
            ) : (
              backups.map((b) => (
                <tr key={b.id} className="hover:bg-neutral-50">
                  <td className="px-4 py-3 font-mono text-xs">{b.filename}</td>
                  <td className="px-4 py-3 capitalize">{b.type}</td>
                  <td className="px-4 py-3 text-neutral-500">{b.created_at}</td>
                  <td className="px-4 py-3 text-neutral-500">{formatSize(b.size_bytes)}</td>
                  <td className="px-4 py-3 text-right space-x-3">
                    <button className="text-brand-600 hover:underline text-xs" onClick={() => doDownload(b.filename)}>Download</button>
                    <button className="text-danger-600 hover:underline text-xs" onClick={() => setRestoreTarget({ type: 'existing', filename: b.filename })}>Restore</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Modal open={!!restoreTarget} onClose={() => setRestoreTarget(null)} title="Confirm Database Restore">
        <div className="space-y-4">
          <p className="text-sm text-danger-700 bg-danger-50 border border-danger-200 rounded-lg px-3 py-3">
            This will replace <strong>all current data</strong> with the selected backup
            {restoreTarget?.filename ? ` (${restoreTarget.filename})` : ''}. A safety backup of the
            current state will be taken automatically first, but this action cannot be undone from
            the UI. The application must be restarted afterward.
          </p>
          <div className="flex justify-end gap-2">
            <button className="btn-secondary" onClick={() => setRestoreTarget(null)}>Cancel</button>
            <button className="btn-danger" disabled={restoring} onClick={confirmRestore}>
              {restoring ? 'Restoring…' : 'Yes, Restore Database'}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={restoredNotice} onClose={() => setRestoredNotice(false)} title="Restore Complete" width="max-w-md">
        <div className="space-y-4">
          <p className="text-sm text-neutral-700">
            The database has been restored. Please close and reopen the application now so it loads
            the restored data from a clean connection.
          </p>
          <div className="flex justify-end">
            <button className="btn-primary" onClick={() => setRestoredNotice(false)}>Got it</button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
}
