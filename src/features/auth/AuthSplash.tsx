import logo from "@/assets/logo.png";

export default function AuthSplash() {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-background"
      style={{ fontFamily: "'Instrument Sans', sans-serif" }}
    >
      <div className="flex flex-col items-center gap-4">
        <img src={logo} alt="Agenda" className="size-9 rounded-lg animate-pulse" />
        <span className="text-xs text-muted-foreground">Loading…</span>
      </div>
    </div>
  );
}
