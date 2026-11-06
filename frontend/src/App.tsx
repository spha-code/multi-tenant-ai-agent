import { useEffect, useRef } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import Layout from "./components/Layout";
import { FullLoading } from "./components/States";
import CallbackPage from "./pages/CallbackPage";
import CustomersPage from "./pages/CustomersPage";
import OrdersPage from "./pages/OrdersPage";
import ProfilePage from "./pages/ProfilePage";

/** Redirects anonymous users to Keycloak exactly once. */
function RequireAuth() {
  const { ready, user, signIn } = useAuth();
  const redirecting = useRef(false);

  useEffect(() => {
    if (ready && !user && !redirecting.current) {
      redirecting.current = true;
      void signIn();
    }
  }, [ready, user, signIn]);

  if (!ready || !user) return <FullLoading label="Checking your session…" />;
  return <Outlet />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Keycloak drops the authorization code here */}
          <Route path="/auth/callback" element={<CallbackPage />} />

          <Route element={<RequireAuth />}>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/orders" replace />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="customers" element={<CustomersPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
