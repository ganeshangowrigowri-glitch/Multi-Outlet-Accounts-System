import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { ls, lss, fmt, oKey, today, uid } from "../../utils/helpers";
import { addSale, deleteSaleForDate, addCashEntry, addGLEntry, getPurchases, getTransfers, getReturns, getSales, getInventoryMaster,  getEmptyInventoryMaster, getOpeningStock, saveOpeningStock, getSuppliers} from "../../db";
import { I } from "../../utils/icons";
import { SEED_INVENTORY } from "../../data/seeds";
import { outletInvKey, outletEmptyInvKey } from "../admin/InventoryAdmin";
const EMPTY_PURCHASE_SUP_ID = "EMPTY_PURCHASE"; // adjust to match your actual Supabase ID

const MAIN_EMPTY_SUP_IDS = new Set([
  "2001-DCSL",
  "2002-LION BREWERY",
  "2003-UG",
  "2006-DCSL BEER",
  "2007-TODDY",
]);

// ─────────────────────────────────────────────────────────────
//  OUTLET MAIN INVENTORY
//  Reads master + outlet overrides (Tab 3).
//  Override key is `code__supplier` (composite) to allow same
//  code to exist under different suppliers (e.g. LION BREWERY
//  and KASTHURI W/S sharing the same item codes).
// ─────────────────────────────────────────────────────────────
  function getOutletInventory(outlet, masterOverride) {
  const master    = masterOverride || ls("inv_main", SEED_INVENTORY);
  const overrides = ls(outletInvKey(outlet), {});
  return master
    .filter(item => {
      const ovKey = `${item.code}__${item.supplier}`;
      return item.type !== "EM" && !overrides[ovKey]?.hidden;
    })
    // AFTER
.map(item => {
  const ovKey = `${item.code}__${item.supplier}`;
  const ov    = overrides[ovKey];
  return {
    ...item,
    unitCost:     ov?.unitCost     !== undefined ? ov.unitCost     : item.unitCost,
    sellingPrice: ov?.sellingPrice !== undefined ? ov.sellingPrice : item.sellingPrice,
    qty:          ov?.qty          !== undefined ? ov.qty          : 0,
  };
});
}

// ─────────────────────────────────────────────────────────────
//  EMPTY STOCK SEED
//  Each row has a UNIQUE `id` (supplierId__code pattern) so
//  React keys never clash even when the same code appears under
//  multiple suppliers (DCSL and EMPTY PURCHASE both have DEMP Q).
// ─────────────────────────────────────────────────────────────
const EMPTY_SEED_STAFF = [
  // ── DCSL ──
  { id:"DCSL__DEMP_Q",  code:"DEMP Q",  name:"DES EMP",  supplier:"DCSL",           unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"DCSL__DEMP_P",  code:"DEMP P",  name:"DES EMP",  supplier:"DCSL",           unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"DCSL__DEMP_N",  code:"DEMP N",  name:"DES EMP",  supplier:"DCSL",           unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  // ── LION BREWERY ──
  { id:"LION__BEMP_Q",  code:"BEMP Q",  name:"BEER EMP", supplier:"LION BREWERY",   unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  // ── TODDY ──
  { id:"TODD__TEMP_Q",  code:"TEMP Q",  name:"TOD EMP",  supplier:"TODDY",          unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  // ── UG ──
  { id:"UG__UEMP_Q",    code:"UEMP Q",  name:"UG EMP",   supplier:"UG",             unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  // ── DCSL BEER ──
  { id:"BEER__HEMP_Q",  code:"HEMP Q",  name:"HEI EMP",  supplier:"DCSL BEER",      unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  // ── EMPTY PURCHASE (independent supplier — includes all of the above items) ──
  { id:"EP__DEMP_Q",    code:"DEMP Q",  name:"DES EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"EP__DEMP_P",    code:"DEMP P",  name:"DES EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"EP__DEMP_N",    code:"DEMP N",  name:"DES EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"EP__BEMP_Q",    code:"BEMP Q",  name:"BEER EMP", supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"EP__TEMP_Q",    code:"TEMP Q",  name:"TOD EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"EP__UEMP_Q",    code:"UEMP Q",  name:"UG EMP",   supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
  { id:"EP__HEMP_Q",    code:"HEMP Q",  name:"HEI EMP",  supplier:"EMPTY PURCHASE", unitCost:0, sellingPrice:0, qty:0, type:"EMP" },
];

// ─────────────────────────────────────────────────────────────
//  OUTLET EMPTY INVENTORY
//  Override key is item.id (unique) NOT item.code, because the
//  same code can exist under different empty suppliers.
// ─────────────────────────────────────────────────────────────
function getOutletEmptyInventory(outlet, masterOverride, emptyMasterData) {
  const master = 
    (emptyMasterData && emptyMasterData.length > 0)
      ? emptyMasterData.filter(i => i.supplier !== "EMPTY PURCHASE")
      : (masterOverride
          ? masterOverride.filter(i => i.type === "EMP" && i.supplier !== "EMPTY PURCHASE")
          : []
        ).length > 0
          ? masterOverride.filter(i => i.type === "EMP" && i.supplier !== "EMPTY PURCHASE")
          : EMPTY_SEED_STAFF.filter(i => i.supplier !== "EMPTY PURCHASE");

  const overrides = ls(outletEmptyInvKey(outlet), {});

  const result = master
    .filter(item => item.supplier !== "EMPTY PURCHASE" && !overrides[`${item.code}__${item.supplier}`]?.hidden)
    .map(item => {
      const ovKey = `${item.code}__${item.supplier}`;
      const ov = overrides[ovKey];
      return {
        ...item,
        id:           item.id || `${item.supplier}__${item.code}`.replace(/\s/g, "_"),
        unitCost:     ov?.unitCost     !== undefined ? ov.unitCost     : item.unitCost,
        sellingPrice: ov?.sellingPrice !== undefined ? ov.sellingPrice : item.sellingPrice,
        qty:          ov?.qty          !== undefined ? ov.qty          : 0,
      };
    });

  // Deduplicate by code__supplier
  const seen = new Set();
  return result.filter(item => {
    const key = `${item.code}__${item.supplier}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}


// ─────────────────────────────────────────────────────────────
//  OPENING STOCK HELPER
//  Priority: explicit opening for this date → yesterday's
//  saved end stock → seed qty (first-time).
// ─────────────────────────────────────────────────────────────
function prevDate(dateStr) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function txnDate(rec) {
  return (rec.date || "").slice(0, 10);
}

function txnItems(rec) {
  return rec.items || rec.lines || [];
}

function isTransferIn(rec, outlet) {
  const notes = rec.notes || "";
  if (notes.includes("type:in")) return true;
  if (notes.includes("type:out")) return false;
  return (rec.to_outlet_id ?? rec.to) === outlet;
}

function isTransferOut(rec, outlet) {
  const notes = rec.notes || "";
  if (notes.includes("type:out")) return true;
  if (notes.includes("type:in")) return false;
  return (rec.from_outlet_id ?? rec.from) === outlet;
}
async function propagateOpeningForward(outlet, fromDate, endStockMain, endStockEmp) {
  const d = new Date(fromDate);
  d.setDate(d.getDate() + 1);
  const nextDay = d.toISOString().slice(0, 10);
  const existing = await getOpeningStock(outlet, nextDay);
  const mergedMain = endStockMain
    ? { ...(existing?.main || {}), ...endStockMain }
    : existing?.main || null;
  const mergedEmp = endStockEmp
    ? { ...(existing?.emp || {}), ...endStockEmp }
    : existing?.emp || null;
  await saveOpeningStock(outlet, nextDay, mergedMain, mergedEmp);
}

function getOpeningForDate(outlet, date, seedMain, seedEmp) {
  // 1. Explicit opening saved for today
  const todayOpening = ls(oKey(outlet, `opening_${date}`), null);
  if (todayOpening) return todayOpening;

  // 2. Yesterday's end stock from saved daily sale
  const yDate    = prevDate(date);
  const yOpening = ls(oKey(outlet, `opening_${yDate}`), null);
  if (yOpening) return yOpening;

  const yesSales = ls(oKey(outlet, "sales"), []).find(s => s.date === yDate);
  if (yesSales) {
    const main = {}, emp = {};
    (yesSales.mainRows || []).forEach(r => {
      const es = r.endStock !== "" && r.endStock !== undefined
        ? parseFloat(r.endStock) || 0
        : null;
      if (es !== null) main[r.code] = es;
    });
    // For empty rows key by unique id
    (yesSales.empRows || []).forEach(r => {
      const es = r.endStock !== "" && r.endStock !== undefined
        ? parseFloat(r.endStock) || 0
        : null;
      if (es !== null) emp[r.id] = es;
    });
    if (Object.keys(main).length || Object.keys(emp).length) return { main, emp };
  }

  // 3. Fall back to seed qty
  const main = {}, emp = {};
  seedMain.forEach(i => { main[i.code] = Number(i.qty) || 0; });
  seedEmp.forEach(e  => { emp[e.id]   = Number(e.qty) || 0; });
  return { main, emp };
}

// ─────────────────────────────────────────────────────────────
//  SCROLL ARROWS
// ─────────────────────────────────────────────────────────────
function ScrollArrows({ scrollBy }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
      <button onClick={() => scrollBy(-300)} style={{
        width:28, height:24, borderRadius:5,
        border:"1px solid var(--s3,#444)",
        background:"var(--s2,#252540)", color:"var(--txt,#ccc)",
        cursor:"pointer", fontSize:15,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>‹</button>
      <button onClick={() => scrollBy(300)} style={{
        width:28, height:24, borderRadius:5,
        border:"1px solid var(--s3,#444)",
        background:"var(--s2,#252540)", color:"var(--txt,#ccc)",
        cursor:"pointer", fontSize:15,
        display:"flex", alignItems:"center", justifyContent:"center",
      }}>›</button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
//  MAIN COMPONENT
//  subTab  → "daily" | "status"
//  dailyTab → "main"  | "empty"
// ─────────────────────────────────────────────────────────────
function CsTotals({ csData, fmt, physStock }) {
  const totSale   = csData.reduce((a, r) => a + r.totalSaleAmt,   0);
  const totProfit = csData.reduce((a, r) => a + r.profit,         0);
  const totPhys   = csData.reduce((a, r) =>
    a + Number(r.physicalStockOverride !== "" ? r.physicalStockOverride : r.physicalStock), 0);
  const totTBS    = csData.reduce((a, r) => a + r.totalBottleSale, 0);
  return (
    <tfoot>
      <tr style={{ background:"var(--s3)", fontWeight:700 }}>
        <td colSpan={7} className="rt" style={{ paddingRight:11, fontSize:11.5 }}>Totals:</td>
        <td className="rt mono bold">{totTBS}</td>
        <td className="rt mono bold">Rs.{fmt(totPhys)}</td>
        <td className="rt mono cg bold">Rs.{fmt(totSale)}</td>
        <td className="rt mono cg bold">Rs.{fmt(totProfit)}</td>
        <td colSpan={5} />
      </tr>
    </tfoot>
  );
}
export default function S_Inventory({ outlet, user, toast_, subTab, dailyTab }) {
  const [supOrder, setSupOrder] = useState([
  "2001-DCSL","2003-UG","2005-ROCKLAND","2004-IDL","2006-DCSL BEER",
  "2002-LION BREWERY","2007-TODDY","2008-ROYAL CASK","2009-LUXURY BRAND",
  "2010-B LANKA","2011-USW","2012-PREMERA","2013-JSP","2014-SIGNATURE",
  "2015-VA","2016-VICTORY","2017-FAVOURITE","2018-FREE LANKA",
  "2019-BAG","2020-SODA","2021-GOLD LEAF","2022-BITE","2023-KASTHURI W/S",
]);

useEffect(() => {
  getSuppliers().then(data => {
    if (data && data.length > 0) {
      setSupOrder(data.map(s => s.id));
    }
  });
}, []);



  const [mainDate,      setMainDate]      = useState(today());
  const [mainSupFilter, setMainSupFilter] = useState("ALL");
  const [empDate,       setEmpDate]       = useState(today());
  const [empSupFilter,  setEmpSupFilter]  = useState("ALL");
  const [justSaved,     setJustSaved]     = useState(false);
  const [justSavedEmp,  setJustSavedEmp]  = useState(false);
  const [csFrom,        setCsFrom]        = useState(() => today().slice(0, 7) + "-01");
  const [csTo,          setCsTo]          = useState(today);
  const [physStock,     setPhysStock]     = useState({});
  const [dbPurchases, setDbPurchases] = useState([]);
const [dbTransfers, setDbTransfers] = useState([]);
const [dbReturns,   setDbReturns]   = useState([]);
const [dbSales,     setDbSales]     = useState([]);
const dbSalesRef = useRef([]);
const refreshTxnData = useCallback(() => {
  getPurchases(outlet).then(setDbPurchases);
  getTransfers(outlet).then(setDbTransfers);
  getReturns(outlet).then(setDbReturns);
}, [outlet]);

useEffect(() => {
  refreshTxnData();
  getSales(outlet).then(data => { setDbSales(data); dbSalesRef.current = data; });
}, [outlet, refreshTxnData]);


useEffect(() => {
  const onFocus = () => refreshTxnData();
  window.addEventListener("focus", onFocus);
  return () => window.removeEventListener("focus", onFocus);
}, [refreshTxnData]);

  const mainTableRef = useRef(null);
  const empTableRef  = useRef(null);
  const csTableRef = useRef(null);
  const skipNextReloadRef = useRef(false);
  const skipNextEmpReloadRef = useRef(false);
  const mainScrollBy = useCallback(d => mainTableRef.current?.scrollBy({ left:d, behavior:"smooth" }), []);
  const empScrollBy  = useCallback(d => empTableRef.current?.scrollBy({ left:d, behavior:"smooth" }), []);

  const [masterInv, setMasterInv] = useState(() => ls("inv_main", SEED_INVENTORY));
const [emptyMaster, setEmptyMaster] = useState([]);

// ── Load master inventory from Supabase ──
useEffect(() => {
  // Load empty master separately to guarantee prices from Tab 2
  getEmptyInventoryMaster().then(empData => {
    if (empData && empData.length > 0) {
      const empItems = empData.filter(i => i.supplier !== "EMPTY PURCHASE");
      setEmptyMaster(empItems);
    }
  });


  getInventoryMaster().then(data => {
    if (data && data.length > 0) {
      // EMP items already handled above — skip them here
      const empItems = data.filter(i => i.type === "EMP" && i.supplier !== "EMPTY PURCHASE");
      if (empItems.length > 0) setEmptyMaster(prev => prev.length > 0 ? prev : empItems);

      // Main items → masterInv state (sorted)
      const mainItems = data.filter(i => i.type !== "EMP");
      const sorted = [...mainItems].sort((a, b) => {
        const oi = supOrder.indexOf(a.supplier);
        const oj = supOrder.indexOf(b.supplier);
        const supCmp = (oi === -1 ? 999 : oi) - (oj === -1 ? 999 : oj);
        if (supCmp !== 0) return supCmp;
        const numA = parseInt((a.code || "").replace(/\D/g, "")) || 0;
        const numB = parseInt((b.code || "").replace(/\D/g, "")) || 0;
        return numA - numB;
      });
      lss("inv_main", sorted);
      setMasterInv(sorted);
    }
  });
}, [supOrder]);

const seedMain = useMemo(() => getOutletInventory(outlet, masterInv), [outlet, masterInv]);
const seedEmp = useMemo(() => {
  return getOutletEmptyInventory(outlet, masterInv, emptyMaster);
}, [outlet, masterInv, emptyMaster]);
  // ── Supplier dropdown for Main tab (strip numeric prefix for display) ──
  const mainSuppliers = useMemo(() => {
    const stripped = seedMain.map(i => (i.supplier || "").replace(/^\d{4}-/, "").trim() || "—");
    return ["ALL", ...[...new Set(stripped)].sort()];
  }, [seedMain]);

  // ── Supplier dropdown for Empty tab (use full supplier name) ──
  // AFTER 
const empSuppliers = useMemo(() => {
  const sups = seedEmp
    .filter(i => i.supplier !== "EMPTY PURCHASE")
    .map(i => (i.supplier || "").trim() || "EMP");
  return ["ALL", ...[...new Set(sups)]];
}, [seedEmp]);
  // ── Main rows state ──
  const [mainRows, setMR] = useState(() =>
    seedMain.map(i => ({
      ...i,
      adminSellingPrice: Number(i.sellingPrice) || 0,
      openingStock: Number(i.qty) || 0,
      purchase:0, transferIn:0, transferOut:0, returns:0,
      sold:"", rate: Number(i.sellingPrice) || 0, endStock:"",
    }))
  );
const [empRows, setER] = useState(() =>
  seedEmp
    .filter(e => e.supplier !== "EMPTY PURCHASE")
    .map(e => ({
      ...e,
      adminSellingPrice: Number(e.sellingPrice) || Number(e.rate) || 0,
      openingStock: Number(e.qty) || 0,
      purchase:0, invPurchase:"", received:"",
      return_:"", invIssue:"", issue:"",
      sold:"", rate: Number(e.sellingPrice) || Number(e.rate) || 0, endStock:"",
    }))
);
  
  useEffect(() => {
  if (skipNextReloadRef.current) {
    skipNextReloadRef.current = false;
    return;
  }
 const lsMain = getOutletInventory(outlet, masterInv);

const baseMaster = masterInv || ls("inv_main", SEED_INVENTORY);
const baseQtyByCode = {};
baseMaster.forEach(i => { baseQtyByCode[i.code] = Number(i.qty) || 0; });

const baseMain = {};
lsMain.forEach(i => { baseMain[i.code] = baseQtyByCode[i.code] || 0; });
  const prev = new Date(mainDate);
  prev.setDate(prev.getDate() - 1);
  const yDate = prev.toISOString().slice(0, 10);

  // Build purchase / transfer / return maps in the SAME effect
  const pV = {}, tiV = {}, toV = {}, rV = {};

  dbPurchases
    .filter(r => txnDate(r) === mainDate)
    .forEach(rec => txnItems(rec).forEach(l => {
      if (!l.itemCode || l.isEmptyItem) return;
      pV[l.itemCode] = (pV[l.itemCode] || 0) + (parseFloat(l.qty) || 0);
    }));

  dbTransfers
    .filter(r => txnDate(r) === mainDate && isTransferIn(r, outlet))
    .forEach(rec => txnItems(rec).forEach(l => {
      if (!l.itemCode) return;
      tiV[l.itemCode] = (tiV[l.itemCode] || 0) + (parseFloat(l.qty) || 0);
    }));

  dbTransfers
    .filter(r => txnDate(r) === mainDate && isTransferOut(r, outlet))
    .forEach(rec => txnItems(rec).forEach(l => {
      if (!l.itemCode) return;
      toV[l.itemCode] = (toV[l.itemCode] || 0) + (parseFloat(l.qty) || 0);
    }));

  dbReturns
    .filter(r => txnDate(r) === mainDate)
    .forEach(rec => txnItems(rec).forEach(l => {
      if (!l.itemCode) return;
      rV[l.itemCode] = (rV[l.itemCode] || 0) + (parseFloat(l.qty) || 0);
    }));

  (async () => {
    const opening = await getOpeningStock(outlet, mainDate);
    const mergedMain = opening?.main
      ? { ...baseMain, ...opening.main }
      : baseMain;
    const resolvedOpening = { main: mergedMain, emp: opening?.emp || {} };
    const todaySale = dbSalesRef.current.find(
    s => s.date === mainDate && (s.items || []).some(r => !r.isEmptyItem)
    );
    const savedMap = todaySale
  ? Object.fromEntries(
      (todaySale.items || [])
        .filter(r => !r.isEmptyItem)
        .flatMap(r => {
          const entries = [[r.id, r]];
          if (r.code) entries.push([r.code, r]);
          return entries;
        })
    )
  : {};

    setMR(() => lsMain.map(i => {
      const adminSP     = Number(i.sellingPrice) || 0;
      const key         = i.id || `${i.code}__${i.supplier}`;
      const op = resolvedOpening.main?.[`${i.code}__${i.supplier}`]
      ?? resolvedOpening.main?.[i.code]
      ?? 0;
      const saved = savedMap[i.id] || savedMap[i.code];
      const purchase    = pV[i.code]  || 0;
      const transferIn  = tiV[i.code] || 0;
      const transferOut = toV[i.code] || 0;
      const returns     = rV[i.code]  || 0;

      if (saved) {
        return {
          ...i,
          adminSellingPrice: adminSP,
          openingStock:      op,
          purchase,
          transferIn,
          transferOut,
          returns,
          sold:     saved.sold !== undefined && saved.sold !== null ? String(saved.sold) : "",
          rate:     Number(saved.rate) || adminSP,
          endStock: saved.endStockEdited ? saved.endStock : null,
          endStockEdited: saved.endStockEdited || false,
        };
      }
      return {
        ...i,
        adminSellingPrice: adminSP,
        openingStock:      op,
        purchase,
        transferIn,
        transferOut,
        returns,
        sold:     "",
        rate:     adminSP,
        endStock: null,
      };
    }));
  })();
}, [outlet, mainDate, masterInv, dbPurchases, dbTransfers, dbReturns]); // eslint-disable-line

useEffect(() => {
  if (skipNextEmpReloadRef.current) {
    skipNextEmpReloadRef.current = false;
    return;
  }
  const lsEmp = getOutletEmptyInventory(outlet, masterInv, emptyMaster);

  const baseEmp = {};
  lsEmp.forEach(e => { baseEmp[e.id] = Number(e.qty) || 0; });

  const prev = new Date(empDate);
  prev.setDate(prev.getDate() - 1);
  const yDate = prev.toISOString().slice(0, 10);

  // ── Build empty purchase maps in the SAME effect ──
  
  const codes = new Set(lsEmp.map(e => e.code));
const pQ = {}, ipQ = {};


   dbPurchases
  .filter(r => txnDate(r) === empDate)
  .forEach(rec => (rec.items || []).forEach(l => {
    const itemCode = l.itemCode || l.code || "";
    if (!itemCode || !codes.has(itemCode)) return;
    const qty = parseFloat(l.qty) || 0;
    if (!qty) return;
    const sid = rec.supplier_id || rec.supplier || "";

    const isEmptyPurchaseSup =
      sid === "EMPTY PURCHASE" ||
      sid === EMPTY_PURCHASE_SUP_ID;

    const isMainSup =
      ["2001-DCSL","2002-LION BREWERY","2003-UG",
       "2006-DCSL BEER","2007-TODDY"].some(s =>
        sid === s || sid.includes(s) || s.includes(sid)
      );

    if (isEmptyPurchaseSup) {
      pQ[itemCode] = (pQ[itemCode] || 0) + qty;
    } else if (isMainSup) {
      ipQ[itemCode] = (ipQ[itemCode] || 0) + qty;
    }
  }));
 
   (async () => {
    const opening = await getOpeningStock(outlet, empDate);
    const mergedEmp = opening?.emp
      ? { ...baseEmp, ...opening.emp }
      : baseEmp;
    const resolvedOpening = { main: opening?.main || {}, emp: mergedEmp };
    const todaySale = dbSalesRef.current.find(
    s => s.date === empDate && (s.items || []).some(r => r.isEmptyItem)
    );
    const savedMap = todaySale
      ? Object.fromEntries(
          (todaySale.items || [])
            .filter(r => r.isEmptyItem && r.supplier !== "EMPTY PURCHASE")
            .map(r => [r.id, r])
        )
      : {};

    setER(() => lsEmp
      .filter(e => e.supplier !== "EMPTY PURCHASE")
      .map(e => {
        const adminSP = Number(e.sellingPrice) || Number(e.unitCost) || 0;
        const op = resolvedOpening.emp?.[`${e.code}__${e.supplier}`]
        ?? resolvedOpening.emp?.[e.id]
        ?? 0;
        const saved   = savedMap[e.id];

        if (saved) {
          return {
            ...e,
            adminSellingPrice: adminSP,
            openingStock:      op,
            purchase:    pQ[e.code]  || 0,
            invPurchase: ipQ[e.code] || 0,
            received:    saved.received || "",
            return_:     saved.return_  || "",
            invIssue:    saved.invIssue || "",
            issue:       saved.issue    || "",
            sold:        saved.sold     || "",
            rate:        Number(saved.rate) || adminSP,
            endStock: saved.endStockEdited ? saved.endStock : null,
            endStockEdited: saved.endStockEdited || false,
          };
        }
        return {
          ...e,
          adminSellingPrice: adminSP,
          openingStock:      op,
          purchase:    pQ[e.code]  || 0,
          invPurchase: ipQ[e.code] || 0,
          received:    "",
          return_:     "",
          invIssue:    "",
          issue:       "",
          sold:        "",
          rate:        adminSP,
          endStock: null,
        };
      })
    );
  })();
}, [outlet, empDate, dbPurchases, masterInv, emptyMaster]); // eslint-disable-line

  

  // ─────────────────────────────────────────────────────────
  //  DERIVE FUNCTIONS
  // ─────────────────────────────────────────────────────────

  /**
   * MAIN STOCK derivation (doc page 4):
   *   Total   = Opening + Purchase + TransferIn − TransferOut + Returns
   *             NOTE: Returns are ADDED (goods returned TO the outlet)
   *   Balance = Total − Sold
   *   Amount  = Sold × Rate
   *   End Stock → defaults to Balance, editable by staff
   *   Stock Short/Ex  = End Stock − Balance
   *   Amount Short/Ex:
   *     if sold=0 → stkSE × adminSellingPrice
   *     if sold>0 → (stkSE × adminSellingPrice) + ((rate − adminSellingPrice) × sold)
   */
  // REPLACE WITH:
function deriveMain(r) {
    const opening     = Number(r.openingStock) || 0;
    const purchase    = Number(r.purchase)     || 0;
    const transferIn  = Number(r.transferIn)   || 0;
    const transferOut = Number(r.transferOut)  || 0;
    const returns     = Number(r.returns)      || 0;
    const total       = opening + purchase + transferIn - transferOut + returns;
    const sold        = parseFloat(r.sold) || 0;
    const balance     = total - sold;
    const amount      = sold * r.rate;
   const endStock = (r.endStock !== null && r.endStock !== "" && r.endStock !== undefined)
  ? parseFloat(r.endStock)
  : balance;
    const stkSE  = endStock - balance;
    const amtSE  = sold === 0
      ? stkSE * r.adminSellingPrice
      : (stkSE * r.adminSellingPrice) + ((r.rate - r.adminSellingPrice) * sold);
    return { total, sold, balance, amount, endStock, amtSE, stkSE, purchase, transferIn, transferOut, returns };
  }

  /**
   * EMPTY STOCK derivation (doc page 5):
   *   Balance = Opening + Purchase + InvPurchase + Received + Return
   *             − InvIssue − Issue − Sold
   *             NOTE: sold IS deducted from balance
   *   Amount  = Sold × Rate
   *   End Stock → defaults to Balance, editable by staff
   */
  function deriveEmp(r) {
    const opening     = Number(r.openingStock) || 0;
    const purchase    = parseFloat(r.purchase)    || 0;
    const invPurchase = parseFloat(r.invPurchase) || 0;
    const received    = parseFloat(r.received)    || 0;
    const return_     = parseFloat(r.return_)     || 0;
    const invIssue    = parseFloat(r.invIssue)    || 0;
    const issue       = parseFloat(r.issue)       || 0;
    const sold        = parseFloat(r.sold)        || 0;
    // ✅ Sold deducted from balance — doc: purchase+invPurchase+received+return−invIssue−issue−sold
    const balance  = opening + purchase + invPurchase + received + return_ - invIssue - issue - sold;
    const amount   = sold * r.rate;
    const endStock = (r.endStock !== null && r.endStock !== "" && r.endStock !== undefined)
  ? parseFloat(r.endStock)
  : balance;
    const stkSE = endStock - balance;
    const amtSE = sold === 0
      ? stkSE * r.adminSellingPrice
      : (stkSE * r.adminSellingPrice) + ((r.rate - r.adminSellingPrice) * sold);
    return { purchase, invPurchase, received, return_, invIssue, issue, sold, balance, amount, endStock, amtSE, stkSE };
  }

  // ─────────────────────────────────────────────────────────
  //  FIELD UPDATERS
  // ─────────────────────────────────────────────────────────
const updM = (id, field, val) => setMR(prev => prev.map(r => {
  if (r.id !== id) return r;
  // When sold changes, clear endStock so it auto-follows balance
if (field === "sold") {
  return { ...r, sold: val, endStock: null };
}
  // When endStock is manually edited, keep it
if (field === "endStock") {
  return { ...r, endStock: val, endStockEdited: true };
}
  return { ...r, [field]: parseFloat(val) || 0 };
}));

 const updE = (id, field, val) => setER(prev => prev.map(r => {
  if (r.id !== id) return r;
  // When any balance-affecting field changes, clear endStock so it auto-follows
  if (["sold", "received", "return_", "invIssue", "issue"].includes(field)) {
  return { ...r, [field]: val, endStock: null };
}
  if (field === "endStock") {
  return { ...r, endStock: val, endStockEdited: true };
}
return { ...r, [field]: val };
}));

  // ─────────────────────────────────────────────────────────
  //  SAVE MAIN DAILY SALE
  // ─────────────────────────────────────────────────────────

  async function saveMainSale() {
  skipNextReloadRef.current = true;   
  const totalSale = mainRows.reduce((a, r) => a + deriveMain(r).amount, 0);

  const mainRowsWithDerived = mainRows.map(r => {
    const { stkSE, endStock } = deriveMain(r);
    return { 
      ...r, 
      stkSE, 
      endStock, 
      endStockEdited: r.endStockEdited || false,
      sold: parseFloat(r.sold) || 0,
    };
  });

  const nd = new Date(mainDate);
  nd.setDate(nd.getDate() + 1);
  const nextDay = nd.toISOString().slice(0, 10);
  const om = {};
  mainRowsWithDerived.forEach(r => {
    const key = r.id || `${r.code}__${r.supplier}`;
    om[key] = deriveMain(r).endStock;
  });

  await propagateOpeningForward(outlet, mainDate, om, null);
  await deleteSaleForDate(outlet, mainDate, false);
  await addSale(outlet, {
    date: mainDate,
    items: mainRowsWithDerived,
    total: totalSale,
    paymentMethod: "cash",
  });
  await addCashEntry(outlet, {
    date: mainDate,
    description: "Daily Sale",
    type: "in",
    debit: totalSale,
    credit: 0,
  });
  await addGLEntry(outlet, {
    date: mainDate,
    account_id: "4001",
    description: "Sales Revenue",
    debit: 0,
    credit: totalSale,
    source: "sale",
  });

// ── Restore display immediately from local data (no async wait) ──
  const localSavedMap = Object.fromEntries(
    mainRowsWithDerived.map(r => [r.id, r])
  );
  setMR(prev => prev.map(r => {
    const sv = localSavedMap[r.id];
    if (!sv) return r;
    return {
      ...r,
      sold:           sv.sold !== undefined && sv.sold !== null ? String(sv.sold) : r.sold,
      rate:           Number(sv.rate) || r.rate,
      endStock:       sv.endStockEdited ? sv.endStock : null,
      endStockEdited: sv.endStockEdited || false,
    };
  }));

  // ── Update sales ref AFTER setMR ──
  const freshSales = await getSales(outlet);
skipNextReloadRef.current = true;
dbSalesRef.current = freshSales;
setDbSales(freshSales);
setJustSaved(true);
toast_("Main stock daily sale saved ✓");
}
    // ─────────────────────────────────────────────────────────
  //  SAVE EMPTY DAILY SALE
  // ─────────────────────────────────────────────────────────

 async function saveEmpSale() {
  skipNextEmpReloadRef.current = true; 
  const nd = new Date(empDate);
  nd.setDate(nd.getDate() + 1);
  const nextDay = nd.toISOString().slice(0, 10);
  const oe = {};
  empRows.forEach(r => { oe[r.id] = deriveEmp(r).endStock; });
  await propagateOpeningForward(outlet, empDate, null, oe);
  const empRowsWithDerived = empRows.map(r => {
    const d = deriveEmp(r);
    return { ...r, ...d, isEmptyItem: true };
  });
  await deleteSaleForDate(outlet, empDate, true);
  await addSale(outlet, { date: empDate, items: empRowsWithDerived, total: 0, paymentMethod: "empty" });
  
  for (const e of empRows) {
    const s    = parseFloat(e.sold)    || 0;
    const rr   = parseFloat(e.return_) || 0;
    const p    = parseFloat(e.purchase)|| 0;
    const rate = parseFloat(e.rate)    || 0;
    if (s > 0) await addCashEntry(outlet, { date: empDate, description: `Empty Sold: ${e.name} (${e.supplier})`, debit: s * rate, credit: 0 });
    if (rr > 0) await addCashEntry(outlet, { date: empDate, description: `Empty Return: ${e.name} (${e.supplier})`, debit: 0, credit: rr * rate });
    if (p > 0) await addCashEntry(outlet, { date: empDate, description: `Empty Purchase: ${e.name} (${e.supplier})`, debit: 0, credit: p * rate });
  }

setJustSavedEmp(true);
const freshSales = await getSales(outlet);
const updatedSales = [
  ...dbSalesRef.current.filter(s => !(s.date === empDate && s.items?.some(r => r.isEmptyItem))),
  ...freshSales.filter(s => s.date === empDate)
];
dbSalesRef.current = updatedSales;
setDbSales(updatedSales);
toast_("Empty stock daily sale saved ✓");
  }
   
  // ─────────────────────────────────────────────────────────
  //  CURRENT STATUS DATA (Tab 5 logic)
  //  Total Bottle Sale = Opening + Total Purchase − In Hand Stock
  //  Physical Stock    = In Hand Stock × Unit Cost
  //  Profit            = Margin × Total Bottle Sale
  //  Margin            = Selling Price − Unit Cost
  // ─────────────────────────────────────────────────────────
  // AFTER
const inv = useMemo(() => getOutletInventory(outlet, masterInv), [outlet, masterInv]);

const csData = useMemo(() => inv.map(item => {
  const uc = Number(item.unitCost)     || 0;
  const sp = Number(item.sellingPrice) || 0;
  const mg = sp - uc;

  // ── All daily sales for this item in the date range, sorted by date ──
  const salesInRange = dbSales
  .filter(s => s.date >= csFrom && s.date <= csTo && 
    (s.items || []).some(r => !r.isEmptyItem))
  .sort((a, b) => a.date.localeCompare(b.date));
  
  // ── Last known end stock (= in-hand stock) ──
let lastEndStock = null;

// Collect ALL matching rows from csTo date across all sale records
const csToSales = salesInRange.filter(s => s.date === csTo);
const csToRows = [];
for (const sale of csToSales) {
  const row = (sale.items || []).find(
    r => !r.isEmptyItem && (
      (r.id && r.id === item.id) ||
      (r.code && r.code === item.code && r.supplier === item.supplier)
    )
  );
  if (row && row.endStock !== null && row.endStock !== "" && row.endStock !== undefined) {
    csToRows.push(row);
  }
}

if (csToRows.length > 0) {
  // Prefer the row with sold > 0; otherwise take the highest endStock
  const soldRow = csToRows.find(r => parseFloat(r.sold) > 0);
  if (soldRow) {
    lastEndStock = parseFloat(soldRow.endStock);
  } else {
    lastEndStock = Math.max(...csToRows.map(r => parseFloat(r.endStock)));
  }
}

// Fallback: search entire range
if (lastEndStock === null) {
  for (let i = salesInRange.length - 1; i >= 0; i--) {
    const row = (salesInRange[i].items || []).find(
      r => !r.isEmptyItem && (
        (r.id && r.id === item.id) ||
        (r.code && r.code === item.code && r.supplier === item.supplier)
      )
    );
    if (row && row.endStock !== null && row.endStock !== "" && row.endStock !== undefined && parseFloat(row.endStock) > 0) {
      lastEndStock = parseFloat(row.endStock);
      break;
    }
  }
}

// Check if a saved sale record exists for this item on csTo date
 const hasSavedRecord = salesInRange.some(s =>
  (s.items || []).some(r =>
    !r.isEmptyItem && (
      (r.id && r.id === item.id) ||
      (r.code && r.code === item.code && r.supplier === item.supplier)
    )
  )
);

  // ── First opening in range ──
   let firstOpening = null;
if (salesInRange.length > 0) {
  // Get all records for the earliest date in range
  const firstDate = salesInRange[0].date;
  const firstDateSales = salesInRange.filter(s => s.date === firstDate);
  // Pick the row with the highest openingStock (most reliable save)
  for (const sale of firstDateSales) {
    const row = (sale.items || []).find(
      r => !r.isEmptyItem && (
        (r.id && r.id === item.id) ||
        (r.code && r.code === item.code && r.supplier === item.supplier)
      )
    );
    if (row && row.openingStock !== null && row.openingStock !== undefined) {
      const op = Number(row.openingStock);
      if (firstOpening === null || op > firstOpening) {
        firstOpening = op;
      }
    }
  }
}
  // ── Purchases ──
  let totalPurchase = 0;
  dbPurchases
    .filter(p => p.date >= csFrom && p.date <= csTo)
    .forEach(p => (p.items || []).forEach(l => {
      if (l.itemCode === item.code && !l.isEmptyItem)
        totalPurchase += parseFloat(l.qty) || 0;
    }));

  // ── Transfers In ──
  let transferIn = 0;
  dbTransfers
    .filter(t => txnDate(t) >= csFrom && txnDate(t) <= csTo && isTransferIn(t, outlet))
    .forEach(t => txnItems(t).forEach(l => {
      if (l.itemCode === item.code) transferIn += parseFloat(l.qty) || 0;
    }));

  // ── Transfers Out ──
  let transferOut = 0;
  dbTransfers
    .filter(t => txnDate(t) >= csFrom && txnDate(t) <= csTo && isTransferOut(t, outlet))
    .forEach(t => txnItems(t).forEach(l => {
      if (l.itemCode === item.code) transferOut += parseFloat(l.qty) || 0;
    }));

  // ── Returns ──
  let totalReturn = 0;
  dbReturns
    .filter(r => r.date >= csFrom && r.date <= csTo)
    .forEach(r => (r.items || []).forEach(l => {
      if (l.itemCode === item.code) totalReturn += parseFloat(l.qty) || 0;
    }));

  const opening     = firstOpening !== null ? firstOpening : (Number(item.qty) || 0);
  const inHandStock = lastEndStock  !== null ? lastEndStock  : opening;

  const totalBottleSale = opening + totalPurchase - inHandStock;
  const physicalStock   = inHandStock * uc;
  const totalSaleAmt    = totalBottleSale * sp;   
  const profit          = mg * totalBottleSale;

  // ── Adj to stock (stock short/excess) ──
  // Last saved stkSE for this item in range, or 0
  let adjStock = 0;
  if (salesInRange.length > 0) {
    const lastSale = salesInRange[salesInRange.length - 1];
    const lastRow  = (lastSale.items || []).find(
      r => r.code === item.code && r.id === item.id && !r.isEmptyItem
    );
    if (lastRow?.stkSE !== undefined) adjStock = lastRow.stkSE || 0;
  }

  const pk = `${item.id}_${csFrom}_${csTo}`;

  return {
    ...item,
    opening,
    inHandStock,
    physicalStock,
    physicalStockOverride: physStock[pk] ?? "",
    hasSavedRecord,
    totalBottleSale,
    totalSaleAmt,
    totalPurchase,
    transferIn,
    transferOut,
    totalReturn,
    adjStock,
    profit,
    margin: mg,
    unitCost: uc,
    sellingPrice: sp,
    physKey: pk,
  };
}
 ).filter(r =>
  (r.opening > 0 || r.inHandStock > 0) &&
  (
    r.totalBottleSale > 0 || r.totalPurchase > 0 ||
    r.transferIn > 0 || r.transferOut > 0 || r.totalReturn > 0 ||
    r.hasSavedRecord === true
  )

), [inv, outlet, csFrom, csTo, physStock, dbSales, dbPurchases, dbTransfers, dbReturns]);
  // ─────────────────────────────────────────────────────────
  //  FILTERED VIEWS
  // ─────────────────────────────────────────────────────────
  const roStyle  = { background:"var(--s2)", cursor:"not-allowed", opacity:0.75 };
  const iS       = { padding:"4px 8px", background:"var(--s2)", border:"1px solid var(--bdr)", borderRadius:6, fontSize:12, color:"var(--txt)", outline:"none" };
  const lbl      = { fontSize:9, fontWeight:700, letterSpacing:".08em", textTransform:"uppercase", color:"var(--mut)", display:"block", marginBottom:2 };
  const tblWrap  = { flex:1, minHeight:0, overflowX:"auto", overflowY:"auto", maxHeight:"calc(100vh - 180px)" };
  const filteredMain = useMemo(() => {
    if (mainSupFilter === "ALL") return mainRows;
    return mainRows.filter(r => {
      const sup = (r.supplier || "").replace(/^\d{4}-/, "").trim();
      return sup === mainSupFilter.trim();
    });
  }, [mainRows, mainSupFilter]);

  const filteredEmp = useMemo(() => {
    if (empSupFilter === "ALL") return empRows;
    return empRows.filter(r => {
      const key = (r.supplier || "").trim() || "EMP";
      return key === empSupFilter.trim();
    });
  }, [empRows, empSupFilter]);

  // ─────────────────────────────────────────────────────────
  //  CONTROL BAR (shared by main and empty tabs)
  // ─────────────────────────────────────────────────────────
  function CtrlBar({ date, setDate, supFilter, setSupFilter, suppliers, onSave, saveLabel, count, supLabel }) {
    return (
      <div style={{ display:"flex", alignItems:"flex-end", gap:8, flexWrap:"wrap", padding:"6px 0" }}>
        <div>
          <label style={lbl}>Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...iS, width:148 }} />
        </div>
        <div>
          <label style={lbl}>{supLabel || "Supplier"}</label>
          <select value={supFilter} onChange={e => setSupFilter(e.target.value)} style={{ ...iS, minWidth:130 }}>
            {suppliers.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button className="btn btng" style={{ marginBottom:0 }} onClick={onSave}>
          {I.check} {saveLabel}
        </button>
        <button className="btn btnd btnsm no-print" style={{ marginBottom:0 }} onClick={() => window.print()}>
          {I.print} Print
        </button>
        <span style={{ marginLeft:"auto", fontSize:11, color:"var(--mut)", alignSelf:"center" }}>
          {count} items{supFilter !== "ALL" ? ` · ${supFilter}` : ""}
        </span>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────
  return (
  <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", width:"100%" }}>

      <style>{`
        [data-inv-tbl]::-webkit-scrollbar { display:none }
        @media print {
          .no-print, button, select, input[type=date] { display:none !important; }
          body, html { background:#fff !important; color:#000 !important; }
          table { width:100% !important; font-size:9px !important; border-collapse:collapse !important; }
          th, td { border:1px solid #ccc !important; padding:3px 5px !important; }
          [data-inv-tbl] { overflow:visible !important; height:auto !important; }
          input[type=number] { border:none !important; background:transparent !important; font-size:9px !important; width:auto !important; }
          .tpill { background:#eee !important; color:#333 !important; border-radius:3px; padding:1px 4px; }
        }
      `}</style>

      {/* ════════════════ DAILY SALE ════════════════ */}
        {subTab === "daily" && (
  <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

          {/* ── MAIN STOCK TAB ── */}
          {dailyTab === "main" && (
  <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
             <CtrlBar
             date={mainDate} setDate={d => {
             setMainDate(d);
             getSales(outlet).then(data => {
             dbSalesRef.current = data;
             setDbSales(data);
             });
             }}
                supFilter={mainSupFilter} setSupFilter={setMainSupFilter}
                suppliers={mainSuppliers}
                onSave={saveMainSale} saveLabel="Save Daily Sale"
                count={filteredMain.length} supLabel="Supplier"
              />
              <ScrollArrows scrollBy={mainScrollBy} />
              <div data-inv-tbl ref={mainTableRef} style={{ flex:1, overflowX:"auto", overflowY:"auto", minHeight:0 }}>
                <table className="tbl tin" style={{ minWidth:1100, width:"100%" }}>
                  <thead style={{ position:"sticky", top:0, zIndex:5, background:"var(--s2,#1e1e3a)" }}>
                    <tr>
                      <th>Code</th>
                      <th>Item</th>
                      <th>Type</th>
                      <th>Supplier</th>
                      <th>Opening</th>
                      <th>Purchase</th>
                      <th>Trans.In</th>
                      <th>Trans.Out</th>
                      <th>Returns</th>
                      <th>Total</th>
                      <th>Sold</th>
                      <th>Balance</th>
                      <th>Rate</th>
                      <th>Amount</th>
                      <th>Amt ±</th>
                      <th>Stk ±</th>
                      <th>End Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMain.length === 0 && (
                      <tr><td colSpan={17}><div className="empty">No items.</div></td></tr>
                    )}
                    {filteredMain.map(r => {
                      const { total,sold, balance, amount, endStock, amtSE, stkSE, purchase, transferIn, transferOut, returns } = deriveMain(r);
                      return (
                        <tr key={r.id}>
                          <td className="mono" style={{ fontSize:10 }}>{r.code}</td>
                          <td style={{ fontWeight:600 }}>{r.name}</td>
                          <td><span className="tpill">{r.type}</span></td>
                          <td style={{ fontSize:10, whiteSpace:"nowrap", color:"var(--mut)" }}>
                            {r.supplier?.replace(/^\d{4}-/, "") || "—"}
                          </td>
                          <td className="mono" style={{ textAlign:"right" }}>{r.openingStock || "—"}</td>
                          
                         <td className="mono cg" style={{ textAlign:"right", ...roStyle, padding:"3px 6px" }}>{purchase || "—"}</td>
                         <td className="mono cb" style={{ textAlign:"right", ...roStyle, padding:"3px 6px" }}>{transferIn || "—"}</td>
                         <td className="mono ca" style={{ textAlign:"right", ...roStyle, padding:"3px 6px" }}>{transferOut || "—"}</td>
                         <td className="mono cr" style={{ textAlign:"right", ...roStyle, padding:"3px 6px" }}>{returns || "—"}</td>
                          <td className="mono bold" style={{ textAlign:"right" }}>{fmt(total)}</td>
                          <td>
                            <input
                              type="number" value={r.sold}
                              onChange={e => updM(r.id, "sold", e.target.value)}
                              style={{ width:53, borderColor:"var(--gld)" }}
                            />
                          </td>
                          <td className="mono" style={{ textAlign:"right" }}>{fmt(balance)}</td>
                          <td>
                            <input
                              type="number" value={r.rate}
                              onChange={e => updM(r.id, "rate", e.target.value)}
                              style={{ width:63 }}
                            />
                          </td>
                          <td className="mono cg bold">Rs.{fmt(amount)}</td>
                          <td className={`mono bold ${amtSE < 0 ? "cr" : amtSE > 0 ? "cg" : ""}`}>
                            {amtSE !== 0 ? `${amtSE < 0 ? "−" : "+"}Rs.${fmt(Math.abs(amtSE))}` : "—"}
                          </td>
                          <td className={`mono bold ${stkSE < 0 ? "cr" : stkSE > 0 ? "cg" : ""}`}>
                            {stkSE !== 0 ? `${stkSE < 0 ? "−" : "+"}${Math.abs(stkSE)}` : "—"}
                          </td>
                          <td>
                            <input
                              type="number"
                              value={r.endStock !== null && r.endStock !== "" && r.endStock !== undefined ? 
                              r.endStock : balance}
                              onChange={e => updM(r.id, "endStock", e.target.value)}
                              style={{ width:53, borderColor:"var(--acc,#f59e0b)" }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                    <tr style={{ background:"var(--s3)", fontWeight:700 }}>
                      <td colSpan={13} style={{ textAlign:"right", paddingRight:10, fontSize:12 }}>Total Sale:</td>
                      <td className="mono cg">Rs.{fmt(filteredMain.reduce((a, r) => a + deriveMain(r).amount, 0))}</td>
                      <td colSpan={3} />
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── EMPTY STOCK TAB ── */}
           {dailyTab === "empty" && (
           <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>
              <CtrlBar
              date={empDate} setDate={d => {
              setEmpDate(d);
              getSales(outlet).then(data => {
              dbSalesRef.current = data;
              setDbSales(data);
              });
              }}
                supFilter={empSupFilter} setSupFilter={setEmpSupFilter}
                suppliers={empSuppliers}
                onSave={saveEmpSale} saveLabel="Save Empty Sale"
                count={filteredEmp.length} supLabel="Supplier / Type"
              />
              <ScrollArrows scrollBy={empScrollBy} />
              <div data-inv-tbl ref={empTableRef} style={{ flex:1, overflowX:"auto", overflowY:"auto", minHeight:0 }}>
                <table className="tbl tin" style={{ minWidth:1200, width:"100%" }}>
                  <thead style={{ position:"sticky", top:0, zIndex:5, background:"var(--s2,#1e1e3a)" }}>
                    <tr>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Supplier</th>
                      <th>Opening</th>
                      <th>Rate</th>
                      <th>Purchase</th>
                      <th>Inv.Purchase</th>
                      <th>Received</th>
                      <th>Return</th>
                      <th>Inv.Issue</th>
                      <th>Issue</th>
                      <th>Sold</th>
                      <th>Balance</th>
                      <th>Amount</th>
                      <th>Amt ±</th>
                      <th>Stk ±</th>
                      <th>End Stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEmp.length === 0 && (
                      <tr><td colSpan={17}><div className="empty">No empty stock items.</div></td></tr>
                    )}
                    {filteredEmp.map(r => {
                      const { purchase, invPurchase, received, return_, invIssue, issue, sold, balance, amount, endStock, amtSE, stkSE } = deriveEmp(r);
                      return (
                        <tr key={r.id}>
                          <td className="mono" style={{ fontSize:10 }}>{r.code}</td>
                          <td style={{ fontWeight:600, whiteSpace:"nowrap" }}>{r.name}</td>
                          <td><span className="tpill">{r.supplier || "EMP"}</span></td>
                          <td className="mono" style={{ textAlign:"right", ...roStyle, padding:"3px 8px" }}>{r.openingStock || "—"}</td>
                          <td>
                            <input
                              type="number" value={r.rate}
                              onChange={e => updE(r.id, "rate", e.target.value)}
                              style={{ width:60 }}
                            />
                          </td>
                          <td className="mono cg" style={{ textAlign:"right", ...roStyle, padding:"3px 6px" }}>{purchase || "—"}</td>
                          <td className="mono cg" style={{ textAlign:"right", ...roStyle, padding:"3px 6px" }}>{invPurchase || "—"}</td>
                          <td>
                            <input
                              type="number" value={r.received}
                              onChange={e => updE(r.id, "received", e.target.value)}
                              style={{ width:53, borderColor:"var(--cb,#60a5fa)" }}
                            />
                          </td>
                          <td>
                            <input
                              type="number" value={r.return_}
                              onChange={e => updE(r.id, "return_", e.target.value)}
                              style={{ width:53, borderColor:"var(--cr,#f87171)" }}
                            />
                          </td>
                          <td>
                            <input
                              type="number" value={r.invIssue}
                              onChange={e => updE(r.id, "invIssue", e.target.value)}
                              style={{ width:53, borderColor:"var(--ca,#fb923c)" }}
                            />
                          </td>
                          <td>
                            <input
                              type="number" value={r.issue}
                              onChange={e => updE(r.id, "issue", e.target.value)}
                              style={{ width:53, borderColor:"var(--ca,#fb923c)" }}
                            />
                          </td>
                          <td>
                            <input
                              type="number" value={r.sold}
                              onChange={e => updE(r.id, "sold", e.target.value)}
                              style={{ width:53, borderColor:"var(--gld)" }}
                            />
                          </td>
                          <td className="mono bold" style={{ textAlign:"right" }}>{fmt(balance)}</td>
                          <td className="mono cg bold">{amount ? `Rs.${fmt(amount)}` : "—"}</td>
                          <td className={`mono bold ${amtSE < 0 ? "cr" : amtSE > 0 ? "cg" : ""}`}>
                            {amtSE !== 0 ? `${amtSE < 0 ? "−" : "+"}Rs.${fmt(Math.abs(amtSE))}` : "—"}
                          </td>
                          <td className={`mono bold ${stkSE < 0 ? "cr" : stkSE > 0 ? "cg" : ""}`}>
                            {stkSE !== 0 ? `${stkSE < 0 ? "−" : "+"}${Math.abs(stkSE)}` : "—"}
                          </td>
                          <td>
                            <input
                              type="number"
                              value={r.endStock !== null && r.endStock !== "" && r.endStock !== undefined ? 
                              r.endStock : balance}
                              onChange={e => updE(r.id, "endStock", e.target.value)}
                              style={{ width:53, borderColor:"var(--acc,#f59e0b)" }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
{/* ════════════════ CURRENT STATUS ════════════════ */}
{subTab === "status" && (
  <div style={{ display:"flex", flexDirection:"column", height:"100%", overflow:"hidden" }}>

   <style>{`
  @media print {
    @page { size: legal landscape; margin: 8mm; }
    .no-print, button, select, input[type=date] { display:none !important; }
    body, html { background:#fff !important; color:#000 !important; font-size:6.5px !important; }
    .cs-tbl {
      width:100% !important;
      font-size:6.5px !important;
      border-collapse:collapse !important;
      table-layout:auto !important;
      page-break-inside:auto !important;
    }
    .cs-tbl thead {
      display:table-header-group !important;
      background:#f0f0f0 !important;
    }
    .cs-tbl tbody { display:table-row-group !important; }
    .cs-tbl tfoot { display:table-footer-group !important; }
    .cs-tbl tr {
      page-break-inside:avoid !important;
      page-break-after:auto !important;
    }
    .cs-tbl th {
      background:#f0f0f0 !important;
      color:#000 !important;
      font-weight:700 !important;
      font-size:6px !important;
      border:1px solid #999 !important;
      padding:2px 3px !important;
      white-space:nowrap !important;
    }
    .cs-tbl td {
      border:1px solid #bbb !important;
      padding:2px 3px !important;
      white-space:nowrap !important;
      font-size:6.5px !important;
    }
    .cs-tbl .rt { text-align:right !important; }
    .cs-tbl .mono { font-family:monospace !important; }
    .cs-tbl .bold { font-weight:700 !important; }
    .ctag {
      background:#e8e8e8 !important; color:#111 !important;
      border-radius:2px; padding:1px 2px;
      font-family:monospace; font-size:6px;
    }
    .tpill {
      background:#ddd !important; color:#333 !important;
      border-radius:2px; padding:1px 2px; font-size:6px;
    }
    [data-cs-tbl] {
      overflow:visible !important;
      height:auto !important;
      max-height:none !important;
      display:block !important;
    }
    .cs-print-header {
      display:block !important;
      font-size:10px; font-weight:700; margin-bottom:4px;
    }
  }
  .cs-print-header { display:none; }
  [data-cs-tbl]::-webkit-scrollbar { display:none; }
`}</style>

    {/* ── Controls ── */}
    <div style={{ display:"flex", alignItems:"flex-end", gap:8, flexWrap:"wrap", padding:"6px 0" }}>
      <div>
        <label style={lbl}>From Date</label>
        <input type="date" value={csFrom} onChange={e => setCsFrom(e.target.value)} style={iS} />
      </div>
      <div>
        <label style={lbl}>To Date</label>
        <input type="date" value={csTo} onChange={e => setCsTo(e.target.value)} style={iS} />
      </div>
      <button
        className="btn btnd btnsm no-print"
        style={{ marginBottom:0 }}
        onClick={() => window.print()}
      >
        {I.print} Print
      </button>
      <span style={{ marginLeft:"auto", fontSize:11, color:"var(--mut)", alignSelf:"center" }}>
        {csData.length} items with activity
      </span>
    </div>

    {/* ── Scroll Arrows ── */}
    <div className="no-print" style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
      <button
        onClick={() => csTableRef.current?.scrollBy({ left:-350, behavior:"smooth" })}
        style={{
          width:28, height:24, borderRadius:5,
          border:"1px solid var(--s3,#444)",
          background:"var(--s2,#252540)", color:"var(--txt,#ccc)",
          cursor:"pointer", fontSize:15,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}
      >‹</button>
      <button
        onClick={() => csTableRef.current?.scrollBy({ left:350, behavior:"smooth" })}
        style={{
          width:28, height:24, borderRadius:5,
          border:"1px solid var(--s3,#444)",
          background:"var(--s2,#252540)", color:"var(--txt,#ccc)",
          cursor:"pointer", fontSize:15,
          display:"flex", alignItems:"center", justifyContent:"center",
        }}
      >›</button>
    </div>

    {/* ── Print header (only visible when printing) ── */}
    <div className="cs-print-header">
      Current Status Report &nbsp;|&nbsp; {outlet} &nbsp;|&nbsp; {csFrom} to {csTo}
    </div>

    {/* ── Table ── */}
    <div data-cs-tbl ref={csTableRef} style={{ flex:1, overflowX:"auto", overflowY:"auto", minHeight:0 }}>
      <table className="cs-tbl" style={{ width:"100%", minWidth:1100 }}>
        <thead>
          <tr>
            <th style={{ width:30 }}>#</th>
            <th style={{ width:72 }}>Item Code</th>
            <th>Description</th>
            <th style={{ width:70 }}>Item Type</th>
            <th className="rt" style={{ width:82 }}>Opening Stk</th>
            <th className="rt" style={{ width:82 }}>Total Pur</th>
            <th className="rt" style={{ width:82 }}>In Hand Stk</th>
            <th className="rt" style={{ width:90 }}>Total Btle Sale</th>
            <th className="rt" style={{ width:108 }}>Phy Stk (Rs.)</th>
            <th className="rt" style={{ width:100 }}>Total Sale (Rs.)</th>
            <th className="rt" style={{ width:100 }}>Profit (Rs.)</th>
            <th className="rt" style={{ width:80 }}>Margin</th>
            <th className="rt" style={{ width:76 }}>Trans.In</th>
            <th className="rt" style={{ width:76 }}>Trans.Out</th>
            <th className="rt" style={{ width:70 }}>Return</th>
            <th className="rt" style={{ width:80 }}>Adj. to Stk</th>
          </tr>
        </thead>
        <tbody>
          {csData.length === 0 && (
            <tr><td colSpan={16}><div className="empty">No activity for this period.</div></td></tr>
          )}
          {csData.map((row, idx) => (
            <tr key={row.id}>
              <td style={{ color:"var(--mut2)", fontSize:11, fontFamily:"monospace" }}>{idx + 1}</td>
              <td><span className="ctag">{row.code}</span></td>
              <td className="bold">{row.name}</td>
              <td><span className="tpill">{row.type}</span></td>
              <td className="rt mono">{row.opening ?? "—"}</td>
              <td className="rt mono">{row.totalPurchase || "—"}</td>
              <td className="rt mono bold" style={{ color: row.inHandStock >= 0 ? "var(--grn)" : "var(--red)" }}>
                {row.inHandStock}
              </td>
              <td className="rt mono">{row.totalBottleSale || "—"}</td>
              <td className="rt mono">
                Rs.{fmt(row.physicalStockOverride !== "" ? row.physicalStockOverride : row.physicalStock)}
              </td>
              <td className="rt mono cg">Rs.{fmt(row.totalSaleAmt)}</td>
              <td className="rt mono cg bold">Rs.{fmt(row.profit)}</td>
              <td className="rt mono">{row.margin !== undefined ? `Rs.${fmt(row.margin)}` : "—"}</td>
              <td className="rt mono cb">{row.transferIn || "—"}</td>
              <td className="rt mono ca">{row.transferOut || "—"}</td>
              <td className="rt mono cr">{row.totalReturn || "—"}</td>
              <td className={`rt mono bold ${row.adjStock < 0 ? "cr" : row.adjStock > 0 ? "cg" : ""}`}>
                {row.adjStock !== 0 ? `${row.adjStock > 0 ? "+" : ""}${row.adjStock}` : "—"}
              </td>
            </tr> 
          ))}
        </tbody>
        {csData.length > 0 && (
          <CsTotals csData={csData} fmt={fmt} physStock={physStock} />
        )}
      </table>
    </div>
  </div>
)}
 </div>
  );
}