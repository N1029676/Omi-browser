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

Downloading is **non-destructive**: the Omi keeps the audio until you press *Free space on Omi* (section 5).
Closing the page loses what was downloaded into it, but the audio is still on the device, so just download again.

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
| Audio | Opus, 16 kHz mono (codec char `19B10002-…`: 20 = 10 ms frames, 21 = 20 ms frames) |

DATA notifications are not aligned to record boundaries, so the app reassembles on the 444-byte stride.

## Notes and limits

* Offline storage needs firmware with SD-card storage (the 3.0.20+ ring buffer); INFO also needs an ATT MTU ≥ 44.
* The whole download is held in memory (roughly the size of the unread data); fine for hours of audio.
* Not tested against real hardware. It was verified against a mock device that follows the firmware's storage
  protocol, using real Opus frames. If something misbehaves on your Omi, the Activity log in the page shows
  what the device replied.
