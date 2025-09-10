"use strict";

// Minimal default settings; only fields used by the module remain.
const DefaultSettings = {
  enabled: false,
  interval: 1000,
  idle_warn_minutes: 9,
  pre_refresh_ms: 1000,
  retry_backoff_ms: 3000,
  dungeon_only: false,
  civil_unrest: false,
  keep_resurrection_invincibility: false,
};

// from_ver / to_ver retained for toolbox signature compatibility.
module.exports = function migrateSettings(from_ver, to_ver, settings) {
  if (from_ver == null) return DefaultSettings; // new install (null) or legacy undefined
  return Object.assign({}, DefaultSettings, settings || {});
};
