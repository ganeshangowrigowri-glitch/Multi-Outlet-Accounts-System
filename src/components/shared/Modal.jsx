import { I } from "../../utils/icons";

export default function Modal({ title, onClose, children, footer }) {
  return (
    <div className="overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="mhd">
          <h3>{title}</h3>
          <button className="mclose" onClick={onClose}>{I.x}</button>
        </div>
        <div className="mbody">{children}</div>
        {footer && <div className="mfoot">{footer}</div>}
      </div>
    </div>
  );
}
