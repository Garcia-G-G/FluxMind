import type { ReactNode } from "react";

const MarketingLayout = ({ children }: { children: ReactNode }): ReactNode => {
  return <div className="relative">{children}</div>;
};

export default MarketingLayout;
