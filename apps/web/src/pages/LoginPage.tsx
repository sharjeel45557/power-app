import { Navigate, useLocation } from "react-router-dom";
import { Button, Card, Spinner } from "../components/ui";
import { useAuth } from "../lib/auth";

export function LoginPage() {
  const { user, loading, login } = useAuth();
  const location = useLocation();
  const returnTo =
    (location.state as { from?: string } | null)?.from ?? "/";

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (user) return <Navigate to={returnTo} replace />;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-6 p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
            P
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              Welcome to power-app
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sign in with your organization account to continue.
            </p>
          </div>
          <Button className="w-full" onClick={() => login(returnTo)}>
            Sign in with Microsoft
          </Button>
        </div>
      </Card>
    </div>
  );
}
