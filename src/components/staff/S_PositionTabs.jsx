import { useState } from "react";
import S_Position from "./S_Position";
import S_StaffLoan from "./S_StaffLoan";
export default function S_PositionTabs(props) {
  const [tab, setTab] = useState("entry");
  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }} className="no-print">
        <button className={"btn btnsm" + (tab === "entry" ? " btng" : "")} onClick={() => setTab("entry")}>New Position Entry</button>
        <button className={"btn btnsm" + (tab === "loan" ? " btng" : "")} onClick={() => setTab("loan")}>Staff Loan Details</button>
      </div>
      {tab === "entry" ? <S_Position {...props} /> : <S_StaffLoan {...props} />}
    </div>
  );
}