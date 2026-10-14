import { DEFAULT_PRESETS, replaceVariables } from "./reply-model";
import { insertReply, readReplyContext } from "./reply-context";
import type { ReplyPreset } from "./reply-model";
import { isVisible } from "./adapter";
import { EDITOR } from "./reply-shortcut";

export class ReplyOverlay {
  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private editor: HTMLElement | null = null;
  private context = readReplyContext;
  private presets: ReplyPreset[] = DEFAULT_PRESETS;
  private opened = false;
  private request = false;
  private enabled = true;
  private epoch = 0;
  private binding = "";
  private url = "";
  private candidate = "";
  private observer: MutationObserver;

  constructor(private doc: Document) {
    doc.addEventListener("focusin", this.onFocus, true);
    doc.addEventListener("pointerdown", this.onPointerDown, true);
    doc.addEventListener("click", this.onClick, true);
    window.addEventListener("scroll", this.position, true);
    window.addEventListener("resize", this.position);
    this.observer = new MutationObserver(() => this.validate());
    this.observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
    void this.load();
  }

  private async load(): Promise<void> {
    const data = await chrome.storage.local.get("replyPresets");
    if (Array.isArray(data.replyPresets)) this.presets = data.replyPresets;
  }

  private validate(): boolean {
    if (!this.opened || !this.editor) return false;
    const context = this.editor.isConnected ? this.context(this.editor) : null;
    if (this.doc.location.href !== this.url || !context ||
      `${context.handle}\n${context.topic}` !== this.binding) { this.close(); return false; }
    return true;
  }

  private onFocus = (event: Event): void => {
    this.openFor(this.editorFrom(event.target));
  };

  private editorFrom(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) return null;
    const direct = target.closest<HTMLElement>(EDITOR);
    if (direct && isVisible(direct)) return direct;
    const scope = target.closest<HTMLElement>('[role="dialog"]');
    const editor = [...(scope?.querySelectorAll<HTMLElement>(EDITOR) ?? [])].find(isVisible);
    return editor ?? null;
  }

  private openFor(target: HTMLElement | null): void {
    if (!this.enabled || !target || !isVisible(target)) return;
    const context = this.context(target);
    if (!context) return this.close();
    if (target === this.editor && this.opened && this.validate()) return;
    this.close();
    this.editor = target;
    this.binding = `${context.handle}\n${context.topic}`;
    this.url = this.doc.location.href;
    this.opened = true;
    this.ensure();
    this.render(context);
    const epoch = this.epoch;
    void this.load().then(() => {
      if (this.epoch === epoch && !this.candidate && !this.request && this.validate()) this.render(context);
    }).catch(() => {});
    this.position();
  }

  private onPointerDown = (event: Event): void => {
    this.openFor(this.editorFrom(event.target));
  };

  private onClick = (event: Event): void => {
    if (!(event.target instanceof Node) || this.host?.contains(event.target)) return;
    const editor = this.editorFrom(event.target);
    if (editor) {
      this.openFor(editor);
      return;
    }
    if (!this.opened || !this.editor) return;
    if (!this.editor.contains(event.target)) this.close();
  };

  private ensure(): void {
    if (this.host) return;
    this.host = this.doc.createElement("div");
    this.host.dataset.xfhReplyRoot = "";
    this.shadow = this.host.attachShadow({ mode: "open" });
    this.doc.body.append(this.host);
  }

  private render(context: NonNullable<ReturnType<typeof readReplyContext>>): void {
    if (!this.shadow) return;
    const categories = [
      ["interaction", "互动"], ["thanks", "感谢"], ["polite", "礼貌"],
    ] as const;
    this.shadow.innerHTML = `<style>
      :host{--blue:#1d9bf0;--text:#0f1419;--muted:#536471;--line:#eff3f4;--surface:#fff;--soft:#f7f9f9;position:fixed;z-index:2147483646;width:288px;max-width:calc(100vw - 16px);color:var(--text);font:13px/1.4 system-ui,-apple-system,"Microsoft YaHei",sans-serif}
      .box{padding:12px;border:1px solid var(--line);border-radius:16px;background:var(--surface);box-shadow:0 8px 28px #00000022;max-height:calc(100vh - 24px);overflow:auto;overflow-wrap:anywhere}
      .head{display:flex;justify-content:space-between;gap:8px;align-items:center}.head strong{font-size:15px;font-weight:700}.close{width:28px;height:28px;border:0;border-radius:50%;background:transparent;color:var(--text);font-size:18px;line-height:1;cursor:pointer}.close:hover{background:#eff3f4}
      .topic{margin:8px 0;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .tabs{display:flex;gap:6px;margin:10px 0 8px}.tabs button,.item,.generate,.insert{border:1px solid #cfd9de;border-radius:999px;background:var(--surface);color:inherit;padding:6px 10px;cursor:pointer;font:inherit}
      .tabs button.active{border-color:var(--blue);color:var(--blue);background:#e8f5fd}.items{display:grid;gap:6px}.item{text-align:left;border-radius:10px;background:var(--soft)}
      .item:hover,.insert:hover{background:#eff3f4}.actions{display:flex;gap:8px;margin-top:10px}.generate{flex:1;background:var(--blue);border-color:var(--blue);color:#fff;font-weight:700}.generate:hover{background:#1a8cd8}.insert{flex:1}
      .candidate{margin-top:9px;padding:8px;border-left:3px solid var(--blue);border-radius:0 8px 8px 0;background:#e8f5fd;white-space:pre-wrap}.error{color:#b3261e}.choices{display:flex;gap:8px;margin-top:9px}select{min-width:0;flex:1;padding:6px 8px;background:var(--surface);color:inherit;border:1px solid #cfd9de;border-radius:8px;font:inherit}button:disabled{opacity:.55;cursor:default}
      .note{margin:7px 0 0;color:var(--muted);font-size:11px}.note:empty{display:none}
      @media(prefers-color-scheme:dark){:host{--text:#e7e9ea;--muted:#8b98a5;--line:#2f3336;--surface:#000;--soft:#16181c}.box{box-shadow:0 8px 28px #00000088}.close:hover{background:#181818}.tabs button.active{background:#061d2b}.tabs button,.item,.generate,.insert{border-color:#536471}.item:hover,.insert:hover{background:#181818}.candidate{background:#061d2b}select{border-color:#536471}}
    </style><div class="box"><div class="head"><strong>快捷回复</strong><button class="close" title="关闭">×</button></div>
      <div class="topic"></div><div class="tabs"></div><div class="items"></div>
      <div class="choices"><select aria-label="语言"><option>中文</option><option>English</option></select><select aria-label="语气"><option>自然</option><option>简洁</option><option>热情</option><option>专业</option></select></div>
      <div class="actions"><button class="generate">生成回复</button><button class="insert" disabled>插入草稿</button></div>
      <div class="candidate" hidden></div><div class="note" role="status"></div></div>`;
    this.shadow.querySelector(".topic")!.textContent = `回复 @${context.handle}：${context.topic}`;
    const tabs = this.shadow.querySelector(".tabs")!;
    const items = this.shadow.querySelector(".items")!;
    let selected = "interaction";
    const renderItems = () => {
      tabs.querySelectorAll("button").forEach(button => button.classList.toggle("active", button.dataset.category === selected));
      items.replaceChildren(...this.presets.filter(item => item.category === selected).map(item => {
        const button = this.doc.createElement("button");
        button.className = "item"; button.textContent = item.title; button.type = "button";
        button.addEventListener("click", () => {
          const text = replaceVariables(item.text, context);
          this.setCandidate(text);
        });
        return button;
      }));
    };
    for (const [id, title] of categories) {
      const button = this.doc.createElement("button");
      button.type = "button"; button.dataset.category = id; button.textContent = title;
      button.addEventListener("click", () => { selected = id; renderItems(); });
      tabs.append(button);
    }
    renderItems();
    this.shadow.querySelector(".close")!.addEventListener("click", () => this.close());
    this.shadow.querySelector(".generate")!.addEventListener("click", () => void this.generate(context));
    this.shadow.querySelector(".insert")!.addEventListener("click", () => this.insert());
    this.position();
  }

  private setCandidate(text: string): void {
    if (!this.shadow) return;
    this.candidate = text;
    const candidate = this.shadow.querySelector<HTMLElement>(".candidate")!;
    candidate.textContent = text; candidate.hidden = false;
    const insert = this.shadow.querySelector<HTMLButtonElement>(".insert")!;
    insert.disabled = false;
    const note = this.shadow.querySelector<HTMLElement>(".note");
    if (note) {
      note.textContent = "预置回复无需配置 API，点击“插入草稿”后再自行发送";
      note.classList.remove("error");
    }
    this.position();
  }

  private async generate(context: NonNullable<ReturnType<typeof readReplyContext>>): Promise<void> {
    if (this.request || !this.validate()) return;
    this.request = true;
    const epoch = this.epoch;
    const button = this.shadow?.querySelector<HTMLButtonElement>(".generate");
    if (button) { button.disabled = true; button.textContent = "生成中…"; }
    try {
      const result = await chrome.runtime.sendMessage({
        type: "xfh-generate-reply",
        context: { ...context,
          language: this.shadow?.querySelector<HTMLSelectElement>('[aria-label="语言"]')?.value ?? "中文",
          tone: this.shadow?.querySelector<HTMLSelectElement>('[aria-label="语气"]')?.value ?? "自然" },
      });
      if (epoch !== this.epoch || !this.validate()) return;
      if (!result?.text) throw new Error(result?.error || "模型没有返回内容");
      this.setCandidate(result.text);
    } catch (error) {
      if (epoch === this.epoch && this.validate()) {
        const note = this.shadow?.querySelector<HTMLElement>(".note");
        const message = error instanceof Error && /extension context invalidated/i.test(error.message)
          ? "扩展刚刚更新，请刷新当前 X 页面后再生成"
          : error instanceof Error ? error.message : "生成失败";
        if (note) { note.textContent = message; note.classList.add("error"); }
      }
    } finally {
      if (epoch === this.epoch) this.request = false;
      if (button) { button.disabled = false; button.textContent = "生成回复"; }
    }
  }

  private insert(): void {
    if (!this.validate()) return;
    const text = this.candidate;
    if (this.editor && insertReply(this.editor, text)) this.close();
    else {
      const note = this.shadow?.querySelector<HTMLElement>(".note");
      if (note) note.textContent = "未能插入，请重新选择回复框";
    }
  }

  private position = (): void => {
    if (!this.host || !this.editor || !this.opened) return;
    if (!this.validate()) return;
    const rect = this.editor.getBoundingClientRect();
    const height = this.host.getBoundingClientRect().height || 210;
    this.host.style.left = `${Math.max(8, Math.min(window.innerWidth - 284, rect.right - 276))}px`;
    this.host.style.top = `${Math.max(8, Math.min(window.innerHeight - height - 8, rect.bottom + 8))}px`;
  };

  close(): void {
    this.epoch++;
    this.candidate = "";
    this.opened = false;
    this.editor = null;
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.request = false;
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) this.close();
  }

  destroy(): void {
    this.close();
    this.doc.removeEventListener("focusin", this.onFocus, true);
    this.doc.removeEventListener("pointerdown", this.onPointerDown, true);
    this.doc.removeEventListener("click", this.onClick, true);
    window.removeEventListener("scroll", this.position, true);
    window.removeEventListener("resize", this.position);
    this.observer.disconnect();
  }
}
