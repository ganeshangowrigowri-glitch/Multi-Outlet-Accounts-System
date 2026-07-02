// src/components/staff/S_Purchase.jsx
import { useState, useEffect } from "react";
import { fmt, oKey, today } from "../../utils/helpers";
import { uid } from "../../utils/helpers";
import { I } from "../../utils/icons";
import { SEED_INVENTORY, SUPPLIERS_LIST, COA_DEF } from "../../data/seeds";
import { loadEmptyFromStorage } from "../admin/InventoryAdmin";
import { outletInvKey } from "../admin/InventoryAdmin";
import {
  addPurchase, addAPInvoice, addGLEntry,
  addCashEntry, addTransfer, addAREntry, addReturn,
  getCOA, getInventoryMaster, getSuppliers, getEmptyInventoryMaster,
} from "../../db";
// ── Helper: apply outlet-specific price overrides (same logic as Daily Sale) ──
function applyOutletOverrides(masterItems, outlet) {
  const overrides = (() => {
    try {
      return JSON.parse(localStorage.getItem(outletInvKey(outlet)) || "{}");
    } catch { return {}; }
  })();

  return masterItems
    .filter(item => {
      const ovKey = `${item.code}__${item.supplier}`;
      return item.type !== "EMP" && !overrides[ovKey]?.hidden;
    })
    .map(item => {
      const ovKey = `${item.code}__${item.supplier}`;
      const ov = overrides[ovKey];
      return {
        ...item,
        unitCost:     ov?.unitCost     !== undefined ? ov.unitCost     : item.unitCost,
        sellingPrice: ov?.sellingPrice !== undefined ? ov.sellingPrice : item.sellingPrice,
      };
    });
}

export default function S_Purchase({ outlet, user, toast_ }) {

  // ── Load from Supabase (inv_main & COA) but keep emptyInv & extra suppliers from localStorage ──
  const [inv,            setInv]     = useState(SEED_INVENTORY);
  const [emptyInvState,  setEmptyInv] = useState([]);
  const [allCOA,         setCOA]     = useState(COA_DEF);
  const [suppliersReady, setReady]   = useState(false);
  const [saving, setSaving] = useState(false);

  // AFTER
const SUP_ORDER = [
  "2001-DCSL","2003-UG","2005-ROCKLAND","2004-IDL","2006-DCSL BEER",
  "2002-LION BREWERY","2007-TODDY","2008-ROYAL CASK","2009-LUXURY BRAND",
  "2010-B LANKA","2011-USW","2012-PREMERA","2013-JSP","2014-SIGNATURE",
  "2015-VA","2016-VICTORY","2017-FAVOURITE","2018-FREE LANKA",
  "2019-BAG","2020-SODA","2021-GOLD LEAF","2022-BITE","2023-KASTHURI W/S",
];

useEffect(() => {
  getInventoryMaster().then(data => {
    if (data.length) {
      const sorted = [...data.filter(i => i.type !== "EMP")].sort((a, b) => {
        const oi = SUP_ORDER.indexOf(a.supplier);
        const oj = SUP_ORDER.indexOf(b.supplier);
        const supCmp = (oi === -1 ? 999 : oi) - (oj === -1 ? 999 : oj);
        if (supCmp !== 0) return supCmp;
        const numA = parseInt((a.code || "").replace(/\D/g, "")) || 0;
        const numB = parseInt((b.code || "").replace(/\D/g, "")) || 0;
        return numA - numB;
      });
      // ✅ Apply outlet-specific price overrides — same logic as Daily Sale
      const withOutletPrices = applyOutletOverrides(sorted, outlet);
      setInv(withOutletPrices);
    }
  });
  getEmptyInventoryMaster().then(data => {
    if (data && data.length) setEmptyInv(data);
    else setEmptyInv(loadEmptyFromStorage());
  });
  getCOA().then(data => { if (data.length) setCOA(data); });
  setReady(true);
}, []);

    const emptyInv = emptyInvState.length > 0 ? emptyInvState : loadEmptyFromStorage();
  const extraSuppliers = (() => { try { return JSON.parse(localStorage.getItem("extra_suppliers") || "[]"); } catch { return []; } })();
  const extraSupIds    = extraSuppliers.map(s => s.id);
  const mergedSuppliers = [
    ...SUPPLIERS_LIST.filter(s => !extraSupIds.includes(s.id)),
    ...extraSuppliers.map(s => ({ id: s.id, name: s.name || s.id })),
    { id: "EMPTY PURCHASE", name: "EMPTY PURCHASE" },
  ];

  const [subTab,     setSubTab]     = useState("received");
  const [date,       setDate]       = useState(today());
  const [supId,      setSupId]      = useState(mergedSuppliers[0]?.id || "");
  const [invNo,      setInvNo]      = useState("");
  const [lateCharge, setLateCharge] = useState("");
  const [lines,      setLines]      = useState([{ id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", unitCost: "", discount: "", amount: 0 }]);

  const [trDate,  setTrDate]  = useState(today());
  const [trType,  setTrType]  = useState("in");
  const [trLines, setTrLines] = useState([{ id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", unitCost: "", stockValue: 0 }]);

  const arAccList = allCOA.filter(a => a.id >= "1200" && a.id <= "1299");
  const [trAcc, setTrAcc] = useState(arAccList[0]?.id || "");
  useEffect(() => { if (arAccList.length && !trAcc) setTrAcc(arAccList[0]?.id || ""); }, [allCOA]); // eslint-disable-line

  const [retDate,  setRetDate]  = useState(today());
  const [retLines, setRetLines] = useState([{ id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", sellingPrice: "", stockValue: 0 }]);

  // ── Line update helpers — IDENTICAL to original ──
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
          supId.endsWith(i.supplier) ||
          supId.includes(i.supplier) ||
          i.supplier.includes(supId.replace(/^\d{4}-/, ""))
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

  async function savePurchase() {
    if (saving) return;
    if (!invNo || !lines[0].itemCode) { toast_("Fill invoice no and at least one item", "err"); return; }
    setSaving(true);

  try {
      const rec = { id: uid(), date, supId, invoiceNo: invNo, lines, subtotal, totalDisc, lateCharge: parseFloat(lateCharge) || 0, grandTotal, outlet, by: user.username };

      await addPurchase(outlet, { date, supplier: supId, items: lines, total: grandTotal, status: "received", notes: `Inv:${invNo}` });
      await addAPInvoice(outlet, { supplier: supId, date, amount: grandTotal, paid: 0, status: "unpaid", ref: invNo });
      await addGLEntry(outlet, { date, account_id: "1300", description: `Purchase ${supId} Inv:${invNo}`, debit: grandTotal, credit: 0, source: "purchase" });
      await addGLEntry(outlet, { date, account_id: "2000", description: `AP ${supId} Inv:${invNo}`,       debit: 0, credit: grandTotal, source: "purchase" });

      toast_("Purchase saved ✓");
      setLines([{ id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", unitCost: "", discount: "", amount: 0 }]);
      setInvNo("");
      setLateCharge("");
    } finally {
      setSaving(false);
    }
  }

  // ── Save transfer — UI uses AR/AP accounts; DB outlet FK uses staff outlet + type in notes ──
  async function saveTransfer() {
    if (!trAcc || !trLines[0].itemCode) { toast_("Fill account and items", "err"); return; }

    const total = trLines.reduce((a, l) => a + (l.stockValue || 0), 0);

    const ok = await addTransfer({
      from: outlet,
      to:   outlet,
      date: trDate,
      items: trLines,
      status: "completed",
      type: trType,
      notes: `type:${trType}|account:${trAcc}`,
    });
    if (!ok?.ok) { toast_(ok?.message || "Transfer save failed", "err"); return; }

    if (trType === "out") {
      await addAREntry(outlet, { date: trDate, description: `Transfer Out to ${trAcc}`, debit: total, credit: 0, ref: trAcc });
      await addGLEntry(outlet, { date: trDate, account_id: trAcc, description: `Transfer Out to ${trAcc}`, debit: total, credit: 0, source: "transfer" });
    } else {
      await addGLEntry(outlet, { date: trDate, account_id: "2100", description: `Transfer In from ${trAcc}`, debit: 0, credit: total, source: "transfer" });
    }

    toast_(`Transfer ${trType === "in" ? "In" : "Out"} saved ✓`);
    setTrLines([{ id: uid(), itemCode: "", itemName: "", type: "Q", qty: "", unitCost: "", stockValue: 0 }]);
    setTrAcc(arAccList[0]?.id || "");
  }

  // ── Save return — same logic, Supabase storage ──
  async function saveReturn() {
    if (!retLines[0].itemCode) { toast_("Add at least one item", "err"); return; }

    const total = retLines.reduce((a, l) => a + (l.stockValue || 0), 0);

    await addReturn(outlet, { date: retDate, items: retLines, total });
    await addCashEntry(outlet, { date: retDate, description: "Return Goods", type: "out", debit: 0, credit: total });
    await addGLEntry(outlet,   { date: retDate, account_id: "4001", description: "Return Goods", debit: total, credit: 0, source: "return" });

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
                        {(() => {
                      let items = [];
                      if (supId === "EMPTY PURCHASE") {
                      const seen = new Set();
                      items = emptyInv
                      .filter(it => it.supplier === "EMPTY PURCHASE")
                      .filter(it => {
                      if (seen.has(it.code)) return false;
                      seen.add(it.code);
                      return true;
                      });
                      } else {
                     const mainItems = inv.filter(it => it.supplier === supId && it.type !== "EMP");
                     const emptyItems = emptyInv.filter(it =>
                     it.supplier === supId ||
                     supId.endsWith(it.supplier)
                     );
                      // Deduplicate empty items by code
                      const seen = new Set();
                      const dedupedEmpty = emptyItems.filter(it => {
                      if (seen.has(it.code)) return false;
                      seen.add(it.code);
                      return true;
                     });
                     items = [...mainItems, ...dedupedEmpty];
                     }
                     return items.map(it => (
                     <option key={it.id || `${it.code}__${it.supplier}`} value={it.code}>
                      {it.code} — {it.name}
                      </option>
                     ));
                    })()}
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

            <button className="btn btng" style={{ marginTop: 12 }} onClick={savePurchase} disabled={saving}>{I.check} {saving ? "Saving..." : "Save Purchase"}</button>
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
                          {inv.map(it => <option key={`${it.code}__${it.supplier}`} value={it.code}>{it.code} — {it.name}</option>)}
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
                          {inv.map(it => <option key={`${it.code}__${it.supplier}`} value={it.code}>{it.code} — {it.name}</option>)}
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
