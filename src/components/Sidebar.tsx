type Props = {
  open: boolean;
  onClose: () => void;
  onNewChat: () => void;
};

export default function Sidebar({ open, onClose, onNewChat }: Props) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-ink/40 md:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-line bg-panel p-4 transition-transform md:static md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-4 text-2xl font-extrabold tracking-tight">
          chat<span className="rounded bg-lol px-1.5">LOL</span>
        </div>

        <button
          type="button"
          onClick={onNewChat}
          className="rounded-xl bg-brand px-4 py-2.5 text-left font-semibold text-white hover:opacity-90"
        >
          New chat
        </button>

        <nav className="mt-6 flex-1 overflow-y-auto" aria-label="Chat history">
          <p className="text-sm text-muted">Your chats will appear here.</p>
        </nav>
      </aside>
    </>
  );
}
