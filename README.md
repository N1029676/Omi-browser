# Omi Audio Retriever

A single-page app (`index.html`, no build, no dependencies) that downloads the audio your
[Omi](https://www.omi.me) wearable stored offline on its SD card, over Bluetooth, using Web Bluetooth.
Everything happens locally in your browser.

## Use

1. Serve the folder over `localhost` (Web Bluetooth needs a secure context):
   ```
   python3 -m http.server 8000
   ```
   then open <http://localhost:8000> in **Chrome, Edge or Opera** (desktop or Android; Safari, Firefox and iOS have no Web Bluetooth).
2. Close the Omi phone app / turn off the phone's Bluetooth. The Omi only talks to one device at a time.
3. **Connect to Omi**, then **Download stored audio**.
4. Recordings are split wherever the device clock shows a gap (adjustable). For each one you can play it,
   download a **WAV** (decoded in-browser with WebCodecs), or download **.opus** (the device's Opus
   frames wrapped in Ogg, no re-encoding). **Save raw dump** writes the untouched 444-byte ring records.

Downloading is **non-destructive**: the Omi keeps the audio until you press *Free space on Omi* (section 6).
That marks the downloaded audio as reusable: the firmware may overwrite it and it can no longer be read over
Bluetooth (so the Omi phone app can't sync it either). It's only enabled after a complete download that was
saved to browser storage.

**Live capture** (section 4) subscribes to the Omi's live audio stream, plays it as it arrives (optional) and saves it
as a recording in the same library. Use it with the phone app closed; it can't run at the same time as a storage download.

Downloads and live recordings are saved in the browser's IndexedDB as they arrive, each chunk flushed to disk before the next is
requested. Recordings survive reloads, and an interrupted download resumes where it stopped. Browser storage can
be cleared by the user or the browser, so export WAV/.opus files for anything you want to keep.

## Device settings

Once connected, the **Device settings** card reads and writes the Omi's settings service:

* **Recording** on/off (the Omi's capture mute: while off it captures nothing, stored or live; the setting is kept by the device across reconnects and reboots)
* **LED brightness** 0–100 %
* **Microphone gain** 0–8

## Remembered device

The page remembers the Omi you connected to and, after a reload, reconnects to it without showing the device picker
(and reconnects by itself if the connection drops and the Omi comes back into range). This uses
`navigator.bluetooth.getDevices()`, available in recent Chrome/Edge; other browsers just show the normal picker.
"Details → Forget this device" clears it. If the settings card says your permission predates settings support, forget the
device and connect once more.

## Install as an app

The page is an installable web app (manifest, icons and a service worker). In Chrome or Edge, use the **Install app**
button in the page header (or the install icon in the address bar) to get a standalone window and launcher/desktop icon.
Web Bluetooth, remembered device and the library work the same in the installed app.

The service worker is network-first: it always revalidates, so a new deployment appears immediately, and it falls back
to the cached copy when offline (you can open the app and play/export downloaded recordings without a connection; talking to
the Omi of course needs Bluetooth only, not internet). `version.json` is never cached, so the update check stays accurate.
The icons are rendered from `icons/icon.svg` and `icons/icon-maskable.svg`.

## Versions and update check

The version is the commit's date and time in UTC, `yymmddhhmm` (shown in the header and footer). Every
`index.html` contains it, and `version.json` next to it holds the same value. The page compares the two on load,
every 15 minutes and when the tab regains focus, and shows a "Reload to update" banner when `version.json` is newer than
the running page. Always commit with:

```
tools/commit.sh -m "message"
```

It stamps `index.html`, `sw.js` and `version.json` with the current UTC minute and sets the commit's author/committer date to that
same minute, so `TZ=UTC git log -1 --format=%ad --date=format:%y%m%d%H%M` equals the version inside the commit.
(`tools/stamp-version.sh` only does the stamping.) Commits made another way, such as through the GitHub web editor, keep the
old version and won't trigger the update banner.

## Protocol notes

The public [protocol page](https://docs.omi.me/doc/developer/Protocol) covers live streaming only. Offline storage is
implemented in the firmware (`omi/firmware/omi/src/lib/core/storage.c`, `sd_card.h`) and is what this app speaks:

| | |
|---|---|
| Storage service | `30295780-4301-EABD-2904-2849ADFEAE43` |
| Command / notify characteristic | `30295781-…` (write + notify) |
| Status characteristic | `30295782-…` (read: 4 × u32 LE: used bytes, unread records, free bytes, rtc valid) |
| Commands | `0x10` INFO · `0x11` READ(seq u64 BE, [count u32 BE]) · `0x12` ADVANCE(seq) · `0x15` ADVANCE_ID(ring_id, seq) · `0x03` STOP |
| Notifications | `0x01` ACK[status] · `0x02` INFO(41 B) · `0x03` DATA · `0x04` DONE[status][next_seq] · `0x05` READ_BEGIN[seq][count] |
| Ring record (444 B) | `[timestamp u32 BE][440 B payload]`; payload is `[len u8][Opus frame]…` zero-padded |
| Timestamp | epoch seconds; bit 31 set = seconds since boot (device clock not set) |
| Settings service `19B10010-…` | `…11` LED brightness u8 0–100 · `…12` mic gain u8 0–8 · `…13` charging u8 · `…15` capture mute u8 (1 = paused) |
| Live audio characteristic | `19B10001-…` (notify): subscribing starts the stream. Packet = `[packet# u16 LE][fragment# u8][bytes]`; an Opus frame starts at fragment 0 and may span several packets. A missing packet drops that frame. |
| Audio | Opus, 16 kHz mono (codec char `19B10002-…`: 20 = 10 ms frames, 21 = 20 ms frames) |

DATA notifications are not aligned to record boundaries, so the app reassembles on the 444-byte stride.

## Notes and limits

* Offline storage needs firmware with SD-card storage (the 3.0.20+ ring buffer); INFO also needs an ATT MTU ≥ 44.
* Stored recordings are also held in memory while the page is open (roughly the size of the unread data); fine for hours of audio.
* Not tested against real hardware. It was verified against a mock device that follows the firmware's storage
  protocol, using real Opus frames. If something misbehaves on your Omi, the Activity log in the page shows
  what the device replied.
