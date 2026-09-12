import { CourseSession, LearningSession, conversationView } from "../pi";
import type { ModelGateway } from "../pi";
import type {
  Answer,
  AssistantOutput,
  ConversationView,
  ModelInfo,
  ModelRetryListener,
} from "../domain/learning";
import { modelRequest, courseModelRequest } from "../transport/model";
import { ConversationChannel } from "./channel";

const gateway: ModelGateway = {
  onboarding: modelRequest,
  course: courseModelRequest,
};

/** Own the business connection; expose presentation state to React and storage to PI. */
export class LearningConnection {
  private channel = new ConversationChannel();

  subscribe(listener: (state: ConversationView) => void) {
    return this.channel.subscribe((state) => listener(conversationView(state)));
  }

  async open() {
    return conversationView(await this.channel.open());
  }

  async answer(questionId: string, answer: Answer) {
    return conversationView(await this.channel.answer(questionId, answer));
  }

  async endCorrection() {
    return conversationView(await this.channel.endCorrection());
  }

  createSession(
    info: ModelInfo,
    update: (state: ConversationView) => void,
    output: (value: AssistantOutput) => void,
    onRetry: ModelRetryListener,
  ) {
    return new LearningSession(
      gateway,
      info,
      this.channel,
      (state) => update(conversationView(state)),
      output,
      onRetry,
    );
  }

  close() {
    this.channel.close();
  }
}

type CourseArguments = ConstructorParameters<typeof CourseSession> extends [
  ModelGateway,
  ...infer Arguments,
] ? Arguments : never;

export function createCourseSession(...args: CourseArguments) {
  return new CourseSession(gateway, ...args);
}
