import { describe, expect, it, vi } from "vitest";
import { requestReply } from "../src/reply-service";
import type { ModelConfig, ReplyContext } from "../src/reply-model";

const config: ModelConfig = {
  baseUrl: "https://api.example.com/v1", model: "reply-model", apiKey: "secret",
  language: "中文", tone: "自然",
};
const context: ReplyContext = {
  name: "作者", handle: "alice", topic: "留言", language: "中文", tone: "自然",
};

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status, headers: { "content-type": "application/json" },
  });
}

describe("reply service", () => {
  it("sends only after the endpoint permission is granted", async () => {
    const send = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>(
      async () => response(200, { choices: [{ message: { content: "好的" } }] }),
    );
    await expect(requestReply(config, context, async () => true, send)).resolves.toBe("好的");
    expect(send).toHaveBeenCalledOnce();
    expect(JSON.parse(send.mock.calls[0][1]?.body as string).messages).toHaveLength(2);
  });

  it("classifies common endpoint failures", async () => {
    for (const [status, message] of [[401, "API Key"], [403, "拒绝"], [429, "限流"]] as const) {
      await expect(requestReply(config, context, async () => true,
        async () => response(status, {}))).rejects.toThrow(message);
    }
    await expect(requestReply(config, context, async () => true,
      async () => new Response("{bad", { status: 200 }))).rejects.toThrow("JSON");
  });

  it("does not send when permission is refused and reports timeout", async () => {
    const send = vi.fn(async () => response(200, {}));
    await expect(requestReply(config, context, async () => false, send)).rejects.toThrow("未授权");
    expect(send).not.toHaveBeenCalled();
    await expect(requestReply(config, context, async () => true,
      (_url, init) => new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
      }), 5)).rejects.toThrow("超时");
  });
});
