# Hollow Wardens 3D

**Made by Rubaiyat.**

A fast 3D action roguelite that runs in your browser. Pick a Warden, fight off waves of Hollows, grab a boon after every wave, and chase your best wave and score. Built with [three.js](https://threejs.org/). No build step, no dependencies to install.

## Play

Open `index.html` in a modern browser, or host the folder anywhere that serves static files.

**GitHub Pages:** push this repo, then go to *Settings > Pages*, choose *Deploy from a branch*, select `main` and `/ (root)`. Your game will be live at `https://<your-username>.github.io/<repo-name>/`.

The page loads three.js (r128) and a web font from a CDN, so it needs an internet connection the first time.

## Game modes

- **Endless** - waves get bigger and meaner. A boss arrives every fifth wave (Rotted Choir, then Hollow Titan, then they alternate and bring friends).
- **Story** - three fixed fights, a quick run to learn your Warden.

## What keeps you coming back

- **Boons** - after every wave pick 1 of 3. 15 boons across common, rare and epic tiers, and they stack (extra crit chance, lightning finishers, a longer parry window, a one-time Phoenix revive and more). Boss waves offer better rewards.
- **Soul Forge** - every run earns shards, even failed ones. Spend them on permanent upgrades from the main menu: health, damage, stamina, Realm charge and shard income.
- **Score and combo** - chain hits to raise your multiplier, parry for bonus points, finish a wave without being hit for a flawless bonus. Getting hit resets your combo.
- **Parry and reflect** - tap Guard just before an enemy lands a hit to stun it and counter. Time it on a ranged orb and it flies back at triple damage.
- **Enemy variety** - Dusk Wisps swoop, Hollow Brutes hit hard, Shade Stalkers telegraph a lunge, Gloom Spitters keep their distance, and bosses have volleys and ground slams. At most a couple of enemies attack at once, so fights stay readable.
- **Four Wardens** - Aren (tank, piercing shockwave), Suki (stunning seals), Dain (blink strike), Imi (healing light that also burns nearby foes). Each has a unique Realm ultimate.
- **Records** - best wave, high score and best time are saved in your browser (`localStorage`).

## Controls

| Action | Keyboard | Touch |
| --- | --- | --- |
| Move | WASD or arrow keys | On-screen stick |
| Attack (3-hit combo) | J | Attack |
| Skill | K | Skill |
| Guard / parry | L (hold) | Guard |
| Dodge | Space | Dodge |
| Realm (when charged) | U | Realm |
| Pause | P or Esc | II button |
| Pick a boon | 1, 2, 3 | Tap a card |

You always face your nearest enemy, and movement is relative to them, so forward means toward the target.

## Project structure

```
index.html   page markup (menu, HUD, overlays)
style.css    all styling
game.js      game logic, in sections: data, save, scene, combat, run flow, UI, input
```

To tweak balance, the data tables at the top of `game.js` (`CHARS`, `ENEMY_TYPES`, `BOONS`, `FORGE`) hold almost every number.

## Saved data

Progress is stored under the `hollowWardens3d.save.v1` key in `localStorage`. The *Reset saved progress* link in the Soul Forge panel clears it.

## License

MIT, see [LICENSE](LICENSE). Copyright (c) 2026 Rubaiyat.
