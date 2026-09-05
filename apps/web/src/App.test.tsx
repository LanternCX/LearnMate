import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";

describe("LearnMate dashboard", () => {
  it("shows a clear next lesson and the three learning spaces", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "早上好，小航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /继续学习/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /课程学习/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /自由探索/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /AI 实验室/ })).toBeInTheDocument();
  });

  it("turns a student's question into visible feedback", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(screen.getByLabelText("向 LearnMate 提问"), "神经网络为什么能学习？");
    await user.click(screen.getByRole("button", { name: "开始探索" }));

    expect(screen.getByRole("status")).toHaveTextContent("已为你准备");
    expect(screen.getByLabelText("向 LearnMate 提问")).toHaveValue("");
  });
});
