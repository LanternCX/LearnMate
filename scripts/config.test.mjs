import { test } from "node:test";
import assert from "node:assert/strict";
import { loadClientConfig, publicBuildConfig } from "./config.mjs";

test("client settings do not depend on backend configuration or credentials", () => {
  const { config } = loadClientConfig({ env: {
    ZHIYA_SERVER_CONFIG: "/does/not/exist.yaml",
    ZHIYA_SERVER_SMTP_PASSWORD: "private-smtp",
    ZHIYA_CLIENT_API_ORIGIN: "https://api.example.com",
    ZHIYA_CLIENT_DEV_ORIGIN: "http://127.0.0.1:11420",
    ZHIYA_CLIENT_REQUEST_TIMEOUT_SECONDS: "42",
  } });
  assert.deepEqual(config, {
    api_origin: "https://api.example.com",
    dev_origin: "http://127.0.0.1:11420",
    request_timeout_seconds: 42,
  });
  assert.deepEqual(publicBuildConfig(config), { requestTimeoutMilliseconds: 42000 });
});

test("client build rejects malformed settings", () => {
  for (const env of [
    { ZHIYA_CLIENT_REQUEST_TIMEOUT_SECONDS: "0" },
    { ZHIYA_CLIENT_REQUEST_TIMEOUT_SECONDS: "1.5" },
    { ZHIYA_CLIENT_API_ORIGIN: "https://user:secret@example.com" },
    { ZHIYA_CLIENT_API_ORIGIN: "https://example.com/api" },
    { ZHIYA_CLIENT_DEV_ORIGIN: "https://127.0.0.1:1420" },
    { ZHIYA_CLIENT_API_ORIGN: "https://example.com" },
  ]) assert.throws(() => loadClientConfig({ env }));
});
