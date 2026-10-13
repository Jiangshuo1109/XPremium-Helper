import { DEFAULT_PRESETS, replaceVariables } from "./reply-model";
import { insertReply, readReplyContext } from "./reply-context";
import type { ReplyPreset } from "./reply-model";
import { isVisible } from "./adapter";

const EDITOR = '[contenteditable="true"][data-testid^="tweetTextarea_"]';

export class ReplyOverlay {
  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private editor: HTMLElement | null = null;
  private context = readReplyContext;
  private presets: ReplyPreset[] = DEFAULT_PRESETS;
  private opened = false;
  private request = false;
  private epoch = 0;
  private binding = "";
  private url = "";
  private candidate = "";
  private observer: MutationObserver;

  constructor(private doc: Document) {
    doc.addEventListener("focusin", this.onFocus, true);
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
    const target = event.target instanceof HTMLElement ? event.target.closest<HTMLElement>(EDITOR) : null;
    if (!target || !isVisible(target)) return;
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
  };

  private onClick = (event: Event): void => {
    if (!this.opened || !this.editor || !(event.target instanceof Node)
      || this.host?.contains(event.target)) return;
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
      :host{position:fixed;z-index:2147483646;width:276px;max-width:calc(100vw - 16px);color:#192126;font:12px/1.4 system-ui,"Microsoft YaHei",sans-serif}
      .box{padding:10px;border:1px solid #cfd7d9;border-radius:8px;background:#fff;box-shadow:0 4px 18px #0002;max-height:calc(100vh - 24px);overflow:auto;overflow-wrap:anywhere}
      .head{display:flex;justify-content:space-between;gap:8px;align-items:center}.head strong{font-size:12px}
      .topic{margin:7px 0;color:#68757b;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
      .tabs{display:flex;gap:5px;margin:8px 0}.tabs button,.item,.generate,.insert{border:1px solid #cfd7d9;border-radius:5px;background:#f7f9f9;color:inherit;padding:5px 7px;cursor:pointer}
      .tabs button.active{border-color:#1479b8;color:#1479b8;background:#edf6fb}.items{display:grid;gap:5px}.item{text-align:left}
      .actions{display:flex;gap:6px;margin-top:8px}.generate{flex:1;background:#1479b8;border-color:#1479b8;color:#fff}.insert{flex:1}
      .candidate{margin-top:8px;padding:7px;border-left:3px solid #1479b8;background:#f1f7fa;white-space:pre-wrap}.error{color:#b3261e}.choices{display:flex;gap:8px;margin-top:8px}select{min-width:0;flex:1;padding:4px;background:inherit;color:inherit;border:1px solid #879499;border-radius:4px}button:disabled{opacity:.55;cursor:default}
      .note{margin:6px 0 0;color:#68757b;font-size:10px}.close{border:0;background:transparent;color:#68757b;cursor:pointer}
      @media(prefers-color-scheme:dark){:host{color:#edf1f2}.box{border-color:#4b565b;background:#202629;box-shadow:0 4px 18px #0008}.topic,.note{color:#a9b3b7}.tabs button,.item,.insert{border-color:#4b565b;background:#171c1e;color:inherit}.candidate{background:#1e3745}}
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
        if (note) { note.textContent = error instanceof Error ? error.message : "生成失败"; note.classList.add("error"); }
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

  destroy(): void {
    this.close();
    this.doc.removeEventListener("focusin", this.onFocus, true);
    this.doc.removeEventListener("click", this.onClick, true);
    window.removeEventListener("scroll", this.position, true);
    window.removeEventListener("resize", this.position);
    this.observer.disconnect();
  }
}
