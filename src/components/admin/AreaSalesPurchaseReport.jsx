import { useState, useEffect, useMemo, useRef } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { I } from "../../utils/icons";
import { getInventoryMaster, getSales, getPurchases, getOutletInventory } from "../../db";
import { AREAS, UNASSIGNED_AREA, getOutletArea } from "../../data/areas";

// ─────────────────────────────────────────────────────────────────────────
//  AREA SALES & PURCHASE REPORT  (Admin-only, read-only)
//
//  This component performs NO independent Sales/Purchase calculation.
//  It reuses the EXACT SAME formula that the existing Current Status
//  screens (S_Inventory.jsx "Tab 5" and InventoryAdmin.jsx "Tab 5") use:
//
//      Opening + Total Purchase − In Hand Stock = Total Bottle Sale
//
//  (see the comment block above `computeCsData` in S_Inventory.jsx, and
//  the equivalent per-outlet loop inside the `csData` useMemo in
//  InventoryAdmin.jsx). The opening/in-hand-stock detection logic below
//  (first opening on the earliest date in range, last end stock on/at
//  the period end date, with the same fallback search) is copied
//  line-for-line from those two places so the numbers can never drift.
//
//  This file does not import from, modify, or re-render anything in
//  S_Inventory.jsx or InventoryAdmin.jsx — it only reads the same raw
//  Sales / Purchases / Outlet Inventory tables via the existing db.js
//  functions, exactly like those two screens already do.
// ─────────────────────────────────────────────────────────────────────────

// ── date helpers (period is a "YYYY-MM" month string) ──
function monthRange(period) {
  const [y, m] = String(period || "").split("-").map(Number);
  if (!y || !m) return { from: "", to: "" };
  const from = `${period}-01`;
  const lastDay = new Date(y, m, 0).getDate();
  const to = `${period}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function monthLabel(period) {
  if (!period) return "";
  try {
    return new Date(`${period}-01`).toLocaleString("en-LK", { month: "long", year: "numeric" });
  } catch {
    return period;
  }
}

// ── EXACT reuse of the Current Status opening/end-stock detection logic ──
// (copied from computeCsData / InventoryAdmin.jsx csData — see header note)
function findOpeningAndEndStock(salesInRange, toDate, item) {
  const matchRow = (sale) =>
    (sale.items || []).find(
      (r) =>
        !r.isEmptyItem &&
        ((r.id && r.id === item.id) || (r.code && r.code === item.code && r.supplier === item.supplier))
    );

  // ── First opening in range ──
  let firstOpening = null;
  if (salesInRange.length > 0) {
    const firstDate = salesInRange[0].date;
    const firstDateSales = salesInRange.filter((s) => s.date === firstDate);
    for (const sale of firstDateSales) {
      const row = matchRow(sale);
      if (row && row.openingStock !== null && row.openingStock !== undefined) {
        const op = Number(row.openingStock);
        if (firstOpening === null || op > firstOpening) firstOpening = op;
      }
    }
  }

  // ── Last known end stock (= in-hand stock) ──
  let lastEndStock = null;
  const csToSales = salesInRange.filter((s) => s.date === toDate);
  const csToRows = [];
  for (const sale of csToSales) {
    const row = matchRow(sale);
    if (row && row.endStock !== null && row.endStock !== "" && row.endStock !== undefined) {
      csToRows.push(row);
    }
  }
  if (csToRows.length > 0) {
    const soldRow = csToRows.find((r) => parseFloat(r.sold) > 0);
    lastEndStock = soldRow
      ? parseFloat(soldRow.endStock)
      : Math.max(...csToRows.map((r) => parseFloat(r.endStock)));
  }
  if (lastEndStock === null) {
    for (let i = salesInRange.length - 1; i >= 0; i--) {
      const row = matchRow(salesInRange[i]);
      if (
        row &&
        row.endStock !== null &&
        row.endStock !== "" &&
        row.endStock !== undefined &&
        parseFloat(row.endStock) > 0
      ) {
        lastEndStock = parseFloat(row.endStock);
        break;
      }
    }
  }
  return { firstOpening, lastEndStock };
}

// ── Per-outlet, per-item Current Status figures for one item ──
// (same formula as computeCsData; currency/margin/transfers/returns are
// intentionally omitted here — this report only needs the two bottle
// quantities, and Sales/Purchase never touch those fields anyway)
function computeItemCurrentStatus(item, salesForOutlet, purchasesForOutlet, invQty, fromDate, toDate) {
  const salesInRange = (salesForOutlet || [])
    .filter(
      (s) => s.date && s.date >= fromDate && s.date <= toDate && (s.items || []).some((r) => !r.isEmptyItem)
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  const { firstOpening, lastEndStock } = findOpeningAndEndStock(salesInRange, toDate, item);

  let totalPurchase = 0;
  (purchasesForOutlet || [])
    .filter((p) => p.date && p.date >= fromDate && p.date <= toDate)
    .filter((p) => (p.supplier || p.supplier_id) === item.supplier)
    .forEach((p) =>
      (p.items || p.lines || []).forEach((l) => {
        if (l.itemCode === item.code && !l.isEmptyItem) totalPurchase += parseFloat(l.qty) || 0;
      })
    );
  const opening = firstOpening !== null ? firstOpening : Number(invQty) || 0;
  const inHandStock = lastEndStock !== null ? lastEndStock : opening;
  const totalBottleSale = opening + totalPurchase - inHandStock;

  return { totalBottleSale, totalPurchase };
}

// Purely cosmetic: stable colour per supplier so DCSL/UG/IDL/Rockland/Lion
// each get a consistent, distinct accent. Does not affect data or logic.
const ASP_PALETTE = ["#f0b429", "#38bdf8", "#e093d7", "#f5d93a", "#3ce2b0", "#adca29"];
function supplierAccent(id) {
  if (!id) return ASP_PALETTE[0];
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ASP_PALETTE[h % ASP_PALETTE.length];
}

// Display-only grouping key to draw a divider where the brand changes.
// Derived from the item's own code (no new data, no logic change).
function aspBrandKey(item) {
  return (item?.brand ?? item?.code ?? "").toString().split(/[-_\s]/)[0];
}

const AREA_OPTIONS = ["ALL", ...AREAS];

export default function AreaSalesPurchaseReport({ outlets, toast_ }) {
  const outletNames = outlets || [];

  const [reportType, setReportType] = useState("sales"); // "sales" | "purchase"
  const [areaSel, setAreaSel] = useState("ALL");
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [supplierId, setSupplierId] = useState("");
  const [hideZero, setHideZero] = useState(false);

  const [masterInv, setMasterInv] = useState([]);
  const [invLoading, setInvLoading] = useState(true);
  const [outletsLoading, setOutletsLoading] = useState(false);
  const cacheRef = useRef({}); // { [outletName]: { sales, purchases, inv } }
  const [dataVersion, setDataVersion] = useState(0);
  const printRef = useRef(null);

  // ── Load master inventory (item/brand + supplier master data) once ──
  useEffect(() => {
    let cancelled = false;
    getInventoryMaster()
      .then((data) => {
        if (!cancelled) setMasterInv(data || []);
      })
      .finally(() => {
        if (!cancelled) setInvLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Supplier options: only suppliers that actually have main-stock items ──
  const supplierOptions = useMemo(() => {
    const seen = new Map();
    masterInv.forEach((i) => {
      if (i.type !== "EM" && i.supplier && !seen.has(i.supplier)) {
        seen.set(i.supplier, i.supplier.replace(/^\d{4}-/, ""));
      }
    });
    return [...seen.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [masterInv]);

  // Default the supplier once options are known
  useEffect(() => {
    if (!supplierId && supplierOptions.length > 0) setSupplierId(supplierOptions[0].id);
  }, [supplierOptions, supplierId]);

  // ── Outlets belonging to the selected Area ──
  const outletsInScope = useMemo(() => {
    if (areaSel === "ALL") return outletNames;
    return outletNames.filter((o) => getOutletArea(o) === areaSel);
  }, [outletNames, areaSel]);

    // ── Brands/items belonging to the selected Supplier ──
  const supplierItems = useMemo(() => {
    if (!supplierId) return [];
    return masterInv
      .filter((i) => i.supplier === supplierId && i.type !== "EM")
      .sort((a, b) => (a.code || "").localeCompare(b.code || "", undefined, { numeric: true }));
  }, [masterInv, supplierId]);

  // Display-only: true at the index where the brand group changes,
  // used purely to draw a visual divider column. Does not affect data.
  const supplierItemGroupBreak = useMemo(
    () => supplierItems.map((item, idx) => idx > 0 && aspBrandKey(item) !== aspBrandKey(supplierItems[idx - 1])),
    [supplierItems]
  );

  // ── Load raw Sales/Purchases/Outlet-Inventory for outlets not cached yet ──
  useEffect(() => {
    const missing = outletsInScope.filter((o) => !cacheRef.current[o]);
    if (missing.length === 0) return;
    let cancelled = false;
    setOutletsLoading(true);
    Promise.all(
      missing.map(async (o) => {
        const [sales, purchases, inv] = await Promise.all([
          getSales(o),
          getPurchases(o),
          getOutletInventory(o),
        ]);
        return [o, { sales, purchases, inv }];
      })
    )
      .then((entries) => {
        if (cancelled) return;
        entries.forEach(([o, d]) => {
          cacheRef.current[o] = d;
        });
        setDataVersion((v) => v + 1);
      })
      .catch((err) => {
        console.error("AreaSalesPurchaseReport load error:", err);
        toast_ && toast_("Failed to load some outlet data", "err");
      })
      .finally(() => {
        if (!cancelled) setOutletsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletsInScope]);

  // ── Build the Outlet × Brand matrix (read-only aggregation, in memory) ──
  const matrix = useMemo(() => {
    if (!supplierId || supplierItems.length === 0) return null;
    const { from, to } = monthRange(period);
    if (!from || !to) return null;

    const rows = outletsInScope.map((outlet) => {
      const cached = cacheRef.current[outlet] || {};
      const sales = cached.sales || [];
      const purchases = cached.purchases || [];
      const invRows = cached.inv || [];
      const invQtyMap = {};
      invRows.forEach((r) => {
        invQtyMap[`${r.code}__${r.supplier}`] = r.qty;
      });

      const values = supplierItems.map((item) => {
        const invQty = invQtyMap[`${item.code}__${item.supplier}`] || 0;
        const { totalBottleSale, totalPurchase } = computeItemCurrentStatus(
          item,
          sales,
          purchases,
          invQty,
          from,
          to
        );
        return reportType === "sales" ? totalBottleSale : totalPurchase;
      });

      const total = values.reduce((a, v) => a + (Number(v) || 0), 0);
      return { outlet, values, total };
    });

    const colTotals = supplierItems.map((_, idx) =>
      rows.reduce((a, r) => a + (Number(r.values[idx]) || 0), 0)
    );
    const grandTotal = rows.reduce((a, r) => a + r.total, 0);

    return { rows, colTotals, grandTotal };
    // dataVersion is a dependency purely to re-run once newly-fetched
    // outlet data lands in cacheRef (the ref itself isn't reactive).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletsInScope, supplierItems, reportType, period, dataVersion]);

  const displayRows = useMemo(() => {
    if (!matrix) return [];
    return hideZero ? matrix.rows.filter((r) => r.total !== 0) : matrix.rows;
  }, [matrix, hideZero]);

  // ── Heading text (dynamic per filters) ──
  const areaLabel = areaSel === "ALL" ? "ALL AREAS" : areaSel.toUpperCase();
  const supplierLabel = supplierOptions.find((s) => s.id === supplierId)?.name || "—";
  const periodLabel = monthLabel(period);
  const reportTitle = reportType === "sales" ? "AREA SALES REPORT" : "AREA PURCHASE REPORT";

  async function downloadExcel() {
    if (!matrix) return;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Area Report");
    ws.addRow([reportTitle]);
    ws.addRow([areaLabel]);
    ws.addRow([`Supplier: ${supplierLabel}`]);
    ws.addRow([`Period: ${periodLabel}`]);
    ws.addRow([]);
    const headerRow = ws.addRow(["Outlet", ...supplierItems.map((i) => i.name), "Total"]);
    headerRow.font = { bold: true };
    displayRows.forEach((r) => {
      ws.addRow([r.outlet, ...r.values, r.total]);
    });
    const totalRow = ws.addRow([
      "TOTAL",
      ...supplierItems.map((_, idx) => matrix.colTotals[idx]),
      matrix.grandTotal,
    ]);
    totalRow.font = { bold: true };
    ws.getColumn(1).width = 22;
    for (let c = 2; c <= supplierItems.length + 2; c++) ws.getColumn(c).width = 13;
    const buf = await wb.xlsx.writeBuffer();
    saveAs(
      new Blob([buf]),
      `${reportTitle.replace(/ /g, "_")}_${areaLabel.replace(/[^A-Za-z0-9]+/g, "_")}_${supplierLabel.replace(
        /[^A-Za-z0-9]+/g,
        "_"
      )}_${period}.xlsx`
    );
  }

const accent = supplierAccent(supplierId);

const stickyHeadCell = {
  position: "sticky",
  top: 0,
  background: "var(--s2)",
  color: accent,
  fontWeight: 700,
  letterSpacing: ".02em",
  borderBottom: `2px solid ${accent}55`,
  zIndex: 3,
};
const stickyFirstCol = (isHeader) => ({
  position: "sticky",
  left: 0,
  background: isHeader ? "var(--s2)" : "var(--s1)",
  color: isHeader ? accent : undefined,
  zIndex: isHeader ? 4 : 2,
});
const stickyLastCol = (isHeader) => ({
  position: "sticky",
  right: 0,
  background: isHeader
    ? "var(--s2)"
    : `color-mix(in srgb, ${accent} 10%, var(--s1))`,
  color: isHeader ? accent : undefined,
  zIndex: isHeader ? 4 : 2,
  fontWeight: 700,
});
const stickyTotalRow = {
  position: "sticky",
  bottom: 0,
  background: `color-mix(in srgb, ${accent} 22%, var(--s3))`,
  color: "#fff",
  borderTop: `2px solid ${accent}`,
  zIndex: 3,
  fontWeight: 800,
};

  return (
    <>
    <style>{`
  @media print {
    @page { size: landscape; margin: 6mm; }

    .asp-print-scroll {
      overflow: visible !important;
      max-height: none !important;
      height: auto !important;
    }

    .asp-tbl {
      width: 100% !important;
      max-width: none !important;
      table-layout: auto !important;
      border-collapse: collapse !important;
    }

    /* Compact, column-count-aware sizing instead of relying on browser print-scale */
    .asp-tbl th,
    .asp-tbl td {
      padding: 2pt 4pt !important;
      font-size: clamp(7pt, calc(11pt - var(--asp-print-cols, 8) * 0.12pt), 10pt) !important;
      line-height: 1.25 !important;
    }

    /* Brand/item header names wrap instead of forcing extra column width */
    .asp-tbl th {
      white-space: normal !important;
      word-break: break-word !important;
      vertical-align: bottom;
    }

    /* Outlet names and values stay on one line for readability */
    .asp-tbl td {
      white-space: nowrap !important;
    }

    /* Sticky positioning is meaningless on paper and can break layout */
    .asp-tbl th,
    .asp-tbl td {
      position: static !important;
    }
  }

  .asp-tbl th, .asp-tbl td { white-space: nowrap; }
`}</style>

      {/* ── FILTERS ── */}
      <div className="ctrls no-print" style={{ flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div className="ff" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--mut)", display: "block", marginBottom: 3 }}>
            Report Type
          </label>
          <div className="stabs">
            {[["sales", "Sales"], ["purchase", "Purchase"]].map(([id, label]) => (
              <button
                key={id}
                className={`stab ${reportType === id ? "act" : ""}`}
                onClick={() => setReportType(id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="ff" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--mut)", display: "block", marginBottom: 3 }}>
            Area
          </label>
          <select
            value={areaSel}
            onChange={(e) => setAreaSel(e.target.value)}
            style={{ padding: "6px 10px", background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 7, fontSize: 12.5, color: "var(--txt)", outline: "none", minWidth: 200 }}
          >
            {AREA_OPTIONS.map((a) => (
              <option key={a} value={a}>{a === "ALL" ? "All Areas" : a}</option>
            ))}
          </select>
        </div>

        <div className="ff" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--mut)", display: "block", marginBottom: 3 }}>
            Period
          </label>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            style={{ padding: "6px 10px", background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 7, fontSize: 12.5, color: "var(--txt)", outline: "none" }}
          />
        </div>

        <div className="ff" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--mut)", display: "block", marginBottom: 3 }}>
            Supplier
          </label>
          <select
            value={supplierId}
            onChange={(e) => setSupplierId(e.target.value)}
            style={{ padding: "6px 10px", background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 7, fontSize: 12.5, color: "var(--txt)", outline: "none", minWidth: 180 }}
          >
            {supplierOptions.length === 0 && <option value="">No suppliers</option>}
            {supplierOptions.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--mut)", alignSelf: "flex-end", paddingBottom: 6 }}>
          <input type="checkbox" checked={hideZero} onChange={(e) => setHideZero(e.target.checked)} />
          Hide outlets with zero total
        </label>

        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
          <button className="btn btnd btnsm" onClick={downloadExcel} disabled={!matrix}>
            {I.pkg} Excel
          </button>
          <button className="btn btnd btnsm" onClick={() => window.print()} disabled={!matrix}>
            {I.print} Print
          </button>
        </div>
      </div>

      {(invLoading || outletsLoading) && (
        <div style={{ padding: "10px 4px", fontSize: 11.5, color: "var(--mut)" }}>Loading Current Status data…</div>
      )}

      {/* ── REPORT ── */}
      <div className="card" ref={printRef}>
      <div
  className="chd asp-heading-wrap"
  style={{ "--asp-accent": supplierAccent(supplierId) }}
>
  <div>
    <h3 className="asp-title" style={{ fontWeight: 800 }}>{reportTitle}</h3>
    <p style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 6 }}>
      <span className="asp-badge asp-badge-mut">{areaLabel}</span>
      <span
        className="asp-badge"
        style={{ "--asp-accent": supplierAccent(supplierId) }}
      >
        {supplierLabel}
      </span>
      <span
        className="asp-badge"
        style={{ "--asp-accent": supplierAccent(supplierId) }}
      >
        {periodLabel}
      </span>
    </p>
  </div>
</div>

        {!supplierId || supplierItems.length === 0 ? (
          <div className="empty">No brands/items found for the selected supplier.</div>
        ) : (
         <div 
           className="asp-print-scroll"
           style={{
            overflow: "auto",
             maxHeight: "70vh",
             "--asp-print-cols": supplierItems.length, // used only by @media print font-size calc()
             }}
              >
             <table className="tbl asp-tbl" style={{ borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ ...stickyHeadCell, ...stickyFirstCol(true) }}>Outlet</th>
                   {supplierItems.map((item, idx) => (
                   <th
                   key={item.id}
                    style={{
                   ...stickyHeadCell,
                   ...(supplierItemGroupBreak[idx] ? { borderLeft: "2px solid rgba(255,255,255,.18)" } : {}),
                    }}
                    title={item.code}
                     >
                    {item.name}
                     </th>
                    ))}
                  <th style={{ ...stickyHeadCell, ...stickyLastCol(true) }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.length === 0 && (
                  <tr>
                    <td colSpan={supplierItems.length + 2}>
                      <div className="empty">No outlets/activity for this selection.</div>
                    </td>
                  </tr>
                )}
                {displayRows.map((r) => (
                  <tr key={r.outlet}>
                    <td className="bold" style={stickyFirstCol(false)}>{r.outlet}</td>
                 {r.values.map((v, idx) => (
                 <td
                 key={idx}
                 className="rt mono"
                  style={supplierItemGroupBreak[idx] ? { borderLeft: "2px solid rgba(255,255,255,.12)" } : undefined}
                 >
                 {v ? v : "—"}
                </td>
                ))}
                    <td className="rt mono" style={stickyLastCol(false)}>{r.total ? r.total : "—"}</td>
                  </tr>
                ))}
              </tbody>
              {matrix && displayRows.length > 0 && (
                <tfoot>
                  <tr>
                    <td style={{ ...stickyTotalRow, ...stickyFirstCol(true) }}>TOTAL</td>
                    {matrix.colTotals.map((v, idx) => (
                    <td
                     key={idx}
                     className="rt mono"
                     style={{
                     ...stickyTotalRow,
                      ...(supplierItemGroupBreak[idx] ? { borderLeft: "2px solid rgba(255,255,255,.22)" } : {}),
                     }}
                     >
                       {v ? v : "—"}
                     </td>
                     ))}
                     <td
                     className="rt mono"
                     style={{
                    ...stickyTotalRow,
                     ...stickyLastCol(true),
                    fontSize: 14,
                    color: accent,
                     background: `color-mix(in srgb, ${accent} 30%, var(--s3))`,
                    }}
                    >
                    {matrix.grandTotal ? matrix.grandTotal : "—"}
                   </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </>
  );
}