import type { ReactNode } from "react";

const StudioLoading = (): ReactNode => {
  return (
    <div className="max-w-5xl mx-auto fm-fade-in">
      <div
        className="fm-skel-bar"
        style={{ height: 36, width: "20%", marginBottom: 8 }}
      />
      <div
        className="fm-skel-bar mb-8"
        style={{ height: 16, width: "45%" }}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="fm-skel-bar"
            style={{ height: 92, borderRadius: 12 }}
          />
        ))}
      </div>

      {Array.from({ length: 3 }).map((_, section) => (
        <div key={section} className="mb-6">
          <div
            className="fm-skel-bar"
            style={{ height: 14, width: 64, marginBottom: 12 }}
          />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="fm-skel-bar"
                style={{ height: 152, borderRadius: 16 }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default StudioLoading;
