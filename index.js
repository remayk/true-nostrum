// True Nostrum for Old School Tera Online
// by remayk

const Vec3 = require("tera-vec3");

module.exports = function NetworkMod(mod) {
  mod.game.initialize(["me", "inventory", "contract"]);
  const RES_INVINC_ABN = 1134; // Goddess's Blessing

  /* --------------------------------------------------
   * Item IDs
   * -------------------------------------------------- */
  const NOSTRUM_ITEMS = [
    { id: 6283, name: "Ranger's Nostrum I" },
    { id: 6284, name: "Ranger's Nostrum II" },
    { id: 6285, name: "Ranger's Nostrum III" },
    { id: 6286, name: "Ranger's Nostrum IV" },
    { id: 6287, name: "Ranger's Nostrum V" },
    { id: 6310, name: "Ranger's Nostrum VI" },
    { id: 6288, name: "Nostrum of Energy I" },
    { id: 6289, name: "Nostrum of Energy II" },
    { id: 6290, name: "Nostrum of Energy III" },
    { id: 6291, name: "Nostrum of Energy IV" },
    { id: 6292, name: "Nostrum of Energy V" },
    { id: 6311, name: "Nostrum of Energy VI" },
  ];

  /* --------------------------------------------------
   * Abnormalities
   * -------------------------------------------------- */
  const RANGER_ABNS = [2945, 2946, 2947, 2948, 2949, 2950];
  const ENERGY_ABNS = [2960, 2961, 2962, 2963, 2964, 2965];
  const ABN_TO_CAT = new Map([
    ...RANGER_ABNS.map((id) => [id, "ranger"]),
    ...ENERGY_ABNS.map((id) => [id, "energy"]),
  ]);
  const activeUntil = { ranger: 0, energy: 0 }; // epoch ms
  const CATEGORIES = ["ranger", "energy"];

  /* --------------------------------------------------
   * Cooldown tracking
   * -------------------------------------------------- */
  const itemCooldownsByChar = {};
  function ensureCooldownMap() {
    if (!itemCooldownsByChar[mod.game.me.gameId])
      itemCooldownsByChar[mod.game.me.gameId] = new Map();
  }
  function itemCooldown(id) {
    ensureCooldownMap();
    return Math.max(
      0,
      (itemCooldownsByChar[mod.game.me.gameId].get(id) || 0) - Date.now()
    );
  }
  mod.hook("S_START_COOLTIME_ITEM", 1, (e) => {
    ensureCooldownMap();
    itemCooldownsByChar[mod.game.me.gameId].set(
      e.item,
      Date.now() + e.cooldown * 1000
    );
    // Confirm a pending use (no need to track lastUse separately now)
    for (const cat of CATEGORIES) {
      const pending = pendingUses[cat];
      if (pending && pending.itemId === e.item) {
        pendingUses[cat] = null;
        nextAttemptAfter[cat] = 0;
      }
    }
  });

  /* --------------------------------------------------
   * Idle & scheduling state
   * -------------------------------------------------- */
  let lastCombatOrActivity = Date.now();
  const nextAttemptAfter = { ranger: 0, energy: 0 }; // ms epoch gating next attempt
  const pendingUses = { ranger: null, energy: null }; // { itemId, attemptTime, attempts }
  let warnedIdle = false,
    warnedIdle14 = false;

  function updateIdleStatus() {
    if (mod.game.me.inCombat) {
      lastCombatOrActivity = Date.now();
      warnedIdle = warnedIdle14 = false;
      return;
    }
    const idleMs = Date.now() - lastCombatOrActivity;
    const warnMs = (mod.settings.idle_warn_minutes || 10) * 60_000;
    if (!warnedIdle && idleMs >= warnMs) {
      warnedIdle = true;
      mod.command.message(
        `TN: Idle ${Math.round(idleMs / 60000)}m. Consider /8 tn off.`
      );
    }
    if (!warnedIdle14 && idleMs >= 14 * 60_000) {
      warnedIdle14 = true;
      mod.command.message("TN: 14m idle. Auto-disables at 20m.");
    }
    if (mod.settings.enabled && idleMs >= 20 * 60_000) {
      mod.settings.enabled = false;
      stop(true);
      mod.command.message("TN: Auto-disabled after 20m idle. Use /8 tn on.");
    }
  }

  /* --------------------------------------------------
   * Inventory & usage helpers
   * -------------------------------------------------- */
  const romanMap = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6 };
  const tierRegex = /(VI|IV|V|III|II|I)\s*$/;
  const getCategory = (name) => {
    const n = (name || "").toLowerCase();
    return n.includes("ranger")
      ? "ranger"
      : n.includes("energy")
      ? "energy"
      : null;
  };
  const getTier = (name) => {
    const m = (name || "").match(tierRegex);
    return m ? romanMap[m[1]] || 0 : 0;
  };
  function highestTierItemInInventory(category) {
    let best = null;
    for (const entry of NOSTRUM_ITEMS) {
      if (getCategory(entry.name) !== category) continue;
      if (!mod.game.inventory.findAllInBagOrPockets(entry.id).length) continue;
      const tier = getTier(entry.name);
      if (!best || tier > best.tier)
        best = { id: entry.id, name: entry.name, tier };
    }
    return best;
  }
  function useItem(id) {
    if (itemCooldown(id) > 0) return false;
    if (!mod.game.inventory.findAllInBagOrPockets(id).length) return false;
    mod.send("C_USE_ITEM", 3, {
      gameId: mod.game.me.gameId,
      id,
      dbid: 0,
      target: 0,
      amount: 1,
      dest: new Vec3(0, 0, 0),
      loc: new Vec3(0, 0, 0),
      w: 0,
      unk1: 0,
      unk2: 0,
      unk3: 0,
      unk4: 1,
    });
    return true;
  }

  /* --------------------------------------------------
   * Abnormality hooks
   * -------------------------------------------------- */
  function remainingMs(cat) {
    return Math.max(0, activeUntil[cat] - Date.now());
  }
  function onAbnBeginOrRefresh(e) {
    const cat = ABN_TO_CAT.get(e.id);
    if (!cat) return;
    activeUntil[cat] =
      e.duration && e.duration > 0 ? Date.now() + e.duration : Date.now();
    if (pendingUses[cat]) pendingUses[cat] = null;
  }
  function onAbnEnd(e) {
    const cat = ABN_TO_CAT.get(e.id);
    if (!cat) return;
    activeUntil[cat] = 0;
    nextAttemptAfter[cat] = 0;
  }
  // NOTE: Never return false here; returning false would block the packet
  // and hide buffs from the client. We only observe these abnormalities.
  mod.hook("S_ABNORMALITY_BEGIN", "*", (e) => {
    if (ABN_TO_CAT.has(e.id)) onAbnBeginOrRefresh(e);
  });
  mod.hook("S_ABNORMALITY_REFRESH", "*", (e) => {
    if (ABN_TO_CAT.has(e.id)) onAbnBeginOrRefresh(e);
  });
  mod.hook("S_ABNORMALITY_END", "*", (e) => {
    if (ABN_TO_CAT.has(e.id)) onAbnEnd(e);
  });

  /* --------------------------------------------------
   * Core upkeep loop
   * -------------------------------------------------- */
  function attempt(category, now, preRefresh) {
    if (mod.settings[category + "_enabled"] === false) return;
    const rem = remainingMs(category);
    const need = rem === 0 || rem <= preRefresh;
    const pending = pendingUses[category];

    if (pending) {
      if (now - pending.attemptTime >= 400) {
        if (need) {
          const best = highestTierItemInInventory(category);
          if (best && useItem(best.id)) {
            pending.itemId = best.id;
            pending.attemptTime = Date.now();
            pending.attempts++;
          }
          if (pending.attempts >= 8) {
            nextAttemptAfter[category] =
              Date.now() + (mod.settings.retry_backoff_ms || 3000);
            pendingUses[category] = null;
          }
        } else pendingUses[category] = null; // buff applied
      }
      return;
    }
    if (!need) return;
    if (now < nextAttemptAfter[category]) return;
    const best = highestTierItemInInventory(category);
    if (best && useItem(best.id))
      pendingUses[category] = {
        itemId: best.id,
        attemptTime: Date.now(),
        attempts: 1,
      };
    else nextAttemptAfter[category] = Date.now() + 500;
  }

  function inCivilUnrest() {
    return !!mod.game.me.inCivilUnrest;
  }
  function locationAllowed() {
    if (mod.game.me.inBattleground) return false; // Always blocked in battlegrounds
    const wantDungeon = !!mod.settings.dungeon_only;
    const wantUnrest = !!mod.settings.civil_unrest;
    if (!wantDungeon && !wantUnrest) return true; // unrestricted
    const inD = mod.game.me.inDungeon;
    const inU = inCivilUnrest();
    return (wantDungeon && inD) || (wantUnrest && inU);
  }
  function tryUseNostrums() {
    if (!mod.settings.enabled) return;
    if (!mod.game.isIngame || mod.game.isInLoadingScreen) return;
    if (
      !mod.game.me.alive ||
      mod.game.me.mounted ||
      mod.game.me.inBattleground ||
      mod.game.contract.active
    )
      return;
    if (!locationAllowed()) return;
    if (
      mod.settings.keep_resurrection_invincibility &&
      mod.game.me.abnormalities &&
      mod.game.me.abnormalities[RES_INVINC_ABN]
    )
      return; // preserve invincibility period if flag set
    const preRefresh = Math.max(0, mod.settings.pre_refresh_ms || 0);
    const now = Date.now();
    for (const cat of CATEGORIES) attempt(cat, now, preRefresh);
  }

  /* --------------------------------------------------
   * Loop control & lifecycle
   * -------------------------------------------------- */
  let interval = null;
  function start() {
    stop(true);
    interval = mod.setInterval(() => {
      tryUseNostrums();
      updateIdleStatus();
    }, mod.settings.interval || 1000);
    mod.command.message("TN enabled.");
  }
  function stop(silent = false) {
    if (interval) {
      mod.clearInterval(interval);
      interval = null;
      warnedIdle = warnedIdle14 = false;
      if (!silent) mod.command.message("TN disabled.");
    } else if (!silent) {
      mod.command.message("TN disabled.");
    }
  }
  const self = this;
  if (self && !self.destructor)
    self.destructor = () => {
      try {
        stop(true);
      } catch (_) {}
    };

  mod.game.on("enter_game", () => {
    ensureCooldownMap();
    mod.settings.enabled
      ? start()
      : mod.command.message(
          'Nostrums disabled. Use "/8 tn on" or open GUI: "/8 tn"'
        );
  });
  mod.game.on("leave_game", () => stop());
  try {
    mod.hook("C_CONFIRM_UPDATE_NOTIFICATION", "raw", () => false);
  } catch (_) {}

  /* --------------------------------------------------
   * GUI helpers
   * -------------------------------------------------- */
  function fmtTime(ms) {
    return ms <= 0 ? "ready" : `${Math.ceil(ms / 1000)}s`;
  }
  function color(on) {
    return on ? "#4DE19C" : "#FE6F5E";
  }
  const gui = {
    parse(lines, title = "TN") {
      let body = "";
      for (const l of lines)
        body += l.command
          ? `<a href="admincommand:/@${l.command}">${l.text}</a>`
          : l.text;
      mod.toClient("S_ANNOUNCE_UPDATE_NOTIFICATION", "*", {
        id: 0,
        title,
        body,
      });
    },
  };

  function showGui() {
    const lines = [];
    lines.push({
      text: '<font color="#E0B0FF" size="+24">True Nostrum</font><br>',
    });
    // Status block (simple True/False)
    const BLUE = "#89CFF0"; // light blue
    const LRED = "#FF9FA3"; // light red
    const tf = (v) =>
      `<font color="${v ? BLUE : LRED}">${v ? "True" : "False"}</font>`;
    lines.push({
      text: `<font size="+20">Enabled: ${tf(mod.settings.enabled)}</font><br>`,
    });
    lines.push({
      text: `<font size="+20">Ranger Nostrum: ${tf(
        mod.settings.ranger_enabled !== false
      )}</font><br>`,
    });
    lines.push({
      text: `<font size="+20">Energy Nostrum: ${tf(
        mod.settings.energy_enabled !== false
      )}</font><br>`,
    });
    lines.push({
      text: `<font size="+20">Dungeon Only: ${tf(
        mod.settings.dungeon_only
      )}</font><br>`,
    });
    lines.push({
      text: `<font size="+20">Civil Unrest: ${tf(
        mod.settings.civil_unrest
      )}</font><br>`,
    });
    lines.push({
      text: `<font size="+20">Keep Res Invinciblity: ${tf(
        mod.settings.keep_resurrection_invincibility
      )}</font><br><br>`,
    });
    // Toggles
    lines.push({
      text: '<font color="#FE6F5E" size="+20">- Toggle On/Off</font><br>',
      command: "tn toggle;tn",
    });
    lines.push({
      text: '<font color="#FE6F5E" size="+20">- Toggle Ranger</font><br>',
      command: "tn ranger;tn",
    });
    lines.push({
      text: '<font color="#FE6F5E" size="+20">- Toggle Energy</font><br>',
      command: "tn energy;tn",
    });
    lines.push({
      text: '<font color="#FE6F5E" size="+20">- Toggle Dungeon Only</font><br>',
      command: "tn dungeon;tn",
    });
    lines.push({
      text: '<font color="#FE6F5E" size="+20">- Toggle Civil Unrest</font><br>',
      command: "tn unrest;tn",
    });
    lines.push({
      text: '<font color="#FE6F5E" size="+20">- Toggle Keep Res Invinciblity</font><br>',
      command: "tn invinc;tn",
    });
    gui.parse(lines, '<font color="#E0B0FF">TN</font>');
  }

  /* --------------------------------------------------
   * Commands
   * -------------------------------------------------- */
  mod.command.add("tn", {
    $default: () => showGui(),
    on: () => {
      if (!mod.settings.enabled) {
        mod.settings.enabled = true;
        start();
      }
    },
    off: () => {
      if (mod.settings.enabled) {
        mod.settings.enabled = false;
        stop();
      }
    },
    toggle: () => {
      mod.settings.enabled = !mod.settings.enabled;
      mod.settings.enabled ? start() : stop();
      showGui();
    },
    ranger: () => {
      mod.settings.ranger_enabled = !(mod.settings.ranger_enabled !== false);
      showGui();
    },
    energy: () => {
      mod.settings.energy_enabled = !(mod.settings.energy_enabled !== false);
      showGui();
    },
    gui: () => showGui(),
    status: () => {
      mod.command.message(
        `TN: ${mod.settings.enabled ? "on" : "off"} | ranger:${
          mod.settings.ranger_enabled !== false ? "on" : "off"
        } energy:${
          mod.settings.energy_enabled !== false ? "on" : "off"
        } dungeon_only:${mod.settings.dungeon_only ? "on" : "off"} unrest:${
          mod.settings.civil_unrest ? "on" : "off"
        } keep_invinc:${
          mod.settings.keep_resurrection_invincibility ? "on" : "off"
        }`
      );
    },
    dungeon: () => {
      mod.settings.dungeon_only = !mod.settings.dungeon_only;
      showGui();
    },
    unrest: () => {
      mod.settings.civil_unrest = !mod.settings.civil_unrest;
      showGui();
    },
    invinc: () => {
      mod.settings.keep_resurrection_invincibility =
        !mod.settings.keep_resurrection_invincibility;
      showGui();
    },
  });
};
