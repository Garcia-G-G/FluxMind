import type { ReactNode } from "react";

const AppLoading = (): ReactNode => {
  return (
    <div className="max-w-6xl mx-auto fm-fade-in">
      <div
        className="mb-8 fm-skel-bar"
        style={{ height: 56, width: "40%", borderRadius: 14 }}
      />
      <div
        className="fm-skel-bar mb-10"
        style={{ height: 18, width: "25%", borderRadius: 8 }}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-10">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="fm-skel-bar"
            style={{ height: 118, borderRadius: 16 }}
          />
        ))}
      </div>

      <div
        className="fm-skel-bar mb-4"
        style={{ height: 28, width: "30%", borderRadius: 10 }}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="fm-skel-bar"
            style={{ height: 160, borderRadius: 16 }}
          />
        ))}
      </div>
    </div>
  );
};

export default AppLoading;
