// src/components/staff/S_Purchase.jsx
import { useState } from "react";
import { ls, lss, fmt, oKey, today } from "../../utils/helpers";
import { uid, postCash, postGL } from "../../utils/helpers";
import { I } from "../../utils/icons";
import { SEED_INVENTORY, SUPPLIERS_LIST, COA_DEF } from "../../data/seeds";
import { loadEmptyFromStorage } from "../admin/InventoryAdmin";

export default function S_Purchase({ outlet, user, toast_ }) {

  const inv = ls("inv_main", SEED_INVENTORY);
  const emptyInv = loadEmptyFromStorage();
  const extraSuppliers = ls("extra_suppliers", []);
  const extraSupIds = extraSuppliers.map(s => s.id);
  const mergedSuppliers = [
    ...SUPPLIERS_LIST.filter(s => !extraSupIds.includes(s.id)),
    ...extraSuppliers.map(s => ({ id: s.id, name: s.name || s.id })),
    { id: "EMPTY PURCHASE", name: "EMPTY PURCHASE" },  // ← add this
  ];

  const [subTab,     setSubTab]     = useState("received");
  const [date,       setDate]       = useState(today());
  const [supId, setSupId] = useState(mergedSuppliers[0]?.id || "");
  const [invNo,      setInvNo]      = useState("");
  const [lateCharge, setLateCharge] = useState("");
  const [lines,      setLines]      = useState([{ id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", unitCost: "", discount: "", amount: 0 }]);

  const [trDate,  setTrDate]  = useState(today());
  const [trType,  setTrType]  = useState("in");
  const [trLines, setTrLines] = useState([{ id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", unitCost: "", stockValue: 0 }]);

  // AR account dropdown (1200–1299) for Transfer Out
  const allCOA    = ls("coa_accounts", COA_DEF);
  const arAccList = allCOA.filter(a => a.id >= "1200" && a.id <= "1299");
  const [trAcc, setTrAcc] = useState(arAccList[0]?.id || "");

  const [retDate,  setRetDate]  = useState(today());
  const [retLines, setRetLines] = useState([{ id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", sellingPrice: "", stockValue: 0 }]);

 // ── Line update helpers ──
  function updL(id, f, v) {
    setLines(p => p.map(l => {
      if (l.id !== id) return l;
      const u = { ...l, [f]: v };
      if (f === "itemCode") {
        const isEmptySup = supId === "EMPTY PURCHASE";
        const it = isEmptySup
          ? emptyInv.find(i => i.code === v && i.supplier === "EMPTY PURCHASE")
          : inv.find(i => i.code === v && i.supplier === supId)
            || emptyInv.find(i =>
                i.code === v && (
                  i.supplier === supId ||
                  supId.endsWith(i.supplier)
                )
              );
        if (it) { u.itemName = it.name; u.unitCost = it.unitCost; }
      }
      const g  = (parseFloat(u.qty) || 0) * (parseFloat(u.unitCost) || 0);
      u.amount = g - (parseFloat(u.discount) || 0);
      return u;
    }));
  }

  function updTL(id, f, v) {
    setTrLines(p => p.map(l => {
      if (l.id !== id) return l;
      const u = { ...l, [f]: v };
      if (f === "itemCode") {
        const it = inv.find(i => i.code === v);
        if (it) { u.itemName = it.name; u.unitCost = it.unitCost; }
      }
      u.stockValue = (parseFloat(u.qty) || 0) * (parseFloat(u.unitCost) || 0);
      return u;
    }));
  }

  function updRL(id, f, v) {
    setRetLines(p => p.map(l => {
      if (l.id !== id) return l;
      const u = { ...l, [f]: v };
      if (f === "itemCode") {
        const it = inv.find(i => i.code === v);
        if (it) { u.itemName = it.name; u.sellingPrice = it.sellingPrice; }
      }
      u.stockValue = (parseFloat(u.qty) || 0) * (parseFloat(u.sellingPrice) || 0);
      return u;
    }));
  }

  const subtotal   = lines.reduce((a, l) => a + (l.amount || 0), 0);
  const totalDisc  = lines.reduce((a, l) => a + (parseFloat(l.discount) || 0), 0);
  const grandTotal = subtotal - (parseFloat(lateCharge) || 0);

  // ── Save purchase ──
  function savePurchase() {
    if (!invNo || !lines[0].itemCode) { toast_("Fill invoice no and at least one item", "err"); return; }

    const rec = { id: uid(), date, supId, invoiceNo: invNo, lines, subtotal, totalDisc, lateCharge: parseFloat(lateCharge) || 0, grandTotal, outlet, by: user.username };

    const purs  = ls(oKey(outlet, "purchases"),   []); lss(oKey(outlet, "purchases"),   [rec, ...purs]);
    const apInv = ls(oKey(outlet, "ap_invoices"), []); lss(oKey(outlet, "ap_invoices"), [{ ...rec }, ...apInv]);

    postGL(outlet, { date, accountId: "1300", description: `Purchase ${supId} Inv:${invNo}`, debit: grandTotal, credit: 0 });
    postGL(outlet, { date, accountId: "2000", description: `AP ${supId} Inv:${invNo}`,       debit: 0, credit: grandTotal });

    toast_("Purchase saved ✓");
    setLines([{ id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", unitCost: "", discount: "", amount: 0 }]);
    setInvNo("");
    setLateCharge("");
  }

  // ── Save transfer ──
  function saveTransfer() {
    if (!trAcc || !trLines[0].itemCode) { toast_("Fill account and items", "err"); return; }

    const total = trLines.reduce((a, l) => a + (l.stockValue || 0), 0);
    const rec   = { id: uid(), date: trDate, type: trType, account: trAcc, lines: trLines, total, outlet, by: user.username };

    const trs = ls(oKey(outlet, "transfers"), []);
    lss(oKey(outlet, "transfers"), [rec, ...trs]);

    if (trType === "out") {
      // Post to AR ledger with selected account ID
      const arL = ls(oKey(outlet, "ar_ledger"), []);
      lss(oKey(outlet, "ar_ledger"), [...arL, {
        id:          uid(),
        date:        trDate,
        description: `Transfer Out to ${trAcc}`,
        type:        "dr",
        amount:      total,
        accountId:   trAcc,
      }]);
      postGL(outlet, { date: trDate, accountId: trAcc, description: `Transfer Out to ${trAcc}`, debit: total, credit: 0 });
    } else {
      postGL(outlet, { date: trDate, accountId: "2100", description: `Transfer In from ${trAcc}`, debit: 0, credit: total });
    }

    toast_(`Transfer ${trType === "in" ? "In" : "Out"} saved ✓`);
    setTrLines([{ id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", unitCost: "", stockValue: 0 }]);
    setTrAcc(arAccList[0]?.id || "");
  }

  // ── Save return ──
  function saveReturn() {
    if (!retLines[0].itemCode) { toast_("Add at least one item", "err"); return; }

    const total = retLines.reduce((a, l) => a + (l.stockValue || 0), 0);
    const rec   = { id: uid(), date: retDate, lines: retLines, total, outlet, by: user.username };

    const rets = ls(oKey(outlet, "returns"), []);
    lss(oKey(outlet, "returns"), [rec, ...rets]);

    postCash(outlet, { date: retDate, description: "Return Goods", type: "out", amount: total });
    postGL(outlet,   { date: retDate, accountId: "4001", description: "Return Goods", debit: total, credit: 0 });

    toast_("Return saved ✓");
    setRetLines([{ id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", sellingPrice: "", stockValue: 0 }]);
  }

  return (
    <>
      {/* ── Sub tabs ── */}
      <div className="subtabs">
        {[["received", "Purchase Received"], ["transfer", "Transfer Goods"], ["returns", "Return Goods"]].map(([id, lbl]) => (
          <button key={id} className={`subtab ${subTab === id ? "act" : ""}`} onClick={() => setSubTab(id)}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════
          TAB 1 — Purchase Received
      ══════════════════════════════════════════ */}
      {subTab === "received" && (
        <div className="card">
          <div className="chd"><h3>Purchase Received</h3></div>
          <div style={{ padding: 14 }}>

            <div className="fg3">
              <div className="ff">
                <label>Date</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="ff">
                <label>Supplier</label>
                <select value={supId} onChange={e => setSupId(e.target.value)}>
                  {mergedSuppliers.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
                </select>
              </div>
              <div className="ff">
                <label>Invoice No *</label>
                <input placeholder="INV-0001" value={invNo} onChange={e => setInvNo(e.target.value)} />
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="tbl tin">
                <thead>
                  <tr>
                    <th>#</th><th>Item Code</th><th>Description</th><th>Type</th>
                    <th>Unit Cost</th><th>Qty</th><th>Value</th><th>Discount</th><th>Amount</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={l.id}>
                      <td style={{ width: 25, color: "var(--mut)", fontSize: 10 }}>{i + 1}</td>
                      <td>
                        <select value={l.itemCode} onChange={e => updL(l.id, "itemCode", e.target.value)} style={{ width: 85 }}>
                          <option value="">Select…</option>
                          {(supId === "EMPTY PURCHASE"
  ? emptyInv.filter(it => it.supplier === "EMPTY PURCHASE")
  : [
      ...inv.filter(it => it.supplier === supId && it.type !== "EMP"), // ← exclude EMP type
      ...emptyInv.filter(it =>
        it.supplier === supId ||
        supId.endsWith(it.supplier)
      )
    ]
).map(it => (
  <option key={it.id || it.code} value={it.code}>{it.code}</option>
))}
                        </select>
                      </td>
                      <td style={{ fontSize: 10.5, color: "var(--mut)" }}>{l.itemName || "—"}</td>
                      <td>
                        <select value={l.type} onChange={e => updL(l.id, "type", e.target.value)} style={{ width: 50 }}>
                          {["Q", "P", "N", "CN", "5N", "5Q"].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      <td><input type="number" value={l.unitCost || ""} onChange={e => updL(l.id, "unitCost", e.target.value)} style={{ width: 75 }} /></td>
                      <td><input type="number" value={l.qty      || ""} onChange={e => updL(l.id, "qty",      e.target.value)} style={{ width: 50 }} /></td>
                      <td className="mono">{fmt((parseFloat(l.qty) || 0) * (parseFloat(l.unitCost) || 0))}</td>
                      <td><input type="number" value={l.discount  || ""} onChange={e => updL(l.id, "discount", e.target.value)} style={{ width: 65 }} /></td>
                      <td className="mono bold">Rs.{fmt(l.amount)}</td>
                      <td><button className="btndel" onClick={() => setLines(p => p.filter(x => x.id !== l.id))}>{I.trash}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="addrow" onClick={() => setLines(p => [...p, { id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", unitCost: "", discount: "", amount: 0 }])}>
              {I.plus} Add Item
            </button>

            <div className="totbox">
              <div className="totr"><span className="totl">Total</span><span className="totv">Rs.{fmt(subtotal)}</span></div>
              <div className="totr"><span className="totl">Discount Received</span><span className="totv cg">- Rs.{fmt(totalDisc)}</span></div>
              <div className="ff" style={{ marginTop: 8, maxWidth: 180 }}>
                <label>Late Payment Charge</label>
                <input type="number" placeholder="0.00" value={lateCharge} onChange={e => setLateCharge(e.target.value)} />
              </div>
              <div className="totr grand"><span>Balance</span><span className="totv cr">Rs.{fmt(grandTotal)}</span></div>
            </div>

            <button className="btn btng" style={{ marginTop: 12 }} onClick={savePurchase}>{I.check} Save Purchase</button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB 2 — Transfer Goods
      ══════════════════════════════════════════ */}
      {subTab === "transfer" && (
        <div className="card">
          <div className="chd"><h3>Transfer Goods</h3></div>
          <div style={{ padding: 14 }}>

            {/* In / Out toggle */}
            <div style={{ display: "flex", gap: 7, marginBottom: 12 }}>
              <button className={`btn ${trType === "in"  ? "btng" : "btnd"}`} onClick={() => setTrType("in")}>← Transfer In</button>
              <button className={`btn ${trType === "out" ? "btng" : "btnd"}`} onClick={() => setTrType("out")}>Transfer Out →</button>
            </div>

            <div className="fg">
              <div className="ff">
                <label>Date</label>
                <input type="date" value={trDate} onChange={e => setTrDate(e.target.value)} />
              </div>
              <div className="ff">
                <label>{trType === "in" ? "AP Account (From)" : "AR Account (To)"}</label>
                {trType === "out" ? (
                  <select value={trAcc} onChange={e => setTrAcc(e.target.value)}>
                    {arAccList.length === 0
                      ? <option value="">No AR accounts (1200–1299) found</option>
                      : arAccList.map(a => <option key={a.id} value={a.id}>{a.id} — {a.name}</option>)
                    }
                  </select>
                ) : (
                  <input
                    placeholder="2100 - Transfer Good In"
                    value={trAcc}
                    onChange={e => setTrAcc(e.target.value)}
                  />
                )}
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="tbl tin">
                <thead>
                  <tr>
                    <th>#</th><th>Item Code</th><th>Description</th><th>Type</th>
                    <th>Qty</th><th>Unit Cost</th><th>Stock Value</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {trLines.map((l, i) => (
                    <tr key={l.id}>
                      <td style={{ width: 25, color: "var(--mut)", fontSize: 10 }}>{i + 1}</td>
                      <td>
                        <select value={l.itemCode} onChange={e => updTL(l.id, "itemCode", e.target.value)} style={{ width: 85 }}>
                          <option value="">Select…</option>
                          {inv.map(it => <option key={it.code} value={it.code}>{it.code} — {it.name}</option>)}
                        </select>
                      </td>
                      <td style={{ fontSize: 10.5, color: "var(--mut)" }}>{l.itemName || "—"}</td>
                      <td>
                        <select value={l.type} onChange={e => updTL(l.id, "type", e.target.value)} style={{ width: 50 }}>
                          {["Q", "P", "N", "CN", "5N", "5Q"].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      <td><input type="number" value={l.qty      || ""} onChange={e => updTL(l.id, "qty",      e.target.value)} style={{ width: 50 }} /></td>
                      <td><input type="number" value={l.unitCost || ""} onChange={e => updTL(l.id, "unitCost", e.target.value)} style={{ width: 75 }} /></td>
                      <td className="mono bold" style={{ color: trType === "in" ? "var(--grn)" : "var(--red)" }}>
                        Rs.{fmt(l.stockValue)}
                      </td>
                      <td><button className="btndel" onClick={() => setTrLines(p => p.filter(x => x.id !== l.id))}>{I.trash}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="addrow" onClick={() => setTrLines(p => [...p, { id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", unitCost: "", stockValue: 0 }])}>
              {I.plus} Add Item
            </button>

            <div className="totbox">
              <div className="totr grand">
                <span>Total Stock Value</span>
                <span className="totv">Rs.{fmt(trLines.reduce((a, l) => a + (l.stockValue || 0), 0))}</span>
              </div>
            </div>

            {trType === "out" && (
              <div className="nbox nb-a" style={{ marginTop: 8 }}>
                ⚠ Transfer Out will post to AR account <strong>{trAcc}</strong>
                {allCOA.find(a => a.id === trAcc) ? ` — ${allCOA.find(a => a.id === trAcc).name}` : ""}.
              </div>
            )}

            <button className="btn btng" style={{ marginTop: 12 }} onClick={saveTransfer}>
              {I.check} Save Transfer {trType === "in" ? "In" : "Out"}
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════
          TAB 3 — Return Goods
      ══════════════════════════════════════════ */}
      {subTab === "returns" && (
        <div className="card">
          <div className="chd"><h3>Return Goods</h3></div>
          <div style={{ padding: 14 }}>

            <div className="ff" style={{ maxWidth: 170, marginBottom: 12 }}>
              <label>Date</label>
              <input type="date" value={retDate} onChange={e => setRetDate(e.target.value)} />
            </div>

            <div style={{ overflowX: "auto" }}>
              <table className="tbl tin">
                <thead>
                  <tr>
                    <th>#</th><th>Item Code</th><th>Description</th><th>Type</th>
                    <th>Qty</th><th>Selling Price</th><th>Return Value</th><th></th>
                  </tr>
                </thead>
                <tbody>
                  {retLines.map((l, i) => (
                    <tr key={l.id}>
                      <td style={{ width: 25, color: "var(--mut)", fontSize: 10 }}>{i + 1}</td>
                      <td>
                        <select value={l.itemCode} onChange={e => updRL(l.id, "itemCode", e.target.value)} style={{ width: 85 }}>
                          <option value="">Select…</option>
                          {inv.map(it => <option key={it.code} value={it.code}>{it.code} — {it.name}</option>)}
                        </select>
                      </td>
                      <td style={{ fontSize: 10.5, color: "var(--mut)" }}>{l.itemName || "—"}</td>
                      <td>
                        <select value={l.type} onChange={e => updRL(l.id, "type", e.target.value)} style={{ width: 50 }}>
                          {["Q", "P", "N", "CN"].map(t => <option key={t}>{t}</option>)}
                        </select>
                      </td>
                      <td><input type="number" value={l.qty          || ""} onChange={e => updRL(l.id, "qty",          e.target.value)} style={{ width: 50 }} /></td>
                      <td><input type="number" value={l.sellingPrice || ""} onChange={e => updRL(l.id, "sellingPrice", e.target.value)} style={{ width: 75 }} /></td>
                      <td className="mono bold cr">Rs.{fmt(l.stockValue)}</td>
                      <td><button className="btndel" onClick={() => setRetLines(p => p.filter(x => x.id !== l.id))}>{I.trash}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="addrow" onClick={() => setRetLines(p => [...p, { id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", sellingPrice: "", stockValue: 0 }])}>
              {I.plus} Add Item
            </button>

            <div className="totbox">
              <div className="totr grand">
                <span>Total Return Value</span>
                <span className="totv cr">Rs.{fmt(retLines.reduce((a, l) => a + (l.stockValue || 0), 0))}</span>
              </div>
            </div>

            <div className="nbox nb-r" style={{ marginTop: 8 }}>
              ⚠ Return value will be auto-deducted from In Hand Cash.
            </div>

            <button className="btn btng" style={{ marginTop: 12 }} onClick={saveReturn}>
              {I.check} Save Return
            </button>
          </div>
        </div>
      )}
    </>
  );
} 