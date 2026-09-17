import { useState, useEffect, useMemo } from "react";
import { fmt, today } from "../../utils/helpers";
import { getPriceHistoryStock, upsertPriceHistoryStock } from "../../db";


function buildHistoryRows(masterInv, overridesMain) {
  const rows = [];
  (masterInv || []).forEach(item => {
    if (item.type === "EMP") return;
    const ovKey = `${item.code}__${item.supplier}`;
    const hist = (overridesMain[ovKey]?.priceHistory || [])
      .slice()
      .sort((a, b) => a.date.localeCompare(b.date));
    hist.forEach((h, i) => {
      const oldCost = i > 0 ? hist[i - 1].unitCost : item.unitCost;
      rows.push({
        rowKey:   `${ovKey}__${h.date}`,
        itemKey:  ovKey,
        date:     h.date,
        supplier: item.supplier,
        name:     item.name,
        type:     item.type,
        newCost:  h.unitCost,
        oldCost,
        margin:   h.unitCost - oldCost,
      });
    });
  });
  return rows.sort((a, b) => b.date.localeCompare(a.date));
}

export default function S_PriceHistory({ outlet, masterInv, outletOverridesMain }) {
  const [month, setMonth]           = useState(() => today().slice(0, 7)); // "YYYY-MM"
  const [stockMap, setStockMap]     = useState({});   // persisted: rowKey -> stock
  const [localStock, setLocalStock] = useState({});   // in-progress edits before blur

  // Load persisted Stock values for this outlet once, and whenever outlet changes.
  useEffect(() => {
    getPriceHistoryStock(outlet).then(setStockMap);
  }, [outlet]);

  const allRows = useMemo(
    () => buildHistoryRows(masterInv, outletOverridesMain),
    [masterInv, outletOverridesMain]
  );

  const rows = useMemo(
    () => allRows.filter(r => r.date.slice(0, 7) === month),
    [allRows, month]
  );

  const stockFor = rowKey =>
    localStock[rowKey] !== undefined ? localStock[rowKey] : (stockMap[rowKey] ?? "");

  const onStockChange = (rowKey, v) =>
    setLocalStock(prev => ({ ...prev, [rowKey]: v }));

  async function onStockBlur(row) {
    if (localStock[row.rowKey] === undefined) return;
    const num = parseFloat(localStock[row.rowKey]) || 0;
    setStockMap(prev => ({ ...prev, [row.rowKey]: num }));
    try {
      await upsertPriceHistoryStock(outlet, row.itemKey, row.date, num);
    } catch (err) {
      console.error("upsertPriceHistoryStock:", err);
    }
  }

  const total = rows.reduce((a, r) => a + r.margin * (Number(stockFor(r.rowKey)) || 0), 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 4px" }}>
        <label style={{ fontSize: 11, color: "var(--mut)" }}>Month</label>
        <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
        <span style={{ fontSize: 11, color: "var(--mut)" }}>
          {rows.length} price change{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        <table className="tbl tin">
          <thead>
            <tr>
              <th>Date</th><th>Supplier</th><th>Items</th><th>Type</th>
              <th>New Cost</th><th>Old Cost</th><th>Margin</th><th>Stock</th><th>Value</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const stock = Number(stockFor(r.rowKey)) || 0;
              const value = r.margin * stock;
              return (
                <tr key={r.rowKey}>
                  <td>{r.date}</td>
                  <td>{r.supplier}</td>
                  <td>{r.name}</td>
                  <td>{r.type}</td>
                  <td className="mono">{fmt(r.newCost)}</td>
                  <td className="mono">{fmt(r.oldCost)}</td>
                  <td className="mono" style={{ color: r.margin >= 0 ? "var(--grn)" : "var(--red)" }}>
                    {fmt(r.margin)}
                  </td>
                  <td>
                    <input
                      type="number"
                      value={stockFor(r.rowKey)}
                      onChange={e => onStockChange(r.rowKey, e.target.value)}
                      onBlur={() => onStockBlur(r)}
                      style={{ width: 70 }}
                    />
                  </td>
                  <td className="mono bold">{fmt(value)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} style={{ textAlign: "center", color: "var(--mut)", padding: 20 }}>
                  No price changes recorded for this month.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr style={{ background: "var(--s3)", fontWeight: 700 }}>
              <td colSpan={8} style={{ textAlign: "right", paddingRight: 12 }}>TOTAL</td>
              <td className="mono bold">{fmt(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}