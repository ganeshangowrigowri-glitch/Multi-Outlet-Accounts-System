/** Trigger print for ledger reports — shows only .ledger-print-zone content. */
export function printLedger() {
  document.body.classList.add("printing-ledger");
  const cleanup = () => {
    document.body.classList.remove("printing-ledger");
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}
