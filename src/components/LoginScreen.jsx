import { useState } from "react";
import { OUTLETS, SEED_CLERKS } from "../data/seeds";
import { ls } from "../utils/helpers";
import { I } from "../utils/icons";

export default function LoginScreen({ onLogin }) {
  const [tab, setTab]       = useState("admin");
  const [form, setForm]     = useState({ outlet: "", username: "", password: "" });
  const [showPw, setShowPw] = useState(false);
  const [err, setErr]       = useState("");

  function submit() {
    setErr("");
    const u = (form.username || "").trim().toLowerCase();
    const p = (form.password || "").trim();
    if (tab === "admin") {
      if (u === "admin" && p === "admin123") onLogin({ role: "admin", username: "admin" });
      else setErr("Wrong credentials. Try again");
    } else {
      if (!form.outlet) { setErr("Select your outlet first."); return; }
      const clerks = ls("clerks", SEED_CLERKS);
      const c = clerks.find(x => x.username.toLowerCase() === u && x.password === p && x.outlet === form.outlet);
      if (c) onLogin({ role: "staff", ...c });
      else setErr(`No match. Check outlet, username & password.\nHint: outlet=CARVELLO, user=kishobana, pass=pass123`);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="login-logo">
          <div className="login-mark">{I.shield}</div>
          <h1>Accounts Manager</h1>
          <p>Multi-Outlet Financial System</p>
        </div>
        <div className="tabs">
          <button className={`tab ${tab === "admin" ? "act" : ""}`} onClick={() => { setTab("admin"); setErr(""); }}>Admin</button>
          <button className={`tab ${tab === "staff" ? "act" : ""}`} onClick={() => { setTab("staff"); setErr(""); }}>Staff / Clerk</button>
        </div>
        {err && <div className="err-box">{err}</div>}
        {tab === "staff" && (
          <div className="field">
            <label>Outlet</label>
            <div className="iw">
              <span className="iw-ic">{I.bldg}</span>
              <select value={form.outlet} onChange={e => setForm({ ...form, outlet: e.target.value })}>
                <option value="">Select outlet…</option>
                {OUTLETS.map(o => <option key={o}>{o}</option>)}
              </select>
            </div>
          </div>
        )}
        <div className="field">
          <label>Username</label>
          <div className="iw">
            <span className="iw-ic">{I.user}</span>
            <input value={form.username}
              onChange={e => setForm({ ...form, username: e.target.value })}
              placeholder={tab === "admin" ? "admin" : "your username"}
              onKeyDown={e => e.key === "Enter" && submit()} />
          </div>
        </div>
        <div className="field">
          <label>Password</label>
          <div className="iw">
            <span className="iw-ic">{I.lock}</span>
            <input type={showPw ? "text" : "password"} value={form.password}
              onChange={e => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••" onKeyDown={e => e.key === "Enter" && submit()} />
            <button className="eye-btn" onClick={() => setShowPw(!showPw)}>{showPw ? I.eyeOff : I.eye}</button>
          </div>
        </div>
        <button className="btn-login" onClick={submit}>Sign In →</button>
        {tab === "admin" && <p style={{ fontSize: 11, color: "var(--muted)", textAlign: "center", marginTop: 12 }}>Default: admin / admin123</p>}
      </div>
    </div>
  );
}
