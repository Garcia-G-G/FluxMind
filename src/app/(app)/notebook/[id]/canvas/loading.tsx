import type { ReactNode } from "react";

const CanvasLoading = (): ReactNode => {
  return (
    <div className="h-full -m-4 relative fm-fade-in">
      <div
        className="fm-skel-bar"
        style={{ width: "100%", height: "100%", borderRadius: 0 }}
      />
    </div>
  );
};

export default CanvasLoading;
