# Making an APK (and Play Store build) for Hollow Wardens 3D

## 1. What PWABuilder needs (all included in this folder)
| Requirement | File | Status |
| --- | --- | --- |
| Served over HTTPS | GitHub Pages / Firebase | You deploy |
| Web app manifest linked from the page | `manifest.json` + `<link rel="manifest">` in `index.html` | Done |
| `name`, `short_name`, `start_url`, `display: standalone` | `manifest.json` | Done |
| 192x192 and 512x512 PNG icons | `icon-192.png`, `icon-512.png` | Done |
| Maskable icon (Android adaptive icons) | `icon-maskable-512.png` | Done |
| Service worker that works offline | `sw.js` (registered in `index.html`) | Done |
| `start_url` and `scope` that match your hosting path | `"./"` works under `/repo-name/` | Done |

Important: the old manifest used `"start_url": "/"`. On a GitHub project site that points to the wrong place. It is now `"./"`.

## 2. Steps to get the APK (free, install outside the Play Store)
1. Upload every file in this folder (not the folder itself, and include the `store` folder if you like) to your GitHub repository. Keep the file names exactly as they are.
2. Turn on Pages (Settings > Pages > Deploy from a branch > main > / root). Wait 1-2 minutes.
3. Open your link in Chrome. It should load, and after a refresh the menu should offer "Install app". That confirms the manifest and service worker work.
4. Go to pwabuilder.com, paste your full link and press Start. The manifest and service worker checks should now pass.
5. Press Package for stores > Android.
   - For a file you can share directly, choose the APK ("Other Android") option.
   - For the Play Store, choose the Google Play option, which makes an AAB file.
6. Set: App name `Hollow Wardens 3D`, Package ID like `com.rubaiyat.hollowwardens` (lowercase, no spaces, cannot be changed after publishing), version 1, and let it create a new signing key.
7. Download the zip. Keep the signing key file and its passwords safe. You need the same key for every update, and losing it means you can never update the app.
8. Install the APK on your phone: copy it over, allow installs from unknown sources, tap the file.

## 3. Removing the browser bar in the app (Digital Asset Links)
A GitHub link ending in `/repo-name/` cannot prove ownership, so a thin address bar may show. To remove it:
1. Create a repository named exactly `YOUR-USERNAME.github.io` and put the game files at its root.
2. In PWABuilder's download you get a `assetlinks.json` file, and the SHA-256 fingerprint is in the key info.
3. Add the file to the repo at `.well-known/assetlinks.json`, and add an empty file named `.nojekyll` in the root so GitHub serves the dot folder.
4. Rebuild the package using your new link.

## 4. Google Play Store requirements (one-time $25 developer fee)
- A Google Play developer account (identity verification is required).
- The AAB file from PWABuilder (not the APK).
- App icon 512x512: `store/play-store-icon-512.png`
- Feature graphic 1024x500: `store/feature-graphic-1024x500.png`
- At least 2 phone screenshots (take them from the running game; landscape works).
- Short description (80 characters) and full description.
- A privacy policy web page link. The game stores progress only in the browser and collects no personal data, so a short page saying that is enough. You can host it as `privacy.html` in your repo.
- Content rating questionnaire (the game has fantasy violence against monsters, no blood).
- Data safety form: declare that no data is collected.
- New personal developer accounts must run a closed test with testers for a period before they can publish publicly. Check the current Play Console rules when you apply, because they change.

## 5. Every time you change the game
Edit the files, then raise `VERSION` in `sw.js` (for example `hw3d-v3`) so players get the update. A web update reaches the installed app automatically. You only rebuild the APK if you change the name, icons or package settings.
