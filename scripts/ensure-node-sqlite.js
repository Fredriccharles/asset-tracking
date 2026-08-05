/**
 * Ensures better-sqlite3 is compiled for the current Node.js ABI.
 *
 * better-sqlite3 is a native module. If it was previously built for
 * Electron (or a different Node version), the plain Node.js server will
 * crash with ERR_DLOPEN_FAILED due to an ABI (NODE_MODULE_VERSION) mismatch.
 *
 * This module is loaded at the very top of server/server.js (before the
 * database module is required). If the native binary is incompatible, it
 * runs `npm rebuild better-sqlite3` to recompile it for the current runtime.
 */
const { execSync } = require('child_process');
const path = require('path');

const projectRoot = path.join(__dirname, '..');

// better-sqlite3 loads its native .node binding lazily — only when a
// Database instance is created. A plain `require('better-sqlite3')` does NOT
// touch the native binary, so it can succeed even when the ABI is wrong.
// To reliably detect an ABI mismatch we must instantiate an in-memory
// database: if the native binary was compiled for a different Node version
// (or Electron), `new Database(':memory:')` throws ERR_DLOPEN_FAILED.
function canLoadNativeBinary() {
  const Database = require('better-sqlite3');
  const probe = new Database(':memory:');
  probe.close();
  return true;
}

function ensureNodeSqlite() {
  try {
    canLoadNativeBinary();
    console.log('[sqlite] better-sqlite3 is compatible with the current Node.js runtime.');
    return true;
  } catch (err) {
    if (err && err.code === 'ERR_DLOPEN_FAILED') {
      console.log('[sqlite] better-sqlite3 ABI mismatch detected, rebuilding for Node.js...');
      try {
        execSync('npm rebuild better-sqlite3', {
          stdio: 'inherit',
          cwd: projectRoot,
        });
        console.log('[sqlite] better-sqlite3 rebuilt successfully for Node.js.');
        // Re-verify the rebuilt native binary actually loads.
        delete require.cache[require.resolve('better-sqlite3')];
        canLoadNativeBinary();
        console.log('[sqlite] better-sqlite3 verified after rebuild.');
        return true;
      } catch (rebuildErr) {
        console.error('[sqlite] Rebuild failed:', rebuildErr.message);
        return false;
      }
    }
    // Any other error is unexpected; surface it so the real problem is visible.
    console.error('[sqlite] Unexpected error while checking better-sqlite3:', err.message);
    return false;
  }
}

// Allow running directly: `node scripts/ensure-node-sqlite.js`
if (require.main === module) {
  const ok = ensureNodeSqlite();
  process.exit(ok ? 0 : 1);
}

module.exports = { ensureNodeSqlite };
