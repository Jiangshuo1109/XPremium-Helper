import { describe, expect, it } from "vitest";
import {
  buildModelRequest, normalizeBaseUrl, parseModelResponse, permissionOrigin, replaceVariables,
} from "../src/reply-model";

const context = { name: "测试作者", handle: "alice", topic: "这是一条留言", language: "中文" as const, tone: "自然" as const };

describe("reply model boundary", () => {
  it("replaces only supported local variables", () => {
    expect(replaceVariables("你好 {name} {handle}：{topic}", context))
      .toBe("你好 测试作者 @alice：这是一条留言");
  });

  it("allows HTTPS and local development endpoints only", () => {
    expect(normalizeBaseUrl("https://api.example.com/v1/")).toBe("https://api.example.com/v1");
    expect(permissionOrigin("https://api.example.com/v1")).toBe("https://api.example.com/*");
    expect(normalizeBaseUrl("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(() => normalizeBaseUrl("http://example.com")).toThrow();
    expect(() => normalizeBaseUrl("https://user:pass@example.com")).toThrow();
  });

  it("builds a Chat Completions request without adding unrelated page data", () => {
    const request = buildModelRequest({
      baseUrl: "https://api.example.com/v1", model: "test-model", apiKey: "secret",
      language: "中文", tone: "自然",
    }, context);
    expect(request.url).toBe("https://api.example.com/v1/chat/completions");
    expect(request.headers.Authorization).toBe("Bearer secret");
    expect(JSON.parse(request.body)).toMatchObject({
      model: "test-model", stream: false, temperature: 0.7, max_tokens: 512,
    });
    expect(request.body).not.toContain("cookie");
    expect(request.body).toContain("这是一条留言");
  });

  it("parses valid output and rejects malformed or empty output", () => {
    expect(parseModelResponse({ choices: [{ message: { content: "  好的，谢谢  " } }] })).toBe("好的，谢谢");
    expect(parseModelResponse({ choices: [{ message: { content: [{ type: "text", text: "数组内容" }] } }] }))
      .toBe("数组内容");
    expect(parseModelResponse({ choices: [{ text: "旧版文本字段" }] })).toBe("旧版文本字段");
    expect(() => parseModelResponse({ choices: [] })).toThrow("没有返回");
    expect(() => parseModelResponse({ choices: [{ message: { content: "(N/A here)" } }] }))
      .toThrow("占位内容");
    expect(() => parseModelResponse({
      choices: [{ message: { content: "这是一句未完成的回复" }, finish_reason: "length" }],
    })).toThrow("被截断");
    expect(() => parseModelResponse("<html>")).toThrow("格式");
  });
});
