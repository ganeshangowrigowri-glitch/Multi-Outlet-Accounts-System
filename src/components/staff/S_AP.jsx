// src/components/staff/S_AP.jsx
import { useState,useEffect, useMemo } from "react";
import { fmt, today } from "../../utils/helpers";
import {supabase} from "../../supabase";
import { I } from "../../utils/icons";
import { addAPPayment, addCashEntry, addBankEntry, addCardEntry, addGLEntry } from "../../db";

export default function S_AP({ outlet, user, toast_ }) {

  const [subTab,    setSubTab]   = useState("sup");
  const [invoices,  setInvR]     = useState([]);
  const [payments,  setPayR]     = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  useEffect(() => {
  supabase.from("ap_invoices").select("*").eq("outlet_id", outlet)
    .order("date", { ascending: false })
    .then(({ data }) => { if (data) setInvR(data); });

  supabase.from("ap_payments").select("*").eq("outlet_id", outlet)
    .order("date", { ascending: false })
    .then(({ data }) => { if (data) setPayR(data); });

  supabase.from("suppliers").select("*")
    .then(({ data }) => { if (data) setSuppliers(data); });
}, [outlet]);


 const [pf, setPf] = useState({
    date:    today(),
    supId: "",
    invDate: today(),
    invNo:   "",
    invAmt:  "",
    payType: "Bank",
    bankId:  "",
    cardId:  "",
    payAmt:      "",
    discount:    "",
    checkNo:     "",
    lateCharge:  "",
  });

  const [manualInv, setManualInv] = useState(false); // toggle: dropdown vs typed invoice no
   
  const [aged, setAged] = useState("");

useEffect(() => {
  if (suppliers.length > 0 && !aged) setAged(suppliers[0].id);
}, [suppliers]);

 const [outletBanks, setOutletBanks] = useState([]);
  useEffect(() => {
  supabase.from("bank_accounts")
    .select("*")
    .eq("outlet_id", outlet)
    .eq("active", true)
    .then(({ data }) => { if (data) setOutletBanks(data); });
}, [outlet]);

  // Visa Card settlement — reuses the same account_type="card" rows as S_Card.jsx
  const [cardAccounts, setCardAccounts] = useState([]);
  useEffect(() => {
  supabase.from("bank_accounts")
    .select("*")
    .eq("outlet_id", outlet)
    .eq("active", true)
    .eq("account_type", "card")
    .then(({ data }) => { if (data) setCardAccounts(data); });
}, [outlet]);
  // ── Invoice numbers filtered by supplier + invDate ──
  const filteredInvoices = useMemo(() => {
    return invoices.filter(inv =>
      inv.supplier_id === pf.supId &&
      inv.date  === pf.invDate
    );
  }, [invoices, pf.supId, pf.invDate]);

  function handleSupChange(supId) {
    setPf(p => ({ ...p, supId, invNo: "", invAmt: "" }));
  }
  function handleInvDateChange(invDate) {
    setPf(p => ({ ...p, invDate, invNo: "", invAmt: "" }));
  }

  // When an invoice is selected → auto-fill amount
  function handleInvNoChange(invNo) {
    if (!invNo) { setPf(p => ({ ...p, invNo: "", invAmt: "" })); return; }
    const matched = filteredInvoices.find(i => i.ref === invNo);
    const amt = matched ? (matched.amount ?? "") : "";
    setPf(p => ({ ...p, invNo, invAmt: amt !== "" ? String(amt) : "" }));
  }
async function savePayment() {
  if (!pf.invNo || !pf.payAmt) { toast_("Fill invoice no & payment amount", "err"); return; }
  if ((pf.payType === "Bank" || pf.payType === "Visa Card") && !pf.bankId) { toast_("Select a bank account", "err"); return; }
  if (pf.payType === "Visa Card" && !pf.cardId) { toast_("Select a card account", "err"); return; }
  const pa   = parseFloat(pf.payAmt)   || 0;
  const disc = parseFloat(pf.discount) || 0;
  const bankAcc = outletBanks.find(b => b.id === pf.bankId);

await addAPPayment(outlet, {
  date:        pf.date,
  invoiceId:   pf.invNo,
  amount:      pa,
  method:      pf.payType,
  ref:         pf.checkNo || "",
  supplierId:  pf.supId,
  invAmt:      parseFloat(pf.invAmt) || 0,
  discount:    disc,
  lateCharge:  parseFloat(pf.lateCharge) || 0,
  bankName:    bankAcc?.bank || "",
  accountNo:   bankAcc?.account_no || "",
});
if (pf.payType === "Cash") {
    await addCashEntry(outlet, {
      date: pf.date,
      description: `AP Payment ${pf.supId} ${pf.invNo}`,
      type: "out", debit: 0, credit: pa,
    });
  }
  if (pf.payType === "Bank") {
    await addBankEntry(outlet, {
      date: pf.date,
      bankId: pf.bankId,
      description: `AP Payment ${pf.supId} ${pf.invNo}`,
      checkNo: pf.checkNo,
      type: "out", debit: 0, credit: pa,
    });
  }
if (pf.payType === "Visa Card") {
    // Card Settlement Ledger → Debit only. No Bank Ledger entry for Visa Card payments.
    await addCardEntry(outlet, {
      date: pf.date,
      cardId: pf.cardId,
      description: `AP Payment ${pf.supId} ${pf.invNo}`,
      txnType: "payment",
      debit: pa, credit: 0,
    });
  }

  await addGLEntry(outlet, {
    date: pf.date,
    account_id: "2000",
    description: `AP Payment ${pf.supId}`,
    debit: pa, credit: 0, source: "ap_payment",
  });

  // Refresh payments
  const { data } = await supabase.from("ap_payments")
    .select("*").eq("outlet_id", outlet)
    .order("date", { ascending: false });
  if (data) setPayR(data);

  toast_("Payment saved ✓");
  setPf(p => ({ ...p, invNo: "", invAmt: "", payAmt: "", discount: "", checkNo: "", lateCharge: "", cardId: "" }));
}
  

  // ── Aged analysis ──
  const agedData = () => {
    const b = { o7: 0, d815: 0, d1521: 0, o22: 0 };
    invoices.filter(i => i.supplier_id === aged).forEach(inv => {
      const d   = parseInt((inv.date || "").slice(8, 10)) || 0;
      const rem = inv.amount - payments
        .filter(p => p.invNo === inv.invNo)
        .reduce((a, p) => a + p.amount, 0);
      if (rem <= 0) return;
      if      (d >= 1  && d <= 7)  b.o22   += rem;
      else if (d >= 8  && d <= 14) b.d1521 += rem;
      else if (d >= 15 && d <= 21) b.d815  += rem;
      else                          b.o7    += rem;
    });
    return b;
  };

  const bal = v => {
    const t = invoices.filter(i => i.supplier_id === v).reduce((a, i) => a + Number(i.amount), 0);
    const p = payments.filter(p => p.supplier_id === v).reduce((a, p) => a + p.amount + p.discount, 0);
    return t - p;
  };

  const ad = agedData();

  return (
    <>
      <div className="subtabs">
        {[["sup", "Suppliers"], ["pay", "Pay Invoice"], ["aged", "Aged Analysis"]].map(([id, lbl]) => (
          <button key={id} className={`subtab ${subTab === id ? "act" : ""}`} onClick={() => setSubTab(id)}>
            {lbl}
          </button>
        ))}
      </div>

      {/* ── TAB 1: Suppliers & Balance ── */}
      {subTab === "sup" && (
        <div className="card">
          <div className="chd"><h3>Suppliers & Balance</h3></div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Account ID</th><th>Supplier</th>
                <th className="rt">Invoiced</th><th className="rt">Paid</th>
                <th className="rt">Outstanding</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => {
                const b = bal(s.id);
                return (
                  <tr key={s.id}>
                    <td className="mono">{s.id}</td>
                    <td className="bold">{s.name}</td>
                    <td className="rt mono">Rs.{fmt(invoices.filter(i => i.supplier_id === s.id).reduce((a, i) => a + i.grandTotal, 0))}</td>
                    <td className="rt mono cg">Rs.{fmt(payments.filter(p => p.supplier_id === s.id).reduce((a, p) => a + p.amount + p.discount, 0))}</td>
                    <td className="rt mono bold" style={{ color: b > 0 ? "var(--red)" : "var(--grn)" }}>Rs.{fmt(b)}</td>
                    <td><span className={`badge ${b > 0 ? "ba" : "bg"}`}>{b > 0 ? "Outstanding" : "Settled"}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── TAB 2: Pay Invoice ── */}
      {subTab === "pay" && (
        <>
          <div className="card">
            <div className="chd"><h3>Payment to Invoice</h3></div>
            <div style={{ padding: 14 }}>
              <div className="fg">

                {/* Payment Date */}
                <div className="ff">
                  <label>Payment Date</label>
                  <input type="date" value={pf.date} onChange={e => setPf({ ...pf, date: e.target.value })} />
                </div>

                {/* Supplier — step 1 filter */}
                <div className="ff">
                  <label>Supplier</label>
                  <select value={pf.supId} onChange={e => handleSupChange(e.target.value)}>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
                  </select>
                </div>

                {/* Invoice Date — step 2 filter */}
                <div className="ff">
                  <label>Invoice Date</label>
                  <input type="date" value={pf.invDate} onChange={e => handleInvDateChange(e.target.value)} />
                </div>

               <div className="ff">
                  <label>
                    Invoice No *{" "}
                    <button
                      type="button"
                      className="btn btnsm"
                      style={{ marginLeft: 6, padding: "1px 6px", fontSize: 10 }}
                      onClick={() => setManualInv(m => !m)}
                    >
                      {manualInv ? "Choose from list" : "Type manually"}
                    </button>
                  </label>
                  {manualInv ? (
                    <input
                      value={pf.invNo}
                      onChange={e => setPf({ ...pf, invNo: e.target.value })}
                      placeholder="Type invoice no…"
                      style={{ minWidth: 140 }}
                    />
                  ) : (
                    <select
                      value={pf.invNo}
                      onChange={e => handleInvNoChange(e.target.value)}
                      style={{ minWidth: 140 }}
                    >
                      <option value="">Select invoice…</option>
                      {filteredInvoices.map(inv => (
                        <option key={inv.id} value={inv.ref}>{inv.ref}</option>
                      ))}
                    </select>
                  )}
                  {!manualInv && filteredInvoices.length === 0 && (
                    <div style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 3 }}>
                      No invoices for selected supplier &amp; date
                    </div>
                  )}
                </div>

                {/* Invoice Amount — auto-filled on selection */}
                <div className="ff">
                  <label>Invoice Amount</label>
                  <input
                    type="number"
                    value={pf.invAmt}
                    onChange={e => setPf({ ...pf, invAmt: e.target.value })}
                    placeholder="Auto-filled on selection"
                    style={{ fontWeight: pf.invNo ? 600 : undefined }}
                  />
                </div>

                 <div className="ff">
                  <label>Payment Type</label>
                  <select
                    value={pf.payType}
                    onChange={e => setPf({ ...pf, payType: e.target.value, bankId: "", cardId: "" })}
                  >
                    {["Bank", "Cash", "Visa Card"].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                {/* Bank Account — needed for Bank, and for Visa Card settlement */}
                {(pf.payType === "Bank" || pf.payType === "Visa Card") && (
                  <div className="ff">
                    <label>Bank Account *</label>
                    {outletBanks.length === 0 ? (
                      <div className="nbox nb-a" style={{ fontSize: 11, padding: "6px 10px" }}>
                        ⚠ No bank accounts assigned to this outlet. Ask admin to configure in Admin → Bank Master.
                      </div>
                    ) : (
                      <select
                        value={pf.bankId}
                        onChange={e => setPf({ ...pf, bankId: e.target.value })}
                        style={{ minWidth: 220 }}
                      >
                        <option value="">Select bank account…</option>
                        {outletBanks.map(b => (
                          <option key={b.id} value={b.id}>
                            {b.bank} — {b.account_no} ({b.account_name})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Card Account — only when payType === "Visa Card" */}
                {pf.payType === "Visa Card" && (
                  <div className="ff">
                    <label>Card Account *</label>
                    {cardAccounts.length === 0 ? (
                      <div className="nbox nb-a" style={{ fontSize: 11, padding: "6px 10px" }}>
                        ⚠ No card accounts set up. Ask admin to configure in Admin → Bank Master (Account Type = Card).
                      </div>
                    ) : (
                      <select
                        value={pf.cardId}
                        onChange={e => setPf({ ...pf, cardId: e.target.value })}
                        style={{ minWidth: 220 }}
                      >
                        <option value="">Select card account…</option>
                        {cardAccounts.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.bank} — {c.account_no}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {/* Payment Amount */}
                <div className="ff">
                  <label>Payment Amount *</label>
                  <input type="number" value={pf.payAmt} onChange={e => setPf({ ...pf, payAmt: e.target.value })} />
                </div>

                {/* Discount */}
                <div className="ff">
                  <label>Discount</label>
                  <input type="number" value={pf.discount} onChange={e => setPf({ ...pf, discount: e.target.value })} />
                </div>

                {/* Check Number — always visible */}
                <div className="ff">
                  <label>Check Number</label>
                  <input
                    placeholder="e.g. 000123"
                    value={pf.checkNo}
                    onChange={e => setPf({ ...pf, checkNo: e.target.value })}
                  />
                </div>

                {/* Late Payment Charge */}
                <div className="ff">
                  <label>Late Payment Charge</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={pf.lateCharge}
                    onChange={e => setPf({ ...pf, lateCharge: e.target.value })}
                  />
                </div>

              </div>

              {/* Totals */}
              <div className="totbox">
                <div className="totr"><span className="totl">Invoice Amount</span><span className="totv">Rs.{fmt(pf.invAmt || 0)}</span></div>
                <div className="totr"><span className="totl">Payment</span><span className="totv cg">- Rs.{fmt(pf.payAmt || 0)}</span></div>
                <div className="totr"><span className="totl">Discount</span><span className="totv cg">- Rs.{fmt(pf.discount || 0)}</span></div>
                {(parseFloat(pf.lateCharge) > 0) && (
                  <div className="totr"><span className="totl">Late Payment Charge</span><span className="totv cr">+ Rs.{fmt(pf.lateCharge || 0)}</span></div>
                )}
                <div className="totr grand">
                  <span>Balance Due</span>
                  <span className="totv" style={{
                    color: (parseFloat(pf.invAmt)||0)-(parseFloat(pf.payAmt)||0)-(parseFloat(pf.discount)||0)+(parseFloat(pf.lateCharge)||0) > 0
                      ? "var(--red)" : "var(--grn)",
                  }}>
                    Rs.{fmt((parseFloat(pf.invAmt)||0)-(parseFloat(pf.payAmt)||0)-(parseFloat(pf.discount)||0)+(parseFloat(pf.lateCharge)||0))}
                  </span>
                </div>
              </div>

              {pf.payType === "Cash" && (
                <div className="nbox nb-a" style={{ marginTop: 8 }}>⚠ Cash payment will auto-deduct from In Hand Cash.</div>
              )}

              {pf.payType === "Visa Card" && (
                <div className="nbox nb-a" style={{ marginTop: 8 }}>💳 Visa Card payment posts to Card Settlement (Debit).</div>
              )}

              {pf.payType === "Bank" && pf.bankId && (() => {
                const b = outletBanks.find(x => x.id === pf.bankId);
                return b ? (
                  <div className="nbox nb-b" style={{ marginTop: 8, fontSize: 11.5 }}>
                    🏦 Payment via <strong>{b.bank}</strong> — A/C {b.accountNo} · {b.branch}
                  </div>
                ) : null;
              })()}

              <button className="btn btng" style={{ marginTop: 12 }} onClick={savePayment}>
                {I.check} Save Payment
              </button>
            </div>
          </div>

        </>
      )}

      {/* ── TAB 3: Aged Analysis ── */}
      {subTab === "aged" && (
        <>
          <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--mut)" }}>Supplier:</label>
            <select value={aged} onChange={e => setAged(e.target.value)}
              style={{ padding: "5px 9px", background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 6, fontSize: 12, color: "var(--txt)", outline: "none" }}>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.id} — {s.name}</option>)}
            </select>
          </div>

          <div className="agrid">
            {[["0–7 Days", ad.o7, "var(--grn)"], ["8–14 Days", ad.d815, "var(--gld2)"],
              ["15–21 Days", ad.d1521, "var(--red)"], ["Over 22 Days", ad.o22, "var(--red)"]].map(([l, v, c]) => (
              <div className="acard" key={l}>
                <div className="aval" style={{ color: c }}>Rs.{fmt(v)}</div>
                <div className="albl">{l}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="chd">
              <h3>Aged Payables — {suppliers.find(s => s.id === aged)?.name}</h3>
              <p>As of {today()}</p>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Invoice No</th><th>Date</th><th>Day</th>
                  <th className="rt">Invoice</th><th className="rt">Paid</th>
                  <th className="rt">Outstanding</th><th>Bucket</th>
                </tr>
              </thead>
              <tbody>
                {invoices.filter(i => i.supplier_id === aged).length === 0 && (
                  <tr><td colSpan={7}><div className="empty">No invoices for this supplier.</div></td></tr>
                )}
                {invoices.filter(i => i.supplier_id === aged).map(inv => {
                  const paid = payments.filter(p => p.invNo === inv.invNo && p.supplier_id === aged).reduce((a, p) => a + p.amount, 0);
                  const b    = inv.amount - paid;
                  const d    = parseInt((inv.date || "").slice(8, 10)) || 0;
                  const bkt  = d >= 1 && d <= 7 ? "Over 22" : d >= 8 && d <= 14 ? "15–21" : d >= 15 && d <= 21 ? "8–14" : "0–7";
                  return (
                    <tr key={inv.id}>
                      <td className="mono">{inv.ref}</td>
                      <td className="mono">{inv.date}</td>
                      <td>{d}</td>
                      <td className="rt mono">Rs.{fmt(inv.amount)}</td>
                      <td className="rt mono cg">Rs.{fmt(paid)}</td>
                      <td className="rt mono bold" style={{ color: b > 0 ? "var(--red)" : "var(--grn)" }}>Rs.{fmt(b)}</td>
                      <td><span className={`badge ${bkt === "0–7" ? "bg" : bkt === "Over 22" ? "ba" : "bb"}`}>{bkt}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
