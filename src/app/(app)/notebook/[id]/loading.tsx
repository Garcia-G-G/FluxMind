import type { ReactNode } from "react";

const NotebookLoading = (): ReactNode => {
  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 md:-m-6 fm-fade-in">
      <div
        className="hidden md:block w-80 lg:w-[340px] shrink-0"
        style={{
          borderRight: "1px solid var(--fm-surface-border)",
          background: "var(--fm-bg-secondary, var(--fm-bg))",
        }}
      >
        <div className="p-4 space-y-3">
          <div className="fm-skel-bar" style={{ height: 18, width: "30%" }} />
          <div className="fm-skel-bar" style={{ height: 40 }} />
          <div className="space-y-2 pt-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="fm-skel-bar" style={{ height: 36 }} />
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 p-4 gap-3">
        <div className="flex gap-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="fm-skel-bar"
              style={{ height: 32, width: 96, borderRadius: 8 }}
            />
          ))}
        </div>
        <div
          className="fm-skel-bar mt-4"
          style={{ height: "70vh", borderRadius: 16 }}
        />
      </div>
    </div>
  );
};

export default NotebookLoading;
