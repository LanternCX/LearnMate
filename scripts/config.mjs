import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export const root = fileURLToPath(new URL("../", import.meta.url));
const clientRoot = resolve(root, "apps/client");

// Build tools read client settings only. The Go server loads its own YAML.
export function loadClientConfig({ path, env = process.env } = {}) {
  const configPath = resolve(clientRoot, path ?? env.ZHIYA_CLIENT_CONFIG ?? "config.json");
  let config;
  try { config = JSON.parse(readFileSync(configPath, "utf8")); }
  catch { throw new Error("Cannot read client configuration JSON"); }
  const fields = ["api_origin", "dev_origin", "request_timeout_seconds"];
  if (!config || typeof config !== "object" || Array.isArray(config) ||
      Object.keys(config).some(key => !fields.includes(key))) {
    throw new Error("Unknown client configuration field");
  }
  const known = new Set(["ZHIYA_CLIENT_CONFIG"]);
  for (const key of fields) {
    const name = "ZHIYA_CLIENT_" + key.toUpperCase();
    known.add(name);
    if (Object.hasOwn(env, name)) {
      config[key] = key === "request_timeout_seconds" ? Number(env[name]) : env[name];
    }
  }
  for (const name of Object.keys(env)) {
    if (name.startsWith("ZHIYA_CLIENT_") && !known.has(name)) {
      throw new Error("Unknown client configuration environment variable " + name);
    }
  }
  if (!Number.isInteger(config.request_timeout_seconds) ||
      config.request_timeout_seconds < 1 || config.request_timeout_seconds > 3600) {
    throw new Error("Client request_timeout_seconds must be an integer from 1 to 3600");
  }
  validateOrigin(config.api_origin, false);
  validateOrigin(config.dev_origin, true);
  return { config, configPath };
}

function validateOrigin(value, development) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error("Invalid client origin"); }
  if (!["http:", "https:"].includes(url.protocol) || value !== url.origin ||
      url.username || url.password) throw new Error("Client origins must not contain paths or credentials");
  if (development && url.protocol !== "http:") throw new Error("Development origin must use HTTP");
  if ((development || url.protocol === "http:") &&
      !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) {
    throw new Error("HTTP client origins must use loopback");
  }
}

export function publicBuildConfig(config) {
  return { requestTimeoutMilliseconds: config.request_timeout_seconds * 1000 };
}
