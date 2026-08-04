const { db } = require('../db/init');

const insertHistory = db.prepare(`
  INSERT INTO asset_history (item_id, event_type, description, performed_by, reference_type, reference_id, metadata)
  VALUES (@item_id, @event_type, @description, @performed_by, @reference_type, @reference_id, @metadata)
`);

/**
 * Appends one permanent, read-only entry to an asset's lifecycle timeline.
 * Never updated or deleted afterward — this is the system of record for
 * the Asset History module's per-asset timeline view.
 *
 * @param {object} req - express request (used to attribute the event to the logged-in admin)
 * @param {number} itemId
 * @param {string} eventType - one of the values allowed by asset_history.event_type
 * @param {string} description - human-readable summary shown directly in the timeline
 * @param {object} [opts]
 * @param {string} [opts.referenceType] - e.g. 'checkout', 'maintenance_ticket', 'retirement'
 * @param {number} [opts.referenceId]
 * @param {object} [opts.metadata] - arbitrary JSON-serializable extra detail
 */
function recordHistory(req, itemId, eventType, description, opts = {}) {
  try {
    insertHistory.run({
      item_id: itemId,
      event_type: eventType,
      description,
      performed_by: req.user ? req.user.username : 'system',
      reference_type: opts.referenceType || null,
      reference_id: opts.referenceId || null,
      metadata: opts.metadata ? JSON.stringify(opts.metadata) : null,
    });
  } catch (err) {
    console.error('[asset-history] Failed to write history entry:', err.message);
  }
}

module.exports = { recordHistory };
