import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { Layout } from "./components/Layout";
import { Spinner } from "./components/ui";
import { useAuth } from "./lib/auth";
import { DashboardPage } from "./pages/DashboardPage";
import { ResourceFormPage } from "./pages/ResourceFormPage";
import { ResourceListPage } from "./pages/ResourceListPage";
import { LoginPage } from "./pages/LoginPage";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<DashboardPage />} />

        {/* Native entities */}
        <Route path="/e/:name" element={<ResourceListPage kind="entities" />} />
        <Route path="/e/:name/new" element={<ResourceFormPage kind="entities" />} />
        <Route path="/e/:name/:id" element={<ResourceFormPage kind="entities" />} />

        {/* External connectors */}
        <Route path="/c/:name" element={<ResourceListPage kind="connectors" />} />
        <Route path="/c/:name/new" element={<ResourceFormPage kind="connectors" />} />
        <Route path="/c/:name/:id" element={<ResourceFormPage kind="connectors" />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
