import type { Conversation } from "@/lib/types";
import { PlusIcon, SettingsIcon, TrashIcon } from "./icons";

type Props = {
  open: boolean;
  conversations: Conversation[];
  activeId: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenSettings: () => void;
};

export default function Sidebar({
  open,
  conversations,
  activeId,
  onClose,
  onNewChat,
  onSelect,
  onDelete,
  onOpenSettings,
}: Props) {
  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/50 md:hidden" onClick={onClose} aria-hidden="true" />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-side p-3 transition-transform md:static md:z-auto md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Sidebar"
      >
        <div className="px-2 pb-3 pt-1 text-2xl font-extrabold tracking-tight">
          chat<span className="rounded bg-lol px-1.5 text-[#16152B]">LOL</span>
        </div>

        <button
          type="button"
          onClick={onNewChat}
          className="flex items-center gap-2 rounded-xl border border-line bg-panel px-3 py-2.5 font-semibold hover:border-brand"
        >
          <PlusIcon /> New chat
        </button>

        <nav className="mt-4 flex-1 overflow-y-auto" aria-label="Conversation history">
          <h2 className="px-2 text-sm font-semibold text-muted">History</h2>
          <p className="px-2 pb-2 text-xs text-muted">Saved on this device only.</p>
          {conversations.length === 0 ? (
            <p className="px-2 text-sm text-muted">No saved conversations yet. Send a message to start one.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {conversations.map((c) => (
                <li key={c.id} className="group relative">
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-current={c.id === activeId ? "true" : undefined}
                    className={`w-full truncate rounded-lg py-2 pl-3 pr-10 text-left text-sm ${
                      c.id === activeId ? "bg-panel font-semibold" : "hover:bg-panel/60"
                    }`}
                  >
                    {c.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id)}
                    aria-label={`Delete chat: ${c.title}`}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted hover:text-ink md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
                  >
                    <TrashIcon width={16} height={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </nav>

        <button
          type="button"
          onClick={onOpenSettings}
          className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-semibold hover:bg-panel"
        >
          <SettingsIcon /> Settings
        </button>
      </aside>
    </>
  );
}
