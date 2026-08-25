// src/components/staff/S_Expenses.jsx
import { useState, useEffect } from "react";
import { fmt, today, monthOf } from "../../utils/helpers";
import { I } from "../../utils/icons";
import {
  addCashEntry, addBankEntry, addCardEntry, addGLEntry,
  getCashPettyCash, setCashPettyCash, getCashCoins, setCashCoins,
  getCashPending, getCashPendingDate, setCashPending,
  getCashDifferent, setCashDifferent,
} from "../../db";
import { supabase } from "../../supabase";

export default function S_Expenses({ outlet, user, toast_ }) {

  const [accounts, setAccounts] = useState([]);
  const expAccs  = accounts.filter(a => a.id >= "5500" && a.id <= "5999" && a.id !=="5500");
  useEffect(() => {
  supabase.from("coa_accounts").select("*").then(({ data }) => {
    if (data) setAccounts(data);
  });
}, []);

  const [date,      setDate]      = useState(today());
  const [accId,     setAccId]     = useState(expAccs[0]?.id || "5651");
  const [desc,      setDesc]      = useState("");
  const [amount,    setAmount]    = useState("");
  const [payMethod, setPayMethod] = useState("Cash");
  const [chequeNo,  setChequeNo]  = useState("");
  const [records, setRec] = useState([]);
  useEffect(() => {
  supabase.from("expenses")
    .select("*")
    .eq("outlet_id", outlet)
    .order("date", { ascending: false })
    .then(({ data }) => { if (data) setRec(data); });
}, [outlet]);

  // ── Bank accounts assigned/allowed by Admin for this outlet ──
  // Same query shape as S_Bank.jsx's outletBanks: active, not hidden,
  // and excludes account_type = "card" (those are Card Settlement accounts).
  const [outletBanks, setOutletBanks] = useState([]);
  useEffect(() => {
    supabase.from("bank_accounts")
      .select("*")
      .eq("outlet_id", outlet)
      .eq("active", true)
      .eq("hidden", false)
      .neq("account_type", "card")
      .order("bank")
      .then(({ data }) => setOutletBanks(data || []));
  }, [outlet]);

  // ── Card Settlement accounts assigned/allowed by Admin for this outlet ──
  // Same query shape as S_Card.jsx's cardAccounts (account_type = "card").
  const [cardAccounts, setCardAccounts] = useState([]);
  useEffect(() => {
    supabase.from("bank_accounts")
      .select("*")
      .eq("outlet_id", outlet)
      .eq("active", true)
      .eq("hidden", false)
      .eq("account_type", "card")
      .order("bank")
      .then(({ data }) => setCardAccounts(data || []));
  }, [outlet]);

  // Split card accounts by network so "Visa Card" only offers Visa
  // accounts and "Amex Card" only offers Amex accounts — keeps card
  // transactions card-wise as required.
  const visaCards = cardAccounts.filter(c => /visa/i.test(c.bank || ""));
  const amexCards = cardAccounts.filter(c => /amex/i.test(c.bank || ""));

  const [bankId, setBankId] = useState("");
  const [cardId, setCardId] = useState("");

  // Default the Bank Account field once outlet banks load / method switches to Bank.
  useEffect(() => {
    if (payMethod === "Bank" && !outletBanks.find(b => b.id === bankId)) {
      setBankId(outletBanks[0]?.id || "");
    }
  }, [payMethod, outletBanks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Default the Card Account field to the right network's list once it
  // loads / method switches between Visa Card and Amex Card.
  useEffect(() => {
    const list = payMethod === "Visa Card" ? visaCards : payMethod === "Amex Card" ? amexCards : [];
    if (!list.find(c => c.id === cardId)) {
      setCardId(list[0]?.id || "");
    }
  }, [payMethod, cardAccounts]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submit() {
  if (!amount || parseFloat(amount) <= 0) { toast_("Enter valid amount", "err"); return; }
  if (payMethod === "Bank" && !bankId) { toast_("Select a bank account", "err"); return; }
  if (payMethod === "Visa Card" && !cardId) { toast_("Select a Visa card account", "err"); return; }
  if (payMethod === "Amex Card" && !cardId) { toast_("Select an Amex card account", "err"); return; }

  const amt = parseFloat(amount);
  const acc = accounts.find(a => a.id === accId);
  const baseRec = {
    date, account_id: accId,
    description: desc, amount: amt, paid_via: payMethod,
    outlet_id: outlet
  };
  // Extra columns (bank/card/cheque reference) are only attached to the
  // expense row itself if the schema already has them — falls back to the
  // base row so this never breaks saving on an older schema. The cheque
  // number and bank/card link are always recorded on the ledger entry
  // below regardless of whether these columns exist on `expenses`.
  const extraRec = {
    ...(payMethod === "Bank" ? { bank_id: bankId } : {}),
    ...((payMethod === "Visa Card" || payMethod === "Amex Card") ? { card_id: cardId } : {}),
    ...(chequeNo ? { cheque_no: chequeNo } : {}),
  };

 let { data, error } = await supabase.from("expenses").insert([{ ...baseRec, ...extraRec }]).select();
  if (error && Object.keys(extraRec).length) {
    // Column(s) not present on this schema yet — retry with the base fields only.
    ({ data, error } = await supabase.from("expenses").insert([baseRec]).select());
  }
  if (error) { toast_("Save failed: " + error.message, "err"); return; }

  // Some schemas/RLS setups don't hand back the inserted row on select-after-insert
  // for every payment method (seen with Bank/Card rows) — fall back to the record
  // we just sent so it appears immediately instead of only after a refresh.
  const savedRec = data?.[0] || { ...baseRec, ...extraRec, id: `tmp_${Date.now()}` };
  setRec(prev => [savedRec, ...prev]);

  const payeeDesc = `Expense: ${acc?.name || accId}`;

  // Cash/Bank/Card ledger — routed by payment method, mutually exclusive
  // so an expense only ever hits ONE of Cash / Bank / Visa / Amex.
  if (payMethod === "Cash") {
    // Unchanged — In Hand Cash Ledger, Cash Out (credit) side.
    await addCashEntry(outlet, {
      date, description: payeeDesc,
      type: "out", debit: 0, credit: amt,
    });
  } else if (payMethod === "Bank") {
    // Selected Bank Account only — Bank Ledger, Debit/money-out side.
    // Stored convention (see S_Bank.jsx BankLedgerView): credit = money out.
    await addBankEntry(outlet, {
      date, bankId,
      description: payeeDesc,
      checkNo: chequeNo,
      type: "out", debit: 0, credit: amt,
    });
  } else if (payMethod === "Visa Card" || payMethod === "Amex Card") {
    // Selected Visa/Amex card account only — Card Settlement Ledger,
    // Debit side (same pattern as the Card → Bank transfer in S_Card.jsx,
    // which also reduces a card account's balance via debit).
    await addCardEntry(outlet, {
      date, cardId,
      description: payeeDesc,
      txnType: "expense",
      debit: amt, credit: 0,
    });
  }

  // GL entry — unchanged, independent of payment method.
  await addGLEntry(outlet, {
    date, account_id: accId,
    description: acc?.name || accId,
    debit: amt, credit: 0, source: "expense",
  });

  toast_("Expense saved ✓");
  setDesc(""); setAmount(""); setChequeNo("");
}

  const mo     = today().slice(0, 7);
  const mTotal = records.filter(r => monthOf(r.date) === mo).reduce((a, r) => a + r.amount, 0);
  const byCat  = records
    .filter(r => monthOf(r.date) === mo)
    .reduce((a, r) => {
      const name = accounts.find(acc => acc.id === r.account_id)?.name || r.account_id;
      a[name] = (a[name] || 0) + r.amount;
      return a;
    }, {});

    const selectedBank = outletBanks.find(b => b.id === bankId);
  const selectedCard = cardAccounts.find(c => c.id === cardId);

 
  // PAYEMENT sheet categories. "CUSTOM" reveals a free-text field so
  // staff can still type something not on the list.
  const OCP_PRESETS = ["BB CASH", "BBB", "UBB", "DBB", "MR.KK LOAN", "UG DISCOUNT"];

  const [ocpDate, setOcpDate] = useState(today());
  const [ocpType, setOcpType] = useState("drawing"); // "drawing" | "other_cash"
  const [ocpPreset, setOcpPreset] = useState(OCP_PRESETS[0]);
  const [ocpDesc, setOcpDesc] = useState("");
  const [ocpAmt,  setOcpAmt]  = useState("");
  const [ocpRecords, setOcpRecords] = useState([]);
  useEffect(() => {
    supabase.from("cash_ledger")
      .select("*").eq("outlet_id", outlet)
      .in("balance_type", ["drawing", "other_cash"])
      .order("date", { ascending: false })
      .then(({ data }) => setOcpRecords(data || []));
  }, [outlet]);

   const [ocpSaving, setOcpSaving] = useState(false);

    async function submitOtherCashPayment() {
    if (ocpSaving) return; // prevents a double-click (or double-fire) from inserting twice
    if (!ocpAmt || parseFloat(ocpAmt) <= 0) { toast_("Enter valid amount", "err"); return; }
    // Other Cash Payment: use the preset unless "CUSTOM" is picked, in
    // which case the free-text field is required. Personal Drawing keeps
    // using the free-text field as before.
    if (ocpType === "other_cash" && ocpPreset === "CUSTOM" && !ocpDesc.trim()) {
      toast_("Enter a description for the custom entry", "err"); return;
    }
    setOcpSaving(true);
    try {
      const amt = parseFloat(ocpAmt);
      const label = ocpType === "drawing"
        ? "Personal Drawing"
        : (ocpPreset === "CUSTOM" ? ocpDesc.trim() : ocpPreset);
      const finalDesc = ocpType === "drawing" ? (ocpDesc || label) : label;
      await addCashEntry(outlet, {
        date: ocpDate, description: finalDesc,
        type: ocpType, debit: 0, credit: amt,
      });
      setOcpRecords(prev => [{ date: ocpDate, description: finalDesc, credit: amt, balance_type: ocpType, id: `tmp_${Date.now()}` }, ...prev]);
      toast_(`${label} saved ✓`);
      setOcpDesc(""); setOcpAmt("");
    } finally {
      setOcpSaving(false);
    }
  }
  // ── Cash Balance Detail reconciliation (Petty Cash / Coins / Total
  // Pending / Different) — month-scoped, mirrors S_Bank.jsx's reconciliation
  // pattern but for the single In Hand Cash ledger.
  const cbMonth = today().slice(0, 7);
  const [pettyCash, setPettyCashVal] = useState(0);
  const [coins,     setCoinsVal]     = useState(0);
  const [pendAmt,   setPendAmtVal]   = useState(0);
  const [pendDate,  setPendDateVal]  = useState(today());
  const [diffAmt,   setDiffAmtVal]   = useState(0);
  const [diffSign,  setDiffSignVal]  = useState("+");
  useEffect(() => {
    getCashPettyCash(outlet, cbMonth).then(setPettyCashVal);
    getCashCoins(outlet, cbMonth).then(setCoinsVal);
    getCashPending(outlet, cbMonth).then(v => setPendAmtVal(v || 0));
    getCashPendingDate(outlet, cbMonth).then(d => setPendDateVal(d || today()));
    getCashDifferent(outlet, cbMonth).then(({ amount, sign }) => { setDiffAmtVal(amount); setDiffSignVal(sign); });
  }, [outlet, cbMonth]);

  async function saveCashDetail() {
    await setCashPettyCash(outlet, parseFloat(pettyCash) || 0, cbMonth);
    await setCashCoins(outlet, parseFloat(coins) || 0, cbMonth);
    await setCashPending(outlet, parseFloat(pendAmt) || 0, pendDate, cbMonth);
    await setCashDifferent(outlet, parseFloat(diffAmt) || 0, diffSign, cbMonth);
    toast_("Cash Balance Detail saved ✓");
  }

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

            {/* ── Bank Account — Bank only, required, admin-assigned accounts only ── */}
            {payMethod === "Bank" && (
              <div className="ff">
                <label>Bank Account *</label>
                <select value={bankId} onChange={e => setBankId(e.target.value)}>
                  <option value="">Select bank account…</option>
                  {outletBanks.map(b => (
                    <option key={b.id} value={b.id}>{b.bank} — {b.account_no || b.accountNo}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Card Account — Visa/Amex only, required, admin-assigned accounts only ── */}
            {(payMethod === "Visa Card" || payMethod === "Amex Card") && (
              <div className="ff">
                <label>{payMethod} Account *</label>
                <select value={cardId} onChange={e => setCardId(e.target.value)}>
                  <option value="">Select card account…</option>
                  {(payMethod === "Visa Card" ? visaCards : amexCards).map(c => (
                    <option key={c.id} value={c.id}>{c.bank} — {c.account_no || c.accountNo}</option>
                  ))}
                </select>
              </div>
            )}

            {/* ── Cheque No — optional, all methods ── */}
            <div className="ff">
              <label>Cheque No</label>
              <input placeholder="Optional" value={chequeNo} onChange={e => setChequeNo(e.target.value)} />
            </div>
          </div>

          {payMethod === "Cash" && (
            <div className="nbox nb-a" style={{ marginBottom: 10 }}>
              ⚠ Cash expense will auto-deduct from In Hand Cash.
            </div>
          )}
          {payMethod === "Bank" && (
            <div className="nbox nb-a" style={{ marginBottom: 10 }}>
              ⚠ {selectedBank ? <>Will deduct from <strong>{selectedBank.bank} — {selectedBank.account_no || selectedBank.accountNo}</strong> and appear on the Debit side of its Bank Ledger.</> : "Select a bank account — the expense will deduct from that account's Bank Ledger."}
            </div>
          )}
          {(payMethod === "Visa Card" || payMethod === "Amex Card") && (
            <div className="nbox nb-a" style={{ marginBottom: 10 }}>
              ⚠ {selectedCard ? <>Will deduct from <strong>{selectedCard.bank} — {selectedCard.account_no || selectedCard.accountNo}</strong> and appear on the Debit side of the Card Settlement Ledger.</> : `Select a ${payMethod} account — the expense will deduct from that card's Settlement Ledger.`}
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
                 <td style={{ fontSize: 11 }}>{accounts.find(a => a.id === r.account_id)?.name || r.account_id}</td>
                 <td style={{ fontSize: 11, color: "var(--mut)" }}>{r.description || "—"}</td>
                 <td><span className={`badge ${r.paid_via === "Cash" ? "ba" : "bb"}`}>{r.paid_via}</span></td>
                <td className="rt mono cr bold">Rs.{fmt(r.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
 
  {/* ── Other Cash Payments / Personal Drawings ── */}
      <div className="card">
        <div className="chd"><h3>Other Cash Payments</h3></div>
        <div style={{ padding: 14 }}>
          <div className="fg">
            <div className="ff">
              <label>Date</label>
              <input type="date" value={ocpDate} onChange={e => setOcpDate(e.target.value)} />
            </div>
                      <div className="ff">
              <label>Type</label>
              <select value={ocpType} onChange={e => setOcpType(e.target.value)}>
                <option value="drawing">Personal Drawing</option>
                <option value="other_cash">Other Cash Payment</option>
              </select>
            </div>
            {ocpType === "other_cash" && (
              <div className="ff">
                <label>Category *</label>
                <select value={ocpPreset} onChange={e => setOcpPreset(e.target.value)}>
                  {OCP_PRESETS.map(p => <option key={p} value={p}>{p}</option>)}
                  <option value="CUSTOM">Other</option>
                </select>
              </div>
            )}
            <div className="ff">
              <label>Amount (Rs.) *</label>
              <input type="number" placeholder="0.00" value={ocpAmt} onChange={e => setOcpAmt(e.target.value)} />
            </div>
            {/* Personal Drawing: free-text description as before.
                Other Cash Payment: free-text only shown/required when
                CUSTOM is selected in the Category dropdown above. */}
            {(ocpType === "drawing" || ocpPreset === "CUSTOM") && (
              <div className="ff full">
                <label>Description{ocpType === "other_cash" ? " *" : ""}</label>
                <input placeholder="Details…" value={ocpDesc} onChange={e => setOcpDesc(e.target.value)} />
              </div>
            )}
          </div>
          <div className="nbox nb-a" style={{ marginBottom: 10 }}>
            ⚠ Deducts from In Hand Cash and appears as its own line in the Cash Flow Statement.
          </div>
           <button className="btn btng" onClick={submitOtherCashPayment} disabled={ocpSaving}>
          {I.check} {ocpSaving ? "Saving…" : "Save"}
          </button> 
        </div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Type</th><th>Description</th><th className="rt">Amount</th></tr></thead>
          <tbody>
            {ocpRecords.length === 0 && <tr><td colSpan={4}><div className="empty">No entries yet.</div></td></tr>}
            {ocpRecords.slice(0, 25).map(r => (
              <tr key={r.id}>
                <td className="mono">{r.date}</td>
                <td><span className="badge ba">{r.balance_type === "drawing" ? "Personal Drawing" : "Other Cash"}</span></td>
                <td style={{ fontSize: 11, color: "var(--mut)" }}>{r.description || "—"}</td>
                <td className="rt mono cr bold">Rs.{fmt(r.credit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Cash Balance Detail (month-end reconciliation) ── */}
      <div className="card">
        <div className="chd"><h3>Cash Balance Detail — {cbMonth}</h3></div>
        <div style={{ padding: 14 }}>
          <div className="fg">
            <div className="ff">
              <label>Petty Cash (Rs.)</label>
              <input type="number" value={pettyCash} onChange={e => setPettyCashVal(e.target.value)} />
            </div>
            <div className="ff">
              <label>Coins (Rs.)</label>
              <input type="number" value={coins} onChange={e => setCoinsVal(e.target.value)} />
            </div>
            <div className="ff">
              <label>Total Pending Date</label>
              <input type="date" value={pendDate} onChange={e => setPendDateVal(e.target.value)} />
            </div>
            <div className="ff">
              <label>Total Pending (Rs.)</label>
              <input type="number" value={pendAmt} onChange={e => setPendAmtVal(e.target.value)} />
            </div>
            <div className="ff">
              <label>Different Sign</label>
              <select value={diffSign} onChange={e => setDiffSignVal(e.target.value)}>
                <option value="+">+ (Cash Over)</option>
                <option value="-">− (Cash Short)</option>
              </select>
            </div>
            <div className="ff">
              <label>Different (Rs.)</label>
              <input type="number" value={diffAmt} onChange={e => setDiffAmtVal(e.target.value)} />
            </div>
          </div>
          <button className="btn btnd btnsm" onClick={saveCashDetail}>{I.check} Save Cash Balance Detail</button>
        </div>
      </div>
       </>
  );
}
  