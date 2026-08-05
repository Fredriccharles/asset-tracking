const { db } = require('../db/init');

const insertAudit = db.prepare(`
  INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, details, ip_address)
  VALUES (@user_id, @username, @action, @entity_type, @entity_id, @details, @ip_address)
`);

/**
 * Records an entry in the append-only audit log.
 * @param {object} req - express request (used to pull user + ip)
 * @param {string} action - short action code, e.g. 'ITEM_CREATE'
 * @param {string} entityType - e.g. 'item'
 * @param {number|null} entityId
 * @param {object} [details] - arbitrary JSON-serializable context
 */
function logAction(req, action, entityType, entityId, details = {}) {
  try {
    insertAudit.run({
      user_id: req.user ? req.user.id : null,
      username: req.user ? req.user.username : 'system',
      action,
      entity_type: entityType,
      entity_id: entityId || null,
      details: JSON.stringify(details || {}),
      ip_address: req.ip || null,
    });
  } catch (err) {
    console.error('[audit] Failed to write audit log entry:', err.message);
  }
}

module.exports = { logAction };
