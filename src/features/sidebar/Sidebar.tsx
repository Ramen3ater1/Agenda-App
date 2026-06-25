import { useState } from "react";
import { CalendarDays, Plus, Trash2, Folder, Sun, Layers, LogOut } from "lucide-react";
import { isTodayTask } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { useAuth } from "@/store/AuthProvider";
import type { Folder as FolderType, Task, SmartList } from "@/types";

export default function Sidebar({
  activeList, onSelectList, folders, tasks,
  onCreateFolder, onRenameFolder, onDeleteFolder,
  timerRunning, timerDisplay, timerTaskName,
}: {
  activeList: string;
  onSelectList: (id: string) => void;
  folders: FolderType[];
  tasks: Task[];
  onCreateFolder: (name: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  timerRunning: boolean;
  timerDisplay: string;
  timerTaskName: string;
}) {
  const { user, signOut } = useAuth();
  const email = user?.email ?? "";
  const initial = email ? email[0]!.toUpperCase() : "?";
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const todayCount = tasks.filter(isTodayTask).length;
  const activeCount = tasks.filter(t => t.status !== "done").length;

  function submitNew() {
    if (!newName.trim()) return;
    onCreateFolder(newName.trim());
    setNewName(""); setAdding(false);
  }
  function submitRename(id: string) {
    if (editName.trim()) onRenameFolder(id, editName.trim());
    setEditingId(null);
  }

  const smartItem = (id: SmartList, icon: React.ReactNode, label: string, count?: number) => {
    const isActive = activeList === id;
    return (
      <button
        onClick={() => onSelectList(id)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
          isActive ? "bg-accent text-white" : "text-[#9E9E9C] hover:bg-sidebar-accent hover:text-sidebar-foreground"
        }`}
      >
        {icon}
        <span className="flex-1 text-left">{label}</span>
        {count != null && count > 0 && (
          <span className={`text-[11px] font-mono ${isActive ? "text-white/70" : "text-[#6B6B68]"}`}>{count}</span>
        )}
      </button>
    );
  };

  const groupHeading = "px-3 pt-4 pb-1.5 text-[10px] uppercase tracking-[0.12em] text-[#6B6B68] font-semibold select-none";

  return (
    <aside className="w-[240px] shrink-0 bg-sidebar flex flex-col h-screen sticky top-0">
      <div className="px-5 pt-6 pb-5 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <img src={logo} alt="Agenda" className="size-7 rounded" />
          <span className="text-sidebar-foreground font-semibold text-[15px] tracking-tight">Agenda</span>
        </div>
        <p className="text-[11px] text-[#6B6B68] mt-2 leading-snug">Plan, track, and finish your work.</p>
      </div>

      <nav className="flex-1 px-2.5 py-2 overflow-y-auto">
        {smartItem("today", <Sun size={16} />, "Today", todayCount)}
        {smartItem("all", <Layers size={16} />, "All", activeCount)}
        {smartItem("calendar", <CalendarDays size={16} />, "Calendar")}

        <div className="flex items-center justify-between pr-1">
          <div className={groupHeading}>Lists</div>
          <button
            onClick={() => setAdding(v => !v)}
            title="New list"
            className="size-5 flex items-center justify-center rounded text-[#6B6B68] hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>

        {adding && (
          <div className="px-2 py-1">
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") submitNew(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
              onBlur={() => { if (!newName.trim()) setAdding(false); }}
              placeholder="List name…"
              className="w-full px-2 py-1 bg-sidebar-accent border border-sidebar-border rounded text-xs text-sidebar-foreground outline-none placeholder:text-[#555553]"
            />
          </div>
        )}

        {folders.map(f => {
          const isActive = activeList === f.id;
          const count = tasks.filter(t => t.folderId === f.id && t.status !== "done").length;
          if (editingId === f.id) {
            return (
              <div key={f.id} className="px-2 py-1">
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") submitRename(f.id); if (e.key === "Escape") setEditingId(null); }}
                  onBlur={() => submitRename(f.id)}
                  className="w-full px-2 py-1 bg-sidebar-accent border border-sidebar-border rounded text-xs text-sidebar-foreground outline-none"
                />
              </div>
            );
          }
          return (
            <div
              key={f.id}
              onClick={() => onSelectList(f.id)}
              onDoubleClick={() => { setEditingId(f.id); setEditName(f.name); }}
              className={`group w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm cursor-pointer transition-colors ${
                isActive ? "bg-accent text-white" : "text-[#9E9E9C] hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Folder size={15} className={isActive ? "text-white" : "text-amber-400/80"} />
              <span className="flex-1 text-left truncate">{f.name}</span>
              {count > 0 && (
                <span className={`text-[11px] font-mono group-hover:hidden ${isActive ? "text-white/70" : "text-[#6B6B68]"}`}>{count}</span>
              )}
              <button
                onClick={e => { e.stopPropagation(); onDeleteFolder(f.id); }}
                title="Delete list"
                className="hidden group-hover:flex shrink-0 text-[#6B6B68] hover:text-red-400"
              >
                <Trash2 size={12} />
              </button>
            </div>
          );
        })}
      </nav>

      {timerRunning && (
        <div className="mx-2.5 mb-3 px-3.5 py-3 rounded-md bg-sidebar-accent border border-sidebar-border">
          <div className="text-[9px] uppercase tracking-widest text-[#6B6B68] font-mono mb-1.5">Live Session</div>
          <div className="font-mono text-sidebar-foreground text-xl font-medium tracking-tight">{timerDisplay}</div>
          <div className="text-[11px] text-[#6B6B68] truncate mt-1">{timerTaskName}</div>
          <div className="flex items-center gap-1 mt-2">
            <div className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] text-emerald-400">Recording</span>
          </div>
        </div>
      )}
      <div className="px-4 py-4 border-t border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="size-7 rounded-full bg-accent/20 flex items-center justify-center text-xs font-semibold text-accent">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sidebar-foreground text-xs font-medium truncate">{email}</div>
            <button
              onClick={() => signOut()}
              className="mt-0.5 flex items-center gap-1 text-[#6B6B68] text-[11px] hover:text-sidebar-foreground transition-colors"
            >
              <LogOut size={11} /> Sign out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
