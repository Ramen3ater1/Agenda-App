import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import ErrorBoundary from "@/components/ErrorBoundary";
import { AuthProvider } from "@/store/AuthProvider";
import AuthGuard from "@/routes/AuthGuard";
import ProtectedProviders from "@/routes/ProtectedProviders";
import Layout from "@/routes/Layout";
import ListRoute from "@/routes/ListRoute";
import CalendarRoute from "@/routes/CalendarRoute";
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
                  <Route index element={<Navigate to="/today" replace />} />
                  <Route path="today" element={<ListRoute scope="today" />} />
                  <Route path="all" element={<ListRoute scope="all" />} />
                  <Route path="folder/:folderId" element={<ListRoute scope="folder" />} />
                  <Route path="calendar" element={<CalendarRoute />} />
                  <Route path="task/:taskId" element={<TaskRoute />} />
                </Route>
              </Route>
            </Route>
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  );
}
