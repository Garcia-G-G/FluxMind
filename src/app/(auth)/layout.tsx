import type { ReactNode } from "react";

const AuthLayout = ({ children }: { children: ReactNode }): ReactNode => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">FluxMind</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Knowledge intelligence platform
          </p>
        </div>
        {children}
      </div>
    </div>
  );
};

export default AuthLayout;
