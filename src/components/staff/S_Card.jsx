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
import { getCardLedger, addCardEntry } from "../../db";
import { printLedger } from "../../utils/printLedger";

// ════════════════════════════════════════════════════════════
export default function S_Card({ outlet, toast_ }) {
  const [tab, setTab] = useState(0);
  const [cardAccounts, setCardAccounts] = useState([]);

  useEffect(() => {
    // Only fetch account_type = "card" here — this page must never
    // see or list plain bank accounts. Admin sets up the three card
    // accounts (Visa Card 1, Visa Card 2, NTB/AMEX) in Bank Master,
    // each with its own fee_pct.
    supabase.from("bank_accounts").select("*")
      .eq("outlet_id", outlet).eq("active", true).eq("hidden", false)
      .eq("account_type", "card")
      .then(({ data }) => setCardAccounts(data || []));
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
        {["Card Settlement", "Ledger"].map((t, i) => (
          <button key={i} className={`stab ${tab === i ? "act" : ""}`} onClick={() => setTab(i)}>
            {I.bank} {t}
          </button>
        ))}
      </div>

      {tab === 0 && <RecordCollection outlet={outlet} cardAccounts={cardAccounts} toast_={toast_} />}
      {tab === 1 && <LedgerView outlet={outlet} cardAccounts={cardAccounts} />}
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
function LedgerView({ outlet, cardAccounts }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCard, setFilterCard] = useState("");

  useEffect(() => {
    setLoading(true);
    getCardLedger(outlet).then(data => { setEntries(data || []); setLoading(false); });
  }, [outlet]);

  const cardName = id => {
    const c = cardAccounts.find(c => c.id === id);
    return c ? `${c.bank} — ${c.account_no || c.accountNo}` : "—";
  };

  const filtered = filterCard ? entries.filter(e => e.card_id === filterCard) : entries;
  const sorted = [...filtered].sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // Pending/running balance per card = sum(net) - sum(debit), matching
  // Excel's E = E_prev + (Credit * (1 - fee%)) - Debit
  const balances = {};
  cardAccounts.forEach(c => {
    balances[c.id] = entries
      .filter(e => e.card_id === c.id)
      .reduce((s, e) => s + Number(e.net ?? e.credit ?? 0) - Number(e.debit || 0), 0);
  });

  let running = 0;

  const filterLabel = filterCard ? cardName(filterCard) : "All Card Accounts";

  return (
    <div className="card">
      <div className="chd">
        <div>
          <h3>Card Settlement Ledger</h3>
          <p>Full settlement detail — gross, interest, and net per collection</p>
        </div>
        <button className="btn btnd btnsm no-print" onClick={printLedger}>
          {I.print} Print
        </button>
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

      <div className="no-print" style={{ padding: "0 14px 10px" }}>
        <select value={filterCard} onChange={e => setFilterCard(e.target.value)}>
          <option value="">All Card Accounts</option>
          {cardAccounts.map(c => <option key={c.id} value={c.id}>{c.bank} — {c.account_no || c.accountNo}</option>)}
        </select>
      </div>

      <div className="ledger-print-zone">
        <div className="ledger-print-header">
          <h1>Card Settlement Ledger</h1>
          <p>{outlet}</p>
          <p>{filterLabel}</p>
        </div>

        <div className="ledger-print-table-wrap" style={{ overflowX: "auto" }}>
          <table className="ledger-print-tbl ledger-print-tbl--wide" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
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
              {loading && <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>Loading…</td></tr>}
              {!loading && sorted.length === 0 && (
                <tr><td colSpan={8} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>No entries yet</td></tr>
              )}
              {sorted.map(e => {
                const net = Number(e.net ?? (Number(e.credit || 0) - Number(e.interest || 0)));
                running += net - Number(e.debit || 0);
                return (
                  <tr key={e.id} style={{ borderBottom: "1px solid rgba(63,63,70,.2)" }}>
                    <td className="ldate" style={{ padding: "6px 10px" }}>{e.date}</td>
                    <td style={{ padding: "6px 10px" }}>{cardName(e.card_id)}</td>
                    <td className="ldesc" style={{ padding: "6px 10px" }}>{e.description}</td>
                    <td className="rt" style={{ padding: "6px 10px" }}>{e.debit > 0 ? fmt(e.debit) : "-"}</td>
                    <td className="rt" style={{ padding: "6px 10px" }}>{e.credit > 0 ? fmt(e.credit) : "-"}</td>
                    <td className="rt" style={{ padding: "6px 10px", color: "var(--red,#f87171)" }}>{e.interest > 0 ? fmt(e.interest) : "-"}</td>
                    <td className="rt" style={{ padding: "6px 10px", color: "var(--grn,#4ade80)" }}>{net > 0 ? fmt(net) : "-"}</td>
                    <td className="rt" style={{ padding: "6px 10px", fontWeight: 600 }}>{fmt(running)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
