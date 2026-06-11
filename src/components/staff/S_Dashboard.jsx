// src/components/staff/S_Dashboard.jsx
import { useState, useEffect } from "react";
import { fmt, today, monthOf } from "../../utils/helpers";
import { supabase } from "../../supabase";
import { I } from "../../utils/icons";

export default function S_Dashboard({ outlet, user }) {
  const [sales,      setSales]      = useState([]);
const [expenses,   setExpenses]   = useState([]);
const [cashLedger, setCashLedger] = useState([]);
const [bankLedger, setBankLedger] = useState([]);
const [apInvoices, setApInvoices] = useState([]);
const [apPayments, setApPayments] = useState([]);
const [arLedger,   setArLedger]   = useState([]);

useEffect(() => {
  if (!outlet) return;

  supabase.from("sales").select("*").eq("outlet_id", outlet)
    .order("date", { ascending: false })
    .then(({ data }) => { if (data) setSales(data); });

  supabase.from("expenses").select("*").eq("outlet_id", outlet)
    .then(({ data }) => { if (data) setExpenses(data); });

  supabase.from("cash_ledger").select("*").eq("outlet_id", outlet)
    .then(({ data }) => { if (data) setCashLedger(data); });

  supabase.from("bank_ledger").select("*").eq("outlet_id", outlet)
    .then(({ data }) => { if (data) setBankLedger(data); });

  supabase.from("ap_invoices").select("*").eq("outlet_id", outlet)
    .then(({ data }) => { if (data) setApInvoices(data); });

  supabase.from("ap_payments").select("*").eq("outlet_id", outlet)
    .then(({ data }) => { if (data) setApPayments(data); });

  supabase.from("ar_ledger").select("*").eq("outlet_id", outlet)
    .then(({ data }) => { if (data) setArLedger(data); });
}, [outlet]);
  const mo         = today().slice(0, 7);
  const mSales     = sales.filter(s => monthOf(s.date) === mo).reduce((a, s) => a + Number(s.total), 0);
  const mExp       = expenses.filter(e => monthOf(e.date) === mo).reduce((a, e) => a + Number(e.amount), 0);
  const cashBal = cashLedger.reduce((a, t) => a + (Number(t.debit) - Number(t.credit)), 0);
  const bankBal = bankLedger.reduce((a, t) => a + (Number(t.debit) - Number(t.credit)), 0);
  const apOut   = apInvoices.reduce((a, i) => a + Number(i.amount), 0) - apPayments.reduce((a, p) => a + Number(p.amount), 0);
  const arBal   = arLedger.reduce((a, e) => a + (Number(e.debit) - Number(e.credit)), 0);
  const todaySales = sales.filter(s => s.date === today()).reduce((a, s) => a + Number(s.total), 0);

  const hour    = new Date().getHours();
  const greet   = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const dateStr = new Date().toLocaleDateString("en-LK", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  return (
    <>
      {/* ── Welcome Banner ── */}
      <div style={{ background: "linear-gradient(135deg,var(--s1) 0%,#1a1a2e 100%)", border: "1px solid var(--bdr)", borderRadius: "var(--rl)", padding: "22px 24px", marginBottom: 14, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", top: 0, right: 0, width: 200, height: 200, background: "radial-gradient(circle,rgba(245,158,11,.08) 0%,transparent 70%)", pointerEvents: "none" }} />
        <div style={{ position: "relative" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ fontSize: 10.5, color: "var(--mut)", fontWeight: 600, letterSpacing: ".08em", textTransform: "uppercase", marginBottom: 4 }}>{greet} 👋</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 24, color: "var(--txt)", marginBottom: 4 }}>
                {user?.username ? user.username.charAt(0).toUpperCase() + user.username.slice(1) : "Staff"}
              </div>
              <div style={{ fontSize: 11.5, color: "var(--mut)" }}>{user?.designation || "Staff"} &nbsp;·&nbsp; {dateStr}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.25)", borderRadius: 8, padding: "6px 14px" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--gld2)", boxShadow: "0 0 6px var(--gld)" }} />
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--gld2)" }}>{outlet}</span>
              </div>
              <div style={{ fontSize: 10.5, color: "var(--mut2)" }}>Access: {user?.access || "All windows"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
        {[
          ["Today's Sales",  todaySales, "cg"],
          ["Month Sales",    mSales,     "ca"],
          ["Month Expenses", mExp,       "cr"],
          ["Cash in Hand",   cashBal,    "cg"],
          ["Bank Balance",   bankBal,    "cb"],
          ["AP Outstanding", apOut,      "cr"],
        ].map(([l, v, c]) => (
          <div className="sc" key={l}>
            <div className="sl">{l}</div>
            <div className={`sa ${c}`}>Rs.{fmt(v)}</div>
          </div>
        ))}
      </div>

      {/* ── AP / AR Big Numbers ── */}
      <div className="sg2">
        <div className="sc" style={{ textAlign: "center" }}>
          <div className="sl">Accounts Payable Outstanding</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "var(--red)", marginTop: 4 }}>Rs.{fmt(apOut)}</div>
        </div>
        <div className="sc" style={{ textAlign: "center" }}>
          <div className="sl">Accounts Receivable Balance</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 22, color: "var(--grn)", marginTop: 4 }}>Rs.{fmt(arBal)}</div>
        </div>
      </div>

      {/* ── Recent Sales Table ── */}
      <div className="card">
        <div className="chd"><h3>Recent Sales</h3></div>
        <table className="tbl">
          <thead><tr><th>Date</th><th>By</th><th className="rt">Amount</th></tr></thead>
          <tbody>
            {sales.length === 0 && <tr><td colSpan={3}><div className="empty">No sales yet.</div></td></tr>}
            {sales.slice(0, 8).map(s => (
              <tr key={s.id}>
                <td className="mono">{s.date}</td>
                <td>{s.by}</td>
                <td className="rt mono cg bold">Rs.{fmt(s.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
