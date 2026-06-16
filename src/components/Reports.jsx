import React, { useState, useEffect, useCallback } from "react";
import { I } from "../utils/icons";
import { OUTLETS } from "../data/seeds";
import {
  getOutlets,
  getSales,
  getPurchases,
  getReturns,
  getTransfers,
  getExpenses,
  getCashLedger,
  getBankLedger,
  getARLedger,
  getAPInvoices,
  getAPPayments,
  getCashBF,
  getBankBF,
  getCOA,
  getInventoryMaster,
  getOpeningStock,
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
  return new Date(y, mo, 0).toISOString().slice(0, 10);
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
    getARLedger(o), getAPInvoices(o), getAPPayments(o),
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
      let cashLedger=[], bankLedger=[], arLedger=[], apInvoices=[], apPayments=[];
      let cashBF=0, bankBF=0;

      arrayResults.forEach(([sal,pur,ret,trn,exp,csh,bnk,ar,apInv,apPay]) => {
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
      });
      scalarResults.forEach(([cbf,bbf]) => { cashBF += Number(cbf)||0; bankBF += Number(bbf)||0; });

      const invMap = {};
      (inv||[]).forEach(i => { invMap[i.code]=i; if(i.id) invMap[i.id]=i; });

      // ── Sales Revenue ──
      const totalSalesAmt = sales.reduce((a,s) => {
        const mt = (s.items||[]).filter(r=>!r.isEmptyItem)
          .reduce((sum,r)=>sum+(parseFloat(r.sold)||0)*(parseFloat(r.rate)||0),0);
        return a+(Number(s.total)||mt||0);
      }, 0);
      const totalReturns = returns.reduce((a,r)=>a+(Number(r.total)||0),0);
      const netSalesAmt  = totalSalesAmt - totalReturns;

      // ── Opening Stock ──
      let openingStockVal=0;
      const openingStockByCode={};
      if (mStart) {
        const opRes = await Promise.all(outlets.map(o=>getOpeningStock(o,mStart)));
        opRes.forEach(op => {
          if (!op?.main) return;
          Object.entries(op.main).forEach(([code,qty]) => {
            const item=invMap[code]; const uc=Number(item?.unitCost)||0; const q=Number(qty)||0;
            openingStockVal += q*uc;
            if (q>0 && uc>0) {
              if (!openingStockByCode[code]) openingStockByCode[code]={name:item?.name||code,qty:0,unitCost:uc};
              openingStockByCode[code].qty += q;
            }
          });
        });
      }

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
      let endStockVal=0;
      const endStockByCode={};
      const salesSorted=[...sales].sort((a,b)=>(b.date||"").localeCompare(a.date||""));
      const latestSale=salesSorted.find(s=>(s.items||[]).some(r=>!r.isEmptyItem));
      if (latestSale) {
        (latestSale.items||[]).filter(r=>!r.isEmptyItem).forEach(r=>{
          const es=parseFloat(r.endStock);
          if (!isNaN(es)) {
            const item=invMap[r.code]||invMap[r.id];
            const uc=Number(item?.unitCost)||Number(r.unitCost)||0;
            endStockVal+=es*uc;
            endStockByCode[r.code]={name:r.name||item?.name||r.code,qty:es,unitCost:uc};
          }
        });
      }

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
      sales.forEach(s=>{ const d=dayOf(s.date); const amt=(s.items||[]).filter(r=>!r.isEmptyItem).reduce((a,r)=>a+(parseFloat(r.sold)||0)*(parseFloat(r.rate)||0),0); salesByDay[d]=(salesByDay[d]||0)+(Number(s.total)||amt); });

      // ── Expenses by day ──
      const expByDay={};
      expenses.forEach(e=>{ const d=dayOf(e.date); expByDay[d]=(expByDay[d]||0)+(Number(e.amount)||0); });

      // ── Cost of Sales by item ──
      const cosByItem={};
      sales.forEach(s=>(s.items||[]).filter(r=>!r.isEmptyItem&&(parseFloat(r.sold)||0)>0).forEach(r=>{
        const item=invMap[r.code]||invMap[r.id]; const uc=Number(item?.unitCost)||Number(r.unitCost)||0;
        if(!cosByItem[r.code]) cosByItem[r.code]={code:r.code,name:r.name||item?.name||r.code,type:r.type||item?.type||"",sold:0,purchase:0,transIn:0,transOut:0,returns:0,adj:0,unitCost:uc};
        cosByItem[r.code].sold+=parseFloat(r.sold)||0; cosByItem[r.code].purchase+=parseFloat(r.purchase)||0;
        cosByItem[r.code].transIn+=parseFloat(r.transferIn)||0; cosByItem[r.code].transOut+=parseFloat(r.transferOut)||0;
        cosByItem[r.code].returns+=parseFloat(r.returns)||0; cosByItem[r.code].adj+=parseFloat(r.stkSE)||0;
      }));

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

      setData({ inv, coa, totalSalesAmt, totalReturns, netSalesAmt, openingStockVal, openingStockByCode, totalPurchase, purBySup, transInAmt, transOutAmt, endStockVal, endStockByCode, costOfSales, grossProfit, discBySup, emptyDiscBySup, empSoldByName, empRetByName, totalDiscPayment, totalDiscEmpty, totalOtherInc, totalIncome, totalEmpSold, totalEmpRet, expByAcc, expSaleMkt, expAdmin, expFinance, expOther, expDetail, totalExp, netProfit, emptyStockVal, cashBal, bankBal, cashBF, bankBF, arBal, apBal, totalCurrentAssets, totalCurrentLiab, totalAssets, ownerEquity, coaNonCurrentAssets, coaCurrentLiab, coaNonCurrentLiab, coaCapital, cashFlowIn, cashFlowOut, netCashFlow, bankDeposit, cashLedger, bankLedger, salesByDay, expByDay, sales, purchases, expenses, returns, transfers, cosByItem, empDailyData, empSuppliers });
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
    endStockVal,
    costOfSales, grossProfit,
    discBySup, emptyDiscBySup,
    totalDiscPayment, totalDiscEmpty, totalOtherInc, totalIncome,
    expDetail, expSaleMkt, expAdmin, expFinance, expOther, totalExp, netProfit,
  } = d;

  return (
    <ReportWrap title="Income Statement" outlet={outlet} month={month}>
      {/* Sales Revenue */}
      <TR label="Sales Revenue" val={totalSalesAmt} bold />
      {totalReturns > 0 && <TR label="(Less) Returns on Sale" val={totalReturns} neg indent={1} />}
      {totalReturns > 0 && <TR label="Net Sales" val={netSalesAmt} bold total />}

      {/* Cost of Sales */}
      <SH>Cost of Sales</SH>
      <TR label="Opening Stock" col2={openingStockVal} indent={1} />
      {Object.entries(openingStockByCode).filter(([, v]) => v.qty > 0).map(([code, v]) => (
        <TR key={code} label={`${v.name || code}  (${fmtN(v.qty)} × Rs.${fmt(v.unitCost)})`} col2={v.qty * v.unitCost} indent={2} />
      ))}

      <TR label="(Plus) Purchases" col2={totalPurchase} indent={1} />
      {Object.entries(purBySup).map(([supId, sup]) => (
        <TR key={`pur-${supId}`} label={supId.replace(/^\d{4}-/, "")} col2={sup.total} indent={2} />
      ))}

      {transInAmt > 0  && <TR label="(Plus) Transfer In"  col2={transInAmt}  indent={1} />}
      {transOutAmt > 0 && <TR label="(Less) Transfer Out" col2={transOutAmt} neg indent={1} />}

      <TR label="(Less) End Stock (Current Status)" col2={endStockVal} neg indent={1} />

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
      <TRSplit label="Main Stock (Current Status End Stock)"  col2={endStockVal}   indent={1} />
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
  const { netProfit, cashBal, bankBal, endStockVal, coaCapital } = d;
  // Capital accounts from COA 3000-3999 (drawings, commission etc.)
  // Net Profit flows in from Income Statement
  const capital = cashBal + bankBal;

  return (
    <ReportWrap title="Capital Sheet" outlet={outlet} month={month}>
      <SH>Capital Summary</SH>
      <TR label="Owner's Capital" col2={0} indent={1} />
      <TR label="(Plus) Net Profit / (Loss)" col2={netProfit} indent={1} />
      {coaCapital.filter(a => a.id >= "3003").map(a => (
        <TR key={a.id} label={`(Less) ${a.name}`} col2={0} neg indent={1} />
      ))}
      <TR label="Total Capital" val={netProfit} bold total />

      <SH>Capital Represented By</SH>
      <TR label="Main Stock Value" col2={endStockVal} indent={1} />
      <TR label="Cash in Hand"    col2={cashBal}      indent={1} />
      <TR label="Bank Balance"    col2={bankBal}      indent={1} />
      <TR label="Total" val={endStockVal + capital} bold total />

      <tr>
        <td colSpan={3} style={{ padding: "10px 12px", fontSize: 10.5, color: "var(--mut)", fontStyle: "italic" }}>
          Note: In the next month, this period's Net Profit is auto-added to Owner's Capital.
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

// ══════════════════════════════════════════════════════
// SALES SUMMARY
// ══════════════════════════════════════════════════════
function SalesSummary({ d, outlet, month }) {
  const { salesByDay, totalSalesAmt, sales } = d;
  const days  = Array.from({ length: 31 }, (_, i) => i + 1);
  const weeks = [[1, 7], [8, 14], [15, 21], [22, 28], [29, 31]];
  const weekAvg = (s, e) => {
    const vals = days.filter(dd => dd >= s && dd <= e && salesByDay[dd]);
    return vals.length ? vals.reduce((a, dd) => a + salesByDay[dd], 0) / vals.length : 0;
  };

  return (
    <ReportWrap title="Sales Summary" outlet={outlet} month={month}>
      <tr style={{ background: "var(--s3)" }}>
        {["Day", "Daily Sale", "Sold Items"].map((h, i) => (
          <td key={i} style={{ padding: "6px 10px", fontSize: 9, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--mut2)", borderBottom: "1px solid var(--bdr)" }}>{h}</td>
        ))}
      </tr>
      {days.map(day => {
        const dayTotal  = salesByDay[day] || 0;
        const soldItems = sales.filter(s => dayOf(s.date) === day)
          .reduce((a, s) => a + (s.items || []).filter(r => !r.isEmptyItem && (parseFloat(r.sold) || 0) > 0).length, 0);
        return (
          <tr key={day} style={{ borderBottom: "1px solid rgba(63,63,70,.3)" }}>
            <td style={{ padding: "5px 10px", fontSize: 11.5, fontWeight: 600, color: "var(--mut2)", width: 40 }}>{day}</td>
            <td style={{ padding: "5px 10px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, color: dayTotal > 0 ? "var(--grn)" : "var(--mut2)" }}>
              {dayTotal > 0 ? `Rs.${fmt(dayTotal)}` : ""}
            </td>
            <td style={{ padding: "5px 10px", fontSize: 11.5, color: "var(--mut)" }}>{soldItems > 0 ? soldItems : ""}</td>
          </tr>
        );
      })}
      {weeks.map(([s, e], wi) => (
        <tr key={`avg${s}-${wi}`} style={{ background: "var(--gd2)", borderBottom: "1px solid var(--bdr)" }}>
          <td style={{ padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "var(--gld2)" }}>Avg {s}–{e}</td>
          <td style={{ padding: "5px 10px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11, color: "var(--gld2)" }}>Rs.{fmt(weekAvg(s, e))}</td>
          <td />
        </tr>
      ))}
      <tr style={{ background: "var(--s3)", borderTop: "2px solid var(--bdr2)" }}>
        <td style={{ padding: "7px 10px", fontWeight: 700, fontSize: 12 }}>Total</td>
        <td style={{ padding: "7px 10px", fontFamily: "'JetBrains Mono',monospace", fontWeight: 700, fontSize: 13, color: "var(--grn)" }}>Rs.{fmt(totalSalesAmt)}</td>
        <td />
      </tr>
    </ReportWrap>
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
          {sup.records.map(p => (
            p.items?.filter(l => !l.isEmptyItem).map((l, i) => (
              <tr key={`${p.id||p.date}_${i}`} style={{ borderBottom: "1px solid rgba(63,63,70,.3)" }}>
                <td style={{ padding: "5px 10px", fontSize: 11, color: "var(--mut)", fontFamily: "'JetBrains Mono',monospace" }}>{i === 0 ? p.date : ""}</td>
                <td style={{ padding: "5px 10px", fontSize: 11, color: "var(--mut)" }}>{i === 0 ? (p.ref || p.invoice_no || "—") : ""}</td>
                <td style={{ padding: "5px 10px", fontSize: 11.5, fontWeight: 600 }}>{l.itemName || l.name || l.itemCode}</td>
                <td style={{ padding: "5px 10px", fontSize: 11.5, textAlign: "right", fontFamily: "'JetBrains Mono',monospace" }}>{l.qty}</td>
                <td style={{ padding: "5px 10px", fontSize: 11.5, textAlign: "right", fontFamily: "'JetBrains Mono',monospace", color: "var(--grn)" }}>Rs.{fmt(l.amount || (Number(l.qty) * Number(l.unitCost)) || 0)}</td>
              </tr>
            ))
          ))}
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

// ══════════════════════════════════════════════════════
// MAIN REPORTS COMPONENT
// ══════════════════════════════════════════════════════
export default function Reports({ user }) {
  const isAdmin    = user?.role === "admin";
  const userOutlet = user?.outlet || OUTLETS[0];

  const [report,      setReport]      = useState("income");
  const [outlet,      setOutlet]      = useState(isAdmin ? "ALL" : userOutlet);
  const [month,       setMonth]       = useState(today().slice(0, 7));
  const [outletList,  setOutletList]  = useState(OUTLETS);

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
  ];

  const iS  = { width: "100%", padding: "5px 8px", background: "var(--s2)", border: "1px solid var(--bdr)", borderRadius: 6, fontSize: 11.5, fontFamily: "'Inter',sans-serif", color: "var(--txt)", outline: "none" };
  const lbl = { fontSize: 9, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--mut2)", marginBottom: 3 };

  return (
    <div className="shell">
      {/* ── Sidebar ── */}
      <aside style={{ width: 210, background: "var(--s1)", borderRight: "1px solid var(--bdr)", display: "flex", flexDirection: "column", flexShrink: 0 }}>
        <div style={{ padding: "14px 12px 10px", borderBottom: "1px solid var(--bdr)" }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 13, color: "var(--txt)" }}>Reports</div>
          <div style={{ fontSize: 9.5, color: "var(--mut2)", marginTop: 1 }}>View &amp; Print</div>
        </div>

        {/* Filters */}
        <div style={{ padding: "10px 10px 6px", borderBottom: "1px solid var(--bdr)" }}>
          <div style={{ marginBottom: 7 }}>
            <div style={lbl}>Month</div>
            <input type="month" value={month} onChange={e => setMonth(e.target.value)} style={iS} />
          </div>

          {isAdmin ? (
            <div>
              <div style={lbl}>Outlet</div>
              <select value={outlet} onChange={e => setOutlet(e.target.value)} style={{ ...iS, appearance: "none" }}>
                <option value="ALL">All Outlets</option>
                {outletList.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          ) : (
            <div>
              <div style={lbl}>Outlet</div>
              <div style={{ padding: "5px 8px", background: "var(--s3)", border: "1px solid var(--bdr)", borderRadius: 6, fontSize: 11, color: "var(--gld2)", fontWeight: 600 }}>
                {userOutlet}
              </div>
            </div>
          )}
        </div>

        {/* Report List */}
        <nav style={{ flex: 1, overflowY: "auto", padding: "6px 6px" }}>
          {reportList.map(r => (
            <button key={r.id} className={`ni ${report === r.id ? "act" : ""}`}
              onClick={() => setReport(r.id)} style={{ width: "100%", marginBottom: 2 }}>
              <span style={{ fontSize: 13 }}>{r.icon}</span>
              <span style={{ fontSize: 11.5 }}>{r.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ background: "var(--s1)", borderBottom: "1px solid var(--bdr)", padding: "0 20px", height: 52, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <div>
            <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 17 }}>
              {reportList.find(r => r.id === report)?.label}
            </h1>
            <p style={{ fontSize: 10.5, color: "var(--mut)", marginTop: 1 }}>
              {effectiveOutlet === "ALL" ? "All Outlets" : effectiveOutlet} &nbsp;·&nbsp;
              {month ? new Date(month + "-01").toLocaleString("en-LK", { month: "long", year: "numeric" }) : "All Periods"}
            </p>
          </div>
          <button className="btn btnd btnsm no-print" onClick={() => window.print()}>{I.print} Print</button>
        </div>

        <div className="page">
          {loading ? <Spinner /> : !d ? (
            <div style={{ padding: 40, textAlign: "center", color: "var(--mut)" }}>No data loaded.</div>
          ) : (
            <>
              {report === "income"    && <IncomeStatement    d={d} outlet={effectiveOutlet} month={month} />}
              {report === "balance"   && <BalanceSheet       d={d} outlet={effectiveOutlet} month={month} />}
              {report === "capital"   && <CapitalSheet       d={d} outlet={effectiveOutlet} month={month} />}
              {report === "cashflow"  && <CashFlowStatement  d={d} outlet={effectiveOutlet} month={month} />}
              {report === "sales"     && <SalesSummary       d={d} outlet={effectiveOutlet} month={month} />}
              {report === "expenses"  && <ExpenseSummary     d={d} outlet={effectiveOutlet} month={month} />}
              {report === "purchase"  && <PurchaseSummary    d={d} outlet={effectiveOutlet} month={month} />}
              {report === "cos"       && <CostOfSalesSummary d={d} outlet={effectiveOutlet} month={month} />}
              {report === "emptybott" && <EmptyBottles       d={d} outlet={effectiveOutlet} month={month} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
// updated
