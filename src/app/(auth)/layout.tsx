import type { ReactNode } from "react";

const AuthLayout = ({ children }: { children: ReactNode }): ReactNode => {
  return <div>{children}</div>;
};

export default AuthLayout;
