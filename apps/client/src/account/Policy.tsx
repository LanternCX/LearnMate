import { createContext, useContext } from "react";

export type AccountPolicy = {
  password_min_characters: number;
  password_max_bytes: number;
  nickname_max_characters: number;
  avatar_max_bytes: number;
  avatar_max_dimension: number;
  verification_code_digits: number;
  verification_ttl_seconds: number;
};

export const PolicyContext = createContext<AccountPolicy | null>(null);

export function usePolicy() {
  const policy = useContext(PolicyContext);
  if (!policy) throw new Error("Account rules must be loaded before rendering forms");
  return policy;
}
