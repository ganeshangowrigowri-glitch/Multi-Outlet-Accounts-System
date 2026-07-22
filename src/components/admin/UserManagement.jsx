import { useState } from "react";
import { deleteClerk } from "../../db";
import { I } from "../../utils/icons";
import { DESIGNATIONS, ACCESS_OPTIONS } from "../../data/seeds";
import Modal from "../shared/Modal";
import DesigBadge from "../shared/DesigBadge";

export default function UserManagement({ clerks, setClerks, outlets, toast_ }) {
  const [modal,   setModal]   = useState(null);
  const [form,    setForm]    = useState({});
  const [showPw,  setShowPw]  = useState(false);
  const [search,  setSearch]  = useState("");

  function openAdd() {
    setForm({ username:"", password:"", designation:"Subject Clerk", outlets:[], access:"All windows" });
    setModal("add");
  }
  function openEdit(c) {
    // backward compat: if old data has single outlet string, convert to array
    const outletArr = Array.isArray(c.outlets)
      ? c.outlets
      : c.outlet ? [c.outlet] : [];
    // Don't pre-fill the password field with the stored hash — leaving it
    // blank means "keep the existing password unchanged".
    setForm({ ...c, password: "", outlets: outletArr });
    setModal(c);
  }

  function toggleOutlet(o) {
    const current = form.outlets || [];
    if (current.includes(o)) {
      setForm({ ...form, outlets: current.filter(x => x !== o) });
    } else {
      if (current.length >= 10) { toast_("Maximum 10 outlets allowed", "err"); return; }
      setForm({ ...form, outlets: [...current, o] });
    }
  }

  function saveClerk() {
    if (!form.username) { toast_("Fill username", "err"); return; }
    if (modal === "add" && !form.password) { toast_("Set a password", "err"); return; }
    if (!form.outlets || form.outlets.length === 0) { toast_("Select at least 1 outlet", "err"); return; }
    if (form.outlets.length > 10) { toast_("Maximum 10 outlets allowed", "err"); return; }

    const saveData = {
      ...form,
      outlets: form.outlets,
      outlet: form.outlets[0], // keep first outlet as primary for backward compat
    };
    // Editing with a blank password field = keep the existing hash unchanged.
    if (modal !== "add" && !form.password) {
      saveData.password = modal.password_hash;
    }

    if (modal === "add") {
      if (clerks.find(c => c.username.toLowerCase() === form.username.toLowerCase())) {
        toast_("Username exists", "err"); return;
      }
      setClerks([...clerks, { ...saveData }]);
      toast_(`"${form.username}" added ✓`);
    } else {
      setClerks(clerks.map(c => c.id === modal.id ? { ...c, ...saveData } : c));
      toast_("Updated ✓");
    }
    setModal(null);
  }

  const filtered = clerks.filter(c =>
    c.username.toLowerCase().includes(search.toLowerCase()) ||
    (Array.isArray(c.outlets) ? c.outlets.join(" ") : c.outlet || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <div className="ctrls">
        <div className="sbox">{I.search}<input placeholder="Search name, outlet…" value={search} onChange={e=>setSearch(e.target.value)}/></div>
        <div style={{marginLeft:"auto"}}>
          <button className="btn btng" onClick={openAdd}>{I.plus} Add Staff</button>
        </div>
      </div>

      <div className="card">
        <div className="chd"><h3>All Staff</h3><p>{filtered.length} shown</p></div>
        <table className="tbl">
          <thead>
            <tr><th>Username</th><th>Designation</th><th>Outlets</th><th>Access</th><th></th></tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={5}><div className="empty">No staff found.</div></td></tr>}
            {filtered.map(c => {
              const outletList = Array.isArray(c.outlets) ? c.outlets : c.outlet ? [c.outlet] : [];
              return (
                <tr key={c.id}>
                  <td>
                    <div style={{display:"flex",alignItems:"center",gap:7}}>
                      <div style={{width:25,height:25,borderRadius:6,background:"var(--s3)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:9.5,fontWeight:700,color:"var(--blu)",flexShrink:0}}>
                        {c.username.slice(0,2).toUpperCase()}
                      </div>
                      <span className="bold">{c.username}</span>
                    </div>
                  </td>
                  <td><DesigBadge d={c.designation}/></td>
                  <td>
                    <div style={{display:"flex",flexWrap:"wrap",gap:3}}>
                      {outletList.slice(0,3).map(o => (
                        <span key={o} style={{fontSize:9.5,fontWeight:600,padding:"1px 6px",borderRadius:10,background:"var(--gd)",color:"var(--gld2)",border:"1px solid rgba(245,158,11,.2)"}}>
                          {o}
                        </span>
                      ))}
                      {outletList.length > 3 && (
                        <span style={{fontSize:9.5,color:"var(--mut)",padding:"1px 4px"}}>
                          +{outletList.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{fontSize:11,color:"var(--mut)"}}>{c.access}</td>
                  <td>
                    <div style={{display:"flex",gap:2}}>
                      <button className="btngh btnsm" onClick={()=>openEdit(c)}>{I.edit}</button>
                      <button className="btndel btnsm" onClick={async ()=>{
                       if(!confirm(`Remove "${c.username}"?`))return;
                       await deleteClerk(c.id);
                       setClerks(clerks.filter(x=>x.id!==c.id));
                       toast_("Removed");
                       }}>{I.trash}</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal
          title={modal === "add" ? "Add Staff" : "Edit Staff"}
          onClose={() => setModal(null)}
          footer={<>
            <button className="btn btnd" onClick={() => setModal(null)}>Cancel</button>
            <button className="btn btng" onClick={saveClerk}>{I.check} {modal==="add"?"Add":"Save"}</button>
          </>}
        >
          <div className="fg">
            <div className="ff">
              <label>Username *</label>
              <input value={form.username} onChange={e=>setForm({...form,username:e.target.value})} placeholder="username"/>
            </div>
            <div className="ff">
              <label>Password {modal==="add" ? "*" : ""}</label>
              <div className="pww">
                <input type={showPw?"text":"password"} value={form.password}
                  onChange={e=>setForm({...form,password:e.target.value})}
                  placeholder={modal==="add" ? "••••••••" : "Leave blank to keep current password"}/>
                <button className="pweye" onClick={()=>setShowPw(!showPw)}>
                  {showPw ? I.eyeOff : I.eye}
                </button>
              </div>
            </div>
            <div className="ff">
              <label>Designation</label>
              <select value={form.designation} onChange={e=>setForm({...form,designation:e.target.value})}>
                {DESIGNATIONS.map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="ff">
              <label>Access</label>
              <select value={form.access} onChange={e=>setForm({...form,access:e.target.value})}>
                {ACCESS_OPTIONS.map(a=><option key={a}>{a}</option>)}
              </select>
            </div>
          </div>

          {/* Outlet Multi-Select */}
          <div className="ff full" style={{marginTop:4}}>
            <label>
              Outlets * 
              <span style={{fontWeight:400,color:"var(--mut)",textTransform:"none",letterSpacing:0,marginLeft:6}}>
                ({(form.outlets||[]).length}/10 selected)
              </span>
            </label>

            {/* Selected outlets preview */}
            {(form.outlets||[]).length > 0 && (
              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:8,marginTop:4}}>
                {(form.outlets||[]).map(o => (
                  <span key={o} style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:10,fontWeight:600,padding:"2px 7px",borderRadius:10,background:"var(--gd)",color:"var(--gld2)",border:"1px solid rgba(245,158,11,.3)"}}>
                    {o}
                    <button onClick={()=>toggleOutlet(o)} style={{background:"none",border:"none",cursor:"pointer",color:"var(--gld2)",padding:0,fontSize:11,lineHeight:1}}>×</button>
                  </span>
                ))}
              </div>
            )}

            {/* Scrollable outlet checkbox list */}
            <div style={{maxHeight:180,overflowY:"auto",border:"1px solid var(--bdr)",borderRadius:7,background:"var(--s2)"}}>
              {outlets.map(o => {
                const selected = (form.outlets||[]).includes(o);
                return (
                  <div key={o}
                    onClick={() => toggleOutlet(o)}
                    style={{display:"flex",alignItems:"center",gap:9,padding:"7px 11px",cursor:"pointer",borderBottom:"1px solid rgba(63,63,70,.3)",background:selected?"var(--gd)":"transparent",transition:"background .1s"}}
                  >
                    <div style={{width:14,height:14,borderRadius:3,border:`2px solid ${selected?"var(--gld)":"var(--bdr2)"}`,background:selected?"var(--gld)":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all .1s"}}>
                      {selected && <svg viewBox="0 0 10 8" width="8" height="8"><polyline points="1 4 3.5 6.5 9 1" fill="none" stroke="#000" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                    </div>
                    <span style={{fontSize:12,fontWeight:selected?600:400,color:selected?"var(--gld2)":"var(--txt)"}}>{o}</span>
                  </div>
                );
              })}
            </div>
            <div style={{fontSize:10,color:"var(--mut)",marginTop:4}}>Click to select/deselect. Maximum 10 outlets per staff.</div>
          </div>
        </Modal>
      )}
    </>
  );
}
