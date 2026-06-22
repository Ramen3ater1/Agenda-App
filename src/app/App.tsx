import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import ErrorBoundary from "@/components/ErrorBoundary";
import { TaskProvider } from "@/store/TaskProvider";
import { TimerProvider } from "@/store/TimerProvider";
import Layout from "@/routes/Layout";
import ListRoute from "@/routes/ListRoute";
import CalendarRoute from "@/routes/CalendarRoute";
import TaskRoute from "@/routes/TaskRoute";
import WorkspaceRoute from "@/routes/WorkspaceRoute";
//import { supabase } from '@/lib/supabase'
//console.log(supabase)
//for testing supabase

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <TaskProvider>
          <TimerProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route index element={<Navigate to="/today" replace />} />
                <Route path="today" element={<ListRoute scope="today" />} />
                <Route path="all" element={<ListRoute scope="all" />} />
                <Route path="folder/:folderId" element={<ListRoute scope="folder" />} />
                <Route path="calendar" element={<CalendarRoute />} />
                <Route path="task/:taskId" element={<TaskRoute />} />
                <Route path="task/:taskId/workspace" element={<WorkspaceRoute />} />
                <Route path="*" element={<Navigate to="/today" replace />} />
              </Route>
            </Routes>
          </TimerProvider>
        </TaskProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
