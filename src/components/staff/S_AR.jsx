// src/components/staff/S_AR.jsx
import { useState, useEffect} from "react";
import { fmt } from "../../utils/helpers";
import { I } from "../../utils/icons";
import Ledger from "../shared/Ledger";
import { supabase } from "../../supabase";

export default function S_AR({ outlet }) {

  // AR accounts = admin-managed COA range 1100–1299
  const [arAccounts, setArAccounts] = useState([]);
const [arLedger,   setArLedger]   = useState([]);
const [selId,      setSelId]      = useState("");

useEffect(() => {
  supabase.from("coa_accounts")
    .select("*")
    .gte("id", "1200")
    .lte("id", "1299")
    .then(({ data }) => {
      if (data) {
        setArAccounts(data);
        if (data.length > 0) setSelId(data[0].id);
      }
    });
}, []);

useEffect(() => {
  if (!outlet) return;
  supabase.from("ar_ledger")
    .select("*")
    .eq("outlet_id", outlet)
    .then(({ data }) => { if (data) setArLedger(data); });
}, [outlet]);

  // Rows for the selected account only
  const filteredRows = arLedger.filter(e => e.account_id === selId);

  // Balance per account (for summary strip)
const balanceOf = id =>
    arLedger
      .filter(e => e.account_id === id)
      .reduce((a, e) => a + (Number(e.debit) || 0) - (Number(e.credit) || 0), 0);
  const selAcc    = arAccounts.find(a => a.id === selId);
  const selBal    = balanceOf(selId);
  const grandTotal = arAccounts.reduce((a, acc) => a + balanceOf(acc.id), 0);

  return (
    <>
      {/* ── Summary strip ── */}
      <div className="sg3" style={{ marginBottom: 14 }}>
        <div className="sc">
          <div className="sl">Total AR Balance</div>
          <div className="sa cg">Rs.{fmt(grandTotal)}</div>
        </div>
        <div className="sc">
          <div className="sl">AR Accounts</div>
          <div className="sv">{arAccounts.length}</div>
        </div>
        <div className="sc">
          <div className="sl">Selected Balance</div>
          <div className="sa cg">Rs.{fmt(selBal)}</div>
        </div>
      </div>

      {/* ── All accounts table ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="chd">
          <h3>Accounts Receivable — All Accounts</h3>
          <button className="btn btnd btnsm no-print" onClick={() => window.print()}>
            {I.print} Print
          </button>
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Account ID</th>
              <th>Description</th>
              <th className="rt">Balance</th>
              <th style={{ textAlign: "center" }}>View</th>
            </tr>
          </thead>
          <tbody>
            {arAccounts.length === 0 && (
              <tr><td colSpan={4}><div className="empty">No AR accounts (1100–1299) in Chart of Accounts.</div></td></tr>
            )}
            {arAccounts.map(acc => {
              const b = balanceOf(acc.id);
              return (
                <tr key={acc.id} style={{ background: selId === acc.id ? "var(--s3)" : "" }}>
                  <td>
                    <span style={{
                      fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, fontWeight: 700,
                      padding: "2px 9px", borderRadius: 5,
                      background: "var(--s3)", color: "var(--gld2)",
                      border: "1px solid rgba(245,158,11,.2)",
                    }}>
                      {acc.id}
                    </span>
                  </td>
                  <td className="bold" style={{ fontSize: 12.5 }}>{acc.name}</td>
                  <td className="rt">
                    <span className="mono bold" style={{
                      fontSize: 13,
                      color: b > 0 ? "var(--grn)" : b < 0 ? "var(--red)" : "var(--mut)",
                    }}>
                      Rs.{fmt(b)}
                    </span>
                  </td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      className="btn btnd btnsm"
                      onClick={() => setSelId(acc.id)}
                    >
                      Ledger
                    </button>
                  </td>
                </tr>
              );
            })}
            {/* Grand total row */}
            <tr style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr)" }}>
              <td colSpan={2} style={{ textAlign: "right", paddingRight: 12, fontWeight: 700, fontSize: 12 }}>
                Total Receivable:
              </td>
              <td className="rt">
                <span className="mono bold" style={{ fontSize: 14, color: "var(--grn)" }}>
                  Rs.{fmt(grandTotal)}
                </span>
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Ledger for selected account ── */}
      <div className="card">
        <div className="chd">
          <div>
            <h3>Ledger — {selId} · {selAcc?.name || ""}</h3>
            <p>Auto-posted from Purchase → Transfer Goods → Transfer Out</p>
          </div>
        </div>

        {/* Account selector */}
        <div style={{ padding: "10px 14px 0" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--mut)" }}>Account:</label>
            <select
              value={selId}
              onChange={e => setSelId(e.target.value)}
              style={{
                padding: "5px 10px", background: "var(--s2)", border: "1px solid var(--bdr)",
                borderRadius: 6, fontSize: 12.5, color: "var(--txt)", outline: "none", minWidth: 220,
              }}
            >
              {arAccounts.map(a => (
                <option key={a.id} value={a.id}>{a.id} — {a.name}</option>
              ))}
            </select>
            <span style={{
              fontSize: 11, fontWeight: 700, padding: "3px 9px", borderRadius: 5,
              background: "var(--s3)", color: "var(--gld2)", border: "1px solid rgba(245,158,11,.2)",
            }}>
              Balance: Rs.{fmt(selBal)}
            </span>
          </div>
        </div>

        <div style={{ padding: 12 }}>
          {filteredRows.length === 0 && (
  <div className="empty">No Transfer Out entries for account {selId}.</div>
)}
{filteredRows.length > 0 && (
  <Ledger rows={filteredRows.map(e => ({
    ...e,
    type:   (e.debit || 0) > 0 ? "in" : "out",
    amount: (e.debit || 0) > 0 ? Number(e.debit) : Number(e.credit),
  }))} bfBal={0} />
)}
        </div>
      </div>

      <div className="nbox nb-a" style={{ marginTop: 12, fontSize: 11 }}>
        ℹ️ AR accounts (1100–1299) are managed by Admin in Chart of Accounts.
        Balances auto-post from <strong>Purchase → Transfer Goods → Transfer Out</strong>.
      </div>
    </>
  );
}
