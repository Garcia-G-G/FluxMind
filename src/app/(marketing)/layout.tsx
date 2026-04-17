import type { ReactNode } from "react";
import { AnimatedBackground } from "@/components/shared/animated-background";

const MarketingLayout = ({ children }: { children: ReactNode }): ReactNode => {
  return (
    <div className="relative">
      <AnimatedBackground />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default MarketingLayout;
