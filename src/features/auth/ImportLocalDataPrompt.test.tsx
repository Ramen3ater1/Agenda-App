import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ImportLocalDataPrompt from "@/features/auth/ImportLocalDataPrompt";

describe("ImportLocalDataPrompt", () => {
  it("fires onImport and onDismiss from the two buttons", () => {
    const onImport = vi.fn();
    const onDismiss = vi.fn();
    render(<ImportLocalDataPrompt onImport={onImport} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole("button", { name: /导入/ }));
    expect(onImport).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /空白/ }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
