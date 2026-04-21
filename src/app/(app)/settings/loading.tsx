import type { ReactNode } from "react";

const SettingsLoading = (): ReactNode => {
  return (
    <div className="max-w-4xl mx-auto fm-fade-in">
      <div
        className="fm-skel-bar"
        style={{ height: 40, width: "30%", marginBottom: 24 }}
      />
      <div className="flex gap-2 mb-8">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="fm-skel-bar"
            style={{ height: 36, width: 108, borderRadius: 10 }}
          />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="fm-skel-bar"
            style={{ height: 72, borderRadius: 12 }}
          />
        ))}
      </div>
    </div>
  );
};

export default SettingsLoading;
