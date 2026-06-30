import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "@/store/AuthProvider";
import AuthGuard from "@/routes/AuthGuard";
import ProtectedProviders from "@/routes/ProtectedProviders";
import Layout from "@/routes/Layout";
import PlannerRoute from "@/routes/PlannerRoute";
import TaskRoute from "@/routes/TaskRoute";
import LoginRoute from "@/routes/LoginRoute";
import SignupRoute from "@/routes/SignupRoute";

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginRoute />} />
            <Route path="/signup" element={<SignupRoute />} />
            <Route element={<AuthGuard />}>
              <Route element={<ProtectedProviders />}>
                <Route element={<Layout />}>
                  <Route index element={<Navigate to="/planner/all" replace />} />
                  <Route path="planner/:where" element={<PlannerRoute />} />
                  <Route path="task/:taskId" element={<TaskRoute />} />
                  {/* Legacy redirects */}
                  <Route path="today" element={<Navigate to="/planner/all?level=day&view=checklist" replace />} />
                  <Route path="all" element={<Navigate to="/planner/all" replace />} />
                  <Route path="calendar" element={<Navigate to="/planner/all?view=calendar" replace />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/planner/all" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
