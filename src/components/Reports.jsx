import React, { useState, useEffect, useCallback } from "react";
import { I } from "../utils/icons";
import { OUTLETS, SUPPLIERS_LIST } from "../data/seeds";
import {
  getOutlets,
  getSales,
  getPurchases,
  getReturns,
  getTransfers,
  getExpenses,
  getCashLedger,
  getBankLedger,
  getCapitalLedger,
  getCardLedger,
  getARLedger,
  getAPInvoices,
  getAPPayments,
  getCashBF,
  getBankBF,
  getCOA,
  getInventoryMaster,
  getOpeningStock,
  getSupplierBF,   
  setSupplierBF,   
} from "../db";

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt  = n => Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = n => Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const today    = () => new Date().toISOString().split("T")[0];
const monthOf  = d  => (d || "").slice(0, 7);
const dayOf    = d  => parseInt((d || "").slice(8, 10)) || 0;

// First day of a given YYYY-MM string
const monthStart = m => m ? `${m}-01` : null;
// Last day of a given YYYY-MM string
const monthEnd = m => {
  if (!m) return null;
  const [y, mo] = m.split("-").map(Number);
  const lastDay = new Date(y, mo, 0).getDate();
  return `${m}-${String(lastDay).padStart(2, "0")}`;
};

// ─── Shared UI Atoms ─────────────────────────────────────────────────────────
const SH = ({ children }) => (
  <tr style={{ background: "var(--s3)" }}>
    <td colSpan={10} style={{ padding: "7px 12px", fontWeight: 700, fontSize: 12, color: "var(--gld2)", fontFamily: "'Playfair Display',serif", letterSpacing: ".03em" }}>
      {children}
    </td>
  </tr>
);

const TR = ({ label, col2, val, indent = 0, bold = false, total = false, neg = false }) => (
  <tr style={total ? { borderTop: "1.5px solid var(--bdr2)", background: "var(--s2)" } : {}}>
    <td style={{ padding: `5px 12px 5px ${indent * 16 + 12}px`, fontSize: 12, fontWeight: bold || total ? 700 : 400, color: total ? "var(--txt)" : "var(--mut)", minWidth: 280 }}>
      {label}
    </td>
    <td style={{ padding: "5px 14px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: "var(--txt)" }}>
      {col2 !== undefined && col2 !== "" ? `Rs.${fmt(col2)}` : ""}
    </td>
    <td style={{ padding: "5px 14px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: bold || total ? 700 : 400, color: neg ? "var(--red)" : total ? "var(--grn)" : "var(--txt)" }}>
      {val !== undefined && val !== "" ? (neg ? "(" : "") + "Rs." + fmt(Math.abs(val)) + (neg ? ")" : "") : ""}
    </td>
  </tr>
);

const TRSplit = ({ label, col2, col3, indent = 0, bold = false, total = false, neg = false }) => (
  <tr style={total ? { borderTop: "1.5px solid var(--bdr2)", background: "var(--s2)" } : {}}>
    <td style={{ padding: `5px 12px 5px ${indent * 16 + 12}px`, fontSize: 12, fontWeight: bold || total ? 700 : 400, color: total ? "var(--txt)" : "var(--mut)", minWidth: 280 }}>
      {label}
    </td>
    <td style={{ padding: "5px 14px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: neg ? "var(--red)" : "var(--txt)" }}>
      {col2 !== undefined && col2 !== "" ? (neg ? "(" : "") + "Rs." + fmt(Math.abs(col2)) + (neg ? ")" : "") : ""}
    </td>
    <td style={{ padding: "5px 14px", textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, fontWeight: bold || total ? 700 : 400, color: total ? "var(--grn)" : "var(--txt)" }}>
      {col3 !== undefined && col3 !== "" ? "Rs." + fmt(col3) : ""}
    </td>
  </tr>
);

// ─── Spinner ─────────────────────────────────────────────────────────────────
const Spinner = () => (
  <div style={{ padding: 40, textAlign: "center", color: "var(--mut)", fontSize: 13 }}>
    Loading report data…
  </div>
);

// ─── Report Wrapper ───────────────────────────────────────────────────────────
function ReportWrap({ title, outlet, month, children }) {
  const mo = month
    ? new Date(month + "-01").toLocaleString("en-LK", { month: "long", year: "numeric" })
    : "All Periods";
  return (
    <div>
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btnd btnsm" onClick={() => window.print()}>{I.print} Print</button>
      </div>
      <div style={{ background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: "var(--rl)", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--bdr)", background: "var(--s2)" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 2 }}>{title}</div>
          <div style={{ fontSize: 11, color: "var(--mut)" }}>
            {outlet === "ALL" ? "All Outlets" : outlet} &nbsp;·&nbsp; {mo}
          </div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <colgroup>
              <col style={{ width: "60%" }} />
              <col style={{ width: "20%" }} />
              <col style={{ width: "20%" }} />
            </colgroup>
            <tbody>{children}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// DATA HOOK — fetches everything from Supabase for given outlet(s) + month
// ══════════════════════════════════════════════════════════════════════════════
function useReportData(outlet, month, outletList) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const outlets = outlet === "ALL" ? outletList : [outlet];
      if (!outlets.length) { setLoading(false); return; }

      const mStart = monthStart(month);
      const mEnd   = monthEnd(month);

      const arrayResults = [];
for (const o of outlets) {
  const result = await Promise.all([
    getSales(o), getPurchases(o), getReturns(o), getTransfers(o),
    getExpenses(o), getCashLedger(o), getBankLedger(o),
    getARLedger(o), getAPInvoices(o), getAPPayments(o), getCapitalLedger(o),
  ]);
  arrayResults.push(result);
}

const scalarResults = [];
for (const o of outlets) {
  const result = await Promise.all([getCashBF(o), getBankBF(o)]);
  scalarResults.push(result);
}

const [inv, coa] = await Promise.all([
  getInventoryMaster(), getCOA(),
]);

      const inMonth = arr => {
        if (!Array.isArray(arr)) return [];
        return mStart ? arr.filter(r => r.date >= mStart && r.date <= mEnd) : arr;
      };

      let sales=[], purchases=[], returns=[], transfers=[], expenses=[];
      let cashLedger=[], bankLedger=[], arLedger=[], apInvoices=[], apPayments=[], capitalLedger=[], crateLedgerAll=[];
      let cashBF=0, bankBF=0;

      arrayResults.forEach(([sal,pur,ret,trn,exp,csh,bnk,ar,apInv,apPay,cap,crt]) => {
        sales      = [...sales,      ...inMonth(sal)];
        purchases  = [...purchases,  ...inMonth(pur)];
        returns    = [...returns,    ...inMonth(ret)];
        transfers  = [...transfers,  ...inMonth(trn)];
        expenses   = [...expenses,   ...inMonth(exp)];
        cashLedger = [...cashLedger, ...inMonth(csh)];
        bankLedger = [...bankLedger, ...inMonth(bnk)];
        arLedger   = [...arLedger,   ...(ar    || [])];
        apInvoices = [...apInvoices, ...(apInv || [])];
        apPayments = [...apPayments, ...(apPay || [])];
        capitalLedger = [...capitalLedger, ...inMonth(cap)];
        crateLedgerAll = [...crateLedgerAll, ...(crt || [])];
      });
      scalarResults.forEach(([cbf,bbf]) => { cashBF += Number(cbf)||0; bankBF += Number(bbf)||0; });

      const invMap = {};
      (inv||[]).forEach(i => { invMap[i.code]=i; if(i.id) invMap[i.id]=i; });
      // ── Sales Revenue ──
      // Sums actual daily entered qty × rate across every sale record and every
      // item in the month (same logic as Sales Summary's dailySale calc), so
      // items missing from the last day's entry are no longer silently dropped.
      let totalSalesAmt = 0;
      sales.forEach(s => {
        (s.items || []).filter(r => !r.isEmptyItem).forEach(r => {
          const item = invMap[r.code] || invMap[r.id];
          const sp  = Number(item?.sellingPrice) || Number(r.sellingPrice) || Number(r.rate) || 0;
          const qty = parseFloat(r.sold) || 0;
          totalSalesAmt += qty * sp;
        });
      });
      const totalReturns = returns.reduce((a,r)=>a+(Number(r.total)||0),0);
      const netSalesAmt  = totalSalesAmt - totalReturns;

      // ── Opening Stock ──
      // Mirrors Current Status: firstOpening = r.openingStock from first sale record in month
      let openingStockVal=0;
      const openingStockByCode={};
      const salesSortedAsc = [...sales]
        .filter(s => (s.items||[]).some(r => !r.isEmptyItem))
        .sort((a,b) => (a.date||"").localeCompare(b.date||""));

      // Same as Current Status: get all records on the first date, pick highest openingStock per item
      const firstDate = salesSortedAsc[0]?.date;
      const firstDateSales = firstDate
        ? salesSortedAsc.filter(s => s.date === firstDate)
        : [];

      firstDateSales.forEach(sale => {
        (sale.items||[]).filter(r => !r.isEmptyItem).forEach(r => {
          const item = invMap[r.code] || invMap[r.id];
          const uc = Number(item?.unitCost) || Number(r.unitCost) || 0;
          const q  = parseFloat(r.openingStock) || 0;
          if (q > 0 && uc > 0) {
            if (!openingStockByCode[r.code]) {
              openingStockByCode[r.code] = { name: r.name || item?.name || r.code, qty: 0, unitCost: uc };
            }
            // Same as Current Status: keep highest openingStock per item
            if (q > openingStockByCode[r.code].qty) {
              openingStockByCode[r.code].qty = q;
            }
          }
        });
      });
      openingStockVal = Object.values(openingStockByCode)
        .reduce((a, v) => a + v.qty * v.unitCost, 0);
        
      // ── Purchases by supplier ──
      const purBySup={};
      let totalPurchase=0;
      purchases.forEach(p => {
        const sid=p.supplier_id||p.supplier||"Unknown";
        if (!purBySup[sid]) purBySup[sid]={supId:sid,total:0,records:[]};
        const lt=(p.items||[]).filter(l=>!l.isEmptyItem)
          .reduce((a,l)=>a+(Number(l.amount)||(Number(l.qty)*Number(l.unitCost))||0),0);
        const amt=Number(p.total)||Number(p.grand_total)||lt||0;
        purBySup[sid].total+=amt; purBySup[sid].records.push(p); totalPurchase+=amt;
      });

      // ── Transfers ──
      const transInAmt = transfers
        .filter(t=>outlet==="ALL"||(t.to_outlet_id??t.to)===outlet)
        .reduce((a,t)=>{ const am=(t.items||[]).reduce((s,l)=>s+(Number(l.amount)||0),0); return a+(Number(t.total)||am||0); },0);
      const transOutAmt = transfers
        .filter(t=>outlet==="ALL"||(t.from_outlet_id??t.from)===outlet)
        .reduce((a,t)=>{ const am=(t.items||[]).reduce((s,l)=>s+(Number(l.amount)||0),0); return a+(Number(t.total)||am||0); },0);

        // ── End Stock ──
      // Mirrors Current Status: lastEndStock = r.endStock from last sale record on mEnd date
      let endStockVal=0;
      const endStockByCode={};
      const stockValBySupplier={};
      const salesSorted = [...sales]
        .filter(s => (s.items||[]).some(r => !r.isEmptyItem))
        .sort((a,b) => (b.date||"").localeCompare(a.date||""));

      // Same as Current Status: get all records on mEnd date first, fallback to latest available
      const endDateSales = mEnd
        ? salesSorted.filter(s => s.date === mEnd)
        : [];
      const endSalesToUse = endDateSales.length > 0
        ? endDateSales
        : salesSorted.slice(0, 1);

      // Same as Current Status: per item prefer sold>0 row, else take highest endStock
      const endStockItemMap = {};
      endSalesToUse.forEach(sale => {
        (sale.items||[]).filter(r => !r.isEmptyItem).forEach(r => {
          const es = parseFloat(r.endStock);
          if (isNaN(es)) return;
          const existing = endStockItemMap[r.code];
          const soldQty = parseFloat(r.sold) || 0;
          if (!existing) {
            endStockItemMap[r.code] = { ...r, _sold: soldQty };
          } else {
            // Prefer row with sold > 0; otherwise keep highest endStock
            if (soldQty > 0 && existing._sold === 0) {
              endStockItemMap[r.code] = { ...r, _sold: soldQty };
            } else if (es > parseFloat(existing.endStock)) {
              endStockItemMap[r.code] = { ...r, _sold: soldQty };
            }
          }
        });
      });

      Object.entries(endStockItemMap).forEach(([code, r]) => {
        const item = invMap[code] || invMap[r.id];
        const uc = Number(item?.unitCost) || Number(r.unitCost) || 0;
        const q  = parseFloat(r.endStock) || 0;
        if (q > 0 && uc > 0) {
          endStockVal += q * uc;
          endStockByCode[code] = { name: r.name || item?.name || code, qty: q, unitCost: uc };
          if (r.supplier) stockValBySupplier[r.supplier] = (stockValBySupplier[r.supplier] || 0) + q * uc;
        }
      });

      const costOfSales = openingStockVal+totalPurchase+transInAmt-transOutAmt-endStockVal;
      const grossProfit = netSalesAmt-costOfSales;

      // ── Expenses ──
      const expByAcc={};
      expenses.forEach(e=>{
        const aid=e.account_id||e.acc||"Uncategorised";
        if (!expByAcc[aid]) { const cr=(coa||[]).find(c=>c.id===aid); expByAcc[aid]={name:cr?.name||e.description||aid,total:0,id:aid}; }
        expByAcc[aid].total+=Number(e.amount)||0;
      });
      const expRange  = (f,t)=>Object.values(expByAcc).filter(e=>e.id>=f&&e.id<=t).reduce((a,e)=>a+e.total,0);
      const expDetail = (f,t)=>Object.values(expByAcc).filter(e=>e.id>=f&&e.id<=t);
      const expSaleMkt=expRange("5501","5649"), expAdmin=expRange("5650","5799");
      const expFinance=expRange("5800","5899"), expOther=expRange("5900","5999");
      const totalExp=expSaleMkt+expAdmin+expFinance+expOther;

      // ── Discounts & Empty ──
      const discBySup={}, emptyDiscBySup={}, empSoldByName={}, empRetByName={};
      apPayments.forEach(p=>{ const d=Number(p.discount)||0; if(d>0){const s=p.supplier_id||"Other"; discBySup[s]=(discBySup[s]||0)+d;} });
      sales.forEach(s=>(s.items||[]).filter(r=>r.isEmptyItem&&r.supplier!=="EMPTY PURCHASE").forEach(e=>{
        const key=e.supplier||e.name||"Empty";
        const sol=parseFloat(e.sold)||0, ret=parseFloat(e.return_)||0, rate=parseFloat(e.rate)||0;
        if(sol>0) empSoldByName[key]=(empSoldByName[key]||0)+sol*rate;
        if(ret>0) empRetByName[key]=(empRetByName[key]||0)+ret*rate;
      }));
      const totalDiscPayment=Object.values(discBySup).reduce((a,v)=>a+v,0);
      const totalDiscEmpty=Object.values(emptyDiscBySup).reduce((a,v)=>a+v,0);
      const totalEmpSold=Object.values(empSoldByName).reduce((a,v)=>a+v,0);
      const totalEmpRet=Object.values(empRetByName).reduce((a,v)=>a+v,0);
      const totalOtherInc=totalDiscPayment+totalDiscEmpty;
      const totalIncome=grossProfit+totalOtherInc;
      const netProfit=totalIncome-totalExp;

      // ── Balance Sheet ──
      const cashBal=cashBF+cashLedger.reduce((a,r)=>a+(Number(r.debit)||0),0)-cashLedger.reduce((a,r)=>a+(Number(r.credit)||0),0);
      const bankBal=bankBF+bankLedger.reduce((a,r)=>a+(Number(r.debit)||0),0)-bankLedger.reduce((a,r)=>a+(Number(r.credit)||0),0);
      const arBal=arLedger.reduce((a,r)=>a+(Number(r.debit)||0)-(Number(r.credit)||0),0);
      const apInvTotal=apInvoices.reduce((a,i)=>a+(Number(i.amount)||0),0);
      const apPaidTotal=apPayments.reduce((a,p)=>a+(Number(p.amount)||0)+(Number(p.discount)||0),0);
      const apBal=apInvTotal-apPaidTotal;

      let emptyStockVal=0;
      const latestEmpSale=salesSorted.find(s=>(s.items||[]).some(r=>r.isEmptyItem));
      if(latestEmpSale)(latestEmpSale.items||[]).filter(r=>r.isEmptyItem&&r.supplier!=="EMPTY PURCHASE")
        .forEach(r=>{ const es=parseFloat(r.endStock); if(!isNaN(es)) emptyStockVal+=es*(parseFloat(r.rate)||0); });

      const coaNonCurrentAssets=(coa||[]).filter(a=>a.id>="1500"&&a.id<="1999");
      const coaCurrentLiab=(coa||[]).filter(a=>a.id>="2000"&&a.id<="2499");
      const coaNonCurrentLiab=(coa||[]).filter(a=>a.id>="2500"&&a.id<="2999");
      const coaCapital=(coa||[]).filter(a=>a.id>="3000"&&a.id<="3999");
      const totalCurrentAssets=endStockVal+emptyStockVal+cashBal+bankBal+arBal;
      const totalCurrentLiab=apBal;
      const totalAssets=totalCurrentAssets;
      const ownerEquity=totalAssets-totalCurrentLiab;

      // ── Sales by day ──
      const salesByDay={};
      salesSortedAsc.forEach((s, idx) => {
        const d = dayOf(s.date);
        const todayAmt = (s.items||[]).filter(r=>!r.isEmptyItem)
          .reduce((a,r)=>a+(parseFloat(r.sold)||0)*(parseFloat(r.rate)||0), 0);
        const prevAmt = idx > 0
          ? (salesSortedAsc[idx-1].items||[]).filter(r=>!r.isEmptyItem)
              .reduce((a,r)=>a+(parseFloat(r.sold)||0)*(parseFloat(r.rate)||0), 0)
          : 0;
        salesByDay[d] = (salesByDay[d]||0) + (todayAmt - prevAmt);
      });
      // ── Expenses by day ──
      const expByDay={};
      expenses.forEach(e=>{ const d=dayOf(e.date); expByDay[d]=(expByDay[d]||0)+(Number(e.amount)||0); });

     // ── Cost of Sales by item ──
     const cosByItem = {};
     const soldQtyByCode = {}; // real daily sold qty, used only to decide which items to show

    sales.forEach(s => (s.items || []).filter(r => !r.isEmptyItem).forEach(r => {
    const item = invMap[r.code] || invMap[r.id];
    const uc = Number(item?.unitCost) || Number(r.unitCost) || 0;
    if (!cosByItem[r.code]) cosByItem[r.code] = { code: r.code, name: r.name || item?.name || r.code, type: r.type || item?.type || "", purchase: 0, transIn: 0, transOut: 0, returns: 0, adj: 0, unitCost: uc };

   cosByItem[r.code].purchase += parseFloat(r.purchase)    || 0;
   cosByItem[r.code].transIn  += parseFloat(r.transferIn)  || 0;
   cosByItem[r.code].transOut += parseFloat(r.transferOut) || 0;
   cosByItem[r.code].returns  += parseFloat(r.returns)     || 0; 
   cosByItem[r.code].adj      += parseFloat(r.stkSE)       || 0; // same field as Current Status "ADJ. TO STK"

  // track real sold qty separately — purely to decide inclusion, not displayed
  soldQtyByCode[r.code] = (soldQtyByCode[r.code] || 0) + (parseFloat(r.sold) || 0);
}));

// Derive Sold per formula: Opening + Purchase + TransIn − TransOut − Adj
Object.keys(cosByItem).forEach(code => {
  const it = cosByItem[code];
  it.opening = openingStockByCode[code]?.qty || 0;
  it.sold = it.opening + it.purchase + it.transIn - it.transOut - it.adj;
});

// Only keep items that were actually sold this month (real activity, not the derived figure)
Object.keys(cosByItem).forEach(code => {
  if (!(soldQtyByCode[code] > 0)) delete cosByItem[code];
});

      // ── Cash Flow ──
      const bankDeposit=bankLedger.filter(t=>Number(t.debit)>0).reduce((a,t)=>a+Number(t.debit),0);
      const cashFlowIn=totalSalesAmt+totalEmpSold;
      const cashFlowOut=totalExp+totalEmpRet+bankDeposit+totalReturns;
      const netCashFlow=cashFlowIn-cashFlowOut;

      // ── Empty Bottles ──
      const empDailyData={};
      sales.forEach(s=>{ const day=dayOf(s.date);
        (s.items||[]).filter(r=>r.isEmptyItem&&r.supplier!=="EMPTY PURCHASE").forEach(e=>{
          const key=e.supplier||e.name||"Empty";
          if(!empDailyData[key]) empDailyData[key]={};
          if(!empDailyData[key][day]) empDailyData[key][day]={sold:0,return_:0,purchase:0,invPurchase:0,received:0,invIssue:0,issue:0};
          empDailyData[key][day].sold+=parseFloat(e.sold)||0; empDailyData[key][day].return_+=parseFloat(e.return_)||0;
          empDailyData[key][day].purchase+=parseFloat(e.purchase)||0; empDailyData[key][day].invPurchase+=parseFloat(e.invPurchase)||0;
          empDailyData[key][day].received+=parseFloat(e.received)||0; empDailyData[key][day].invIssue+=parseFloat(e.invIssue)||0;
          empDailyData[key][day].issue+=parseFloat(e.issue)||0;
        });
      });
      const empSuppliers=Object.keys(empDailyData);
      // crateLedgerAll is already accumulated above (all-time, not month-filtered,
      // since we need the cumulative balance as of period-end for the crate
      // section in Stock Summary — no cost/rate data exists for crates, so
      // it stays quantity-only and doesn't feed into the monetary Net Position).
      // ── Capital Ledger (partner contributions/drawings) ──
      // Mirrors Excel CAPITAL sheet's BY MR.K.K/K.J/K.M (contributions)
      // and TO MR.K.K.Personal/K.J/K.M/Building Owner/Licensee/Manager Loan (drawings).
      const capitalByParty = {};
      capitalLedger.forEach(e => {
        const p = e.party || "Other";
        if (!capitalByParty[p]) capitalByParty[p] = { in: 0, out: 0 };
        capitalByParty[p][e.direction] += Number(e.amount || 0);
      });
      const totalCapitalIn  = capitalLedger.filter(e => e.direction === "in").reduce((a, e) => a + Number(e.amount || 0), 0);
      const totalCapitalOut = capitalLedger.filter(e => e.direction === "out").reduce((a, e) => a + Number(e.amount || 0), 0);
      setData({ inv, coa, totalSalesAmt, totalReturns, netSalesAmt, openingStockVal, openingStockByCode, totalPurchase, purBySup, transInAmt, transOutAmt, endStockVal, endStockByCode, costOfSales, grossProfit, discBySup, emptyDiscBySup, empSoldByName, empRetByName, totalDiscPayment, totalDiscEmpty, totalOtherInc, totalIncome, totalEmpSold, totalEmpRet, expByAcc, expSaleMkt, expAdmin, expFinance, expOther, expDetail, totalExp, netProfit, emptyStockVal, cashBal, bankBal, cashBF, bankBF, arBal, apInvoices, apPayments, apBal, totalCurrentAssets, totalCurrentLiab, totalAssets, ownerEquity, coaNonCurrentAssets, coaCurrentLiab, coaNonCurrentLiab, coaCapital, cashFlowIn, cashFlowOut, netCashFlow, bankDeposit, cashLedger, bankLedger, salesByDay, expByDay,sales, purchases, expenses, returns, transfers, cosByItem, empDailyData, empSuppliers, capitalByParty, totalCapitalIn, totalCapitalOut, crateLedgerAll, stockValBySupplier });
    } catch (err) {
      console.error("Reports load error:", err);
    } finally {
      setLoading(false);
    }
  }, [outlet, month, outletList]); // eslint-disable-line

  useEffect(() => { load(); }, [load]);

  return { data, loading };
}

// ══════════════════════════════════════════════════════
// INCOME STATEMENT
// Per PDF: Sales Revenue → Returns → Net → Cost of Sales → Gross Profit
//          → Other Income → Total Income → Expenses → Net Profit
// ══════════════════════════════════════════════════════
    function IncomeStatement({ d, outlet, month }) {
  const {
    totalSalesAmt, totalReturns, netSalesAmt,
    openingStockVal, openingStockByCode,
    totalPurchase, purBySup,
    transInAmt, transOutAmt,
    endStockVal, endStockByCode,
    costOfSales, grossProfit,
    discBySup, emptyDiscBySup,
    totalDiscPayment, totalDiscEmpty, totalOtherInc, totalIncome,
    expDetail, expSaleMkt, expAdmin, expFinance, expOther, totalExp, netProfit,
  } = d;

  // Show More / Show Less — Cost of Sales item-level detail rows only.
  // Default OFF (Show Less) so both screen and print default to the
  // clean summary-totals view; item rows only render (and therefore
  // only print) when staff explicitly expands them.
  const [showCosDetails, setShowCosDetails] = useState(false);

  return (
    <ReportWrap title="Income Statement" outlet={outlet} month={month}>
      {/* Sales Revenue */}
      <TR label="Sales Revenue" val={totalSalesAmt} bold />
      {totalReturns > 0 && <TR label="(-) Returns on Sale" val={totalReturns} neg indent={1} />}
      {totalReturns > 0 && <TR label="Net Sales" val={netSalesAmt} bold total />}

      {/* Cost of Sales */}
      <SH>Cost of Sales</SH>
      <tr className="no-print">
        <td colSpan={3} style={{ padding: "0 12px 6px" }}>
          <button className="btn btnd btnsm" onClick={() => setShowCosDetails(v => !v)}>
            {showCosDetails ? "Show Less" : "Show More"}
          </button>
        </td>
      </tr>
      <TR label="Opening Stock" col2={openingStockVal} indent={1} />
      {showCosDetails && Object.entries(openingStockByCode).filter(([, v]) => v.qty > 0).map(([code, v]) => (
        <TR key={code} label={`${v.name || code}  (${fmtN(v.qty)} × Rs.${fmt(v.unitCost)})`} col2={v.qty * v.unitCost} indent={2} />
      ))}

      <TR label="(+) Purchases" col2={totalPurchase} indent={1} />
      {showCosDetails && Object.entries(purBySup).map(([supId, sup]) => (
        <TR key={`pur-${supId}`} label={supId.replace(/^\d{4}-/, "")} col2={sup.total} indent={2} />
      ))}

      {transInAmt > 0  && <TR label="(+) Transfer In"  col2={transInAmt}  indent={1} />}
      {transOutAmt > 0 && <TR label="(-) Transfer Out" col2={transOutAmt} neg indent={1} />}

      <TR label="(-) End Stock" col2={endStockVal} neg indent={1} />
      {showCosDetails && Object.entries(endStockByCode).filter(([, v]) => v.qty > 0).map(([code, v]) => (
        <TR key={code} label={`${v.name || code}  (${fmtN(v.qty)} × Rs.${fmt(v.unitCost)})`} col2={v.qty * v.unitCost} indent={2} />
      ))}

      <TR label="Cost of Sales" val={costOfSales} neg total />
      <TR label="Gross Profit / (Loss)" val={grossProfit} bold total />

      {/* Other Income */}
      <SH>Other Income</SH>

      {/* Discount Received on Payment */}
      {(Object.keys(discBySup).length > 0) && (
        <>
          <TR label="Discount Received on Payment" indent={1} />
          {Object.entries(discBySup).map(([sup, amt]) => (
            <TR key={sup} label={sup.replace(/^\d{4}-/, "")} col2={amt} indent={2} />
          ))}
          <TR label="Total Discount on Payment" val={totalDiscPayment} bold indent={1} />
        </>
      )}

      {/* Discount Received on Empty */}
      {(Object.keys(emptyDiscBySup).length > 0) && (
        <>
          <TR label="Discount Received on Empty" indent={1} />
          {Object.entries(emptyDiscBySup).map(([sup, amt]) => (
            <TR key={sup} label={sup} col2={amt} indent={2} />
          ))}
          <TR label="Total Discount on Empty" val={totalDiscEmpty} bold indent={1} />
        </>
      )}

      <TR label="Total Other Income" val={totalOtherInc} bold total />
      <TR label="Total Income" val={totalIncome} bold total />

      {/* Expenses */}
      <SH>Sale &amp; Marketing Expenses (5501–5649)</SH>
      {expDetail("5501", "5649").map(e => <TR key={e.id} label={e.name} col2={e.total} indent={1} />)}
      <TR label="Total Sale &amp; Marketing" val={expSaleMkt} neg bold />

      <SH>Administration (5650–5799)</SH>
      {expDetail("5650", "5799").map(e => <TR key={e.id} label={e.name} col2={e.total} indent={1} />)}
      <TR label="Total Administration" val={expAdmin} neg bold />

      <SH>Finance Charge (5800–5899)</SH>
      {expDetail("5800", "5899").map(e => <TR key={e.id} label={e.name} col2={e.total} indent={1} />)}
      <TR label="Total Finance Charge" val={expFinance} neg bold />

      <SH>Other Expenses (5900–5999)</SH>
      {expDetail("5900", "5999").map(e => <TR key={e.id} label={e.name} col2={e.total} indent={1} />)}
      <TR label="Total Other Expenses" val={expOther} neg bold />

      <TR label="Total Expenses" val={totalExp} neg total />
      <TR label="Net Profit / (Loss)" val={netProfit} bold total />
    </ReportWrap>
  );
}

// ══════════════════════════════════════════════════════
// BALANCE SHEET
// Per PDF spec — account ranges from COA
// ══════════════════════════════════════════════════════
function BalanceSheet({ d, outlet, month }) {
  const {
    endStockVal, emptyStockVal,
    cashBal, bankBal, arBal, apBal,
    totalCurrentAssets, totalAssets, totalCurrentLiab, ownerEquity,
    netProfit,
    coaNonCurrentAssets,
  } = d;

  return (
    <ReportWrap title="Balance Sheet" outlet={outlet} month={month}>
      {/* Non-current Assets */}
      {coaNonCurrentAssets.length > 0 && (
        <>
          <SH>Non-current Assets (1500–1999)</SH>
          {coaNonCurrentAssets.map(a => (
            <TRSplit key={a.id} label={a.name} col2={0} indent={1} />
          ))}
        </>
      )}

      {/* Current Assets */}
      <SH>Current Assets (1000–1499)</SH>
      <TRSplit label="Main Stock"  col2={endStockVal}   indent={1} />
      <TRSplit label="Empty Stock"                            col2={emptyStockVal}  indent={1} />
      <TRSplit label="Cash in Hand"                          col2={cashBal}         indent={1} />
      <TRSplit label="Bank"                                  col2={bankBal}         indent={1} />
      <TRSplit label="Accounts Receivable (1100)"            col2={arBal}           indent={1} />
      <TRSplit label="Total Assets" col3={totalAssets} bold total />

      {/* Total Capital */}
      <SH>Total Capital</SH>
      <TRSplit label="Net Profit / (Loss) — from Income Statement" col2={netProfit} indent={1} />
      <TRSplit label="Total Capital" col3={ownerEquity} bold total />

      {/* Non-current Liabilities */}
      <SH>Non-current Liabilities (2500–2999)</SH>

      {/* Current Liabilities */}
      <SH>Current Liabilities (2000–2499)</SH>
      <TRSplit label="Accounts Payable" col2={apBal} indent={1} />
      <TRSplit label="Total Current Liabilities" col3={totalCurrentLiab} bold total />

      <TRSplit label="Total Capital and Liabilities" col3={ownerEquity + totalCurrentLiab} bold total />
    </ReportWrap>
  );
}

// ══════════════════════════════════════════════════════
// CAPITAL SHEET
// Per PDF: Owner's Capital + Net Profit - Drawings - Commission = Total Capital
// ══════════════════════════════════════════════════════
  function CapitalSheet({ d, outlet, month }) {
  const { netProfit, cashBal, bankBal, endStockVal, coaCapital, capitalByParty = {}, totalCapitalIn = 0, totalCapitalOut = 0 } = d;
  // Capital accounts from COA 3000-3999 (drawings, commission etc.)
  // Net Profit flows in from Income Statement
  const capital = cashBal + bankBal;
  const parties = Object.keys(capitalByParty);
  const totalCapital = netProfit + totalCapitalIn - totalCapitalOut;

  return (
    <ReportWrap title="Capital Sheet" outlet={outlet} month={month}>
      <SH>Capital Summary</SH>
      <TR label="Owner's Capital" col2={0} indent={1} />
      <TR label=" Net Profit / (Loss)" col2={netProfit} indent={1} />
      {coaCapital.filter(a => a.id >= "3003").map(a => (
        <TR key={a.id} label={`(-) ${a.name}`} col2={0} neg indent={1} />
      ))}
      <TR label="Total Capital" val={netProfit} bold total />

      <SH>Partner Contributions (BY)</SH>
      {parties.length === 0 && <TR label="No contributions/drawings recorded this period" col2="" indent={1} />}
      {parties.filter(p => capitalByParty[p].in > 0).map(p => (
        <TR key={`in-${p}`} label={`BY ${p}`} col2={capitalByParty[p].in} indent={1} />
      ))}
      <TR label="Total Contributions" val={totalCapitalIn} bold total />

      <SH>Partner Drawings (TO)</SH>
      {parties.filter(p => capitalByParty[p].out > 0).map(p => (
        <TR key={`out-${p}`} label={`TO ${p}`} col2={capitalByParty[p].out} neg indent={1} />
      ))}
      <TR label="Total Drawings" val={totalCapitalOut} bold total neg />

      <TR label="Total Capital (Net Profit + Contributions − Drawings)" val={totalCapital} bold total />

      <SH>Capital Represented By</SH>
      <TR label="Main Stock Value" col2={endStockVal} indent={1} />
      <TR label="Cash in Hand"    col2={cashBal}      indent={1} />
      <TR label="Bank Balance"    col2={bankBal}      indent={1} />
      <TR label="Total" val={endStockVal + capital} bold total />

      <tr>
        <td colSpan={3} style={{ padding: "10px 12px", fontSize: 10.5, color: "var(--mut)", fontStyle: "italic" }}>
          Note: In the next month, this period's Net Profit is auto-added to Owner's Capital.
          Enter partner contributions/drawings from the Capital Ledger page (staff nav).
        </td>
      </tr>
    </ReportWrap>
  );
}

// ══════════════════════════════════════════════════════
// CASH FLOW STATEMENT
// ══════════════════════════════════════════════════════
function CashFlowStatement({ d, outlet, month }) {
  const {
    totalSalesAmt, empSoldByName, empRetByName,
    totalEmpSold, totalEmpRet,
    cashFlowIn, cashFlowOut, netCashFlow,
    bankDeposit, totalReturns, totalExp,
    cashBF, cashBal,
  } = d;

  return (
    <ReportWrap title="Cash Flow Statement" outlet={outlet} month={month}>
      <SH>Cash Inflows</SH>
      <TR label="Total Sales Cash" col2={totalSalesAmt} indent={1} />
      {totalEmpSold > 0 && <TR label="Empty Sold" col2={totalEmpSold} indent={1} />}
      {Object.entries(empSoldByName).map(([n, v]) => (
        <TR key={n} label={`  BY ${n}`} col2={v} indent={2} />
      ))}
      <TR label="(1) Total Cash Inflows" val={cashFlowIn} bold total />

      <SH>Cash Outflows</SH>
      <TR label="Day Sheet Expenses" col2={totalExp}     indent={1} />
      <TR label="Bank Deposit"       col2={bankDeposit}  indent={1} />
      {totalEmpRet > 0 && <TR label="Empty Return" col2={totalEmpRet} indent={1} />}
      {Object.entries(empRetByName).map(([n, v]) => (
        <TR key={n} label={`  TO ${n}`} col2={v} indent={2} />
      ))}
      {totalReturns > 0 && <TR label="Return Goods" col2={totalReturns} indent={1} />}
      <TR label="(2) Total Cash Outflows" val={cashFlowOut} bold total />
      <TR label="(1) − (2) Net Cash Balance" val={netCashFlow} bold total />

      <SH>Cash Balance Detail</SH>
      <TRSplit label="" col2="B/F Balance" col3="End Balance" />
      <TRSplit label="Cash" col2={cashBF} col3={cashBal} />
      <TRSplit label="Net Cash" col3={netCashFlow} bold total />
    </ReportWrap>
  );
}

// ══════════════════════════════════════════════════════════════════════════
// SALES SUMMARY
//
// DATA SOURCE (confirmed from S_Inventory.jsx source):
//   Each saved sale item has:
//     r.supplier  → e.g. "DCSL" or "2001-DCSL" (numeric prefix stripped on display)
//     r.code      → e.g. "D0056"
//     r.type      → e.g. "Q", "P", "N"  (item size/type badge — NOT the brand)
//     r.sold      → cumulative sold qty (incremental diff used for daily calc)
//     r.rate      → selling price per unit
//     r.isEmptyItem → true for empty bottle items (excluded here)
//
// BRAND GROUPING: group by supplier name (strip "XXXX-" prefix if present)
//   IDL          → supplier contains "IDL"
//   RL           → supplier contains "RL" or "ROCKLAND"
//   DCSL         → supplier contains "DCSL" (but NOT "DCSL BEER")
//   UG           → supplier contains "UG"
//   LION BREWERY → supplier contains "LION BREWERY" or "LION"
//   DCSL BEER    → supplier contains "DCSL BEER"
//   TODDY        → supplier contains "TODDY"
//
// COLUMN LAYOUT (matches Excel sheet exactly):
//   DATE | DAILY SALE | DAILY DEPOSIT
//   | IDL(Amt+Qty) | RL(Amt+Qty) | DCSL(Amt+Qty) | UG(Amt+Qty)
//   | LION BREWERY(Amt+Qty) | DCSL BEER(Amt+Qty)
//   | TODDY(Amt only)
//   | PURCHASE | SOLD | OTHER
// ══════════════════════════════════════════════════════════════════════════

const BRAND_CONFIG = [
  {
    key: "IDL",
    label: "IDL",
    match: s => s.includes("IDL") && !s.includes("ROYAL") && !s.includes("USW"),
    hasQty: false,
  },
  {
    key: "RL",
    label: "RL",
    match: s => s.includes("ROCKLAND") || (s === "RL") || s.startsWith("RL ") || s.endsWith(" RL"),
    hasQty: false,
  },
  {
    key: "DCSL",
    label: "DCSL",
    match: s => s.includes("DCSL") && !s.includes("DCSL BEER") && !s.includes("BEER"),
    hasQty: false,
  },
  {
    key: "UG",
    label: "UG",
    match: s => s === "UG" || s.includes("2003-UG") || s.endsWith("-UG") || s.startsWith("UG-"),
    hasQty: false,
  },
  {
    key: "LION BREWERY",
    label: "LION BREWERY",
    match: s => s.includes("LION"),
    hasQty: false,
  },
  {
    key: "DCSL BEER",
    label: "DCSL BEER",
    match: s => s.includes("DCSL BEER") || (s.includes("BEER") && s.includes("DCSL")),
    hasQty: false,
  },
  {
    key: "TODDY",
    label: "TODDY",
    match: s => s.includes("TODDY"),
    hasQty: false, // Amount only — no Qty column
  },
];

// Normalise supplier string: strip "XXXX-" numeric prefix, uppercase, trim
function normSup(raw) {
  return (raw || "").replace(/^\d{4}-/, "").toUpperCase().trim();
}

// Return the brand key for a given raw supplier string, or null
function brandOf(rawSupplier) {
  const s = normSup(rawSupplier);
  for (const b of BRAND_CONFIG) {
    if (b.match(s)) return b.key;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────
function SalesSummary({ d, outlet, month }) {
  const { sales, totalSalesAmt, bankLedger, purchases } = d;

  // ── 1. Per-brand, per-day aggregates ─────────────────────────────────
  // brandDay[brandKey][dayNum] = { amt, qty }
  const brandDay = {};
  BRAND_CONFIG.forEach(b => { brandDay[b.key] = {}; });

  const dailySale = {};   // dayNum → total Rs amount
  const dailySold = {};   // dayNum → total units

  // r.sold is the direct daily qty entered by staff (not cumulative)
  // — confirmed from console log: D0001=31, D0002=96, D0003=40 etc.
  // No incremental diff needed — just sum r.sold directly per day.
  const salesFiltered = [...sales]
    .filter(s => (s.items || []).some(r => !r.isEmptyItem));

  salesFiltered.forEach(s => {
    const day = dayOf(s.date);

    (s.items || []).filter(r => !r.isEmptyItem).forEach(r => {
      const bk   = brandOf(r.supplier);
      if (!bk) return; // skip unmapped suppliers

      const qty = parseFloat(r.sold) || 0;  // direct daily qty ✅
      const amt = qty * (parseFloat(r.rate) || 0);

      if (!brandDay[bk][day]) brandDay[bk][day] = { amt: 0, qty: 0 };
      brandDay[bk][day].amt += amt;
      brandDay[bk][day].qty += qty;

      dailySale[day] = (dailySale[day] || 0) + amt;
      dailySold[day] = (dailySold[day] || 0) + qty;
    });
  });

  // ── 2. Daily Deposit — from bankLedger debit entries ─────────────────
  const dailyDeposit = {};
  (bankLedger || []).forEach(r => {
    const day = dayOf(r.date);
    const deb = Number(r.debit) || 0;
    if (deb > 0) dailyDeposit[day] = (dailyDeposit[day] || 0) + deb;
  });

  // ── 3. Daily Purchase — from purchases records ────────────────────────
  const dailyPurchase = {};
  (purchases || []).forEach(p => {
    const day = dayOf(p.date);
    const lineTotal = (p.items || [])
      .filter(l => !l.isEmptyItem)
      .reduce((a, l) => a + (Number(l.amount) || (Number(l.qty) * Number(l.unitCost)) || 0), 0);
    const amt = Number(p.total) || Number(p.grand_total) || lineTotal || 0;
    if (amt > 0) dailyPurchase[day] = (dailyPurchase[day] || 0) + amt;
  });

  // ── 4. Grid helpers ───────────────────────────────────────────────────
  const days  = Array.from({ length: 31 }, (_, i) => i + 1);
  const weeks = [[1, 7], [8, 14], [15, 21], [22, 28], [29, 31]];

  const wkBrandAmt = (bk, s, e) =>
    days.filter(d => d >= s && d <= e).reduce((a, d) => a + (brandDay[bk][d]?.amt || 0), 0);
  const wkBrandQty = (bk, s, e) =>
    days.filter(d => d >= s && d <= e).reduce((a, d) => a + (brandDay[bk][d]?.qty || 0), 0);
  const wkSimple = (map, s, e) =>
    days.filter(d => d >= s && d <= e).reduce((a, d) => a + (map[d] || 0), 0);

   const grandDailySale = Object.values(dailySale   ).reduce((a, v) => a + v, 0);
   const grandDeposit   = Object.values(dailyDeposit ).reduce((a, v) => a + v, 0);
   const grandPurchase  = Object.values(dailyPurchase).reduce((a, v) => a + v, 0);
   const grandSold      = Object.values(dailySold    ).reduce((a, v) => a + v, 0);

  const grandBrandAmt = bk => days.reduce((a, d) => a + (brandDay[bk][d]?.amt || 0), 0);
  const grandBrandQty = bk => days.reduce((a, d) => a + (brandDay[bk][d]?.qty || 0), 0);

  const mo = month
    ? new Date(month + "-01").toLocaleString("en-LK", { month: "long", year: "numeric" })
    : "All Periods";

  // ── 5. Cell style helpers ─────────────────────────────────────────────
  const thBase = {
    padding: "5px 7px", fontSize: 9, fontWeight: 700, letterSpacing: ".06em",
    textTransform: "uppercase", color: "var(--mut2)", background: "var(--s3)",
    borderBottom: "1px solid var(--bdr)", borderRight: "1px solid var(--bdr)",
    whiteSpace: "nowrap",
  };
  const tdBase = (color) => ({
    padding: "4px 7px", fontSize: 11, fontFamily: "'JetBrains Mono',monospace",
    fontWeight: 400,
    color: color || "var(--txt)",
    borderRight: "1px solid rgba(63,63,70,.2)",
    borderBottom: "1px solid rgba(63,63,70,.15)",
    whiteSpace: "nowrap", textAlign: "right",
  });
  const dayTd = {
    padding: "4px 7px", fontSize: 11, fontWeight: 600, color: "var(--mut2)",
    borderRight: "1px solid var(--bdr)", borderBottom: "1px solid rgba(63,63,70,.15)",
    textAlign: "center", background: "var(--s2)",
  };
  const wkTd = (color) => ({
    padding: "5px 7px", fontFamily: "'JetBrains Mono',monospace", fontSize: 10,
    fontWeight: 700, color: color || "var(--gld2)",
    borderRight: "1px solid var(--bdr)", textAlign: "right",
  });
  const totTd = (color) => ({
    padding: "7px 10px", fontFamily: "'JetBrains Mono',monospace",
    fontWeight: 700, fontSize: 12,
    color: color || "var(--txt)",
    textAlign: "right", borderRight: "1px solid var(--bdr)",
  });

  // ── 6. Weekly subtotal row ────────────────────────────────────────────
  const WeekRow = ({ s, e }) => {
    const wSale    = wkSimple(dailySale,     s, e);
    const wDeposit = wkSimple(dailyDeposit,  s, e);
    const wPur     = wkSimple(dailyPurchase, s, e);
    const wSold    = wkSimple(dailySold,     s, e);
    return (
      <tr style={{ background: "var(--gd2)", borderBottom: "2px solid var(--bdr2)" }}>
        <td style={{ ...wkTd(), textAlign: "center", whiteSpace: "nowrap" }}>Wk {s}–{e}</td>
        <td style={wkTd()}>{wSale    > 0 ? fmt(wSale)    : ""}</td>
        <td style={wkTd()}>{wDeposit > 0 ? fmt(wDeposit) : ""}</td>

        {BRAND_CONFIG.map(b => (
          <React.Fragment key={b.key}>
            <td style={wkTd()}>{wkBrandAmt(b.key, s, e) > 0 ? fmt(wkBrandAmt(b.key, s, e)) : ""}</td>
            {b.hasQty && (
              <td style={{ ...wkTd(), color: "var(--mut2)" }}>
                {wkBrandQty(b.key, s, e) > 0 ? fmtN(wkBrandQty(b.key, s, e)) : ""}
              </td>
            )}
          </React.Fragment>
        ))}

        <td style={wkTd()}>{wPur  > 0 ? fmt(wPur)   : ""}</td>
        <td style={wkTd()}>{wSold > 0 ? fmtN(wSold) : ""}</td>
        <td style={{ borderRight: "1px solid var(--bdr)" }} />
      </tr>
    );
  };

  // ── 7. Render ─────────────────────────────────────────────────────────
  return (
    <div>
      {/* Print button */}
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btnd btnsm" onClick={() => window.print()}>{I.print} Print</button>
      </div>

      <div style={{ background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: "var(--rl)", overflow: "hidden" }}>

        {/* Card header */}
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--bdr)", background: "var(--s2)" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 2 }}>Sales Summary</div>
          <div style={{ fontSize: 11, color: "var(--mut)" }}>
            {outlet === "ALL" ? "All Outlets" : outlet} &nbsp;·&nbsp; {mo}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11, minWidth: 900 }}>
            <thead>

              {/* ── Row 1: group headers ── */}
              <tr>
                <th rowSpan={2} style={{ ...thBase, textAlign: "center", minWidth: 42 }}>Date</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "right" }}>Daily Sale</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "right" }}>Daily Deposit</th>

                {BRAND_CONFIG.map(b => b.hasQty ? (
                  // Brands with Qty: span 2 sub-cols
                  <th key={b.key} colSpan={2}
                    style={{ ...thBase, textAlign: "center", background: "var(--gd2)", color: "var(--gld2)", borderBottom: "1px solid var(--bdr2)" }}>
                    {b.label}
                  </th>
                ) : (
                  // Amount-only brands: rowSpan=2, no sub-header needed
                  <th key={b.key} rowSpan={2} style={{ ...thBase, textAlign: "right" }}>
                    {b.label}
                  </th>
                ))}

                <th rowSpan={2} style={{ ...thBase, textAlign: "right" }}>Purchase</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "right" }}>Sold</th>
                <th rowSpan={2} style={{ ...thBase, textAlign: "right" }}>Other</th>
              </tr>

              {/* ── Row 2: sub-col labels (only for hasQty brands) ── */}
              <tr>
                {BRAND_CONFIG.filter(b => b.hasQty).map(b => (
                  <React.Fragment key={b.key}>
                    <th style={{ ...thBase, textAlign: "right", fontSize: 8 }}>Amount</th>
                    <th style={{ ...thBase, textAlign: "right", fontSize: 8 }}>Qty</th>
                  </React.Fragment>
                ))}
              </tr>

            </thead>

            <tbody>
              {days.map(day => {
                const weekBreakBefore = weeks.find(([, e]) => e === day - 1);
                const sale    = dailySale[day]     || 0;
                const deposit = dailyDeposit[day]  || 0;
                const pur     = dailyPurchase[day] || 0;
                const sold    = dailySold[day]     || 0;

                return (
                  <React.Fragment key={day}>
                    {weekBreakBefore && <WeekRow s={weekBreakBefore[0]} e={weekBreakBefore[1]} />}

                    <tr style={{ borderBottom: "1px solid rgba(63,63,70,.25)" }}>
                      {/* Date */}
                      <td style={dayTd}>{day}</td>

                      {/* Daily Sale */}
                      <td style={tdBase(sale > 0 ? "var(--grn)" : "var(--mut2)")}>
                        {sale > 0 ? fmt(sale) : "-"}
                      </td>

                      {/* Daily Deposit */}
                      <td style={tdBase(deposit > 0 ? "var(--blu)" : "var(--mut2)")}>
                        {deposit > 0 ? fmt(deposit) : "-"}
                      </td>

                      {/* Brand columns */}
                      {BRAND_CONFIG.map(b => {
                        const cell = brandDay[b.key][day];
                        return (
                          <React.Fragment key={b.key}>
                            {/* Amount */}
                            <td style={tdBase(cell?.amt > 0 ? "var(--txt)" : "var(--mut2)")}>
                              {cell?.amt > 0 ? fmt(cell.amt) : "-"}
                            </td>
                            {/* Qty (only for hasQty brands) */}
                            {b.hasQty && (
                              <td style={tdBase("var(--mut2)")}>
                                {cell?.qty > 0 ? fmtN(cell.qty) : ""}
                              </td>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* Purchase */}
                      <td style={tdBase(pur > 0 ? "var(--gld2)" : "var(--mut2)")}>
                        {pur > 0 ? fmt(pur) : "-"}
                      </td>

                      {/* Sold (total units all brands) */}
                      <td style={tdBase(sold > 0 ? "var(--txt)" : "var(--mut2)")}>
                        {sold > 0 ? fmtN(sold) : ""}
                      </td>

                      {/* Other (reserved) */}
                      <td style={tdBase("var(--mut2)")}>{""}</td>
                    </tr>
                  </React.Fragment>
                );
              })}

              {/* Week 29–31 subtotal */}
              <WeekRow s={29} e={31} />

              {/* ── Grand Total row ── */}
              <tr style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr2)" }}>
                <td style={{ padding: "7px 10px", fontWeight: 700, fontSize: 12, borderRight: "1px solid var(--bdr)", textAlign: "center" }}>
                  Total
                </td>
                <td style={totTd("var(--grn)")}>{grandDailySale > 0 ? fmt(grandDailySale) : ""}</td>
                <td style={totTd("var(--blu)")}>{fmt(grandDeposit)}</td>

                {BRAND_CONFIG.map(b => (
                  <React.Fragment key={b.key}>
                    <td style={totTd()}>
                      {grandBrandAmt(b.key) > 0 ? fmt(grandBrandAmt(b.key)) : ""}
                    </td>
                    {b.hasQty && (
                      <td style={totTd("var(--mut)")}>
                        {grandBrandQty(b.key) > 0 ? fmtN(grandBrandQty(b.key)) : ""}
                      </td>
                    )}
                  </React.Fragment>
                ))}

                <td style={totTd("var(--gld2)")}>{grandPurchase > 0 ? fmt(grandPurchase) : ""}</td>
                <td style={totTd()}>{grandSold > 0 ? fmtN(grandSold) : ""}</td>
                <td style={{ borderRight: "1px solid var(--bdr)" }} />
              </tr>

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════
// EXPENSE SUMMARY
// ══════════════════════════════════════════════════════
function ExpenseSummary({ d, outlet, month }) {
  const { expByAcc, totalExp } = d;
  const expCats = Object.values(expByAcc);

  return (
    <ReportWrap title="Expense Summary" outlet={outlet} month={month}>
      <tr style={{ background: "var(--s3)" }}>
        {["Description", "Total"].map(h => (
          <td key={h} style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--mut2)", borderBottom: "1px solid var(--bdr)", textAlign: h === "Total" ? "right" : "left" }}>{h}</td>
        ))}
        <td />
      </tr>
      {expCats.length === 0 && <tr><td colSpan={3} style={{ padding: 24, textAlign: "center", color: "var(--mut)" }}>No expenses recorded.</td></tr>}
      {expCats.sort((a, b) => b.total - a.total).map((e, i) => (
        <tr key={i} style={{ borderBottom: "1px solid rgba(63,63,70,.3)" }}>
          <td style={{ padding: "6px 12px", fontSize: 12, color: "var(--txt)" }}>{e.name} <span style={{ fontSize: 10, color: "var(--mut)" }}>({e.id})</span></td>
          <td style={{ padding: "6px 12px", fontFamily: "'JetBrains Mono',monospace", fontSize: 12, textAlign: "right", color: "var(--red)" }}>Rs.{fmt(e.total)}</td>
          <td />
        </tr>
      ))}
      <tr style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr2)" }}>
        <td style={{ padding: "7px 12px", fontWeight: 700, fontSize: 12 }}>Total Expenses</td>
        <td style={{ padding: "7px 12px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 13, color: "var(--red)", textAlign: "right" }}>Rs.{fmt(totalExp)}</td>
        <td />
      </tr>
    </ReportWrap>
  );
}

// ══════════════════════════════════════════════════════
// PURCHASE SUMMARY — broken down by supplier per PDF
// ══════════════════════════════════════════════════════
function PurchaseSummary({ d, outlet, month }) {
  const { purBySup, totalPurchase } = d;

  return (
    <ReportWrap title="Purchase Summary" outlet={outlet} month={month}>
      {Object.entries(purBySup).map(([supId, sup]) => (
        <React.Fragment key={supId}>
          <SH>{supId.replace(/^\d{4}-/, "")}</SH>
          <tr style={{ background: "var(--s2)" }}>
            {["Date", "Invoice No", "Description", "Qty", "Value"].map((h, i) => (
              <td key={i} style={{ padding: "5px 10px", fontSize: 9, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--mut2)", borderBottom: "1px solid var(--bdr)" }}>{h}</td>
            ))}
          </tr>
          {sup.records.map(p => {
  const items = p.items?.filter(l => !l.isEmptyItem) || [];
  const invTotal = items.reduce((a, l) => a + (Number(l.amount) || (Number(l.qty) * Number(l.unitCost)) || 0), 0);
  const invNo = p.ref || p.invoice_no || p.notes?.replace(/^Inv:/, "") || "—";
  return (
    <React.Fragment key={p.id || p.date}>
      {items.map((l, i) => (
        <tr key={`${p.id||p.date}_${i}`} style={{ borderBottom: "1px solid rgba(63,63,70,.3)" }}>
          <td style={{ padding: "5px 10px", fontSize: 11, color: "var(--mut)", fontFamily: "'JetBrains Mono',monospace" }}>{i === 0 ? p.date : ""}</td>
          <td style={{ padding: "5px 10px", fontSize: 11, color: "var(--mut)" }}>{i === 0 ? invNo : ""}</td>
          <td style={{ padding: "5px 10px", fontSize: 11.5, fontWeight: 600 }}>{l.itemName || l.name || l.itemCode}</td>
          <td style={{ padding: "5px 10px", fontSize: 11.5, textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{l.qty}</td>
          <td style={{ padding: "5px 10px", fontSize: 11.5, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "var(--grn)" }}>Rs.{fmt(l.amount || (Number(l.qty) * Number(l.unitCost)) || 0)}</td>
        </tr>
      ))}
         {items.length > 0 && (
          <tr style={{ background: "rgba(63,63,70,.15)" }}>
          <td colSpan={4} style={{ padding: "4px 10px", fontSize: 10.5, fontWeight: 600, color: "var(--mut)", textAlign: "right" }}>
            Invoice {invNo} Total:
          </td>
          <td style={{ padding: "4px 10px", fontSize: 11, fontWeight: 700, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "var(--txt)" }}>
            Rs.{fmt(invTotal)}
          </td>
          </tr>
         )}
         </React.Fragment>
        );
        })}
          <tr style={{ background: "var(--gd2)" }}>
            <td colSpan={4} style={{ padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "var(--gld2)", textAlign: "right" }}>
              Subtotal {supId.replace(/^\d{4}-/, "")}:
            </td>
            <td style={{ padding: "5px 10px", fontSize: 12, fontWeight: 700, color: "var(--gld2)", textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>
              Rs.{fmt(sup.total)}
            </td>
          </tr>
        </React.Fragment>
      ))}
      {Object.keys(purBySup).length === 0 && (
        <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "var(--mut)" }}>No purchases recorded.</td></tr>
      )}
      <tr style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr2)" }}>
        <td colSpan={4} style={{ padding: "7px 10px", fontWeight: 700, fontSize: 12, textAlign: "right" }}>Total Purchase:</td>
        <td style={{ padding: "7px 10px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 13, color: "var(--grn)", textAlign: "right" }}>Rs.{fmt(totalPurchase)}</td>
      </tr>
    </ReportWrap>
  );
}

// ══════════════════════════════════════════════════════
// COST OF SALES SUMMARY
// ══════════════════════════════════════════════════════
function CostOfSalesSummary({ d, outlet, month }) {
  const { cosByItem,openingStockByCode} = d;
  const items    = Object.values(cosByItem);
  const totalCOS = items.reduce((a, i) => a + i.sold * i.unitCost, 0);

  return (
    <ReportWrap title="Cost of Sales Summary" outlet={outlet} month={month}>
      <tr style={{ background: "var(--s3)" }}>
        {["Description", "Type","Opening Stock", "Purchase", "Trans In", "Trans Out", "Return", "Adj", "Sold", "Unit Cost", "Cost of Sales"].map(h => (
          <td key={h} style={{ padding: "5px 8px", fontSize: 8.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--mut2)", borderBottom: "1px solid var(--bdr)", whiteSpace: "nowrap" }}>{h}</td>
        ))}
      </tr>
      {items.length === 0 && <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "var(--mut)" }}>No sold items this period.</td></tr>}
      {items.map(item => {
        const cos = item.sold * item.unitCost;
        const openQty = openingStockByCode[item.code]?.qty || 0;  
        return (
          <tr key={item.code} style={{ borderBottom: "1px solid rgba(63,63,70,.3)" }}>
            <td style={{ padding: "5px 8px", fontSize: 11.5, fontWeight: 600 }}>{item.name} <span className="ctag">{item.code}</span></td>
            <td style={{ padding: "5px 8px" }}><span className="tpill">{item.type}</span></td>
             <td style={{ padding: "5px 8px", fontSize: 11, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "var(--mut)" }}>
             {openQty > 0 ? fmtN(openQty) : ""}
             </td>
            <td style={{ padding: "5px 8px", fontSize: 11, textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{item.purchase || 0}</td>
            <td style={{ padding: "5px 8px", fontSize: 11, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "var(--blu)" }}>{item.transIn || 0}</td>
            <td style={{ padding: "5px 8px", fontSize: 11, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "var(--gld2)" }}>{item.transOut || 0}</td>
            <td style={{ padding: "5px 8px", fontSize: 11, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "var(--red)" }}>{item.returns || 0}</td>
            <td style={{ padding: "5px 8px", fontSize: 11, textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{item.adj || 0}</td>
            <td style={{ padding: "5px 8px", fontSize: 11.5, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: "var(--grn)" }}>{item.sold}</td>
            <td style={{ padding: "5px 8px", fontSize: 11, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "var(--mut)" }}>Rs.{fmt(item.unitCost)}</td>
            <td style={{ padding: "5px 8px", fontSize: 11.5, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", fontWeight: 600, color: "var(--grn)" }}>Rs.{fmt(cos)}</td>
          </tr>
        );
      })}
      <tr style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr2)" }}>
        <td colSpan={10} style={{ padding: "7px 8px", fontWeight: 700, fontSize: 12, textAlign: "right" }}>Total Cost of Sales:</td>
        <td style={{ padding: "7px 8px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 13, color: "var(--grn)", textAlign: "right" }}>Rs.{fmt(totalCOS)}</td>
      </tr>
    </ReportWrap>
  );
}

// ══════════════════════════════════════════════════════
// EMPTY BOTTLES
// Columns: DATE | B/F | PUR | IN PUR | REC | RET | EX | IN ISS | ISS | SOL | SHO | BAL
// ══════════════════════════════════════════════════════
function EmptyBottles({ d, outlet, month }) {
  const { empDailyData, empSuppliers } = d;
  const COLS = ["B/F", "PUR", "IN PUR", "REC", "RET", "EX", "IN ISS", "ISS", "SOL", "SHO", "BAL"];
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const mo = month
    ? new Date(month + "-01").toLocaleString("en-LK", { month: "long", year: "numeric" })
    : "All Periods";

  const thStyle = {
    padding: "5px 6px", fontSize: 9, fontWeight: 700, letterSpacing: ".06em",
    textTransform: "uppercase", color: "var(--mut2)", borderBottomWidth: "1px", borderBottomStyle: "solid", borderBottomColor: "var(--bdr)",
    borderRight: "1px solid var(--bdr)", textAlign: "center", whiteSpace: "nowrap", background: "var(--s3)",
  };
  const tdStyle = (bold, color) => ({
    padding: "3px 6px", fontSize: 10.5, fontFamily: "'JetBrains Mono',monospace",
    textAlign: "right", borderRight: "1px solid rgba(63,63,70,.2)",
    borderBottom: "1px solid rgba(63,63,70,.15)", fontWeight: bold ? 700 : 400,
    color: color || "var(--txt)", minWidth: 38,
  });
  const dayTdStyle = {
    padding: "3px 7px", fontSize: 11, fontWeight: 600, color: "var(--mut2)",
    borderRight: "1px solid var(--bdr)", borderBottom: "1px solid rgba(63,63,70,.15)",
    textAlign: "center", background: "var(--s2)",
  };

  // Compute running balance per supplier
  const runningBal = {};
  empSuppliers.forEach(s => { runningBal[s] = 0; });

  if (empSuppliers.length === 0) {
    return (
      <ReportWrap title="Empty Bottles" outlet={outlet} month={month}>
        <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "var(--mut)" }}>
          No empty bottle data. Record empty bottle transactions in daily Sales.
        </td></tr>
      </ReportWrap>
    );
  }

  return (
    <div>
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btnd btnsm" onClick={() => window.print()}>{I.print} Print</button>
      </div>
      <div style={{ background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: "var(--rl)", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--bdr)", background: "var(--s2)" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 2 }}>Empty Bottles</div>
          <div style={{ fontSize: 11, color: "var(--mut)" }}>{outlet === "ALL" ? "All Outlets" : outlet} &nbsp;·&nbsp; {mo}</div>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th rowSpan={3} style={{ ...thStyle, minWidth: 42, fontSize: 11 }}>DATE</th>
                {empSuppliers.map(sup => (
                  <th key={sup} colSpan={COLS.length} style={{ ...thStyle, background: "var(--gd2)", color: "var(--gld2)", fontSize: 11, borderBottom: "1px solid var(--bdr2)" }}>
                    {sup}
                  </th>
                ))}
              </tr>
              <tr>
                {empSuppliers.map(sup => (
                  <th key={sup + "eb"} colSpan={COLS.length} style={{ ...thStyle, background: "var(--s3)", color: "var(--mut2)", fontSize: 8.5 }}>
                    EMPTY BOTTLE
                  </th>
                ))}
              </tr>
              <tr>
                {empSuppliers.map(sup =>
                  COLS.map(col => <th key={sup + col} style={thStyle}>{col}</th>)
                )}
              </tr>
            </thead>
            <tbody>
              {days.map(day => (
                <tr key={day}>
                  <td style={dayTdStyle}>{day}</td>
                  {empSuppliers.map(sup => {
                    const dd  = (empDailyData[sup] || {})[day] || {};
                    const pur = dd.purchase    || 0;
                    const ip  = dd.invPurchase || 0;
                    const rec = dd.received    || 0;
                    const ret = dd.return_     || 0;
                    const ii  = dd.invIssue    || 0;
                    const iss = dd.issue       || 0;
                    const sol = dd.sold        || 0;
                    const bf  = runningBal[sup] || 0;
                    const bal = bf + pur + ip + rec + ret - ii - iss - sol;
                    runningBal[sup] = bal;

                    return COLS.map(col => {
                      let val = "";
                      if (col === "B/F"    && bf  !== 0) val = fmtN(bf);
                      if (col === "PUR"    && pur  > 0)  val = fmtN(pur);
                      if (col === "IN PUR" && ip   > 0)  val = fmtN(ip);
                      if (col === "REC"    && rec  > 0)  val = fmtN(rec);
                      if (col === "RET"    && ret  > 0)  val = fmtN(ret);
                      if (col === "IN ISS" && ii   > 0)  val = fmtN(ii);
                      if (col === "ISS"    && iss  > 0)  val = fmtN(iss);
                      if (col === "SOL"    && sol  > 0)  val = fmtN(sol);
                      if (col === "BAL")                  val = fmtN(bal);
                      return (
                        <td key={sup + col + day} style={tdStyle(
                          col === "BAL",
                          col === "SOL" ? "var(--grn)"
                            : col === "BAL" ? (bal >= 0 ? "var(--grn)" : "var(--red)")
                            : "var(--txt)"
                        )}>
                          {val}
                        </td>
                      );
                    });
                  })}
                </tr>
              ))}
              {/* TOTAL row */}
              <tr style={{ borderTop: "2px solid var(--bdr2)", background: "var(--s3)" }}>
                <td style={{ ...dayTdStyle, fontWeight: 700, fontSize: 10, color: "var(--txt)" }}>TOTAL</td>
                {empSuppliers.map(sup => {
                  const allDays = Object.values(empDailyData[sup] || {});
                  const t = { purchase: 0, invPurchase: 0, received: 0, return_: 0, invIssue: 0, issue: 0, sold: 0 };
                  allDays.forEach(dd => {
                    t.purchase    += dd.purchase    || 0;
                    t.invPurchase += dd.invPurchase || 0;
                    t.received    += dd.received    || 0;
                    t.return_     += dd.return_     || 0;
                    t.invIssue    += dd.invIssue    || 0;
                    t.issue       += dd.issue       || 0;
                    t.sold        += dd.sold        || 0;
                  });
                  const totalBal = t.purchase + t.invPurchase + t.received + t.return_ - t.invIssue - t.issue - t.sold;
                  return COLS.map(col => {
                    let val = "";
                    if (col === "PUR")    val = fmtN(t.purchase);
                    if (col === "IN PUR") val = fmtN(t.invPurchase);
                    if (col === "REC")    val = fmtN(t.received);
                    if (col === "RET")    val = fmtN(t.return_);
                    if (col === "IN ISS") val = fmtN(t.invIssue);
                    if (col === "ISS")    val = fmtN(t.issue);
                    if (col === "SOL")    val = fmtN(t.sold);
                    if (col === "BAL")    val = fmtN(totalBal);
                    return (
                      <td key={"tot" + sup + col} style={tdStyle(true,
                        col === "SOL" ? "var(--grn)" : col === "BAL" ? "var(--gld2)" : "var(--txt)"
                      )}>
                        {val}
                      </td>
                    );
                  });
                })}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
// ══════════════════════════════════════════════════════════════════════════
// FIXED UG PRODUCT LIST — mirrors the physical Excel "BAR NAME" sheet.
// These are the EXACT short names used throughout the system/database.
// Column headers in the UG Book table use these names directly (no
// relabeling to E1/SP1/etc.), so Excel copy-paste and DB lookups always
// line up. Prices are NOT stored here — they're loaded live from the
// inventory master (getInventoryMaster) every time the report runs, so
// price edits by the admin reflect automatically.
// ══════════════════════════════════════════════════════════════════════════
const UG_FIXED_PRODUCTS = [
  "UES Q", "UES P", "UES N",
  "USP Q", "USP P", "USP N",
  "UL Q",  "UL P",  "UL N",
  "URB Q", "URB P", "URB N",
  "UOW Q", "UOW P", "UOW N",
  "UGS Q", "UGS P", "UGS N",
  "UV6 Q", "UV6 P",
  "UISW Q", "UISW P",
  "UPV Q", "UPV P",
  "UMDG Q",
  "UAP N",
  "ULE N",
  "UGAV Q",
];

// Normalises a raw name/code string for matching: uppercase, trim, collapse
// internal whitespace to single spaces (handles "UV6  P" vs "UV6 P").
function normUGName(raw) {
  return (raw || "").toString().toUpperCase().trim().replace(/\s+/g, " ");
}

const UG_NAME_SET = new Set(UG_FIXED_PRODUCTS.map(normUGName));

// Tries itemName first, then itemCode/code, then name — whichever matches
// one of the fixed UG product short names. Returns the canonical short
// name (exact casing/spacing as defined in UG_FIXED_PRODUCTS) or null.
function matchUGProduct(line) {
  const candidates = [line.itemName, line.itemCode, line.code, line.name];
  for (const c of candidates) {
    const n = normUGName(c);
    if (UG_NAME_SET.has(n)) {
      // Return the canonical-cased version from the fixed list
      return UG_FIXED_PRODUCTS.find(p => normUGName(p) === n);
    }
  }
  return null;
}

// Builds a name -> live price lookup from the inventory master (`inv`,
// as returned by getInventoryMaster and already available on report data
// as `d.inv`). Matches inventory items the same way purchase lines are
// matched: by code or name against the fixed UG short-name list.
function buildUGPriceLookup(inv) {
  const lookup = {};
  (inv || []).forEach(item => {
    const candidates = [item.name, item.code, item.itemCode, item.itemName];
    for (const c of candidates) {
      const n = normUGName(c);
      if (UG_NAME_SET.has(n)) {
        const canonical = UG_FIXED_PRODUCTS.find(p => normUGName(p) === n);
        // Prefer unitCost (purchase price) since this is a purchase ledger;
        // fall back to sellingPrice if unitCost isn't set on the item.
        const price = Number(item.unitCost) || Number(item.sellingPrice) || 0;
        lookup[canonical] = price;
        break;
      }
    }
  });
  return lookup;
}

// Builds the set of inventory item CODES (e.g. "U0001") that are UG
// products — by matching each inventory item's name/code against the
// fixed UG short-name list, same matching rule as buildUGPriceLookup.
// openingStockByCode is keyed by inventory item code, not by the fixed
// sheet column names, so this bridges the two for P/Stock.
function buildUGCodeSet(inv) {
  const set = new Set();
  (inv || []).forEach(item => {
    const candidates = [item.name, item.code, item.itemCode, item.itemName];
    for (const c of candidates) {
      const n = normUGName(c);
      if (UG_NAME_SET.has(n)) {
        if (item.code) set.add(item.code);
        if (item.id)   set.add(item.id);
        break;
      }
    }
  });
  return set;
}

function UGBook({ d, outlet, month }) {
  const { purchases, apPayments, apInvoices, openingStockByCode } = d;

  const mStart = monthStart(month);
  const mEnd   = monthEnd(month);

  // ── Manual B/F state (DB-backed, reuses existing supplier_bf table /
  //    getSupplierBF/setSupplierBF, same as SupplierCreditLedger) ────────
  const UG_SUPPLIER_ID = "2003-UG";
  const [manualBF, setManualBFState]     = useState(null);
  const [bfDateInput, setBfDateInput]     = useState(today());
  const [bfAmountInput, setBfAmountInput] = useState("");
  const [bfSaving, setBfSaving]           = useState(false);
  useEffect(() => {
    let cancelled = false;
    getSupplierBF(UG_SUPPLIER_ID, outlet).then(entry => {
      if (cancelled) return;
      setManualBFState(entry);
      setBfDateInput(entry?.date || today());
      setBfAmountInput(entry?.amount ?? "");
    });
    return () => { cancelled = true; };
  }, [outlet]);

  async function handleSetBF() {
    setBfSaving(true);
    const entry = await setSupplierBF(UG_SUPPLIER_ID, outlet, bfDateInput, bfAmountInput);
    setBfSaving(false);
    if (entry) setManualBFState(entry);
  }

  // ── 1. UG supplier matcher ────────────────────────────────────────────
  const isUG = raw => {
    const s = (raw || "").trim();
    const stripped = s.replace(/^\d{4}-/, "").toUpperCase().trim();
    return s === "2003-UG" || stripped === "UG";
  };

  // ── 2. Filter UG transactions ─────────────────────────────────────────
  const ugPur = purchases.filter(p => isUG(p.supplier_id || p.supplier || ""));

  const ugPay = (apPayments || []).filter(p =>
    isUG(p.supplier_id || p.supplier || "") &&
    (!mStart || (p.date >= mStart && p.date <= mEnd))
  );

  // ── 3. B/F: UG balance from all months before this one (existing,
  //      unchanged carry-forward logic) ─────────────────────────────────
  const ugInvBefore = (apInvoices || []).filter(p =>
    isUG(p.supplier_id || p.supplier || "") && mStart && p.date < mStart
  );
  const ugPayBefore = (apPayments || []).filter(p =>
    isUG(p.supplier_id || p.supplier || "") && mStart && p.date < mStart
  );
  const computedBfBalance =
    ugInvBefore.reduce((a, i) => a + (Number(i.amount)   || 0), 0) -
    ugPayBefore.reduce((a, p) => a + (Number(p.amount)   || 0)
                                   + (Number(p.discount) || 0), 0);

  // Manual B/F override: only applies from its saved date onward, so it
  // doesn't leak into unrelated earlier months. Months before the manual
  // B/F date keep using the existing computed (from-history) balance.
  const useManualBF    = !!manualBF && (!mEnd || manualBF.date <= mEnd);
  const bfBalance       = useManualBF ? manualBF.amount : computedBfBalance;
  const bfEffectiveDate = useManualBF ? manualBF.date : mStart;

  // ── 4. Fixed product columns (always all 28, in sheet order, using the
  //      exact DB short names as headers). Prices loaded live from the
  //      inventory master so admin price edits reflect automatically.
  const priceLookup = buildUGPriceLookup(d.inv);
  const products = UG_FIXED_PRODUCTS.map(name => ({
    code: name,
    name,
    unitCost: priceLookup[name] || 0,
  }));

  // ── 5. Per-day aggregates, keyed by fixed column code ─────────────────
  const dayData = {};
  const initDay = n => {
    dayData[n] = { qtyByCode: {}, purchaseTotal: 0, paymentTotal: 0 };
  };
  // Track lines that didn't match any fixed product, for debugging
  const unmatched = new Set();

  // Names that should be silently excluded entirely from the UG Book
  // (not counted in PURCHASE/AMOUNT, not flagged as unmatched) — these are
  // tracked separately in the Empty Bottles report instead.
  const UG_EXCLUDED_NAMES = new Set(["UG EMP", "UG EMPTY"].map(normUGName));

  ugPur.forEach(p => {
    const day = dayOf(p.date);
    if (!dayData[day]) initDay(day);
    (p.items || []).filter(l => !l.isEmptyItem).forEach(l => {
      const rawName = l.itemName || l.itemCode || l.code || l.name || "?";
      if (UG_EXCLUDED_NAMES.has(normUGName(rawName))) return; // skip empties entirely

      const match = matchUGProduct(l);
      const qty = Number(l.qty) || 0;
      const amt = Number(l.amount) || qty * (Number(l.unitCost) || 0);

      if (match) {
        dayData[day].qtyByCode[match] =
          (dayData[day].qtyByCode[match] || 0) + qty;
      } else {
        unmatched.add(rawName);
      }
      // Purchase total counts every matched bottled-product UG line
      dayData[day].purchaseTotal += amt;
    });
  });

  if (unmatched.size > 0) {
    // eslint-disable-next-line no-console
    console.warn("UG Book: unmatched product names (not shown in any column):", [...unmatched]);
  }

  ugPay.forEach(p => {
    const day = dayOf(p.date);
    if (!dayData[day]) initDay(day);
    dayData[day].paymentTotal += Number(p.amount) || 0;
  });

  // ── 6. Month totals ───────────────────────────────────────────────────
  const days = Array.from({ length: 31 }, (_, i) => i + 1);

  const totalPurchase = days.reduce((a, d) => a + (dayData[d]?.purchaseTotal || 0), 0);
  const totalPayment  = days.reduce((a, d) => a + (dayData[d]?.paymentTotal  || 0), 0);

  const totalQtyByCode = {};
  products.forEach(p => {
    totalQtyByCode[p.code] = days.reduce(
      (a, d) => a + (dayData[d]?.qtyByCode[p.code] || 0), 0
    );
  });

  // ── 7. Footer calculations ────────────────────────────────────────────
  const grossBalance = bfBalance + totalPurchase - totalPayment;
   const ugDiscount   = (totalPurchase / 1.18) * 0.06;      // UG 6% trade discount 
  const vatDiscount  = (totalPurchase * 0.06) - ugDiscount; // VAT on the discount 
  const netBalance   = grossBalance - ugDiscount - vatDiscount;

    // P/Stock: END-of-month stock value for UG item codes only 
  const ugItemCodes = buildUGCodeSet(d.inv);
  const pStock  = Object.entries(d.endStockByCode || {})
    .filter(([code]) => ugItemCodes.has(code))
    .reduce((a, [, v]) => a + (v.qty || 0) * (v.unitCost || 0), 0);
  const mo = month
    ? new Date(month + "-01").toLocaleString("en-LK", { month: "long", year: "numeric" })
    : "All Periods";

  // ── 8. Styles ─────────────────────────────────────────────────────────
  const thBase = {
    padding: "5px 8px",
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: ".06em",
    textTransform: "uppercase",
    color: "var(--mut2)",
    background: "var(--s3)",
    borderBottom: "1px solid var(--bdr)",
    borderRight: "1px solid var(--bdr)",
    whiteSpace: "nowrap",
    textAlign: "center",
  };
  const tdNum = (color, bold) => ({
    padding: "3px 7px",
    fontSize: 11,
    fontFamily: "'JetBrains Mono',monospace",
    textAlign: "right",
    color: color || "var(--txt)",
    borderRight: "1px solid rgba(63,63,70,.2)",
    borderBottom: "1px solid rgba(63,63,70,.15)",
    fontWeight: bold ? 700 : 400,
    whiteSpace: "nowrap",
  });
  const dayTd = {
    padding: "3px 8px",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--mut2)",
    borderRight: "1px solid var(--bdr)",
    borderBottom: "1px solid rgba(63,63,70,.15)",
    textAlign: "center",
    background: "var(--s2)",
    minWidth: 34,
  };
  const totTd = color => ({
    padding: "6px 9px",
    fontFamily: "'JetBrains Mono',monospace",
    fontWeight: 700,
    fontSize: 12,
    color: color || "var(--txt)",
    textAlign: "right",
    borderRight: "1px solid var(--bdr)",
    whiteSpace: "nowrap",
  });
  const footRow = (label, val, color, bold) => (
    <div style={{
      display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "6px 0", borderBottom: "1px solid var(--bdr)",
    }}>
      <span style={{ fontSize: 12, color: "var(--mut)", fontWeight: bold ? 700 : 400 }}>
        {label}
      </span>
      <span style={{
        fontFamily: "'JetBrains Mono',monospace",
        fontSize: bold ? 14 : 12.5,
        color: color || "var(--txt)",
        fontWeight: bold ? 700 : 600,
      }}>
        {val > 0 ? `Rs.${fmt(val)}` : "—"}
      </span>
    </div>
  );

  // Running balance accumulates as rows render (imperative, not state)
  let runBal = bfBalance;

  // ── 9. Render ─────────────────────────────────────────────────────────
  return (
    <div>
           {/* Print button */}
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btnd btnsm" onClick={() => window.print()}>
          {I.print} Print
        </button>
      </div>

      {/* Manual B/F control — new, isolated section (reuses supplier_bf) */}
      <div className="no-print" style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 12, flexWrap: "wrap", padding: "10px 12px", background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 8 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--mut2)", marginBottom: 3 }}>B/F Date</div>
          <input type="date" value={bfDateInput} onChange={e => setBfDateInput(e.target.value)}
            style={{ padding: "6px 10px", background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: 6, fontSize: 12, color: "var(--txt)" }} />
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--mut2)", marginBottom: 3 }}>B/F Amount</div>
          <input type="number" step="0.01" value={bfAmountInput} onChange={e => setBfAmountInput(e.target.value)}
            placeholder="0.00"
            style={{ padding: "6px 10px", width: 140, background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: 6, fontSize: 12, color: "var(--txt)" }} />
        </div>
        <button className="btn btnd btnsm" onClick={handleSetBF} disabled={bfSaving}>
          {bfSaving ? "Saving…" : "Set B/F"}
        </button>
        {manualBF && (
          <span style={{ fontSize: 11, color: "var(--mut)" }}>
            Active: Rs.{fmt(manualBF.amount)} as of {manualBF.date}
          </span>
        )}
      </div>

            <div style={{
        background: "var(--s1)", border: "1px solid var(--bdr)",
        borderRadius: "var(--rl)", overflow: "hidden",
      }}>

        {/* Card header */}
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--bdr)", background: "var(--s2)" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, marginBottom: 2 }}>
            UG Book
          </div>
          <div style={{ fontSize: 11, color: "var(--mut)" }}>
            {outlet === "ALL" ? "All Outlets" : outlet} &nbsp;·&nbsp; {mo}
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
            <thead>

              {/* Row 1 — column labels (always all 28 fixed columns) */}
              <tr>
                <th style={{ ...thBase, minWidth: 38 }}>DATE</th>
                {products.map(p => (
                  <th key={p.code} style={thBase}>{p.code}</th>
                ))}
                <th style={{ ...thBase, textAlign: "right" }}>PURCHASE</th>
                <th style={{ ...thBase, textAlign: "right" }}>AMOUNT</th>
                <th style={{ ...thBase, textAlign: "right" }}>BALANCE</th>
              </tr>

              {/* Row 2 — fixed unit prices */}
              <tr style={{ background: "var(--gd2)" }}>
                <td style={{ ...thBase, background: "var(--gd2)", fontSize: 8.5, color: "var(--gld2)" }}>
                  PRICE
                </td>
                {products.map(p => (
                  <td key={p.code} style={{
                    ...thBase, background: "var(--gd2)",
                    fontSize: 8.5, color: "var(--gld2)", textAlign: "right",
                  }}>
                    {fmtN(p.unitCost)}
                  </td>
                ))}
                <td style={{ ...thBase, background: "var(--gd2)" }} />
                <td style={{ ...thBase, background: "var(--gd2)" }} />
                <td style={{ ...thBase, background: "var(--gd2)" }} />
              </tr>

            </thead>
            <tbody>

             {/* B/F row */}
              <tr style={{ background: "var(--s2)", borderBottom: "1px solid var(--bdr)" }}>
                <td style={{ ...dayTd, fontWeight: 700, fontSize: 9.5, color: "var(--gld2)" }}>
                  B/F{useManualBF ? ` — ${bfEffectiveDate}` : ""}
                </td>
                {products.map(p => (
                  <td key={p.code} style={tdNum("var(--mut2)")} />
                ))}
                <td style={tdNum()} />
                <td style={tdNum()} />
                <td style={tdNum("var(--gld2)", true)}>
                  {bfBalance !== 0 ? fmt(bfBalance) : "—"}
                </td>
              </tr>

              {/* Daily rows 1–31 — BALANCE intentionally blank, matches sheet */}
              {days.map(day => {
                const dd = dayData[day] || { qtyByCode: {}, purchaseTotal: 0, paymentTotal: 0 };
                runBal = runBal + dd.purchaseTotal - dd.paymentTotal;
                const hasAny = dd.purchaseTotal > 0 || dd.paymentTotal > 0;

                return (
                  <tr
                    key={day}
                    style={{
                      borderBottom: "1px solid rgba(63,63,70,.2)",
                      background: hasAny ? "transparent" : "var(--s1)",
                    }}
                  >
                    <td style={dayTd}>{day}</td>

                    {/* Fixed product quantity columns */}
                    {products.map(p => {
                      const qty = dd.qtyByCode[p.code] || 0;
                      return (
                        <td key={p.code} style={tdNum(qty > 0 ? "var(--txt)" : "var(--mut2)")}>
                          {qty > 0 ? fmtN(qty) : "-"}
                        </td>
                      );
                    })}

                    {/* PURCHASE */}
                    <td style={tdNum(dd.purchaseTotal > 0 ? "var(--grn)" : "var(--mut2)")}>
                      {dd.purchaseTotal > 0 ? fmt(dd.purchaseTotal) : "-"}
                    </td>

                    {/* AMOUNT (payment) */}
                    <td style={tdNum(dd.paymentTotal > 0 ? "var(--blu)" : "var(--mut2)")}>
                      {dd.paymentTotal > 0 ? fmt(dd.paymentTotal) : "-"}
                    </td>

                    {/* BALANCE — left blank on daily rows
                        (sheet only shows balance on B/F and TOTAL rows) */}
                    <td style={tdNum("var(--mut2)")}>-</td>
                  </tr>
                );
              })}

              {/* TOTAL row */}
              <tr style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr2)" }}>
                <td style={{ ...dayTd, fontWeight: 700, fontSize: 10, color: "var(--txt)" }}>
                  TOTAL
                </td>
                {products.map(p => (
                  <td key={p.code} style={totTd()}>
                    {totalQtyByCode[p.code] > 0 ? fmtN(totalQtyByCode[p.code]) : ""}
                  </td>
                ))}
                <td style={totTd("var(--grn)")}>
                  {totalPurchase > 0 ? fmt(totalPurchase) : ""}
                </td>
                <td style={totTd("var(--blu)")}>
                  {totalPayment > 0 ? fmt(totalPayment) : ""}
                </td>
                <td style={totTd("var(--gld2)")}>
                  {fmt(grossBalance)}
                </td>
              </tr>

            </tbody>
          </table>
        </div>

        {/* ── Footer summary ── */}
        <div style={{
          padding: "20px 28px",
          borderTop: "2px solid var(--bdr2)",
          background: "var(--s2)",
        }}>
          <div style={{ maxWidth: 460, marginLeft: "auto" }}>

            {footRow("UG 6% Discount", ugDiscount, "var(--grn)")}
            {footRow("VAT Discount",   vatDiscount, "var(--grn)")}

            {/* Damage — manual field, read-only placeholder */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "6px 0", borderBottom: "1px solid var(--bdr)",
            }}>
              <span style={{ fontSize: 12, color: "var(--mut)" }}>Damage</span>
              <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: 12.5, color: "var(--mut2)" }}>
                —
              </span>
            </div>

            {/* Net Balance */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "9px 0", borderBottom: "2px solid var(--bdr2)",
            }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--txt)" }}>Balance</span>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 15, color: "var(--gld2)", fontWeight: 700,
              }}>
                Rs.{fmt(netBalance)}
              </span>
            </div>

            {/* P/Stock */}
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "8px 0",
            }}>
              <span style={{ fontSize: 12, color: "var(--mut)" }}>P/Stock</span>
              <span style={{
                fontFamily: "'JetBrains Mono',monospace",
                fontSize: 12.5, color: "var(--txt)", fontWeight: 600,
              }}>
                {pStock > 0 ? `Rs.${fmt(pStock)}` : "—"}
              </span>
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
// ══════════════════════════════════════════════════════
// SUPPLIER CREDIT LEDGER — mirrors the Excel "IDL %" sheet, which is
// actually an invoice-level outstanding/credit tracker (not a ratio),
// generalised here to work for any supplier that gets a 6% trade
// discount + 18% VAT-on-discount (IDL by default, same as UG Book's
// mechanic — just at invoice level instead of per-product quantity).
// ══════════════════════════════════════════════════════
// ══════════════════════════════════════════════════════
// STOCK SUMMARY — mirrors the Excel "STOCK" sheet: a single month-end
// snapshot combining item stock value, empty bottle stock, bank
// balance, cash in hand, and credit outstanding broken down by
// supplier/category. Reuses the same figures already computed by
// the report data hook (endStockVal, emptyStockVal, cashBal, bankBal)
// so this can never drift from the Balance Sheet's numbers.
// ══════════════════════════════════════════════════════
 const CRATE_TYPE_LABELS = {
  plastic_wh:    "Plastic — W/H",
  plastic_ug:    "Plastic — UG",
  plastic_toddy: "Plastic — Toddy",
  plastic_beer:  "Plastic — Beer",
  wood_ugn:      "Wood — UG N",
  wood_q:        "Wood — Q",
  wood_p:        "Wood — P",
  wood_n:        "Wood — N",
};

 function StockSummary({ d, outlet, month }) {
  const { apInvoices, apPayments, crateLedgerAll = [], stockValBySupplier = {} } = d;

  // Crate balances as of period-end — quantity only, no cost basis
  // exists for crates in the Excel model, so this is informational
  // and does NOT feed into the monetary Net Position total below.
  const mEndCrate = monthEnd(month);
  const crateBalances = {};
  Object.keys(CRATE_TYPE_LABELS).forEach(t => { crateBalances[t] = 0; });
  crateLedgerAll
    .filter(e => !mEndCrate || e.date <= mEndCrate)
    .forEach(e => {
      const t = e.crate_type;
      if (!(t in crateBalances)) return;
      crateBalances[t] += Number(e.bf || 0)
        + Number(e.purchase||0) + Number(e.received||0)
        - Number(e.returned||0) - Number(e.ex||0)
        - Number(e.issued||0) - Number(e.sold||0) - Number(e.short||0);
    });
  const crateRows = Object.keys(CRATE_TYPE_LABELS)
    .map(t => ({ type: t, label: CRATE_TYPE_LABELS[t], balance: crateBalances[t] }))
    .filter(r => r.balance !== 0);

  // Outstanding credit per supplier (all-time, not just this month —
  // matches how a real STOCK sheet shows the running creditor balance).
  const bySupplier = {};
  (apInvoices || []).forEach(i => {
    const s = i.supplier_id || i.supplier;
    if (!s) return;
    bySupplier[s] = (bySupplier[s] || 0) + (Number(i.amount) || 0);
  });
  (apPayments || []).forEach(p => {
    const s = p.supplier_id || p.supplier;
    if (!s) return;
    bySupplier[s] = (bySupplier[s] || 0) - (Number(p.amount) || 0) - (Number(p.discount) || 0);
  });

  const creditRows = SUPPLIERS_LIST
    .map(s => ({ name: s.name, id: s.id, balance: bySupplier[s.id] || 0 }))
    .filter(r => Math.abs(r.balance) > 0.5)
    .sort((a, b) => b.balance - a.balance);

  const totalCredit = creditRows.reduce((a, r) => a + r.balance, 0);
  const totalPosition = d.endStockVal + d.emptyStockVal + d.cashBal + d.bankBal;

  // Supplier Stock vs Credit — mirrors the Excel STOCK sheet's "CREDIT"
  // block: per supplier, compares stock value (at cost) currently held
  // from that supplier against the outstanding credit owed to them, and
  // labels which side is higher (P/STOCK HIGH vs CREDIT HIGH).
  const stockVsCreditRows = SUPPLIERS_LIST
    .map(s => {
      const stockVal = stockValBySupplier[s.id] || 0;
      const creditVal = bySupplier[s.id] || 0;
      return { name: s.name, id: s.id, stockVal, creditVal, label: stockVal >= creditVal ? "P/STOCK HIGH" : "CREDIT HIGH" };
    })
    .filter(r => Math.abs(r.stockVal) > 0.5 || Math.abs(r.creditVal) > 0.5);

  const th = { padding: "8px 12px", fontSize: 10, fontWeight: 700, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--mut2,var(--mut))", background: "var(--s3)", borderBottom: "1px solid var(--bdr)" };
  const td = { padding: "7px 12px", fontSize: 12.5, borderBottom: "1px solid rgba(63,63,70,.15)" };
  const sectionHead = { padding: "10px 12px", fontSize: 12, fontWeight: 700, background: "var(--s2)", borderBottom: "1px solid var(--bdr)" };

  const mo = month ? new Date(month + "-01").toLocaleString("en-LK", { month: "long", year: "numeric" }) : "All Periods";

  return (
    <div>
      <div className="no-print" style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
        <button className="btn btnd btnsm" onClick={() => window.print()}>{I.print} Print</button>
      </div>

      <div style={{ background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: "var(--rl)", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--bdr)", background: "var(--s2)" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18 }}>Stock &amp; Position Summary</div>
          <div style={{ fontSize: 11, color: "var(--mut)" }}>{outlet === "ALL" ? "All Outlets" : outlet} &nbsp;·&nbsp; {mo}</div>
        </div>

        {/* Top summary tiles */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, padding: 16 }}>
          {[
            ["Item Stock (at cost)", d.endStockVal],
            ["Empty Bottle Stock", d.emptyStockVal],
            ["Cash in Hand", d.cashBal],
            ["Bank Balance", d.bankBal],
          ].map(([label, val]) => (
            <div key={label} style={{ flex: "1 1 160px", background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 10.5, color: "var(--mut)", textTransform: "uppercase", letterSpacing: ".04em" }}>{label}</div>
              <div style={{ fontSize: 17, fontWeight: 700, marginTop: 4 }}>Rs.{fmt(val || 0)}</div>
            </div>
          ))}
        </div>

        {/* Credit outstanding by supplier */}
        <div style={sectionHead}>Credit Outstanding by Supplier</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Supplier</th>
                <th style={{ ...th, textAlign: "right" }}>Outstanding Balance</th>
              </tr>
            </thead>
            <tbody>
              {creditRows.length === 0 && (
                <tr><td colSpan={2} style={{ ...td, textAlign: "center", color: "var(--mut)" }}>No outstanding supplier balances</td></tr>
              )}
              {creditRows.map(r => (
                <tr key={r.id}>
                  <td style={td}>{r.name}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(r.balance)}</td>
                </tr>
              ))}
              <tr style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr2,var(--bdr))" }}>
                <td style={{ ...td, fontWeight: 700 }}>Total Credit Outstanding</td>
                <td style={{ ...td, textAlign: "right", fontWeight: 700, fontFamily: "'JetBrains Mono',monospace" }}>{fmt(totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>

       {/* Supplier stock value vs credit outstanding — mirrors Excel's CREDIT block */}
        <div style={sectionHead}>Supplier Stock vs Credit</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Supplier</th>
                <th style={{ ...th, textAlign: "left" }}>Status</th>
                <th style={{ ...th, textAlign: "right" }}>Stock Value (at cost)</th>
                <th style={{ ...th, textAlign: "right" }}>Credit Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {stockVsCreditRows.length === 0 && (
                <tr><td colSpan={4} style={{ ...td, textAlign: "center", color: "var(--mut)" }}>No supplier stock or credit balances</td></tr>
              )}
              {stockVsCreditRows.map(r => (
                <tr key={r.id}>
                  <td style={td}>{r.name}</td>
                  <td style={{ ...td, color: r.label === "P/STOCK HIGH" ? "var(--green,#4ade80)" : "var(--red,#f87171)", fontWeight: 600 }}>{r.label}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(r.stockVal)}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(r.creditVal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "6px 12px", fontSize: 10.5, color: "var(--mut)", fontStyle: "italic" }}>
            P/STOCK HIGH = stock value from this supplier exceeds what's owed to them. CREDIT HIGH = the reverse.
          </div>
        </div>

        {/* Crate balances — quantity only, informational */}
        <div style={sectionHead}>Crate Balances (Empty Containers)</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Crate Type</th>
                <th style={{ ...th, textAlign: "right" }}>Balance (Qty)</th>
              </tr>
            </thead>
            <tbody>
              {crateRows.length === 0 && (
                <tr><td colSpan={2} style={{ ...td, textAlign: "center", color: "var(--mut)" }}>No crate balances recorded</td></tr>
              )}
              {crateRows.map(r => (
                <tr key={r.type}>
                  <td style={td}>{r.label}</td>
                  <td style={{ ...td, textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: "6px 12px", fontSize: 10.5, color: "var(--mut)", fontStyle: "italic" }}>
            Quantity only — no cost value is tracked for crates, so this is not included in Net Position below.
          </div>
        </div>

        {/* Overall position */}
        <div style={sectionHead}>Overall Position</div>
        <div style={{ padding: "12px 16px", display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span>Total Assets (Stock + Empty + Cash + Bank)</span>
          <strong style={{ fontFamily: "'JetBrains Mono',monospace" }}>Rs.{fmt(totalPosition)}</strong>
        </div>
        <div style={{ padding: "0 16px 16px", display: "flex", justifyContent: "space-between", fontSize: 14 }}>
          <span>Less: Total Credit Outstanding</span>
          <strong style={{ fontFamily: "'JetBrains Mono',monospace", color: "var(--red,#f87171)" }}>-Rs.{fmt(totalCredit)}</strong>
        </div>
        <div style={{ padding: "12px 16px", borderTop: "2px solid var(--bdr2,var(--bdr))", display: "flex", justifyContent: "space-between", fontSize: 15, fontWeight: 700 }}>
          <span>Net Position</span>
          <span style={{ fontFamily: "'JetBrains Mono',monospace" }}>Rs.{fmt(totalPosition - totalCredit)}</span>
        </div>
      </div>
    </div>
  );
}


function SupplierCreditLedger({ d, outlet, month, supplierId, setSupplierId, applyDiscount, setApplyDiscount }) {
  const { apInvoices, apPayments } = d;
  

  // ── Manual B/F state (DB-backed) ──
  const [manualBF, setManualBFState]     = useState(null);
  const [bfDateInput, setBfDateInput]     = useState(today());
  const [bfAmountInput, setBfAmountInput] = useState("");
  const [bfSaving, setBfSaving]           = useState(false);
  useEffect(() => {
    let cancelled = false;
    getSupplierBF(supplierId, outlet).then(entry => {
      if (cancelled) return;
      setManualBFState(entry);
      setBfDateInput(entry?.date || today());
      setBfAmountInput(entry?.amount ?? "");
    });
    return () => { cancelled = true; };
  }, [supplierId, outlet]);

  async function handleSetBF() {
    setBfSaving(true);
    const entry = await setSupplierBF(supplierId, outlet, bfDateInput, bfAmountInput);
    setBfSaving(false);
    if (entry) setManualBFState(entry);
  }

  const mStart = monthStart(month);
  const mEnd   = monthEnd(month);

  // Normalises supplier IDs before comparing — guards against case or
  // whitespace differences between the SUPPLIERS_LIST used by this dropdown
  // and the supplier_id values saved from Account Payable (S_AP.jsx).
   const isSup = raw => normSup(raw) === normSup(supplierId);

  const invThisMonth = (apInvoices || []).filter(i => isSup(i.supplier_id || i.supplier));
  const payThisMonth = (apPayments || []).filter(p =>
    isSup(p.supplier_id || p.supplier) &&
    (!mStart || (p.date >= mStart && p.date <= mEnd))
  );

 // B/F: everything before this month (unchanged, existing logic)
  const invBefore = (apInvoices || []).filter(i => isSup(i.supplier_id || i.supplier) && mStart && i.date < mStart);
  const payBefore = (apPayments || []).filter(p => isSup(p.supplier_id || p.supplier) && mStart && p.date < mStart);
  const computedBfBalance =
    invBefore.reduce((a, i) => a + (Number(i.amount) || 0), 0) -
    payBefore.reduce((a, p) => a + (Number(p.amount) || 0) + (Number(p.discount) || 0), 0);

  // Manual B/F override (new): if a manual B/F has been saved for this
  // supplier and its date falls on/before the end of the period being
  // viewed, it replaces the computed opening balance. Invoices dated
  // before the manual B/F date are excluded from the rows below so they
  // aren't double-counted (they're already folded into the manual figure).
  const useManualBF     = !!manualBF && (!mEnd || manualBF.date <= mEnd);
  const bfBalance        = useManualBF ? manualBF.amount : computedBfBalance;
  const bfEffectiveDate  = useManualBF ? manualBF.date : mStart;

  // Normalises an invoice-reference string for matching — trims whitespace
  // and ignores case, so a payment saved from Account Payable still matches
  // its invoice even if Supabase round-trips introduced stray spacing.
  const normInvRef = v => (v || "").toString().trim().toUpperCase();

  const rows = invThisMonth
    .filter(i => (mStart ? i.date >= mStart && i.date <= mEnd : true))
    .filter(i => !useManualBF || i.date >= bfEffectiveDate)
    .map(inv => {
      const invNo = inv.ref || inv.id;
      // Match Account Payable payments to this invoice. p.invoiceId is what
      // S_AP.jsx's savePayment() saves (pf.invNo, i.e. the invoice's ref);
      // p.notes is kept as a fallback for older/alternate save paths.
      const matchedPayments = payThisMonth.filter(
        p => normInvRef(p.invoiceId || p.notes) === normInvRef(invNo)
      );
      const paid      = matchedPayments.reduce((a, p) => a + (Number(p.amount) || 0), 0);
      const discount  = matchedPayments.reduce((a, p) => a + (Number(p.discount) || 0), 0);
      const chq       = matchedPayments.map(p => p.ref).filter(Boolean).join(", ");
      const payDate   = matchedPayments[0]?.date || "";
      const amount    = Number(inv.amount) || 0;
      // 6% Dis = Amount / 1.18 × 0.06
      // VAT Dis = (Amount × 0.06) − 6% Dis
      const sixPctDis = applyDiscount ? (amount / 1.18) * 0.06 : 0;
      const vatDis    = applyDiscount ? (amount * 0.06) - sixPctDis : 0;
      // Outstanding = Amount − 6% Dis − VAT Dis
      const outstanding = amount - sixPctDis - vatDis;
      return { invNo, date: inv.date, amount, payDate, paid, chq, sixPctDis, vatDis, outstanding, discount };
    })
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  const totalAmount      = rows.reduce((a, r) => a + r.amount, 0);
  const totalPaid        = rows.reduce((a, r) => a + r.paid, 0);
  const totalSixPctDis   = rows.reduce((a, r) => a + r.sixPctDis, 0);
  const totalVatDis      = rows.reduce((a, r) => a + r.vatDis, 0);
  let runBal = bfBalance;

  const th = { padding: "6px 9px", fontSize: 9, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--mut2)", background: "var(--s3)", borderBottom: "1px solid var(--bdr)", whiteSpace: "nowrap", textAlign: "right" };
  const td = (bold) => ({ padding: "5px 9px", fontSize: 11.5, fontFamily: "'JetBrains Mono',monospace", textAlign: "right", borderBottom: "1px solid rgba(63,63,70,.15)", fontWeight: bold ? 700 : 400, whiteSpace: "nowrap" });

  const supplierName = (SUPPLIERS_LIST.find(s => s.id === supplierId) || {}).name || supplierId;
  const mo = month ? new Date(month + "-01").toLocaleString("en-LK", { month: "long", year: "numeric" }) : "All Periods";

  return (
    
    <div>
      <div className="no-print" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <select value={supplierId} onChange={e => setSupplierId(e.target.value)} style={{ padding: "6px 10px", background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 7, fontSize: 12.5, color: "var(--txt)" }}>
            {SUPPLIERS_LIST.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--mut)", cursor: "pointer" }}>
            <input type="checkbox" checked={applyDiscount} onChange={e => setApplyDiscount(e.target.checked)} />
            Apply 6% trade discount + VAT
          </label>
        </div>
        <button className="btn btnd btnsm" onClick={() => window.print()}>{I.print} Print</button>
      </div>
      {/* Manual B/F control — new, isolated section */}
      <div className="no-print" style={{ display: "flex", alignItems: "flex-end", gap: 10, marginBottom: 12, flexWrap: "wrap", padding: "10px 12px", background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 8 }}>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--mut2)", marginBottom: 3 }}>B/F Date</div>
          <input type="date" value={bfDateInput} onChange={e => setBfDateInput(e.target.value)}
            style={{ padding: "6px 10px", background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: 6, fontSize: 12, color: "var(--txt)" }} />
        </div>
        <div>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "var(--mut2)", marginBottom: 3 }}>B/F Amount</div>
          <input type="number" step="0.01" value={bfAmountInput} onChange={e => setBfAmountInput(e.target.value)}
            placeholder="0.00"
            style={{ padding: "6px 10px", width: 140, background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: 6, fontSize: 12, color: "var(--txt)" }} />
        </div>
        <button className="btn btnd btnsm" onClick={handleSetBF} disabled={bfSaving}>
        {bfSaving ? "Saving…" : "Set B/F"}
        </button>
        {manualBF && (
          <span style={{ fontSize: 11, color: "var(--mut)" }}>
            Active: Rs.{fmt(manualBF.amount)} as of {manualBF.date}
          </span>
        )}
      </div> 

      <div style={{ background: "var(--s1)", border: "1px solid var(--bdr)", borderRadius: "var(--rl)", overflow: "hidden" }}>
        <div style={{ padding: "16px 18px", borderBottom: "1px solid var(--bdr)", background: "var(--s2)" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18 }}>{supplierName} Credit Ledger</div>
          <div style={{ fontSize: 11, color: "var(--mut)" }}>{outlet === "ALL" ? "All Outlets" : outlet} &nbsp;·&nbsp; {mo}</div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: "left" }}>Date</th>
                <th style={{ ...th, textAlign: "left" }}>Invoice No</th>
                <th style={th}>Amount</th>
                <th style={{ ...th, textAlign: "left" }}>Pay Date</th>
                <th style={th}>Payment</th>
                <th style={{ ...th, textAlign: "left" }}>Chq No</th>
                <th style={th}>6% Dis</th>
                <th style={th}>VAT Dis</th>
                <th style={th}>Outstanding</th>
                <th style={th}>Balance</th>
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: "var(--s2)" }}>
                <td style={td(true)} colSpan={9}>B/F Balance</td>
                <td style={td(true)}>{bfBalance !== 0 ? fmt(bfBalance) : "—"}</td>
              </tr>
              {rows.length === 0 && (
                <tr><td colSpan={10} style={{ padding: 20, textAlign: "center", color: "var(--mut)" }}>No invoices this period</td></tr>
              )}
              {rows.map((r, i) => {
                // Balance = Amount Total − Payment Total
                runBal += r.amount - r.paid;
                return (
                  <tr key={i}>
                    <td style={{ ...td(false), textAlign: "left" }}>{r.date}</td>
                    <td style={{ ...td(false), textAlign: "left" }}>{r.invNo}</td>
                    <td style={td(false)}>{fmt(r.amount)}</td>
                    <td style={{ ...td(false), textAlign: "left" }}>{r.payDate || "—"}</td>
                    <td style={td(false)}>{r.paid > 0 ? fmt(r.paid) : "-"}</td>
                    <td style={{ ...td(false), textAlign: "left" }}>{r.chq || "—"}</td>
                    <td style={td(false)}>{fmt(r.sixPctDis)}</td>
                    <td style={td(false)}>{fmt(r.vatDis)}</td>
                    <td style={td(false)}>{fmt(r.outstanding)}</td>
                    <td style={td(true)}>{fmt(runBal)}</td>
                  </tr>
                );
              })}
              <tr style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr2)" }}>
                <td style={td(true)} colSpan={2}>TOTAL</td>
                <td style={td(true)}>{fmt(totalAmount)}</td>
                <td style={td(true)}></td>
                <td style={td(true)}>{fmt(totalPaid)}</td>
                <td style={td(true)}></td>
                <td style={td(true)}>{fmt(totalSixPctDis)}</td>
                <td style={td(true)}>{fmt(totalVatDis)}</td>
                <td style={td(true)}></td>
                <td style={td(true)}>{fmt(runBal)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


export default function Reports({ user }) {
  const isAdmin    = user?.role === "admin";
  const userOutlet = user?.outlet || OUTLETS[0];

  const [report,      setReport]      = useState("income");
  const [outlet,      setOutlet]      = useState(isAdmin ? "ALL" : userOutlet);
  const [month,       setMonth]       = useState(today().slice(0, 7));
  const [outletList,  setOutletList]  = useState(OUTLETS);
  const [supplierId,  setSupplierId]  = useState("2004-IDL");
  // 6% trade discount + VAT-on-discount only genuinely applies to UG and IDL
  // per the Excel CREDITORS sheet (Beer credit has no such columns at all).
  // Default it correctly per supplier, but let the user override manually.
  const DISCOUNT_SUPPLIERS = ["2003-UG", "2004-IDL"];
  const [applyDiscount, setApplyDiscount] = useState(DISCOUNT_SUPPLIERS.includes("2004-IDL"));
  const [discountTouched, setDiscountTouched] = useState(false);
  function handleSupplierChange(id) {
    setSupplierId(id);
    if (!discountTouched) setApplyDiscount(DISCOUNT_SUPPLIERS.includes(id));
  }

  const effectiveOutlet = isAdmin ? outlet : userOutlet;

  // Load outlet list from Supabase
  useEffect(() => {
    getOutlets(OUTLETS).then(list => { if (list?.length) setOutletList(list); });
  }, []);

  const { data: d, loading } = useReportData(effectiveOutlet, month, outletList);

  const reportList = [
    { id: "income",    label: "Income Statement",      icon: "📊" },
    { id: "balance",   label: "Balance Sheet",         icon: "⚖️"  },
    { id: "capital",   label: "Capital Sheet",         icon: "💰" },
    { id: "cashflow",  label: "Cash Flow Statement",   icon: "💸" },
    { id: "sales",     label: "Sales Summary",         icon: "📈" },
    { id: "expenses",  label: "Expense Summary",       icon: "📉" },
    { id: "purchase",  label: "Purchase Summary",      icon: "🛒" },
    { id: "cos",       label: "Cost of Sales Summary", icon: "📦" },
    { id: "emptybott", label: "Empty Bottles",         icon: "🍾" },
    { id: "ugbook",    label: "UG Book",               icon: "📒" },
    { id: "supledger", label: "Supplier Credit Ledger", icon: "🧾" },
    { id: "stocksum",  label: "Stock Summary",          icon: "📦" }
  ];

  const iS  = { width: "100%", padding: "5px 8px", background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 6, fontSize: 11.5, fontFamily: "'Inter',sans-serif", color: "var(--txt)", outline: "none" };
  const lbl = { fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mut2)", marginBottom: 3 };

        return (
    <div style={{ display:"flex", flexDirection:"column", width:"100%", height:"100%", overflow:"hidden" }}>

      {/* ── Top Bar ── */}
      <div className="no-print" style={{ display:"flex", alignItems:"center", gap:10, padding:"10px 20px", background:"var(--s1)", borderBottom:"1px solid var(--bdr)", flexShrink:0, flexWrap:"wrap" }}>

        {/* Report selector */}
        <select value={report} onChange={e=>setReport(e.target.value)} style={{ padding:"6px 10px", background:"var(--s2)", border:"1px solid var(--bdr)", borderRadius:7, fontSize:12.5, fontFamily:"'Inter',sans-serif", color:"var(--txt)", outline:"none" }}>
          {reportList.map(r=><option key={r.id} value={r.id}>{r.icon} {r.label}</option>)}
        </select>

        {/* Month */}
        <input type="month" value={month} onChange={e=>setMonth(e.target.value)} style={{ padding:"6px 10px", background:"var(--s2)", border:"1px solid var(--bdr)", borderRadius:7, fontSize:12.5, fontFamily:"'Inter',sans-serif", color:"var(--txt)", outline:"none" }} />

        {/* Outlet */}
        {isAdmin ? (
          <select value={outlet} onChange={e=>setOutlet(e.target.value)} style={{ padding:"6px 10px", background:"var(--s2)", border:"1px solid var(--bdr)", borderRadius:7, fontSize:12.5, fontFamily:"'Inter',sans-serif", color:"var(--txt)", outline:"none", appearance:"none" }}>
            <option value="ALL">All Outlets</option>
            {outletList.map(o=><option key={o}>{o}</option>)}
          </select>
        ) : (
          <span style={{ padding:"5px 10px", background:"var(--s3)", border:"1px solid var(--bdr)", borderRadius:6, fontSize:11.5, color:"var(--gld2)", fontWeight:600 }}>{userOutlet}</span>
        )}

        {/* Outlet + period label */}
        <span style={{ fontSize:11.5, color:"var(--mut)", marginLeft:4 }}>
          {effectiveOutlet==="ALL"?"All Outlets":effectiveOutlet} · {month ? new Date(month+"-01").toLocaleString("en-LK",{month:"long",year:"numeric"}) : "All Periods"}
        </span>

        {/* Print */}
        <button className="btn btng btnsm" style={{ marginLeft:"auto" }} onClick={()=>window.print()}>{I.print} Print</button>
      </div>

      {/* ── Report Content ── */}
      <div style={{ flex:1, overflowY:"auto", overflowX:"hidden", padding:"24px 32px 40px" }}>
        {loading ? <Spinner /> : !d ? (
          <div style={{ padding:40, textAlign:"center", color:"var(--mut)" }}>No data loaded.</div>
        ) : (
          <>
            {report==="income"    && <IncomeStatement    d={d} outlet={effectiveOutlet} month={month}/>}
            {report==="balance"   && <BalanceSheet       d={d} outlet={effectiveOutlet} month={month}/>}
            {report==="capital"   && <CapitalSheet       d={d} outlet={effectiveOutlet} month={month}/>}
            {report==="cashflow"  && <CashFlowStatement  d={d} outlet={effectiveOutlet} month={month}/>}
            {report==="sales"     && <SalesSummary       d={d} outlet={effectiveOutlet} month={month}/>}
            {report==="expenses"  && <ExpenseSummary     d={d} outlet={effectiveOutlet} month={month}/>}
            {report==="purchase"  && <PurchaseSummary    d={d} outlet={effectiveOutlet} month={month}/>}
            {report==="cos"       && <CostOfSalesSummary d={d} outlet={effectiveOutlet} month={month}/>}
            {report==="emptybott" && <EmptyBottles       d={d} outlet={effectiveOutlet} month={month}/>}
            {report==="ugbook"    && <UGBook             d={d} outlet={effectiveOutlet} month={month}/>}
            {report==="supledger" && <SupplierCreditLedger d={d} outlet={effectiveOutlet} month={month} supplierId={supplierId} setSupplierId={handleSupplierChange} applyDiscount={applyDiscount} setApplyDiscount={val => { setApplyDiscount(val); setDiscountTouched(true); }}/>}
            {report==="stocksum"  && <StockSummary d={d} outlet={effectiveOutlet} month={month}/>}
          </>
        )}
      </div>
    </div>
  );
}