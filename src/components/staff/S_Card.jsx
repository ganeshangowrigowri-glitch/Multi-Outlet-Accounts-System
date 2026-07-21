// src/components/staff/S_Card.jsx
// ─────────────────────────────────────────────────────────────
//  Staff › Card Settlement
//  Tracks card/POS sales as a pending receivable until the
//  acquiring bank settles the batch into a real bank account,
//  net of the merchant discount fee. Mirrors the Excel "VIZA
//  CARD" sheets, but generalised to any number of card machines.
// ─────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { fmt, today } from "../../utils/helpers";
import { supabase } from "../../supabase";
import { I } from "../../utils/icons";
import {
  getCardLedger, addCardEntry, settleCardToBank,
} from "../../db";

// ════════════════════════════════════════════════════════════
export default function S_Card({ outlet, toast_ }) {
  const [tab, setTab] = useState(0);
  const [cardAccounts, setCardAccounts] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);

  useEffect(() => {
    supabase.from("bank_accounts").select("*")
      .eq("outlet_id", outlet).eq("active", true).eq("hidden", false)
      .then(({ data }) => {
        if (!data) return;
        setCardAccounts(data.filter(a => a.account_type === "card"));
        setBankAccounts(data.filter(a => a.account_type !== "card")); // default 'bank'
      });
  }, [outlet]);

  if (cardAccounts.length === 0) {
    return (
      <div className="card" style={{ textAlign: "center", padding: 40 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>{I.bank}</div>
        <div style={{ fontWeight: 600, marginBottom: 6 }}>No Card Machines Set Up</div>
        <div style={{ fontSize: 12.5, color: "var(--mut)" }}>
          Ask your admin to add a card/POS account for this outlet in Bank Master
          (Account Type = "Card").
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="stabs no-print" style={{ marginBottom: 16 }}>
        {["Record Card Sale", "Settle to Bank", "Ledger"].map((t, i) => (
          <button key={i} className={`stab ${tab === i ? "act" : ""}`} onClick={() => setTab(i)}>
            {I.bank} {t}
          </button>
        ))}
      </div>

      {tab === 0 && <RecordSale outlet={outlet} cardAccounts={cardAccounts} toast_={toast_} />}
      {tab === 1 && <Settle outlet={outlet} cardAccounts={cardAccounts} bankAccounts={bankAccounts} toast_={toast_} />}
      {tab === 2 && <LedgerView outlet={outlet} cardAccounts={cardAccounts} />}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 0 — Record a day's card sales as a pending receivable
// ════════════════════════════════════════════════════════════
function RecordSale({ outlet, cardAccounts, toast_ }) {
  const [date, setDate] = useState(today());
  const [cardId, setCardId] = useState(cardAccounts[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!cardId) { toast_("Select a card account", "err"); return; }
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { toast_("Enter a valid amount", "err"); return; }
    setSaving(true);
    const ok = await addCardEntry(outlet, {
      date, cardId,
      description: description || "Card sale",
      txnType: "sale",
      debit: amt, credit: 0,
    });
    setSaving(false);
    if (ok) {
      toast_("Card sale recorded ✓");
      setAmount(""); setDescription("");
    } else {
      toast_("Failed to save — check connection", "err");
    }
  }

  return (
    <div className="card">
      <div className="chd"><h3>Record Card Sale</h3><p>{outlet}</p></div>
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
                <option key={c.id} value={c.id}>{c.bank} — {c.account_no || c.accountNo}</option>
              ))}
            </select>
          </div>
          <div className="ff">
            <label>Amount (Rs.) *</label>
            <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="ff" style={{ gridColumn: "1 / -1" }}>
            <label>Description</label>
            <input placeholder="e.g. Daily card sales" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>
        <div style={{ marginTop: 14 }}>
          <button className="btn btng" onClick={save} disabled={saving}>
            {I.check} {saving ? "Saving…" : "Save Card Sale"}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 10 }}>
          This adds to the card account's pending balance (money collected but not yet in the bank).
          Once the acquirer settles the batch, record it under "Settle to Bank".
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 1 — Settle a pending card balance into a real bank account
// ════════════════════════════════════════════════════════════
function Settle({ outlet, cardAccounts, bankAccounts, toast_ }) {
  const [date, setDate] = useState(today());
  const [cardId, setCardId] = useState(cardAccounts[0]?.id || "");
  const [bankId, setBankId] = useState(bankAccounts[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const card = cardAccounts.find(c => c.id === cardId);
  const feePct = Number(card?.fee_pct) || 0;
  const gross = parseFloat(amount) || 0;
  const fee = Math.round(gross * feePct) / 100;
  const net = gross - fee;

  async function save() {
    if (!cardId || !bankId) { toast_("Select both card and bank accounts", "err"); return; }
    if (!gross || gross <= 0) { toast_("Enter a valid settlement amount", "err"); return; }
    if (bankAccounts.length === 0) { toast_("No bank account available to settle into — ask admin to add one", "err"); return; }
    setSaving(true);
    await settleCardToBank(outlet, {
      date, cardId, bankId, grossAmount: gross, feePct,
      description: description || "Card settlement",
    });
    setSaving(false);
    toast_(`Settled ✓ Rs.${fmt(net)} deposited to bank (fee Rs.${fmt(fee)})`);
    setAmount(""); setDescription("");
  }

  return (
    <div className="card">
      <div className="chd"><h3>Settle to Bank</h3><p>Record money received from the card acquirer</p></div>
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
                <option key={c.id} value={c.id}>{c.bank} — {c.account_no || c.accountNo} ({Number(c.fee_pct) || 0}% fee)</option>
              ))}
            </select>
          </div>
          <div className="ff">
            <label>Settle Into Bank Account *</label>
            <select value={bankId} onChange={e => setBankId(e.target.value)}>
              <option value="">Select bank account…</option>
              {bankAccounts.map(b => (
                <option key={b.id} value={b.id}>{b.bank} — {b.account_no || b.accountNo}</option>
              ))}
            </select>
          </div>
          <div className="ff">
            <label>Gross Settlement Amount (Rs.) *</label>
            <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="ff" style={{ gridColumn: "1 / -1" }}>
            <label>Description</label>
            <input placeholder="e.g. Batch settlement 1–15 Apr" value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        </div>

        {gross > 0 && (
          <div style={{ background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "10px 14px", marginTop: 10, display: "flex", gap: 20, flexWrap: "wrap", fontSize: 12.5 }}>
            <span><span style={{ color: "var(--mut)" }}>Gross:</span> <strong>Rs.{fmt(gross)}</strong></span>
            <span><span style={{ color: "var(--mut)" }}>Merchant Fee ({feePct}%):</span> <strong style={{ color: "var(--red,#f87171)" }}>-Rs.{fmt(fee)}</strong></span>
            <span><span style={{ color: "var(--mut)" }}>Net to Bank:</span> <strong style={{ color: "var(--grn,#4ade80)" }}>Rs.{fmt(net)}</strong></span>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <button className="btn btng" onClick={save} disabled={saving}>
            {I.check} {saving ? "Saving…" : "Record Settlement"}
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--mut)", marginTop: 10 }}>
          This reduces the card account's pending balance and adds the net amount as a deposit
          to the selected bank account, so Bank and Card stay reconciled automatically.
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 2 — Ledger view: pending balance per card account
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

  const balances = {};
  cardAccounts.forEach(c => {
    balances[c.id] = entries
      .filter(e => e.card_id === c.id)
      .reduce((s, e) => s + Number(e.debit || 0) - Number(e.credit || 0), 0);
  });

  let running = 0;

  return (
    <div className="card">
      <div className="chd">
        <h3>Card Ledger</h3>
        <p>Pending = sold on card but not yet deposited to bank</p>
      </div>

      <div style={{ padding: "10px 14px", display: "flex", gap: 12, flexWrap: "wrap" }}>
        {cardAccounts.map(c => (
          <div key={c.id} className="card" style={{ padding: "10px 14px", flex: "1 1 200px" }}>
            <div style={{ fontSize: 11, color: "var(--mut)" }}>{c.bank} — {c.account_no || c.accountNo}</div>
            <div style={{ fontSize: 17, fontWeight: 700, color: balances[c.id] > 0 ? "var(--gld2,#f59e0b)" : "var(--mut)" }}>
              Rs.{fmt(balances[c.id] || 0)}
            </div>
            <div style={{ fontSize: 10.5, color: "var(--mut)" }}>pending settlement</div>
          </div>
        ))}
      </div>

      <div style={{ padding: "0 14px 10px" }}>
        <select value={filterCard} onChange={e => setFilterCard(e.target.value)}>
          <option value="">All Card Accounts</option>
          {cardAccounts.map(c => <option key={c.id} value={c.id}>{c.bank} — {c.account_no || c.accountNo}</option>)}
        </select>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead>
            <tr style={{ background: "var(--s3)" }}>
              <th style={{ padding: "6px 10px", textAlign: "left" }}>Date</th>
              <th style={{ padding: "6px 10px", textAlign: "left" }}>Card Account</th>
              <th style={{ padding: "6px 10px", textAlign: "left" }}>Type</th>
              <th style={{ padding: "6px 10px", textAlign: "left" }}>Description</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Sale</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Settled/Fee</th>
              <th style={{ padding: "6px 10px", textAlign: "right" }}>Balance</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>Loading…</td></tr>}
            {!loading && sorted.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>No entries yet</td></tr>
            )}
            {sorted.map(e => {
              running += Number(e.debit || 0) - Number(e.credit || 0);
              return (
                <tr key={e.id} style={{ borderBottom: "1px solid rgba(63,63,70,.2)" }}>
                  <td style={{ padding: "6px 10px" }}>{e.date}</td>
                  <td style={{ padding: "6px 10px" }}>{cardName(e.card_id)}</td>
                  <td style={{ padding: "6px 10px", textTransform: "capitalize" }}>{e.txn_type}</td>
                  <td style={{ padding: "6px 10px" }}>{e.description}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right" }}>{e.debit > 0 ? fmt(e.debit) : "-"}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right" }}>{e.credit > 0 ? fmt(e.credit) : "-"}</td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontWeight: 600 }}>{fmt(running)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
