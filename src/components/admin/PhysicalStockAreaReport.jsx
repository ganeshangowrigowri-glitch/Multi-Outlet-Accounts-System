import { useState, useEffect, useMemo, useRef } from "react";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
import { I } from "../../utils/icons";
import { getInventoryMaster, getAPInvoices, getAPPayments } from "../../db";
import { AREAS, UNASSIGNED_AREA, getOutletArea } from "../../data/areas";
import { SUPPLIERS_LIST } from "../../data/seeds";
import { computeStockValBySupplier, computeSupplierBalanceCD, brandOf } from "../Reports";

// ─────────────────────────────────────────────────────────────────────────
//  PHYSICAL STOCK – AREA WISE  (Admin-only, read-only)
//
//  This component performs NO independent physical-stock calculation.
//  Every value comes straight from computeStockValBySupplier() and
//  computeSupplierBalanceCD() — the exact same functions Staff's
//  Reports → Stock Summary uses for its own "Supplier Stock vs Credit"
//  section. Grouping into UG/DCSL/IDL/Lion Brewery/Rockland/DCSL Beer/
//  Other Suppliers reuses brandOf() (Sales Summary's existing supplier
//  category matcher) — no hard-coded supplier ids here.
//
//  Outlet → Area grouping reuses the SAME mapping the existing
//  Area Sales & Purchase Report uses (src/data/areas.js) — no second
//  area mapping is introduced.
// ─────────────────────────────────────────────────────────────────────────

const fmt = n => Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

// Same 7 columns the report spec asks for. "OTHER" catches every supplier
// brandOf() doesn't recognise (TODDY, ROYAL CASK, USW, etc.) — identical
// fallback behaviour to Sales Summary's own "no matching brand column".
const CATS = [
  { key: "UG",           label: "UG" },
  { key: "DCSL",         label: "DCSL" },
  { key: "IDL",          label: "IDL" },
  { key: "LION BREWERY", label: "Lion Brewery" },
  { key: "RL",           label: "Rockland" },
  { key: "DCSL BEER",    label: "DCSL Beer" },
  { key: "OTHER",        label: "Other Suppliers" },
];
const EMPTY_CATS = () => Object.fromEntries(CATS.map(c => [c.key, 0]));

function monthLabel(period) {
  if (!period) return "";
  try {
    return new Date(`${period}-01`).toLocaleString("en-LK", { month: "long", year: "numeric" }).toUpperCase();
  } catch {
    return period;
  }
}

const AREA_OPTIONS = ["ALL", ...AREAS];

export default function PhysicalStockAreaReport({ outlets, toast_ }) {
  const outletNames = outlets || [];

  const [areaSel, setAreaSel] = useState("ALL");
  const [month, setMonth]     = useState(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(false);

  const [catsByOutlet, setCatsByOutlet] = useState({}); // { outlet: { UG:n, DCSL:n, ... } }
  const [rawByOutlet, setRawByOutlet]   = useState({}); // { outlet: { supplierId: val } } — feeds the credit panel

  const [expanded, setExpanded]           = useState(null); // outlet currently showing Stock vs Credit
  const [creditByOutlet, setCreditByOutlet] = useState({}); // { outlet: { supplierId: creditVal } }
  const [creditLoading, setCreditLoading]   = useState(false);

  const invMapRef = useRef(null);

  const outletsInScope = useMemo(() => {
    if (areaSel === "ALL") return outletNames;
    return outletNames.filter(o => getOutletArea(o) === areaSel);
  }, [outletNames, areaSel]);

  // Outlets grouped by area — only built for the "All Areas" view.
  const groupedOutlets = useMemo(() => {
    if (areaSel !== "ALL") return null;
    const groups = {};
    for (const a of AREAS) groups[a] = [];
    const unassigned = [];
    outletNames.forEach(o => {
      const a = getOutletArea(o);
      if (a === UNASSIGNED_AREA) unassigned.push(o);
      else (groups[a] || (groups[a] = [])).push(o);
    });
    if (unassigned.length) groups[UNASSIGNED_AREA] = unassigned;
    return groups;
  }, [outletNames, areaSel]);

  // ── Load Physical Stock for every outlet in scope, for the selected
  // month — via computeStockValBySupplier (Reports.jsx), unchanged. ──
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      if (!invMapRef.current) {
        const inv = await getInventoryMaster();
        const map = {};
        (inv || []).forEach(i => { map[i.code] = i; if (i.id) map[i.id] = i; });
        invMapRef.current = map;
      }
      const entries = await Promise.all(
        outletsInScope.map(async o => [o, await computeStockValBySupplier(o, month, invMapRef.current)])
      );
      if (cancelled) return;

            // Only these six brandOf() keys get their own column. Everything
      // else — TODDY (brandOf DOES tag this, but it has no column here),
      // ROYAL CASK, VA, JSP, BAG, USW, or any supplier brandOf() doesn't
      // recognise at all — must fold into OTHER, never be dropped.
     const MAIN_CAT_KEYS = new Set(["UG", "DCSL", "IDL", "LION BREWERY", "RL", "DCSL BEER"]);
      const raw = {}, byCat = {};
      entries.forEach(([o, bySupplier]) => {
        raw[o] = bySupplier || {};
        const cats = EMPTY_CATS();
        let totalStock = 0;
        Object.entries(bySupplier || {}).forEach(([supId, val]) => {
          const v = Number(val) || 0;
          totalStock += v;
          const bk = brandOf(supId);
          // Only the six main categories get bucketed by brandOf(); every other
          // supplier is captured below via the total-minus-six formula, so no
          // supplier can ever be silently dropped or double-counted.
          if (MAIN_CAT_KEYS.has(bk)) cats[bk] = (cats[bk] || 0) + v;
        });
        const mainSum = CATS.reduce((a, c) => a + (c.key === "OTHER" ? 0 : (cats[c.key] || 0)), 0);
        cats.OTHER = totalStock - mainSum;
        byCat[o] = cats;
      });
      setRawByOutlet(raw);
      setCatsByOutlet(byCat);
      setLoading(false);
    })().catch(err => {
      console.error("PhysicalStockAreaReport load error:", err);
      toast_ && toast_("Failed to load physical stock data", "err");
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outletsInScope, month]);

  // Selected month changed → any cached credit-detail is for the old
  // month, so drop it (recomputed lazily next time a row is expanded).
  useEffect(() => { setCreditByOutlet({}); setExpanded(null); }, [month]);

  // ── Supplier Stock vs Credit — lazy per outlet, reuses
  // computeSupplierBalanceCD verbatim (same function Stock Summary uses). ──
  async function toggleExpand(outlet) {
    if (expanded === outlet) { setExpanded(null); return; }
    setExpanded(outlet);
    if (creditByOutlet[outlet]) return;
    setCreditLoading(true);
    try {
      const [apInvoices, apPayments] = await Promise.all([getAPInvoices(outlet), getAPPayments(outlet)]);
      const pairs = await Promise.all(
        SUPPLIERS_LIST.map(async s => [s.id, await computeSupplierBalanceCD(outlet, month, s.id, apInvoices, apPayments)])
      );
      setCreditByOutlet(prev => ({ ...prev, [outlet]: Object.fromEntries(pairs) }));
    } catch (err) {
      console.error("Supplier credit load error:", err);
      toast_ && toast_("Failed to load supplier credit detail", "err");
    } finally {
      setCreditLoading(false);
    }
  }

   // Reused by both the overall total and each area's own subtotal row
  // (see OutletTable below) — always sums exactly the outlets displayed
  // in that table, for the selected month only.
  function categoryTotalsFor(list) {
    const t = EMPTY_CATS();
    list.forEach(o => {
      const c = catsByOutlet[o];
      if (!c) return;
      CATS.forEach(cat => { t[cat.key] += Number(c[cat.key]) || 0; });
    });
    return t;
  }

  const colTotals = useMemo(
    () => categoryTotalsFor(outletsInScope),
    [outletsInScope, catsByOutlet] // eslint-disable-line react-hooks/exhaustive-deps
  );

  const grandTotal = CATS.reduce((a, c) => a + (colTotals[c.key] || 0), 0);

  const areaLabel   = areaSel === "ALL" ? "ALL AREAS" : areaSel.toUpperCase();
  const periodLabel = monthLabel(month);

  async function downloadExcel() {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Physical Stock");
    ws.addRow([`PHYSICAL STOCK — ${areaLabel} — ${periodLabel}`]);
    ws.addRow([]);
    const header = ws.addRow(["Area", "Outlet", ...CATS.map(c => c.label), "Total"]);
    header.font = { bold: true };

    const addOutletRow = (area, o) => {
      const c = catsByOutlet[o] || {};
      const vals = CATS.map(cat => Number(c[cat.key]) || 0);
      const total = vals.reduce((a, v) => a + v, 0);
      ws.addRow([area, o, ...vals, total]);
    };

    if (areaSel === "ALL" && groupedOutlets) {
      AREAS.concat([UNASSIGNED_AREA]).forEach(area => {
        (groupedOutlets[area] || []).forEach(o => addOutletRow(area, o));
      });
    } else {
      outletsInScope.forEach(o => addOutletRow(areaLabel, o));
    }

    const totalRow = ws.addRow(["", "TOTAL", ...CATS.map(c => colTotals[c.key] || 0), grandTotal]);
    totalRow.font = { bold: true };
    ws.getColumn(1).width = 20;
    ws.getColumn(2).width = 22;
    for (let c = 3; c <= CATS.length + 3; c++) ws.getColumn(c).width = 14;

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `Physical_Stock_${areaLabel.replace(/[^A-Za-z0-9]+/g, "_")}_${month}.xlsx`);
  }

  const th = { padding: "8px 10px", fontSize: 9.5, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--gld2)", background: "var(--s3)", borderBottom: "1px solid var(--bdr)", whiteSpace: "nowrap", textAlign: "right" };
  const td = (bold) => ({ padding: "6px 10px", fontSize: 12, fontFamily: "'JetBrains Mono',monospace", textAlign: "right", borderBottom: "1px solid rgba(63,63,70,.15)", fontWeight: bold ? 700 : 400, whiteSpace: "nowrap" });

    function SupplierCreditPanel({ outlet }) {
    const data = creditByOutlet[outlet];
    if (creditLoading && !data) {
      return <div style={{ padding: 14, fontSize: 11.5, color: "var(--mut)" }}>Loading supplier stock vs credit…</div>;
    }
    if (!data) return null;
    const stockVal = rawByOutlet[outlet] || {};
    const knownIds = new Set(SUPPLIERS_LIST.map(s => s.id));
    // Any supplier ID present in the raw physical-stock data but NOT in
    // SUPPLIERS_LIST was previously invisible here — its stock still fed
    // correctly into OTHER SUPPLIERS (and this outlet's TOTAL), but with
    // no matching master-list entry there was no row to show it on. This
    // surfaces it under its raw ID so it can be identified/reconciled
    // rather than silently making OTHER SUPPLIERS look "wrong".
    const unlistedRows = Object.keys(stockVal)
      .filter(id => !knownIds.has(id))
      .map(id => ({ name: `${id} (not in supplier master)`, id, stockVal: stockVal[id] || 0, creditVal: 0 }));
    const rows = [...SUPPLIERS_LIST
      .map(s => ({ name: s.name, id: s.id, stockVal: stockVal[s.id] || 0, creditVal: data[s.id] || 0 })), ...unlistedRows]
      .filter(r => Math.abs(r.stockVal) > 0.5 || Math.abs(r.creditVal) > 0.5);
    return (
      <div style={{ padding: "10px 16px", background: "var(--s1)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--gld2)", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".04em" }}>
          Supplier Stock vs Credit — {outlet}
        </div>
        {rows.length === 0 ? (
          <div style={{ fontSize: 11.5, color: "var(--mut)" }}>No supplier stock or credit balances.</div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Supplier</th>
                <th style={th}>Stock Value (at cost)</th>
                <th style={th}>Credit Outstanding</th>
                <th style={{ ...th, textAlign: "left" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id}>
                  <td style={{ ...td(false), textAlign: "left" }}>{r.name}</td>
                  <td style={td(false)}>{fmt(r.stockVal)}</td>
                  <td style={td(false)}>{fmt(r.creditVal)}</td>
                  <td style={{ ...td(false), textAlign: "left", color: r.stockVal >= r.creditVal ? "var(--grn)" : "var(--red)", fontWeight: 600 }}>
                    {r.stockVal >= r.creditVal ? "P/STOCK HIGH" : "CREDIT HIGH"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    );
  }

 function OutletTable({ list, areaHeading, grandOnly = false }) {
    if (!list.length) return null;
    const subtotal = categoryTotalsFor(list);
    const subtotalSum = CATS.reduce((a, c) => a + (subtotal[c.key] || 0), 0);
    return (
      <div style={{ marginBottom: 18 }}>
        {areaHeading && (
          <div style={{ padding: "8px 12px", fontWeight: 700, fontSize: 12.5, color: "var(--gld2)", background: "var(--s2)", borderRadius: "8px 8px 0 0", border: "1px solid var(--bdr)", borderBottom: "none" }}>
            {areaHeading}
          </div>
        )}
        <div
          className="ps-scroll"
          style={{ overflowX: "auto", border: "1px solid var(--bdr)", borderRadius: areaHeading ? "0 0 8px 8px" : 8, "--ps-print-cols": CATS.length + 2 }}
        >
          <table className="ps-tbl" style={{ width: "100%", borderCollapse: "collapse", minWidth: 780 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Outlet</th>
                {CATS.map(c => <th key={c.key} style={th}>{c.label}</th>)}
                <th style={th}>Total</th>
              </tr>
            </thead>
            {!grandOnly && (
              <tbody>
                {list.flatMap(o => {
                const c = catsByOutlet[o] || {};
                const vals = CATS.map(cat => Number(c[cat.key]) || 0);
                const total = vals.reduce((a, v) => a + v, 0);
                const isOpen = expanded === o;

                const rows = [
                  <tr key={o} className="ps-row" onClick={() => toggleExpand(o)}>
                    <td style={{ ...td(false), textAlign: "left", color: "var(--gld2)", cursor: "pointer" }}>
                      <span className="expand-arrow">{isOpen ? "▾ " : "▸ "}</span>{o}
                    </td>
                    {vals.map((v, i) => <td key={i} style={td(false)}>{v > 0 ? fmt(v) : "-"}</td>)}
                    <td style={td(true)}>{total > 0 ? fmt(total) : "-"}</td>
                  </tr>,
                ];
                if (isOpen) {
                  rows.push(
                    <tr key={`${o}-credit`} className="no-print">
                      <td colSpan={CATS.length + 2} style={{ padding: 0 }}>
                        <SupplierCreditPanel outlet={o} />
                      </td>
                    </tr>
                  );
                }
                return rows;
               })}
              </tbody>
            )}
            <tfoot>
              <tr style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr2,var(--bdr))" }}>
                <td style={{ ...td(true), textAlign: "left" }}>TOTAL</td>
                {CATS.map(c => (
                  <td key={c.key} style={td(true)}>{subtotal[c.key] > 0 ? fmt(subtotal[c.key]) : "-"}</td>
                ))}
                <td style={td(true)}>{subtotalSum > 0 ? fmt(subtotalSum) : "-"}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .expand-arrow { display: none !important; }
        }
      `}</style>

      <div className="ctrls no-print" style={{ flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div className="ff" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--mut)", display: "block", marginBottom: 3 }}>Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            style={{ padding: "6px 10px", background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 7, fontSize: 12.5, color: "var(--txt)", outline: "none" }} />
        </div>
        <div className="ff" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--mut)", display: "block", marginBottom: 3 }}>Area</label>
          <select value={areaSel} onChange={e => setAreaSel(e.target.value)}
            style={{ padding: "6px 10px", background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 7, fontSize: 12.5, color: "var(--txt)", outline: "none", minWidth: 200 }}>
            {AREA_OPTIONS.map(a => <option key={a} value={a}>{a === "ALL" ? "All Areas" : a}</option>)}
          </select>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignSelf: "flex-end" }}>
          <button className="btn btnd btnsm" onClick={downloadExcel} disabled={loading}>{I.pkg} Excel</button>
          <button className="btn btnd btnsm" onClick={() => window.print()} disabled={loading}>{I.print} Print</button>
        </div>
      </div>

      <div className="card">
        <div className="chd">
          <h3 style={{ fontWeight: 800 }}>PHYSICAL STOCK — {areaLabel} — {periodLabel}</h3>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: "center", color: "var(--mut)" }}>Loading physical stock…</div>
        ) : outletsInScope.length === 0 ? (
          <div className="empty">No outlets found for this selection.</div>
        ) : areaSel === "ALL" && groupedOutlets ? (
          <div style={{ padding: 14 }}>
            {AREAS.concat([UNASSIGNED_AREA]).map(a => (
              <OutletTable key={a} list={groupedOutlets[a] || []} areaHeading={a} />
            ))}
          </div>
        ) : (
          <div style={{ padding: 14 }}>
            <OutletTable list={outletsInScope} />
          </div>
        )}

        {!loading && outletsInScope.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 20px", fontSize: 14, fontWeight: 700, background: "var(--s3)", borderTop: "2px solid var(--bdr2,var(--bdr))" }}>
            <span>TOTAL — {areaLabel}</span>
            <span style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--grn)" }}>Rs.{fmt(grandTotal)}</span>
          </div>
        )}
      </div>
    </>
  );
}