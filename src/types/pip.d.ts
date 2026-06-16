// Document Picture-in-Picture API — not yet in TypeScript's DOM lib (Chrome
// 116+). Declares just enough of the surface for the PiP timer widget:
// `window.documentPictureInPicture.requestWindow(...)` and the live `.window`
// reference used to close the floating window again.
//
// Kept narrow on purpose — the spec only needs requestWindow + window. The
// returned object is a real `Window`, so the rest of the DOM types apply once
// you have it.

interface DocumentPictureInPictureOptions {
  width?: number;
  height?: number;
}

interface DocumentPictureInPicture extends EventTarget {
  requestWindow(options?: DocumentPictureInPictureOptions): Promise<Window>;
  readonly window: Window | null;
}

interface Window {
  documentPictureInPicture?: DocumentPictureInPicture;
}
