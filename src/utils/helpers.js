export const ls  = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
export const lss = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
export const fmt = n => Number(n || 0).toLocaleString("en-LK", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const uid  = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const today = () => new Date().toISOString().split("T")[0];
export const monthOf = d => (d || "").slice(0, 7);
export const oKey = (outlet, mod) => `${outlet}_${mod}`;

export const postCash = (outlet, entry) => {
  const k = oKey(outlet, "cash_ledger");
  lss(k, [...ls(k, []), { ...entry, id: uid() }]);
};
export const postBank = (outlet, entry) => {
  const k = oKey(outlet, "bank_ledger");
  lss(k, [...ls(k, []), { ...entry, id: uid() }]);
};
export const postGL = (outlet, entry) => {
  const k = oKey(outlet, "gl");
  lss(k, [...ls(k, []), { ...entry, id: uid() }]);
};
