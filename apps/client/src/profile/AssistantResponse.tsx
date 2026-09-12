import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "../components/ai-elements/reasoning";
import {
  Message,
  MessageContent,
  MessageResponse,
} from "../components/ai-elements/message";
import { Shimmer } from "../components/ai-elements/shimmer";
import { BrainIcon } from "lucide-react";
import type { AssistantOutput } from "../domain/learning";

export default function AssistantResponse({
  output,
  active,
  stopped = false,
}: {
  output: AssistantOutput;
  active: boolean;
  stopped?: boolean;
}) {
  return (
    <div className="ai-elements w-full">
      {output.reasoning ? (
        <Reasoning isStreaming={output.isReasoning}>
          <ReasoningTrigger
            className="assistant-thinking"
            getThinkingMessage={(streaming, seconds) =>
              streaming ? (
                <Shimmer duration={1}>正在思考…</Shimmer>
              ) : (
                <span>
                  {seconds === undefined ? "已思考" : `已思考 ${seconds} 秒`}
                </span>
              )
            }
          />
          <ReasoningContent className="assistant-reasoning-content">
            {output.reasoning}
          </ReasoningContent>
        </Reasoning>
      ) : (active || stopped) && !output.text ? (
        <div
          className="assistant-thinking assistant-waiting"
          data-stopped={stopped}
          role="status"
          aria-label={stopped ? "已停止" : "正在思考"}
        >
          <BrainIcon aria-hidden="true" />
          {stopped ? (
            <span>已停止</span>
          ) : (
            <Shimmer duration={1}>思考中</Shimmer>
          )}
        </div>
      ) : null}
      {output.text && (
        <Message from="assistant">
          <MessageContent>
            <MessageResponse>{output.text}</MessageResponse>
          </MessageContent>
        </Message>
      )}
    </div>
  );
}
