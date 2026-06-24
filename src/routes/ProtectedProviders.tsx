import { Outlet } from "react-router";
import { TaskProvider } from "@/store/TaskProvider";
import { TimerProvider } from "@/store/TimerProvider";

export default function ProtectedProviders() {
  return (
    <TaskProvider>
      <TimerProvider>
        <Outlet />
      </TimerProvider>
    </TaskProvider>
  );
}
