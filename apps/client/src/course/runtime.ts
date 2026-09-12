import { CourseSession } from "../pi";
import type { ModelGateway } from "../pi";
import { modelRequest, courseModelRequest } from "../transport/model";

const gateway: ModelGateway = {
  onboarding: modelRequest,
  course: courseModelRequest,
};

type CourseArguments = ConstructorParameters<typeof CourseSession> extends [
  ModelGateway,
  ...infer Arguments,
] ? Arguments : never;

export function createCourseSession(...args: CourseArguments) {
  return new CourseSession(gateway, ...args);
}
