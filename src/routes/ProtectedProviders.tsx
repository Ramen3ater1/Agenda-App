import { Outlet } from "react-router";
import { TaskProvider } from "@/store/TaskProvider";
import { TimerProvider } from "@/store/TimerProvider";
import { GoogleSyncProvider } from "@/store/GoogleSyncProvider";

export default function ProtectedProviders() {
  return (
    <TaskProvider>
      <GoogleSyncProvider>
        <TimerProvider>
          <Outlet />
        </TimerProvider>
      </GoogleSyncProvider>
    </TaskProvider>
  );
}
