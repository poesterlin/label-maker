# Label Maker — Niimbot B1

A browser-based label editor and Web Bluetooth reference implementation for the **Niimbot B1** thermal label printer. No login, no accounts, no backend — just open the page, design your label, and print.

## Features

- **Basic mode** — add, position, resize, and style text elements on a canvas. Supports bold, italic, font sizing, and text alignment.
- **Bulk mode** — define multiple labels as paragraphs; preview and print them in one batch.
- **Inline editing** — double-click any text element to edit it in place.
- **Keyboard shortcuts** — Delete/Backspace removes selected, Ctrl+D duplicates, Escape deselects.
- **Auto-save** — your board is persisted to localStorage and restored on reload.
- **Print log** — real-time feedback during print jobs.

## Browser requirements

Web Bluetooth is required to communicate with the printer. Supported browsers:

- **Chrome** / **Chromium** (desktop and Android)
- **Edge** (desktop)
- Other Chromium-based browsers

Firefox and Safari do **not** support Web Bluetooth.

## Getting started

```sh
# install dependencies
bun install

# start the dev server
bun run dev

# build for production
bun run build

# type-check
bun run check
```

The project uses [Bun](https://bun.sh) as the package manager. If you don't have Bun, `npm` works too.

## Printing a label

1. Open the app in a supported browser.
2. Design your label using the canvas editor (basic mode) or text input (bulk mode).
3. Click **Print label**.
4. Your browser will show a Bluetooth device chooser — select your Niimbot B1.
5. The label is rendered, rasterized, and sent to the printer over BLE.

## Project structure

```
src/
├── routes/
│   ├── +page.svelte       # Main page: state, Konva logic, printing, SEO
│   ├── CanvasCard.svelte  # Canvas header, stage, toolbar, edit overlay
│   ├── BasicPanel.svelte  # Basic mode sidebar (add text, item list)
│   ├── BulkPanel.svelte   # Bulk mode sidebar (label list, formatting)
│   ├── +layout.svelte     # Root layout, favicon, meta tags
│   └── +layout.ts         # Static prerender config
├── lib/
│   ├── niimbot.ts         # Web Bluetooth driver for Niimbot B1
│   └── assets/
│       └── favicon.svg
└── app.html               # HTML shell
```

## Web Bluetooth implementation (`src/lib/niimbot.ts`)

`NiimbotService` is a complete BLE driver for the Niimbot B1 and serves as a reference implementation. Key details:

- **Service UUID**: `e7810a71-73ae-499d-8c15-faa9aef0c3f2`
- **IO Characteristic**: `bef8d6c9-9c21-4c9e-b632-bd58c1009f9f`
- **Packet format**: `55 55 [command] [length] [payload...] [checksum] AA AA`
- **Checksum**: XOR of command, length, and all payload bytes
- **Print width**: 384 pixels (48 bytes per row)

### Protocol flow

The printer uses a request-response protocol over Bluetooth GATT. A typical print job:

1. **Connect** — request device, connect GATT, start notifications
2. **Protocol handshake** — send `0xC1` connect command
3. **Configure** — set density (`0x21`), label type (`0x23`)
4. **Start job** — `printStart` (`0x01`), `pageStart` (`0x03`)
5. **Set page size** — width × height in pixels (`0x13`)
6. **Send bitmap rows** — empty rows (`0x84`) or bitmap rows (`0x85`)
7. **Finish** — `pageEnd` (`0xE3`), wait for completion, `printEnd` (`0xF3`)

### Bitmap encoding

The image is converted to a 1-bit bitmap where each byte encodes 8 horizontal pixels (MSB first). A luminance threshold of 200 determines black vs white:

```ts
const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
const isBlackPixel = alpha > 0 && luminance < 200;
```

Bitmap rows include a 3-byte black-pixel count prefix required by the printer firmware.

### Tuning

Print speed can be adjusted via `setPrintTuning`:

```ts
printerService.setPrintTuning({
  waitBetweenPrintLinesMs: 10,  // delay between rows
  printLineBatchSize: 8         // rows per acknowledged write
});
```

## Tech stack

| Layer | Technology |
|---|---|
| Framework | [SvelteKit](https://svelte.dev/docs/kit) with [Svelte 5](https://svelte.dev/docs/svelte/overview) runes |
| Canvas | [Konva](https://konvajs.org) (2D canvas library) |
| Icons | [Tabler Icons](https://tabler.io/icons) |
| BLE API | [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) |
| Build | [Vite](https://vite.dev) |
| Package manager | [Bun](https://bun.sh) |
| Deploy | Static site ([@sveltejs/adapter-static](https://svelte.dev/docs/kit/adapter-static)) |

The entire app is pre-rendered as a static site — it can be hosted anywhere (GitHub Pages, Netlify, Vercel, a local file server).

## References

- [Niimbot B1 BLE protocol documentation](https://github.com/MultiMote/niimbot-printer-protocol) — community reverse-engineered protocol reference
- [Web Bluetooth API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API) — MDN documentation

## License

MIT
