import { useState, useMemo } from "react";
import { ls, lss, fmt } from "../utils/helpers";
import { SEED_INVENTORY, SEED_EMPTY, uid, today } from "../data/seeds";

// ── Storage keys ──
const KEY_SALES     = "sales";
const KEY_CASH      = "cash_ledger";
const KEY_INV       = "inv_main";
const KEY_EMP       = "inv_empty";

// ── Helpers ──
function getOutletData(key, def, outlet) {
  const all = ls(key, []);
  return all.filter(r => r.outlet === outlet) || def;
}
function saveRecord(key, record) {
  const all = ls(key, []);
  lss(key, [...all, record]);
}
function updateRecord(key, id, patch) {
  const all = ls(key, []);
  lss(key, all.map(r => r.id === id ? { ...r, ...patch } : r));
}
function appendCash(outlet, entry) {
  const all = ls(KEY_CASH, []);
  lss(KEY_CASH, [...all, { ...entry, outlet, id: uid(), ts: Date.now() }]);
}

export default function SalesPage({ user, toast }) {
  const outlet = user.outlet;
  const [subTab, setSubTab] = useState("daily");
  const [filterDate, setFilterDate] = useState(today());

  // ── Inventory ──
  const [invItems] = useState(() => ls(KEY_INV, SEED_INVENTORY));
  const [empItems] = useState(() => ls(KEY_EMP, SEED_EMPTY));

  // ── Sales records for this outlet ──
  const [salesRaw, setSalesRaw] = useState(() => ls(KEY_SALES, []));
  const sales = salesRaw.filter(r => r.outlet === outlet);

  function refreshSales() { setSalesRaw(ls(KEY_SALES, [])); }

  // ── Get today's sale record (or create) ──
  const todaySale = useMemo(() =>
    sales.find(r => r.date === filterDate),
    [sales, filterDate]
  );

  // ── Main stock rows for daily sale ──
  const [mainRows, setMainRows] = useState(() => {
    const existing = sales.find(r => r.date === filterDate);
    if (existing) return existing.mainRows;
    return invItems.map(item => ({
      code: item.code,
      name: item.name,
      type: item.type,
      supplier: item.supplier,
      rate: item.sellingPrice || 0,
      unitCost: item.unitCost || 0,
      openingStock: item.qty || 0,
      purchase: 0,
      transferIn: 0,
      transferOut: 0,
      returns: 0,
      sold: 0,
      physical: 0,
      adjToStock: 0,
    }));
  });

  // ── Empty stock rows ──
  const [empRows, setEmpRows] = useState(() => {
    const existing = sales.find(r => r.date === filterDate);
    if (existing) return existing.empRows;
    return empItems.map(e => ({
      code: e.code,
      name: e.name,
      rate: e.rate || 0,
      openingStock: e.qty || 0,
      purchase: 0,
      invoicePurchase: 0,
      received: 0,
      return: 0,
      invoiceIssue: 0,
      issue: 0,
      sold: 0,
    }));
  });

  // ── Calculations for main rows ──
  function calcRow(r) {
    const total   = (r.openingStock||0) + (r.purchase||0) + (r.transferIn||0)
                  - (r.transferOut||0) - (r.returns||0);
    const balance = total - (r.sold||0);
    const amount  = (r.sold||0) * (r.rate||0);
    const endStock = balance - (r.adjToStock||0);
    const shortEx = (r.physical||0) - balance;
    const amountShortEx = shortEx * (r.rate||0);
    return { ...r, total, balance, amount, endStock, shortEx, amountShortEx };
  }

  // ── Calculations for empty rows ──
  function calcEmpRow(r) {
    const endStock = (r.openingStock||0) + (r.received||0) - (r.issue||0)
                   - (r.sold||0) + (r.return||0) - (r.purchase||0);
    const shortEx  = (r.physical||0) - endStock;
    return { ...r, endStock, shortEx };
  }

  // ── Update main row field ──
  function updateMain(code, field, val) {
    setMainRows(rows => rows.map(r =>
      r.code === code ? { ...r, [field]: Number(val) || 0 } : r
    ));
  }

  // ── Update empty row field ──
  function updateEmp(code, field, val) {
    setEmpRows(rows => rows.map(r =>
      r.code === code ? { ...r, [field]: Number(val) || 0 } : r
    ));
  }

  // ── Totals ──
  const calcedMain = useMemo(() => mainRows.map(calcRow), [mainRows]);
  const calcedEmp  = useMemo(() => empRows.map(calcEmpRow), [empRows]);

  const totalSales    = calcedMain.reduce((s, r) => s + (r.amount||0), 0);
  const totalEmpSold  = calcedEmp.reduce((s, r) => s + (r.sold||0) * (r.rate||0), 0);
  const totalEmpReturn= calcedEmp.reduce((s, r) => s + (r.return||0) * (r.rate||0), 0);
  const totalEmpPurch = calcedEmp.reduce((s, r) => s + (r.purchase||0) * (r.rate||0), 0);
  const netCash       = totalSales + totalEmpSold - totalEmpReturn - totalEmpPurch;

  // ── Save daily sale ──
  function saveSale() {
    const record = {
      id: todaySale ? todaySale.id : uid(),
      outlet,
      date: filterDate,
      mainRows: calcedMain,
      empRows: calcedEmp,
      totalSales,
      totalEmpSold,
      totalEmpReturn,
      totalEmpPurch,
      netCash,
      savedAt: Date.now(),
    };
    const all = ls(KEY_SALES, []);
    const exists = all.findIndex(r => r.outlet === outlet && r.date === filterDate);
    if (exists >= 0) {
      const updated = [...all];
      updated[exists] = record;
      lss(KEY_SALES, updated);
    } else {
      lss(KEY_SALES, [...all, record]);
    }

    // ── Auto connect to Cash Ledger ──
    const cashAll = ls(KEY_CASH, []).filter(
      r => !(r.outlet === outlet && r.date === filterDate && r.source === "sales")
    );
    const cashEntries = [];
    if (totalSales > 0) cashEntries.push({
      id: uid(), outlet, date: filterDate, source: "sales",
      description: "Sales Revenue", cashIn: totalSales, cashOut: 0, ts: Date.now(),
    });
    if (totalEmpSold > 0) cashEntries.push({
      id: uid(), outlet, date: filterDate, source: "sales",
      description: "Empty Bottles Sold", cashIn: totalEmpSold, cashOut: 0, ts: Date.now(),
    });
    if (totalEmpReturn > 0) cashEntries.push({
      id: uid(), outlet, date: filterDate, source: "sales",
      description: "Empty Bottles Return", cashIn: 0, cashOut: totalEmpReturn, ts: Date.now(),
    });
    if (totalEmpPurch > 0) cashEntries.push({
      id: uid(), outlet, date: filterDate, source: "sales",
      description: "Empty Bottles Purchase", cashIn: 0, cashOut: totalEmpPurch, ts: Date.now(),
    });
    lss(KEY_CASH, [...cashAll, ...cashEntries]);

    // ── Update inventory qty ──
    const inv = ls(KEY_INV, SEED_INVENTORY);
    const updatedInv = inv.map(item => {
      const row = calcedMain.find(r => r.code === item.code);
      if (!row) return item;
      return { ...item, qty: row.endStock >= 0 ? row.endStock : 0 };
    });
    lss(KEY_INV, updatedInv);

    refreshSales();
    toast("Sale saved & cash updated ✓");
  }

  // ── Date navigation ──
  function prevDay() {
    const d = new Date(filterDate);
    d.setDate(d.getDate() - 1);
    const nd = d.toISOString().split("T")[0];
    setFilterDate(nd);
    const ex = sales.find(r => r.date === nd);
    if (ex) { setMainRows(ex.mainRows); setEmpRows(ex.empRows); }
    else {
      setMainRows(invItems.map(item => ({
        code: item.code, name: item.name, type: item.type,
        supplier: item.supplier, rate: item.sellingPrice || 0,
        unitCost: item.unitCost || 0, openingStock: item.qty || 0,
        purchase: 0, transferIn: 0, transferOut: 0,
        returns: 0, sold: 0, physical: 0, adjToStock: 0,
      })));
      setEmpRows(empItems.map(e => ({
        code: e.code, name: e.name, rate: e.rate || 0,
        openingStock: e.qty || 0, purchase: 0, invoicePurchase: 0,
        received: 0, return: 0, invoiceIssue: 0, issue: 0, sold: 0,
      })));
    }
  }

  function nextDay() {
    const d = new Date(filterDate);
    d.setDate(d.getDate() + 1);
    const nd = d.toISOString().split("T")[0];
    setFilterDate(nd);
    const ex = sales.find(r => r.date === nd);
    if (ex) { setMainRows(ex.mainRows); setEmpRows(ex.empRows); }
    else {
      setMainRows(invItems.map(item => ({
        code: item.code, name: item.name, type: item.type,
        supplier: item.supplier, rate: item.sellingPrice || 0,
        unitCost: item.unitCost || 0, openingStock: item.qty || 0,
        purchase: 0, transferIn: 0, transferOut: 0,
        returns: 0, sold: 0, physical: 0, adjToStock: 0,
      })));
      setEmpRows(empItems.map(e => ({
        code: e.code, name: e.name, rate: e.rate || 0,
        openingStock: e.qty || 0, purchase: 0, invoicePurchase: 0,
        received: 0, return: 0, invoiceIssue: 0, issue: 0, sold: 0,
      })));
    }
  }

  const inputStyle = {
    width: 72, padding: "4px 6px", background: "var(--surf2,#f0ebe0)",
    border: "1px solid var(--border,#e0d8cc)", borderRadius: 6,
    fontSize: 12, fontFamily: "inherit", color: "var(--ink,#1a1612)",
    textAlign: "right", outline: "none",
  };
  const numStyle = { fontFamily: "monospace", fontSize: 12, textAlign: "right" };
  const thStyle  = {
    padding: "8px 10px", fontSize: 10, fontWeight: 700,
    textTransform: "uppercase", letterSpacing: ".06em",
    background: "var(--surf2,#f0ebe0)", whiteSpace: "nowrap",
    borderBottom: "2px solid var(--border,#e0d8cc)", textAlign: "right",
  };
  const tdStyle  = { padding: "6px 10px", borderBottom: "1px solid var(--border,#e0d8cc)" };

  return (
  <div style={{ width:"100%", maxWidth:"100%" }}>
      {/* Sub tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        {[["daily","📋 Daily Sale"],["empty","🍾 Empty Stock"],["status","📊 Current Status"]].map(([id,label])=>(
          <button key={id}
            className={`btn ${subTab===id?"btn-gold":"btn-out"}`}
            onClick={()=>setSubTab(id)}>
            {label}
          </button>
        ))}
      </div>

      {/* Date bar */}
      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
        <button className="btn btn-out" onClick={prevDay}>← Prev</button>
        <input type="date" value={filterDate}
          onChange={e => {
            setFilterDate(e.target.value);
            const ex = sales.find(r => r.date === e.target.value);
            if (ex) { setMainRows(ex.mainRows); setEmpRows(ex.empRows); }
          }}
          style={{ ...inputStyle, width: 150, textAlign:"left" }}
        />
        <button className="btn btn-out" onClick={nextDay}>Next →</button>
        {todaySale && (
          <span style={{ fontSize:11, color:"var(--green,#2d7a4f)", fontWeight:600 }}>
            ✓ Saved
          </span>
        )}
        <button className="btn btn-gold" style={{ marginLeft:"auto" }} onClick={saveSale}>
          💾 Save & Update Cash
        </button>
      </div>

      {/* ── DAILY SALE TAB ── */}
      {subTab === "daily" && (
        <>
          {/* Summary cards */}
          <div className="stats" style={{ gridTemplateColumns:"repeat(4,1fr)", marginBottom:16 }}>
            <div className="stat">
              <div className="stat-v" style={{ fontSize:18 }}>Rs.{fmt(totalSales)}</div>
              <div className="stat-l">Total Sales</div>
            </div>
            <div className="stat">
              <div className="stat-v" style={{ fontSize:18, color:"var(--green,#2d7a4f)" }}>Rs.{fmt(totalEmpSold)}</div>
              <div className="stat-l">Empty Sold</div>
            </div>
            <div className="stat">
              <div className="stat-v" style={{ fontSize:18, color:"var(--red,#c0392b)" }}>Rs.{fmt(totalEmpReturn + totalEmpPurch)}</div>
              <div className="stat-l">Empty Out</div>
            </div>
            <div className="stat">
              <div className="stat-v" style={{ fontSize:18, color: netCash>=0?"var(--green,#2d7a4f)":"var(--red,#c0392b)" }}>
                Rs.{fmt(netCash)}
              </div>
              <div className="stat-l">Net Cash</div>
            </div>
          </div>

          <div className="card">
            <div className="card-hd">
              <div><h3>Main Stock — Daily Sale</h3><p>{filterDate}</p></div>
            </div>
            <div style={{ overflowX:"auto" }}>
              <table>
                <thead>
                  <tr>
                    {["Code","Name","Type",
                      "Opening","Purchase","Tr.In","Tr.Out","Returns",
                      "Total","Sold","Balance","Rate","Amount",
                      "Physical","Short/Ex(Amt)","Short/Ex(Qty)","Adj","End Stock"
                    ].map(h => <th key={h} style={{...thStyle, textAlign: ["Code","Name","Type"].includes(h)?"left":"right"}}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {calcedMain.map(r => (
                    <tr key={r.code}>
                      <td style={{...tdStyle, fontFamily:"monospace", fontSize:11}}>{r.code}</td>
                      <td style={{...tdStyle, fontWeight:600, whiteSpace:"nowrap"}}>{r.name}</td>
                      <td style={tdStyle}><span className="type-badge">{r.type}</span></td>
                      {/* Editable fields */}
                      {[
                        ["openingStock",r.openingStock],
                        ["purchase",r.purchase],
                        ["transferIn",r.transferIn],
                        ["transferOut",r.transferOut],
                        ["returns",r.returns],
                      ].map(([field, val]) => (
                        <td key={field} style={tdStyle}>
                          <input style={inputStyle} type="number" value={val}
                            onChange={e => updateMain(r.code, field, e.target.value)}/>
                        </td>
                      ))}
                      {/* Calculated */}
                      <td style={{...tdStyle,...numStyle}}>{r.total}</td>
                      <td style={tdStyle}>
                        <input style={inputStyle} type="number" value={r.sold}
                          onChange={e => updateMain(r.code,"sold",e.target.value)}/>
                      </td>
                      <td style={{...tdStyle,...numStyle,
                        color: r.balance<0?"var(--red,#c0392b)":"inherit"}}>{r.balance}</td>
                      <td style={{...tdStyle,...numStyle}}>Rs.{fmt(r.rate)}</td>
                      <td style={{...tdStyle,...numStyle,fontWeight:600}}>Rs.{fmt(r.amount)}</td>
                      <td style={tdStyle}>
                        <input style={inputStyle} type="number" value={r.physical}
                          onChange={e => updateMain(r.code,"physical",e.target.value)}/>
                      </td>
                      <td style={{...tdStyle,...numStyle,
                        color: r.amountShortEx<0?"var(--red,#c0392b)":r.amountShortEx>0?"var(--green,#2d7a4f)":"inherit"}}>
                        {r.amountShortEx!==0?(r.amountShortEx>0?"+":"")+fmt(r.amountShortEx):"—"}
                      </td>
                      <td style={{...tdStyle,...numStyle,
                        color: r.shortEx<0?"var(--red,#c0392b)":r.shortEx>0?"var(--green,#2d7a4f)":"inherit"}}>
                        {r.shortEx!==0?(r.shortEx>0?"+":"")+r.shortEx:"—"}
                      </td>
                      <td style={tdStyle}>
                        <input style={inputStyle} type="number" value={r.adjToStock}
                          onChange={e => updateMain(r.code,"adjToStock",e.target.value)}/>
                      </td>
                      <td style={{...tdStyle,...numStyle,fontWeight:600,
                        color: r.endStock<0?"var(--red,#c0392b)":"var(--green,#2d7a4f)"}}>
                        {r.endStock}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background:"var(--surf2,#f0ebe0)", fontWeight:700 }}>
                    <td colSpan={11} style={{...tdStyle, textAlign:"right"}}>Total Sales:</td>
                    <td style={{...tdStyle,...numStyle,fontWeight:700}}>—</td>
                    <td style={{...tdStyle,...numStyle,fontWeight:700,color:"var(--amber,#c47d2a)"}}>
                      Rs.{fmt(totalSales)}
                    </td>
                    <td colSpan={5} style={tdStyle}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── EMPTY STOCK TAB ── */}
      {subTab === "empty" && (
        <div className="card">
          <div className="card-hd">
            <div><h3>Empty Stock — Daily</h3><p>{filterDate}</p></div>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table>
              <thead>
                <tr>
                  {["Code","Name","Rate","Opening","Purchase","Inv.Purchase",
                    "Received","Return","Inv.Issue","Issue","Sold","End Stock","Short/Ex"
                  ].map(h=><th key={h} style={{...thStyle,textAlign:["Code","Name"].includes(h)?"left":"right"}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {calcedEmp.map(r => (
                  <tr key={r.code}>
                    <td style={{...tdStyle,fontFamily:"monospace",fontSize:11}}>{r.code}</td>
                    <td style={{...tdStyle,fontWeight:600}}>{r.name}</td>
                    <td style={{...tdStyle,...numStyle}}>Rs.{fmt(r.rate)}</td>
                    {[
                      ["openingStock",r.openingStock],
                      ["purchase",r.purchase],
                      ["invoicePurchase",r.invoicePurchase],
                      ["received",r.received],
                      ["return",r.return],
                      ["invoiceIssue",r.invoiceIssue],
                      ["issue",r.issue],
                      ["sold",r.sold],
                    ].map(([field,val])=>(
                      <td key={field} style={tdStyle}>
                        <input style={inputStyle} type="number" value={val}
                          onChange={e=>updateEmp(r.code,field,e.target.value)}/>
                      </td>
                    ))}
                    <td style={{...tdStyle,...numStyle,fontWeight:600,
                      color:r.endStock<0?"var(--red,#c0392b)":"var(--green,#2d7a4f)"}}>
                      {r.endStock}
                    </td>
                    <td style={{...tdStyle,...numStyle,
                      color:r.shortEx<0?"var(--red,#c0392b)":r.shortEx>0?"var(--green,#2d7a4f)":"inherit"}}>
                      {r.shortEx!==0?(r.shortEx>0?"+":"")+r.shortEx:"—"}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{background:"var(--surf2,#f0ebe0)",fontWeight:700}}>
                  <td colSpan={3} style={{...tdStyle,textAlign:"right"}}>Cash Impact:</td>
                  <td colSpan={5} style={tdStyle}></td>
                  <td style={{...tdStyle,...numStyle,color:"var(--green,#2d7a4f)"}}>
                    +Rs.{fmt(totalEmpSold)}
                  </td>
                  <td style={{...tdStyle,...numStyle,color:"var(--red,#c0392b)"}}>
                    -Rs.{fmt(totalEmpReturn)}
                  </td>
                  <td style={{...tdStyle,...numStyle,color:"var(--red,#c0392b)"}}>
                    -Rs.{fmt(totalEmpPurch)}
                  </td>
                  <td colSpan={2} style={tdStyle}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ── CURRENT STATUS TAB ── */}
      {subTab === "status" && (
        <div className="card">
          <div className="card-hd">
            <div><h3>Current Status</h3><p>In-hand stock vs physical count</p></div>
          </div>
          <div style={{ overflowX:"auto" }}>
            <table>
              <thead>
                <tr>
                  {["Code","Name","Type","In Hand Stock","Physical Stock",
                    "Total Bottle Sale","Total Sale (Rs.)","Total Purchase",
                    "Transfer In","Transfer Out","Returns","Adj. to Stock"
                  ].map(h=><th key={h} style={{...thStyle,textAlign:["Code","Name","Type"].includes(h)?"left":"right"}}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {calcedMain.map(r=>(
                  <tr key={r.code}>
                    <td style={{...tdStyle,fontFamily:"monospace",fontSize:11}}>{r.code}</td>
                    <td style={{...tdStyle,fontWeight:600}}>{r.name}</td>
                    <td style={tdStyle}><span className="type-badge">{r.type}</span></td>
                    <td style={{...tdStyle,...numStyle,fontWeight:600,
                      color:r.endStock<0?"var(--red,#c0392b)":"var(--green,#2d7a4f)"}}>
                      {r.endStock}
                    </td>
                    <td style={{...tdStyle,...numStyle}}>{r.physical||"—"}</td>
                    <td style={{...tdStyle,...numStyle}}>{r.sold}</td>
                    <td style={{...tdStyle,...numStyle,fontWeight:600}}>Rs.{fmt(r.amount)}</td>
                    <td style={{...tdStyle,...numStyle}}>{r.purchase}</td>
                    <td style={{...tdStyle,...numStyle}}>{r.transferIn}</td>
                    <td style={{...tdStyle,...numStyle}}>{r.transferOut}</td>
                    <td style={{...tdStyle,...numStyle}}>{r.returns}</td>
                    <td style={{...tdStyle,...numStyle,
                      color:r.adjToStock!==0?"var(--red,#c0392b)":"inherit"}}>
                      {r.adjToStock||"—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
