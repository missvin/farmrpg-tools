# Mining Depth History for Firefox

This companion userscript saves a timestamped snapshot of every visible mine and floor whenever you enter FarmRPG's **Mining Locations** page. It stores the history inside Tampermonkey in your Firefox profile and only creates a file when you choose an export button.

It is designed to run alongside [Farm RPG Mining Progress Display](https://greasyfork.org/en/scripts/546285-farm-rpg-mining-progress-display). The two scripts use different storage keys and page elements.

## Install in Firefox with Tampermonkey

1. Install Tampermonkey from [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/tampermonkey/) if it is not already installed.
2. Select the Tampermonkey toolbar icon, then select **Dashboard**.
3. Select the **+** tab or **Create a new script**.
4. Remove the starter template from the editor.
5. Open [`farmrpg-mining-depth-history.user.js`](./farmrpg-mining-depth-history.user.js), copy the entire file, and paste it into the Tampermonkey editor.
6. Press **Ctrl+S**. Confirm that **Farm RPG Mining Depth History** is enabled in the Tampermonkey Dashboard.
7. Open FarmRPG and go to **Go Mining → Mining Locations**. If that page was already open, reload it once.

The expected flow is:

```text
Firefox + Tampermonkey
        │
        ▼
FarmRPG Mining Locations opens
        │
        ▼
Six visible mine rows become stable
        │
        ▼
Mining Depth History: Saved. 1 saved visit. Latest: … (6 mines).
```

The script needs permission to run on `https://farmrpg.com/*`. It does not contact another website or service.

## Confirm that it is working

Above the Mining Locations list, look for a small **Mining Depth History** panel. It should report a saved timestamp, the number of saved visits, and the number of mines captured.

To create another observation:

1. Navigate away from Mining Locations.
2. Return to **Go Mining → Mining Locations**.
3. Confirm that the saved-visit count increases.

A reload is also a new page entry and creates a new observation. Repeated internal page updates during one visit do not create extra observations.

## Export and view depth over time

### CSV for Excel or Google Sheets

Select **Export CSV**. Firefox downloads a file named like:

```text
farmrpg-mining-depth-history-2026-09-03.csv
```

Each mine is one row for each visit:

```text
snapshot_id,observed_at_utc,observed_at_local,timezone_offset_minutes,mine_id,mine_name,floor
```

For a quick chart in Excel or Google Sheets:

1. Open or import the CSV.
2. Filter `mine_name` to one mine.
3. Select `observed_at_local` and `floor`.
4. Insert a line chart with time on the horizontal axis and floor on the vertical axis.

Keep `snapshot_id` when combining or cleaning files; every mine captured during one visit shares that ID and timestamp.

### JSON archive

Select **Export JSON backup** for a lossless copy of the complete versioned history. V1 does not include a JSON restore button, so keep this file as a durable archive that can be migrated or restored by a future version if Tampermonkey storage is lost.

Export JSON periodically, especially before removing Tampermonkey, clearing Firefox extension data, or replacing the script.

## Multiple tabs and windows

- Tabs and windows in the same normal Firefox profile share this script's Tampermonkey history.
- Writes are serialized with Firefox Web Locks so simultaneous tabs do not overwrite one another.
- Matching captures from different tabs within 10 seconds are stored once.
- A rapid leave-and-return in the same tab remains a real visit and is stored.
- The panel updates when another tab changes the shared history.
- Closing a tab or window does not delete saved history.
- Separate Firefox profiles do not share history. Private-window storage can also be separate depending on Firefox and Tampermonkey settings.

If Firefox ever exposes no Web Locks support to the userscript, the panel warns that fallback verification was used. Export a JSON archive promptly if that warning appears.

## Clear history

1. Export JSON first if you may want the data later.
2. Select **Clear history**.
3. Read the confirmation message and confirm the deletion.

Canceling the confirmation changes nothing. Confirmed clearing removes the locally stored history for this userscript and Firefox profile.

## Updating the script

Replace the Tampermonkey editor contents with the newer complete `.user.js` file and save. Updates that retain the same storage schema and key keep existing history. Export JSON before updating as a precaution.

Do not edit the generated `.user.js` inside the repository. Project changes belong in the template or tested core module, followed by:

```powershell
node scripts/buildMiningDepthHistoryUserscript.mjs
```

## Troubleshooting

### No Mining Depth History panel

- Confirm you are signed in and on the overview URL ending in `#!/mine.php`, not inside one specific mine.
- In the Tampermonkey Dashboard, confirm **Farm RPG Mining Depth History** is enabled.
- In Firefox's extension settings, confirm Tampermonkey can access `farmrpg.com`.
- Reload Mining Locations once after installing or updating the script.
- The collector waits briefly for all mine rows to stabilize. If the page is still loading, wait a few seconds and revisit it.

### The panel says “Not saved”

The script refuses to save partial or malformed page data. Copy the full warning before reloading. Open Firefox Developer Tools with **Ctrl+Shift+K** and look for a console entry beginning with `Mining Depth History:` if more detail is needed.

Do not clear history to troubleshoot a warning. Export existing data first when export remains available.

### The visit count looks one lower with two tabs

That is expected when two tabs capture identical mine floors within 10 seconds. The second tab recognizes the first capture and does not create a redundant point.

### Mining Progress Display is also installed

Leave both scripts enabled. Mining Progress Display operates inside individual mines; Mining Depth History operates on the Mining Locations overview. If either script reports an error, capture the exact message and which page was open.
