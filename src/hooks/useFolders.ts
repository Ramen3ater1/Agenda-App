import { useTaskStore } from "@/store/TaskProvider";
import { uid } from "@/lib/utils";

export function useFolders() {
  const { state, dispatch } = useTaskStore();
  return {
    folders: state.folders,
    createFolder: (name: string): string => {
      const id = uid();
      dispatch({ type: "ADD_FOLDER", folder: { id, name } });
      return id;
    },
    renameFolder: (id: string, name: string) => dispatch({ type: "RENAME_FOLDER", id, name }),
    deleteFolder: (id: string) => dispatch({ type: "DELETE_FOLDER", id }),
  };
}
