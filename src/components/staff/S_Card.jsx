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
import { getCardLedger, addCardEntry, getCardBF, getCardBFDate, setCardBF, addBankEntry, getCardPending, getCardPendingDate, setCardPending } from "../../db";
import { printLedger } from "../../utils/printLedger";

// ════════════════════════════════════════════════════════════
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
      debit: amt, credit: 0,
    });

    setSaving(false);
    if (cardOk && bankOk) {
      toast_(`Transfer recorded ✓ Rs.${fmt(amt)} moved to bank`);
      setAmount(""); setDescription("");
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
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

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

  // Entries for the selected card account (or all, when "All Card Accounts" is chosen)
  const cardEntries = entries.filter(e =>
    (!cardId || e.card_id === cardId) && e.balance_type !== "bf" && e.balance_type !== "pending"
  );

  // Balance B/F = opening balance set for this account (or combined, if "All") +
  // everything dated before the "From" filter — same pattern as the Bank Ledger.
  const [openingBF, setOpeningBF] = useState(0);
  const [bfDate, setBFD] = useState(today());
  useEffect(() => {
    getCardBF(outlet, cardId || undefined).then(setOpeningBF);
    getCardBFDate(outlet, cardId || undefined).then(d => setBFD(d || today()));
  }, [outlet, cardId]);

  async function saveBF() {
    if (!cardId) { toast_ && toast_("Select a specific card account first", "err"); return; }
    const ok = await setCardBF(outlet, parseFloat(openingBF) || 0, cardId, bfDate);
    const saved = await getCardBF(outlet, cardId);
    setOpeningBF(saved);
    toast_ && toast_(ok ? "Opening balance saved ✓" : "Save failed — check console", "err");
  }

  // Last Month Pending Amount — same per-card storage pattern as B/F above.
  const [pendingAmt, setPendingAmt] = useState(0);
  const [pendingDate, setPendingDate] = useState(today());
  useEffect(() => {
    getCardPending(outlet, cardId || undefined).then(setPendingAmt);
    getCardPendingDate(outlet, cardId || undefined).then(d => setPendingDate(d || today()));
  }, [outlet, cardId]);

  async function savePending() {
    if (!cardId) { toast_ && toast_("Select a specific card account first", "err"); return; }
    const ok = await setCardPending(outlet, parseFloat(pendingAmt) || 0, cardId, pendingDate);
    const saved = await getCardPending(outlet, cardId);
    setPendingAmt(saved);
    toast_ && toast_(ok ? "Last month pending amount saved ✓" : "Save failed — check console", "err");
  }

  const netOf = e => Number(e.net ?? (Number(e.credit || 0) - Number(e.interest || 0)));
  const before = from ? cardEntries.filter(e => e.date < from) : [];
  const bf = (Number(openingBF) || 0) + before.reduce((a, e) => a + netOf(e) - Number(e.debit || 0), 0);
  const period = cardEntries
    .filter(e => (!from || e.date >= from) && (!to || e.date <= to))
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  const totalDebit    = period.reduce((a, e) => a + Number(e.debit || 0), 0);
  const totalCredit   = period.reduce((a, e) => a + Number(e.credit || 0), 0);
  const totalInterest = period.reduce((a, e) => a + Number(e.interest || 0), 0);
  const totalNet      = period.reduce((a, e) => a + netOf(e), 0);
  // Display-only: Net (Bank Deposit) Total shown in the Total row includes
  // Last Month Pending Amount. Balance C/D keeps using totalNet as-is, unchanged.
  const totalNetWithPending = totalNet + (Number(pendingAmt) || 0);
  const cd = bf + totalNet - totalDebit;
  // Pending Balance = B/F + Net Bank Deposit Total − Debit Total + Last Month Pending Amount − Bank Balance
  const bankBalance = cd; // "Bank Balance" = this ledger's own Balance C/D
  const pendingBalance = bf + totalNet - totalDebit + (Number(pendingAmt) || 0) - bankBalance;

  let running = bf;

  // Pending/running balance per card (summary boxes above the table) = sum(net) - sum(debit),
  // matching Excel's E = E_prev + (Credit * (1 - fee%)) - Debit — unchanged.
   const balances = {};
  cardAccounts.forEach(c => {
    balances[c.id] = entries
      .filter(e => e.card_id === c.id && e.balance_type !== "bf" && e.balance_type !== "pending")
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
              <td style={{ padding: "6px 10px" }} colSpan={7}><strong>Balance C/D</strong></td>
              <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 700 }}>{fmt(cd)}</td>
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