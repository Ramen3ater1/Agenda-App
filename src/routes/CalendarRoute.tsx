import { useNavigate } from "react-router";
import CalendarView from "@/features/calendar";
import { useTasks } from "@/hooks/useTasks";
import { useTaskStore } from "@/store/TaskProvider";
import { GCAL_EVENTS } from "@/constants";

export default function CalendarRoute() {
  const navigate = useNavigate();
  const { tasks, addTask } = useTasks();
  const { state, dispatch } = useTaskStore();

  return (
    <CalendarView
      tasks={tasks}
      gcalEvents={GCAL_EVENTS}
      gcalConnected={state.gcalConnected}
      setGcalConnected={(v) => dispatch({ type: "SET_GCAL", connected: v })}
      onSelectTask={(id) => navigate(`/task/${id}?list=calendar`)}
      onAddTaskForDate={(date) => addTask("New task", { deadline: date })}
    />
  );
}
