// src/components/staff/S_Expenses.jsx
import { useState } from "react";
import { ls, lss, fmt, oKey, today, monthOf } from "../../utils/helpers";
import { uid, postCash, postBank, postGL } from "../../utils/helpers";
import { I } from "../../utils/icons";
import { COA_DEF } from "../../data/seeds";

export default function S_Expenses({ outlet, user, toast_ }) {

  const accounts = ls("coa_accounts", COA_DEF);
  const expAccs  = accounts.filter(a => a.id >= "5500" && a.id <= "5999");

  const [date,      setDate]      = useState(today());
  const [accId,     setAccId]     = useState(expAccs[0]?.id || "5651");
  const [desc,      setDesc]      = useState("");
  const [amount,    setAmount]    = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [records,   setRec]       = useState(() => ls(oKey(outlet, "expenses"), []));

  function save(d) { setRec(d); lss(oKey(outlet, "expenses"), d); }

  function submit() {
    if (!amount || parseFloat(amount) <= 0) { toast_("Enter valid amount", "err"); return; }

    const amt = parseFloat(amount);
    const acc = accounts.find(a => a.id === accId);
    const rec = { id: uid(), date, accId, accName: acc?.name || accId, desc, amount: amt, payMethod, outlet, by: user.username };

    save([rec, ...records]);

    if (payMethod === "Cash") postCash(outlet, { date, description: `Expense: ${acc?.name || accId}`, type: "out", amount: amt });
    if (payMethod === "Bank") postBank(outlet, { date, description: `Expense: ${acc?.name || accId}`, type: "out", amount: amt });

    postGL(outlet, { date, accountId: accId, description: acc?.name || accId, debit: amt, credit: 0 });

    toast_("Expense saved ✓");
    setDesc("");
    setAmount("");
  }

  const mo     = today().slice(0, 7);
  const mTotal = records.filter(r => monthOf(r.date) === mo).reduce((a, r) => a + r.amount, 0);
  const byCat  = records
    .filter(r => monthOf(r.date) === mo)
    .reduce((a, r) => { a[r.accName] = (a[r.accName] || 0) + r.amount; return a; }, {});

  return (
    <>
      {/* ── Record Expense ── */}
      <div className="card">
        <div className="chd"><h3>Record Expense</h3></div>
        <div style={{ padding: 14 }}>

          <div className="fg">
            <div className="ff">
              <label>Date</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="ff">
              <label>Account / Category</label>
              <select value={accId} onChange={e => setAccId(e.target.value)}>
                {expAccs.map(a => <option key={a.id} value={a.id}>{a.id} — {a.name}</option>)}
              </select>
            </div>
            <div className="ff">
              <label>Amount (Rs.) *</label>
              <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
            </div>
            <div className="ff">
              <label>Payment Method</label>
              <select value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                {["Cash", "Bank", "Visa Card", "Amex Card"].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
            <div className="ff full">
              <label>Description</label>
              <input placeholder="Details…" value={desc} onChange={e => setDesc(e.target.value)} />
            </div>
          </div>

          {payMethod === "Cash" && (
            <div className="nbox nb-a" style={{ marginBottom: 10 }}>
              ⚠ Cash expense will auto-deduct from In Hand Cash.
            </div>
          )}

          <button className="btn btng" onClick={submit}>{I.check} Save Expense</button>
        </div>
      </div>

      {/* ── This Month Summary ── */}
      {Object.keys(byCat).length > 0 && (
        <div className="card">
          <div className="chd">
            <h3>This Month Summary</h3>
            <p>Total: Rs.{fmt(mTotal)}</p>
          </div>
          <div style={{ padding: 14 }}>
            {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => (
              <div key={cat} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--bdr)" }}>
                <span style={{ fontSize: 12.5 }}>{cat}</span>
                <span className="mono bold cr">Rs.{fmt(amt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Expense History ── */}
      <div className="card">
        <div className="chd">
          <h3>Expense History</h3>
          <p>{records.length} entries</p>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Date</th><th>Account</th><th>Description</th><th>Method</th><th className="rt">Amount</th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 && (
              <tr><td colSpan={5}><div className="empty">No expenses yet.</div></td></tr>
            )}
            {records.slice(0, 25).map(r => (
              <tr key={r.id}>
                <td className="mono">{r.date}</td>
                <td style={{ fontSize: 11 }}>{r.accName}</td>
                <td style={{ fontSize: 11, color: "var(--mut)" }}>{r.desc || "—"}</td>
                <td><span className={`badge ${r.payMethod === "Cash" ? "ba" : "bb"}`}>{r.payMethod}</span></td>
                <td className="rt mono cr bold">Rs.{fmt(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
