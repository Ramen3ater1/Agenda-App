export default function ImportLocalDataPrompt({
  onImport, onDismiss,
}: { onImport: () => void; onDismiss: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-6" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
      <div className="w-full max-w-[380px] rounded-xl bg-card border border-border p-6 shadow-2xl">
        <h2 className="text-lg font-semibold tracking-tight mb-1.5">导入本地数据？</h2>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          检测到本设备有未同步的本地数据。要把它导入到你的账号（跨设备可见），还是从空白开始？
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={onImport}
            className="w-full px-4 py-2.5 rounded-md bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            导入到我的账号
          </button>
          <button
            onClick={onDismiss}
            className="w-full px-4 py-2.5 rounded-md border border-border text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            从空白开始
          </button>
        </div>
      </div>
    </div>
  );
}
