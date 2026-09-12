export type Question = {
  id: string;
  text: string;
  description?: string;
  kind: "single" | "multiple" | "text";
  options: string[];
};
export type Answer = { selected: string[]; text: string; skipped: boolean };
export type ModelInfo = { id: string; available: boolean };
export type AssistantOutput = {
  text: string;
  reasoning: string;
  isReasoning: boolean;
};

export type Slide = {
  id: string;
  title: string;
  kicker?: string;
  body: string;
  bullets: string[];
  layout: "explain" | "steps" | "compare";
};

export type CourseMessage = {
  id: number;
  role: "user" | "assistant";
  text: string;
  streaming?: boolean;
  slideId?: string;
};

export type CourseActivity =
  | { kind: "thinking"; text: string; active: boolean }
  | {
      kind: "tool";
      name: string;
      label: string;
      status: "running" | "complete" | "error";
    };

export type CourseConversationState = {
  messages: CourseMessage[];
  slides: Slide[];
  presentedSlideIds: string[];
  currentSlideId: string;
};

export type CourseCover = {
  motif:
    | "code"
    | "orbit"
    | "geometry"
    | "language"
    | "nature"
    | "history"
    | "abstract";
  palette: "sprout" | "sunrise" | "ocean" | "berry" | "clay";
  label: string;
};

export type StoredCourse = {
  id: string;
  conversationId: string;
  title: string;
  topic: string;
  cover: CourseCover;
  status: "active";
  state: CourseConversationState;
  createdAt: string;
  updatedAt: string;
};

export type ModelRetryStatus = { attempt: number; maxRetries: number };
export type ModelRetryListener = (status: ModelRetryStatus | null) => void;

export type ConversationView = {
  id: string;
  question: Question | null;
  completed: boolean;
  correctionEnded: boolean;
  memory: string;
  revision: number;
  status: "idle" | "running" | "waiting";
  leaseUntil: string;
  messageCount: number;
  lastAssistant: boolean;
  output: AssistantOutput;
  correction: { answered: boolean; saved: boolean } | null;
};
