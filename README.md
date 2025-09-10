# True Nostrum for Old School Tera Online

Automatically keeps your Ranger's Nostrum and Nostrum of Energy buffs active.

## What It Does

- Watches your two Nostrum buff categories (Ranger / Energy)
- Uses the best tier you have in your inventory when a buff expires or is close to expiring
- Optional idle protection: warns after long inactivity and can auto‑disable

## Quick Start

1. Drop the module folder into your Toolbox / mods directory.
2. Launch the game.
3. In /8 chat type `tn on` (or `tn` for gui) to enable.
4. Profit: buffs stay up automatically.

## In‑Game Commands (/8)

| Purpose                                          | Command      |
| ------------------------------------------------ | ------------ |
| Show status GUI                                  | `tn`         |
| Enable                                           | `tn on`      |
| Disable                                          | `tn off`     |
| Toggle (alternative)                             | `tn toggle`  |
| Toggle Ranger Nostrum                            | `tn ranger`  |
| Toggle Energy Nostrum                            | `tn energy`  |
| Restrict to dungeons only                        | `tn dungeon` |
| Civil Unrest                                     | `tn unrest`  |
| Keep resurrection invincibility (don’t break it) | `tn invinc`  |

## Tips

- Keep at least one Nostrum of each type if you want both buffs.
- If nothing happens: make sure you’re alive, not mounted, not in a battleground, and the module is enabled.
- Ran out of higher tiers? It will fall back to lower ones automatically.

## Troubleshooting

| Symptom                 | Fix                                                     |
| ----------------------- | ------------------------------------------------------- |
| Buff never reapplies    | Check you still have items; try `tn off` then `tn on`   |
| Commands do nothing     | Ensure Toolbox loaded the module; check chat for errors |
| Gets disabled while AFK | That’s idle protection; re‑enable with `tn on`          |

## Credits

Originally based on true-everful-nostrum (Caali, SaltyMonkey, HSDN, others).

Enjoy not worrying about popping your nostrum again.
