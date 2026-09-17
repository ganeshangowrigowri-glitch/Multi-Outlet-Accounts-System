// ─────────────────────────────────────────────────────────────
// Centralized print-mode configuration.
//
//   NORMAL — Letter, landscape (8.5in x 11in / 215.9mm x 279.4mm)
//            This is the app-wide default @page rule in index.css,
//            so any existing `window.print()` call already uses it —
//            nothing else needs to change for normal reports.
//
//   FULL   — custom 8K sheet (270mm x 390mm), printed in landscape
//            orientation so the 390mm edge becomes the printable
//            width — used only by wide, many-column reports
//            (Sales Summary, Expense Summary, UG Book) so every
//            column fits without the old "print at 50% scale" hack.
//
// `@page` rules can't be scoped by a CSS class selector, so FULL mode
// works by injecting a scoped <style> tag right before printing and
// removing it afterward. A `print-full` body class is added alongside
// it purely for ordinary (class-scoped) layout/font rules in CSS.
// ─────────────────────────────────────────────────────────────

const STYLE_TAG_ID = "print-mode-page-style";
const PRINT_MARGIN_MM = 8;

function setPageSize(sizeCss) {
  let tag = document.getElementById(STYLE_TAG_ID);
  if (!tag) {
    tag = document.createElement("style");
    tag.id = STYLE_TAG_ID;
    document.head.appendChild(tag);
  }
  tag.textContent = `@media print { @page { size: ${sizeCss}; margin: ${PRINT_MARGIN_MM}mm; } }`;
}

function clearPageSize() {
  const tag = document.getElementById(STYLE_TAG_ID);
  if (tag) tag.textContent = "";
}

function runWithMode(bodyClass, sizeCss) {
  document.body.classList.add(bodyClass);
  setPageSize(sizeCss);

  const cleanup = () => {
    document.body.classList.remove(bodyClass);
    clearPageSize();
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  // Fallback in case afterprint doesn't fire (older WebKit/print-to-PDF flows)
  setTimeout(cleanup, 5000);

  window.print();
}

// FULL / BIG — 8K sheet (270mm x 390mm), printed landscape so the
// long edge (390mm) is the printable width. Margins are subtracted
// by @page itself, so the table's `width:100%` never exceeds the
// actual printable area.
export function printFull() {
  runWithMode("print-full", "390mm 270mm");
}

// NORMAL is just the stylesheet default (Letter landscape) — exposed
// here too so a component can call it explicitly if it ever needs to,
// but plain window.print() already behaves identically.
export function printNormal() {
  runWithMode("print-normal", "279.4mm 215.9mm");
}

// A4 LANDSCAPE — 297mm x 210mm, the common middle ground between
// Letter and the 8K sheet. Reuses the same .print-full font/padding
// rules (see index.css) since A4 landscape is also wider than Letter
// landscape and benefits from the same slightly larger, readable type
// rather than the tighter Letter-width sizing.
export function printA4() {
  runWithMode("print-full", "297mm 210mm");
}

export default { printFull, printNormal, printA4 };