import { buildModelRequest, parseModelResponse, permissionOrigin } from "./reply-model";
import type { ModelConfig, ReplyContext } from "./reply-model";

export async function requestReply(
  config: ModelConfig,
  context: ReplyContext,
  hasPermission: (origin: string) => Promise<boolean>,
  send: typeof fetch = fetch,
  timeout = 20_000,
): Promise<string> {
  const request = buildModelRequest(config, context);
  if (!await hasPermission(permissionOrigin(config.baseUrl))) throw new Error("接口域名权限未授权，请在设置中重新保存");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await send(request.url, {
      method: "POST", headers: request.headers, body: request.body,
      signal: controller.signal, credentials: "omit", referrerPolicy: "no-referrer", redirect: "error",
    });
    if (response.status === 401) throw new Error("API Key 无效或已过期");
    if (response.status === 403) throw new Error("接口拒绝访问");
    if (response.status === 429) throw new Error("模型接口限流，请稍后再试");
    if (!response.ok) throw new Error(`模型接口返回 HTTP ${response.status}`);
    let payload: unknown;
    try { payload = await response.json(); }
    catch { throw new Error("接口返回的 JSON 格式错误"); }
    return parseModelResponse(payload);
  } catch (error) {
    if (controller.signal.aborted) throw new Error("模型请求超时，请手动重试");
    if (error instanceof TypeError) throw new Error("无法连接模型接口，请检查地址与网络");
    throw error;
  } finally { clearTimeout(timer); }
}
