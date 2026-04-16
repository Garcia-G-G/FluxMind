import type { ReactNode } from "react";

const AppLayout = ({ children }: { children: ReactNode }): ReactNode => {
  return <div>{children}</div>;
};

export default AppLayout;
