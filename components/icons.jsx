function MatIcon({ name, size = 16 }) {
  return (
    <span className="material-symbols-sharp" style={{ fontSize: size }}>
      {name}
    </span>
  );
}

export function IconSend() {
  return <MatIcon name="send" />;
}
export function IconCheck() {
  return <MatIcon name="check_circle" />;
}
export function IconLink() {
  return <MatIcon name="link" />;
}
export function IconWhatsapp() {
  // Material Symbols doesn't include brand icons (WhatsApp), so "chat" stands in —
  // the button label text already says "WA Invoice" / "Kirim via WA", so intent is still clear.
  return <MatIcon name="chat" />;
}
export function IconDownload() {
  return <MatIcon name="download" />;
}
export function IconPlus() {
  return <MatIcon name="add" />;
}
export function IconLock() {
  return <MatIcon name="lock" />;
}
export function IconDelete() {
  return <MatIcon name="delete" />;
}
