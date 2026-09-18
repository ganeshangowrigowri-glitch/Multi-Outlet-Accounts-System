// ─── AREA CATEGORIZATION (display/grouping only) ──────────────
// This file is purely additive. It does NOT change outlet identity,
// outlet IDs, outlet names, or any database records.
//
// Area is stored here as a static id→area lookup for existing outlets,
// plus a localStorage override map so Admin can assign/change an Area
// for any outlet (including outlets added after go-live) without any
// database migration. If you later add a real `area` column to the
// `outlets` table, this file can be swapped for a DB-backed lookup
// with zero changes required in OutletManagement.jsx's rendering logic.

export const UNASSIGNED_AREA = "Unassigned Area";

export const AREAS = [
  "Badulla & Monaragala",
  "Nuwara Eliya",
  "Colombo",
  "Rathnapura",
];

// Outlet id (as stored in the `outlets` table / OUTLETS canonical list)
// -> Area. Only outlets that were confidently matched against the
// names supplied are included here. See the migration report for the
// outlets that could NOT be confidently matched (left unassigned on
// purpose rather than guessed).
export const OUTLET_AREA_MAP = {
  // Badulla & Monaragala
  "BADULLA ROYAL": "Badulla & Monaragala",
  "KETAWELA": "Badulla & Monaragala",
  "ETTAMPITIYA": "Badulla & Monaragala",
  "NELUWA": "Badulla & Monaragala",
  "DAYARABA": "Badulla & Monaragala",
  "MALIGATHANNA BEER": "Badulla & Monaragala",
  "HAPUTALE": "Badulla & Monaragala",
  "DEMODARA": "Badulla & Monaragala",
  "DIMUTHU": "Badulla & Monaragala",
  "SAGARA": "Badulla & Monaragala",
  "BERAGALA": "Badulla & Monaragala",
  "ROYAL BIBILE": "Badulla & Monaragala",
  "MONARAGALA": "Badulla & Monaragala",
  "PAHALA UVA": "Badulla & Monaragala",
  "PREMILICK MAHIYANGANA": "Badulla & Monaragala",
  "THARINDU BEER": "Badulla & Monaragala",
  "ISURUMALI": "Badulla & Monaragala",
  "VIDURA": "Badulla & Monaragala",
  "PREMERLICK-WEERAVILA": "Badulla & Monaragala",
  "ABBANA": "Badulla & Monaragala",

  // Nuwara Eliya
  "CARVELLO": "Nuwara Eliya",
  "BLINK BONNIE": "Nuwara Eliya",
  "KASTHURI": "Nuwara Eliya",
  "GARNIER": "Nuwara Eliya",
  "AMBEWELA": "Nuwara Eliya",
  "KOTAGALA": "Nuwara Eliya",
  "NEW ROYAL MARAYA": "Nuwara Eliya",
  "AG REST": "Nuwara Eliya",
  "T.K.WINE": "Nuwara Eliya",
  "ROYAL MARAYA": "Nuwara Eliya",
  "NANUOYA": "Nuwara Eliya",
  "M NUWARA": "Nuwara Eliya",
  "MASKELIYA": "Nuwara Eliya",
  "HOLEBROOK": "Nuwara Eliya",
  "SAFFAIR": "Nuwara Eliya",
  "SUBASH REST": "Nuwara Eliya",
  "GARNIER BEER": "Nuwara Eliya",
  "KOTAGALA BEER": "Nuwara Eliya",
  "DEVON BEER": "Nuwara Eliya",
  "AMBEWELA BEER": "Nuwara Eliya",
  "NORTON BRIDGE": "Nuwara Eliya",
  "UDAPUSELLAWA": "Nuwara Eliya",

  // Colombo
  "KOTAHENA": "Colombo",
  "RAMYA": "Colombo",
  "MATTAKULIYA": "Colombo",
  "PANCHIKAWATTA": "Colombo",
  "PUBUDU": "Colombo",
  "THUDELLA": "Colombo",
  "REGAL": "Colombo",
  "WELIKADA": "Colombo",
  "ATHURUGIRIYA": "Colombo",
  "PREMILICK-HORANA": "Colombo",
  "UDAWATTA": "Colombo",

  // Rathnapura
  "COLOMBO SPRIT": "Rathnapura",
  "PERERA": "Rathnapura",
  "RAKWANA": "Rathnapura",
};

// Accent color per Area, used ONLY for the Area section heading in
// OutletManagement.jsx (dark-theme friendly, distinct per Area).
export const AREA_COLORS = {
  "Badulla & Monaragala": "#f59e0b", // amber
  "Nuwara Eliya": "#3b82f6",         // blue
  "Colombo": "#a78bfa",              // purple
  "Rathnapura": "#34ce86",           // green
  [UNASSIGNED_AREA]: "#92d4ee",      // neutral blue 
};

const OVERRIDE_KEY = "outletAreaOverrides";

function readOverrides() {
  try {
    return JSON.parse(localStorage.getItem(OVERRIDE_KEY) || "{}");
  } catch {
    return {};
  }
}

/** Admin-assigned area for an outlet (new outlets, or a reassignment
 *  of an existing outlet's area). Stored locally only — never touches
 *  the outlet's identity/id/name/database record. */
export function setOutletAreaOverride(outletName, area) {
  const overrides = readOverrides();
  if (area) overrides[outletName] = area;
  else delete overrides[outletName];
  try { localStorage.setItem(OVERRIDE_KEY, JSON.stringify(overrides)); } catch {}
}

/** Resolve an outlet's Area: admin override first, then the static
 *  supplied mapping, then UNASSIGNED_AREA. Never guesses. */
export function getOutletArea(outletName) {
  const overrides = readOverrides();
  if (overrides[outletName]) return overrides[outletName];
  if (OUTLET_AREA_MAP[outletName]) return OUTLET_AREA_MAP[outletName];
  return UNASSIGNED_AREA;
}

/** Groups a flat outlet-name array into { areaName: [outlets...] },
 *  in AREAS order, with "Unassigned Area" last (only if non-empty). */
export function groupOutletsByArea(outletNames) {
  const groups = {};
  for (const a of AREAS) groups[a] = [];
  const unassigned = [];
  for (const name of outletNames) {
    const area = getOutletArea(name);
    if (area === UNASSIGNED_AREA) unassigned.push(name);
    else (groups[area] || (groups[area] = [])).push(name);
  }
  if (unassigned.length) groups[UNASSIGNED_AREA] = unassigned;
  return groups;
}
