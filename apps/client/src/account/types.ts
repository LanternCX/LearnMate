export type View =
  | "login"
  | "register"
  | "reset"
  | "profile"
  | "security"
  | "password"
  | "email"
  | "delete";
export type Flow = { id: string; email: string; sentAt: number };
