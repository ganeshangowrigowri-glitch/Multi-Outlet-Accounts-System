// src/components/staff/S_Card.jsx
// ─────────────────────────────────────────────────────────────
//  Staff › Card Settlement
//  Records card/POS collections ONLY. Interest/commission is
//  deducted automatically at the rate the admin set on each
//  card account (Bank Master, Account Type = "Card"), and the
//  net amount is what shows in the ledger's running balance —
//  mirroring the Excel "VIZA CARD" / "VIZA CARD 2" sheets.
//
//  This component does NOT touch bank deposits. Bank deposits
//  are a separate page/flow — see S_Bank.jsx.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { fmt, today } from "../../utils/helpers";
import { supabase } from "../../supabase";
import { I } from "../../utils/icons";
import { getCardLedger, addCardEntry, getCardBF, getCardBFDate, setCardBF, addBankEntry, addCashEntry, getCardPending, getCardPendingDate, setCardPending, getCardCD, getCardCDDate, setCardCD, getCardDifferent, setCardDifferent } from "../../db";
import { printLedger } from "../../utils/printLedger";

// ════════════════════════════════════════════════════════════
// ─── Month helpers for month-wise B/F, Pending, C/D, Different ─────
const monthStr = (d) => (d || today()).slice(0, 7); // "YYYY-MM"
const prevMonthStr = (m) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const monthRange = (m) => {
  const [y, mo] = m.split("-").map(Number);
  const lastDate = new Date(y, mo, 0).getDate();
  return [`${m}-01`, `${m}-${String(lastDate).padStart(2, "0")}`];
};
export default function S_Card({ outlet, toast_ }) {
  const [tab, setTab] = useState(0);
  const [cardAccounts, setCardAccounts] = useState([]);
  const [outletBanks, setOutletBanks] = useState([]);

  useEffect(() => {
    // Only fetch account_type = "card" here — this page must never
    // see or list plain bank accounts. Admin sets up the three card
    // accounts (Visa Card 1, Visa Card 2, NTB/AMEX) in Bank Master,
    // each with its own fee_pct.
      supabase.from("bank_accounts").select("*")
      .eq("outlet_id", outlet).eq("active", true).eq("hidden", false)
      .eq("account_type", "card")
      .order("bank")
      .then(({ data }) => setCardAccounts(data || []));
      }, [outlet]);

  useEffect(() => {
    // Bank accounts assigned to THIS outlet only, for the Transfer tab's
    // "Bank Account" field — excludes card-type accounts.
    supabase.from("bank_accounts").select("*")
      .eq("outlet_id", outlet).eq("active", true).eq("hidden", false)
      .neq("account_type", "card")
      .order("bank")
      .then(({ data }) => setOutletBanks(data || []));
  }, [outlet]);

  if (cardAccounts.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{I.bank}</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>No Card Accounts Set Up</div>
        <div style={{ fontSize: 12.5, color: "var(--mut)" }}>
          Ask your admin to add card accounts for this outlet in Bank Master
          (Account Type = "Card") — e.g. Visa Card 1, Visa Card 2, NTB/AMEX — with
          each account's interest/commission % set.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="stabs no-print" style={{ marginBottom: 16 }}>
        {["Card Settlement", "Transfer to Bank", "Ledger"].map((t, i) => (
          <button key={i} className={`stab ${tab === i ? "act" : ""}`} onClick={() => setTab(i)}>
            {I.bank} {t}
          </button>
        ))}
      </div>

      {tab === 0 && <RecordCollection outlet={outlet} cardAccounts={cardAccounts} toast_={toast_} />}
      {tab === 1 && <TransferToBank outlet={outlet} cardAccounts={cardAccounts} outletBanks={outletBanks} toast_={toast_} />}
      {tab === 2 && <LedgerView outlet={outlet} cardAccounts={cardAccounts} toast_={toast_} />}
    </div>
  );
}
// ════════════════════════════════════════════════════════════
// TAB 1 — Transfer from a Card Account to a Bank Account.
// Card Settlement Ledger → Debit (balance decreases)
// Bank Ledger → money in (balance increases), same convention as Bank Deposit
// ════════════════════════════════════════════════════════════
function TransferToBank({ outlet, cardAccounts, outletBanks, toast_ }) {
  const [date, setDate] = useState(today());
  const [cardId, setCardId] = useState(cardAccounts[0]?.id || "");
  const [bankId, setBankId] = useState(outletBanks[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [checkNo, setCheckNo] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (cardAccounts.length && !cardId) setCardId(cardAccounts[0].id); }, [cardAccounts]);
  useEffect(() => { if (outletBanks.length && !bankId) setBankId(outletBanks[0].id); }, [outletBanks]);

  async function save() {
    if (!cardId) { toast_("Select a card account", "err"); return; }
    if (!bankId) { toast_("Select a bank account", "err"); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast_("Enter a valid amount", "err"); return; }

    setSaving(true);
    const desc = description || "Card to Bank transfer";

    // Card Settlement Ledger → Debit (reduces this card account's balance only)
    const cardOk = await addCardEntry(outlet, {
      date, cardId,
      description: desc,
      txnType: "transfer",
      debit: amt, credit: 0,
    });

  // Bank Ledger → money in, linked to the selected bank account only
    const bankOk = await addBankEntry(outlet, {
      date, bankId,
      description: desc,
      checkNo,
      debit: amt, credit: 0,
    });

    setSaving(false);
    if (cardOk && bankOk) {
      toast_(`Transfer recorded ✓ Rs.${fmt(amt)} moved to bank`);
      setAmount(""); setDescription(""); setCheckNo("");
    } else {
      toast_("Failed to save — check connection", "err");
    }
  }

  const card = cardAccounts.find(c => c.id === cardId);
  const bank = outletBanks.find(b => b.id === bankId);

  return (
    <div className="card">
      <div className="chd"><h3>Transfer — Card to Bank</h3><p>{outlet}</p></div>
      <div style={{ padding: 14 }}>
        {outletBanks.length === 0 ? (
          <div style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>
            No bank accounts assigned to this outlet yet — ask your admin to add one in Bank Master.
          </div>
        ) : (
          <>
            <div className="fg">
              <div className="ff">
                <label>Transfer Date *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} />
              </div>
              <div className="ff">
                <label>Card Account *</label>
                <select value={cardId} onChange={e => setCardId(e.target.value)}>
                  {cardAccounts.map(c => (
                    <option key={c.id} value={c.id}>{c.bank} — {c.account_no || c.accountNo}</option>
                  ))}
                </select>
              </div>
              <div className="ff">
                <label>Bank Account *</label>
                <select value={bankId} onChange={e => setBankId(e.target.value)}>
                  {outletBanks.map(b => (
                    <option key={b.id} value={b.id}>{b.bank} — {b.account_no || b.accountNo}</option>
                  ))}
                </select>
              </div>
              <div className="ff">
                <label>Transfer Amount (Rs.) *</label>
                <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
              </div>
            <div className="ff">
                <label>Check No</label>
                <input placeholder="Optional" value={checkNo} onChange={e => setCheckNo(e.target.value)} />
              </div>
              <div className="ff" style={{ gridColumn: "1 / -1" }}>
                <label>Description / Reference</label>
                <input placeholder="Optional" value={description} onChange={e => setDescription(e.target.value)} />
              </div>
            </div>

            {card && bank && (
              <div style={{ background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "10px 14px", marginTop: 10, fontSize: 12 }}>
                <span style={{ color: "var(--mut)" }}>Moving from</span>{" "}
                <strong>{card.bank} — {card.account_no || card.accountNo}</strong>{" "}
                <span style={{ color: "var(--mut)" }}>to</span>{" "}
                <strong>{bank.bank} — {bank.account_no || bank.accountNo}</strong>
              </div>
            )}

            <div style={{ marginTop: 14 }}>
              <button className="btn btng" onClick={save} disabled={saving}>
                {I.check} {saving ? "Saving…" : "Save Transfer"}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 10 }}>
              Reduces the selected Card Account's balance and adds the same amount to the selected
              Bank Account. Appears on both the Card Settlement Ledger and the Bank window → Bank Ledger tab.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 0 — Record a card collection. Interest is deducted
// automatically the moment the amount is entered.
// ════════════════════════════════════════════════════════════
function RecordCollection({ outlet, cardAccounts, toast_ }) {
  const [date, setDate] = useState(today());
  const [cardId, setCardId] = useState(cardAccounts[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const card = cardAccounts.find(c => c.id === cardId);
  const feePct = Number(card?.fee_pct) || 0;
  const gross = parseFloat(amount) || 0;
  const interest = Math.round(gross * feePct) / 100;   // commission/interest deducted
  const net = gross - interest;                          // this is what hits the ledger balance

  async function save() {
    if (!cardId) { toast_("Select a card account", "err"); return; }
    if (!gross || gross <= 0) { toast_("Enter a valid amount", "err"); return; }
    setSaving(true);
    const ok = await addCardEntry(outlet, {
      date, cardId,
      description: description || "Card collection",
      txnType: "sale",
      debit: 0,
      credit: gross,      // gross amount collected (Excel "Day Sheet Credit")
      feePct,
      interest,           // computed interest/commission
      net,                // net after interest (Excel "Bank Deposit" column)
    });
    if (ok) {
      // Daily Sale already booked this whole amount as cash-in (it can't
      // tell cash sales from card sales) — back it out of In Hand Cash.
      await addCashEntry(outlet, {
        date,
        description: description || "Card Settlement",
        type: "out",
        debit: 0,
        credit: gross,
      });
    }
    setSaving(false);
    if (ok) {
      toast_(`Recorded ✓ Net Rs.${fmt(net)} (interest Rs.${fmt(interest)} deducted)`);
      setAmount(""); setDescription("");
    } else {
      toast_("Failed to save — check connection", "err");
    }
  }
  return (
    <div className="card">
      <div className="chd"><h3>Card Settlement — Record Collection</h3><p>{outlet}</p></div>
      <div style={{ padding: 14 }}>
        <div className="fg">
          <div className="ff">
            <label>Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="ff">
            <label>Card Account *</label>
            <select value={cardId} onChange={e => setCardId(e.target.value)}>
              {cardAccounts.map(c => (
                <option key={c.id} value={c.id}>
                  {c.bank} — {c.account_no || c.accountNo} ({Number(c.fee_pct) || 0}% interest)
                </option>
              ))}
            </select>
          </div>
          <div className="ff">
            <label>Amount Collected (Rs.) *</label>
            <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="ff" style={{ gridColumn: "1 / -1" }}>
            <label>Description</label>
            <input placeholder="e.g. Daily card sales" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>

        {gross > 0 && (
          <div style={{ background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "10px 14px", marginTop: 10, display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12.5 }}>
            <span><span style={{ color: "var(--mut)" }}>Gross Collected:</span> <strong>Rs.{fmt(gross)}</strong></span>
            <span><span style={{ color: "var(--mut)" }}>Interest/Commission ({feePct}%):</span> <strong style={{ color: "var(--red,#f87171)" }}>-Rs.{fmt(interest)}</strong></span>
            <span><span style={{ color: "var(--mut)" }}>Net:</span> <strong style={{ color: "var(--grn,#4ade80)" }}>Rs.{fmt(net)}</strong></span>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <button className="btn btng" onClick={save} disabled={saving}>
            {I.check} {saving ? "Saving…" : "Save Card Collection"}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 10 }}>
          Interest/commission is deducted automatically at the rate set by admin on this card account.
          This page only records card collections — it never writes to the Bank Ledger. Record the
          actual bank deposit separately on the Bank Deposit page once it appears in your bank statement.
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 1 — Ledger, laid out exactly like the Excel VIZA CARD sheet:
// Date | Debit | Credit (gross) | Balance | Interest | Bank Deposit (net)
// ════════════════════════════════════════════════════════════
  function LedgerView({ outlet, cardAccounts, toast_ }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cardId, setCardId] = useState(cardAccounts[0]?.id || "");
  const [month, setMonth] = useState(monthStr(today()));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  // Selecting a month scopes the ledger totals (and therefore Pending Balance)
  // to that month. Staff can still fine-tune Period From/To afterward if needed.
  useEffect(() => {
    const [first, last] = monthRange(month);
    setFrom(first);
    setTo(last);
  }, [month]);
  useEffect(() => {
    if (cardAccounts.length && !cardId) setCardId(cardAccounts[0].id);
  }, [cardAccounts]);

  useEffect(() => {
    setLoading(true);
    getCardLedger(outlet).then(data => { setEntries(data || []); setLoading(false); });
  }, [outlet]);

  const cardName = id => {
    const c = cardAccounts.find(c => c.id === id);
    return c ? `${c.bank} — ${c.account_no || c.accountNo}` : "—";
  };

const cardEntries = entries.filter(e =>
    (!cardId || e.card_id === cardId) && e.balance_type !== "bf" && e.balance_type !== "pending" && e.balance_type !== "cd_manual" && e.balance_type !== "different"
  );

  // Balance B/F = opening balance set for this account (or combined, if "All") +
  // everything dated before the "From" filter — same pattern as the Bank Ledger.
const [openingBF, setOpeningBF] = useState(0);
  const [bfDate, setBFD] = useState(today());
  const [bfIsAuto, setBfIsAuto] = useState(false); // true = value shown is carried forward, not yet saved for this month
  useEffect(() => {
    (async () => {
      const saved = await getCardBF(outlet, cardId || undefined, month);
      if (saved !== null) {
        setOpeningBF(saved);
        setBFD((await getCardBFDate(outlet, cardId || undefined, month)) || monthRange(month)[0]);
        setBfIsAuto(false);
      } else {
        // Carry forward: previous month's Balance C/D → this month's Balance B/F
        const prev = prevMonthStr(month);
        const prevCD = await getCardCD(outlet, cardId || undefined, prev);
        const prevCDDate = await getCardCDDate(outlet, cardId || undefined, prev);
        setOpeningBF(prevCD || 0);
        setBFD(prevCDDate || monthRange(month)[0]);
        setBfIsAuto(true);
      }
    })();
  }, [outlet, cardId, month]);

  async function saveBF() {
    if (!cardId) { toast_ && toast_("Select a specific card account first", "err"); return; }
    const ok = await setCardBF(outlet, parseFloat(openingBF) || 0, cardId, bfDate, month);
    const saved = await getCardBF(outlet, cardId, month);
    setOpeningBF(saved || 0);
    setBfIsAuto(false);
    toast_ && toast_(ok ? "Opening balance saved ✓" : "Save failed — check console", "err");
  }
  // Computes a previous month's Final Pending Balance from ITS OWN saved
  // B/F, Pending, Balance C/D, and Different (one month back only — this is
  // not recursive, so it relies on that month's own explicitly saved values).
  async function computeFinalPendingBalance(outlet, cardId, m, allEntries) {
    const [first, last] = monthRange(m);
    const netOfE = e => Number(e.net ?? (Number(e.credit || 0) - Number(e.interest || 0)));
    const monthEntries = allEntries.filter(e =>
      (!cardId || e.card_id === cardId) &&
      e.balance_type !== "bf" && e.balance_type !== "pending" &&
      e.balance_type !== "cd_manual" && e.balance_type !== "different" &&
      e.date >= first && e.date <= last
    );
    const mTotalDebit = monthEntries.reduce((a, e) => a + Number(e.debit || 0), 0);
    const mTotalNet    = monthEntries.reduce((a, e) => a + netOfE(e), 0);
    const mBf      = (await getCardBF(outlet, cardId, m)) || 0;
    const mPending = (await getCardPending(outlet, cardId, m)) || 0;
    const mCd      = (await getCardCD(outlet, cardId, m)) || 0;
    const mDiff    = await getCardDifferent(outlet, cardId, m);
    // Must match the live Pending Balance formula exactly: bf + Net − Debit + Pending − Balance C/D
    const mPendingBalance = mBf + mTotalNet - mTotalDebit + mPending - mCd;
    return mDiff.sign === "-" ? mPendingBalance - mDiff.amount : mPendingBalance + mDiff.amount;
  }
  // Last Month Pending Amount — same per-card storage pattern as B/F above.
  const [pendingAmt, setPendingAmt] = useState(0);
  const [pendingDate, setPendingDate] = useState(today());
  const [pendingIsAuto, setPendingIsAuto] = useState(false); // true = carried from prev month's Final Pending Balance
  useEffect(() => {
    (async () => {
      const saved = await getCardPending(outlet, cardId || undefined, month);
      if (saved !== null) {
        setPendingAmt(saved);
        setPendingDate((await getCardPendingDate(outlet, cardId || undefined, month)) || monthRange(month)[0]);
        setPendingIsAuto(false);
      } else {
        // Carry forward: previous month's Final Pending Balance → this month's Last Month Pending Amount
        const prev = prevMonthStr(month);
        const prevFinal = await computeFinalPendingBalance(outlet, cardId, prev, entries);
        setPendingAmt(prevFinal || 0);
        setPendingDate(monthRange(prev)[1]);
        setPendingIsAuto(true);
      }
    })();
  }, [outlet, cardId, month, entries]);

  async function savePending() {
    if (!cardId) { toast_ && toast_("Select a specific card account first", "err"); return; }
    const ok = await setCardPending(outlet, parseFloat(pendingAmt) || 0, cardId, pendingDate, month);
    const saved = await getCardPending(outlet, cardId, month);
    setPendingAmt(saved || 0);
    setPendingIsAuto(false);
    toast_ && toast_(ok ? "Last month pending amount saved ✓" : "Save failed — check console", "err");
  }

  // Manually-set Balance C/D — purely a persisted display value, does not
  // affect the existing calculated `cd` used by Pending Balance etc.
const [cdManual, setCdManual] = useState(0);
  const [cdManualDate, setCdManualDate] = useState(today());
  useEffect(() => {
    getCardCD(outlet, cardId || undefined, month).then(v => setCdManual(v || 0));
    getCardCDDate(outlet, cardId || undefined, month).then(d => setCdManualDate(d || monthRange(month)[1]));
  }, [outlet, cardId, month]);

  async function saveCDManual() {
    if (!cardId) { toast_ && toast_("Select a specific card account first", "err"); return; }
    const ok = await setCardCD(outlet, parseFloat(cdManual) || 0, cardId, cdManualDate, month);
    const saved = await getCardCD(outlet, cardId, month);
    setCdManual(saved || 0);
    toast_ && toast_(ok ? "Balance C/D saved ✓" : "Save failed — check console", "err");
  }

  // Different — manual +/− adjustment applied to Pending Balance.
 const [diffAmt, setDiffAmt] = useState(0);
  const [diffSign, setDiffSign] = useState("+");
  useEffect(() => {
    getCardDifferent(outlet, cardId || undefined, month).then(({ amount, sign }) => {
      setDiffAmt(amount); setDiffSign(sign); // month-specific only — never carried from another month
    });
  }, [outlet, cardId, month]);

  async function saveDifferent() {
    if (!cardId) { toast_ && toast_("Select a specific card account first", "err"); return; }
    const ok = await setCardDifferent(outlet, parseFloat(diffAmt) || 0, diffSign, cardId, month);
    const saved = await getCardDifferent(outlet, cardId, month);
    setDiffAmt(saved.amount); setDiffSign(saved.sign);
    toast_ && toast_(ok ? "Different saved ✓" : "Save failed — check console", "err");
  }
    const netOf = e => Number(e.net ?? (Number(e.credit || 0) - Number(e.interest || 0)));
  // Balance B/F already reflects everything up to this month's opening date
  // (either staff-set or carried forward from last month's Balance C/D), so
  // it must NOT be added to again here — that was double-counting last
  // month's transactions into this month's balance.
  const bf = Number(openingBF) || 0;
  const period = cardEntries
    .filter(e => (!from || e.date >= from) && (!to || e.date <= to))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const totalDebit    = period.reduce((a, e) => a + Number(e.debit || 0), 0);
  const totalCredit   = period.reduce((a, e) => a + Number(e.credit || 0), 0);
  const totalInterest = period.reduce((a, e) => a + Number(e.interest || 0), 0);
  const totalNet      = period.reduce((a, e) => a + netOf(e), 0);
  const totalNetWithPending = totalNet + (Number(pendingAmt) || 0);
  // Pending Balance = B/F + Net Bank Deposit Total -  Debit Total + Last Month Pending Amount − Balance C/D
  const bankBalance = Number(cdManual) || 0; // "Bank Balance" = staff-set Balance C/D (manual)
  const pendingBalance = bf + totalNet - totalDebit + (Number(pendingAmt) || 0) - bankBalance;
  // Final Pending Balance = Pending Balance ± Different (sign staff-selected)
  const finalPendingBalance = diffSign === "-"
    ? pendingBalance - (Number(diffAmt) || 0)
    : pendingBalance + (Number(diffAmt) || 0);
  let running = bf;

  // Pending/running balance per card (summary boxes above the table) = sum(net) - sum(debit),
  // matching Excel's E = E_prev + (Credit * (1 - fee%)) - Debit — unchanged.
 const balances = {};
  cardAccounts.forEach(c => {
    balances[c.id] = entries
      .filter(e => e.card_id === c.id && e.balance_type !== "bf" && e.balance_type !== "pending" && e.balance_type !== "cd_manual" && e.balance_type !== "different")
      .reduce((s, e) => s + Number(e.net ?? e.credit ?? 0) - Number(e.debit || 0), 0);
  });
  return (
    <div className="card">
      <div className="chd">
        <div>
          <h3>Card Settlement Ledger</h3>
          <p>Full settlement detail — gross, interest, and net per collection</p>
        </div>
        <button className="btn btnd btnsm no-print" onClick={() => window.print()}>{I.print} Print</button>
      </div>

      <div className="no-print" style={{ padding: "10px 14px", display: "flex", gap: 12, flexWrap: "wrap" }}>
        {cardAccounts.map(c => (
          <div key={c.id} className="card" style={{ padding: "10px 14px", flex: "1 1 200px" }}>
            <div style={{ fontSize: 11, color: "var(--mut)" }}>{c.bank} — {c.account_no || c.accountNo}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: balances[c.id] > 0 ? "var(--gld2,#f59e0b)" : "var(--mut)" }}>
              Rs.{fmt(balances[c.id] || 0)}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--mut)" }}>{Number(c.fee_pct) || 0}% interest · net balance</div>
          </div>
        ))}
      </div>
     <div className="no-print" style={{ padding: "10px 14px 0" }}>
        <div className="ff" style={{ maxWidth: 220 }}>
          <label>Select Month</label>
          <input type="month" value={month} onChange={e => setMonth(e.target.value)} />
        </div>
      </div>

      <div className="no-print" style={{ padding: "0 14px", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
          <label>Opening Balance Date</label>
          <input type="date" value={bfDate} onChange={e => setBFD(e.target.value)} />
        </div>
        <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
          <label>Balance B/F (Rs.)</label>
          <input type="number" value={openingBF} onChange={e => setOpeningBF(e.target.value)} />
        </div>
        <button className="btn btnd btnsm" onClick={saveBF}>{I.check} Set</button>
      </div>
      {bfIsAuto && (
        <div className="no-print" style={{ padding: "0 14px 8px", fontSize: 10.5, color: "var(--mut)" }}>
          Carried forward from {prevMonthStr(month)}'s Balance C/D — click Set to confirm for this month.
        </div>
      )}

     <div className="no-print" style={{ padding: "0 14px", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
          <label>Pending Amount Date</label>
          <input type="date" value={pendingDate} onChange={e => setPendingDate(e.target.value)} />
        </div>
        <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
          <label>Last Month Pending Amount (Rs.)</label>
          <input type="number" value={pendingAmt} onChange={e => setPendingAmt(e.target.value)} />
        </div>
        <button className="btn btnd btnsm" onClick={savePending}>{I.check} Set</button>
      </div>
      {pendingIsAuto && (
        <div className="no-print" style={{ padding: "0 14px 8px", fontSize: 10.5, color: "var(--mut)" }}>
          Carried forward from {prevMonthStr(month)}'s Final Pending Balance — click Set to confirm for this month.
        </div>
      )}

      <div className="no-print" style={{ padding: "0 14px", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
          <label>Balance C/D Date</label>
          <input type="date" value={cdManualDate} onChange={e => setCdManualDate(e.target.value)} />
        </div>
        <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
          <label>Balance C/D Amount (Rs.)</label>
          <input type="number" value={cdManual} onChange={e => setCdManual(e.target.value)} />
        </div>
        <button className="btn btnd btnsm" onClick={saveCDManual}>{I.check} Set</button>
      </div>

      <div className="no-print" style={{ padding: "0 14px", display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="ff" style={{ marginBottom: 0, minWidth: 90 }}>
          <label>Sign</label>
          <select value={diffSign} onChange={e => setDiffSign(e.target.value)}>
            <option value="+">+</option>
            <option value="-">−</option>
          </select>
        </div>
        <div className="ff" style={{ marginBottom: 0, flex: 1, minWidth: 140 }}>
          <label>Different (Rs.)</label>
          <input type="number" value={diffAmt} onChange={e => setDiffAmt(e.target.value)} />
        </div>
        <button className="btn btnd btnsm" onClick={saveDifferent}>{I.check} Set</button>
      </div>

      <div className="no-print" style={{ padding: "10px 14px", display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div className="ff" style={{ minWidth: 160 }}>
          <label>Card Account</label>
          <select value={cardId} onChange={e => setCardId(e.target.value)}>
            <option value="">All Card Accounts</option>
            {cardAccounts.map(c => <option key={c.id} value={c.id}>{c.bank} — {c.account_no || c.accountNo}</option>)}
          </select>
        </div>
        <div className="ff">
          <label>Period From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div className="ff">
          <label>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} />
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: "var(--s3)" }}>
              <th style={{ padding: "6px 10px", textAlign: "left" }}>Date</th>
              <th style={{ padding: "6px 10px", textAlign: "left" }}>Card Account</th>
              <th style={{ padding: "6px 10px", textAlign: "left" }}>Description</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Debit</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Credit (Gross)</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Interest</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Net (Bank Deposit)</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ background: "var(--s2)" }}>
              <td style={{ padding: "6px 10px" }} colSpan={7}>
                <strong>Balance B/F</strong> <span style={{ fontWeight: 400, color: "var(--mut)" }}>({bfDate})</span>
              </td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(bf)}</td>
            </tr>
            <tr style={{ background: "var(--s2)" }}>
              <td style={{ padding: "6px 10px" }} colSpan={3}>
                <strong>Last Month Pending Amount</strong> <span style={{ fontWeight: 400, color: "var(--mut)" }}>({pendingDate})</span>
              </td>
              <td style={{ padding: "6px 10px", textAlign: "right" }}>-</td>
              <td style={{ padding: "6px 10px", textAlign: "right" }}>-</td>
              <td style={{ padding: "6px 10px", textAlign: "right" }}>-</td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700, color: "var(--grn,#4ade80)" }}>{fmt(pendingAmt)}</td>
              <td style={{ padding: "6px 10px", textAlign: "right" }}>-</td>
            </tr>
            {loading && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>Loading…</td></tr>}
            {!loading && period.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>No entries in this period</td></tr>
            )}
            {period.map(e => {
              const net = netOf(e);
              running += net - Number(e.debit || 0);
              return (
                <tr key={e.id} style={{ borderBottom: "1px solid rgba(63,63,70,.2)" }}>
                  <td style={{ padding: "6px 10px" }}>{e.date}</td>
                  <td style={{ padding: "6px 10px" }}>{cardName(e.card_id)}</td>
                  <td style={{ padding: "6px 10px" }}>{e.description}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right" }}>{e.debit > 0 ? fmt(e.debit) : "-"}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right" }}>{e.credit > 0 ? fmt(e.credit) : "-"}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--red,#f87171)" }}>{e.interest > 0 ? fmt(e.interest) : "-"}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", color: "var(--grn,#4ade80)" }}>{net > 0 ? fmt(net) : "-"}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>{fmt(running)}</td>
                </tr>
              );
            })}
          <tr style={{ background: "var(--s2)" }}>
              <td style={{ padding: "6px 10px" }} colSpan={7}><strong>Pending Balance</strong></td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(pendingBalance)}</td>
            </tr>
            <tr style={{ background: "var(--s2)" }}>
              <td style={{ padding: "6px 10px" }} colSpan={7}>
                <strong>Different</strong> <span style={{ fontWeight: 400, color: "var(--mut)" }}>({diffSign})</span>
              </td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(diffAmt)}</td>
            </tr>
            <tr style={{ background: "var(--s2)" }}>
              <td style={{ padding: "6px 10px" }} colSpan={7}><strong>Final Pending Balance</strong></td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(finalPendingBalance)}</td>
            </tr>
            <tr style={{ background: "var(--s2)" }}>
              <td style={{ padding: "6px 10px" }} colSpan={7}>
                <strong>Balance C/D</strong> <span style={{ fontWeight: 400, color: "var(--mut)" }}>({cdManualDate})</span>
              </td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(cdManual)}</td>
            </tr>
          <tr style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr2,var(--bdr))" }}>
              <td style={{ padding: "6px 10px", fontWeight: 700 }} colSpan={3}>Total</td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(totalDebit)}</td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(totalCredit)}</td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(totalInterest)}</td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(totalNetWithPending)}</td>
              <td style={{ padding: "6px 10px" }}></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}