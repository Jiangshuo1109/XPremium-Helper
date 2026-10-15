import { DEFAULT_PRESETS, replaceVariables } from "./reply-model";
import { insertReply, readReplyContext } from "./reply-context";
import type { ReplyPreset, ReplyContext } from "./reply-model";
import { isVisible } from "./adapter";
import { EDITOR, replyButton } from "./reply-shortcut";

type WriteState = "idle" | "written" | "changed" | "error";

export class ReplyOverlay {
  private host: HTMLDivElement | null = null;
  private shadow: ShadowRoot | null = null;
  private editor: HTMLElement | null = null;
  private context = readReplyContext;
  private presets: ReplyPreset[] = DEFAULT_PRESETS;
  private opened = false;
  private request = false;
  private sending = false;
  private enabled = false;
  private selectedPreset: ReplyPreset | null = null;
  private epoch = 0;
  private binding = "";
  private url = "";
  private candidate = "";
  private writeState: WriteState = "idle";
  private observer: MutationObserver;
  private validationTimer: number | null = null;

  constructor(private doc: Document) {
    doc.addEventListener("focusin", this.onFocus, true);
    doc.addEventListener("pointerdown", this.onPointerDown, true);
    doc.addEventListener("click", this.onClick, true);
    window.addEventListener("scroll", this.position, true);
    window.addEventListener("resize", this.position);
    this.observer = new MutationObserver(() => this.scheduleValidation());
    this.observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
    this.enabled = true;
    this.ensure();
    this.renderLauncher();
    void this.load().catch(() => {});
  }

  private scheduleValidation(): void {
    if (!this.opened || this.validationTimer !== null) return;
    this.validationTimer = window.setTimeout(() => {
      this.validationTimer = null;
      if (this.opened) this.validate();
    }, 80);
  }

  private async load(): Promise<void> {
    const data = await chrome.storage.local.get("replyPresets");
    if (Array.isArray(data.replyPresets)) this.presets = data.replyPresets;
  }

  private validate(): boolean {
    if (!this.opened) return false;
    const context = this.editor?.isConnected ? this.context(this.editor) : null;
    if (this.doc.location.href !== this.url) {
      this.epoch++;
      this.request = false;
      this.editor = null;
      this.binding = "";
      this.candidate = "";
      this.writeState = "idle";
      this.selectedPreset = null;
      this.url = this.doc.location.href;
      this.render(null);
      return false;
    }
    if (this.editor && (!this.canUseEditor(this.editor) ||
      (this.binding && (!context || `${context.handle}\n${context.topic}` !== this.binding)))) {
      this.editor = null;
      this.binding = "";
      this.writeState = "idle";
      this.render(null);
      return false;
    }
    this.syncDraft();
    return true;
  }

  private canUseEditor(editor: HTMLElement): boolean {
    if (/^\/(?:messages|i\/chat|i\/grok)/.test(this.doc.location.pathname)) return false;
    if (this.doc.querySelector('[data-testid="scheduledConfirmation"], [data-testid="scheduleDatePicker"]')) return false;
    const dialog = [...this.doc.querySelectorAll<HTMLElement>('[role="dialog"]')].filter(isVisible).at(-1);
    if (dialog && !dialog.contains(editor)) return false;
    return editor.isConnected && isVisible(editor);
  }

  private onFocus = (event: Event): void => {
    this.openFor(this.editorFrom(event.target));
  };

  private editorFrom(target: EventTarget | null): HTMLElement | null {
    if (!(target instanceof HTMLElement)) return null;
    const direct = target.closest<HTMLElement>(EDITOR);
    return direct && this.canUseEditor(direct) ? direct : null;
  }

  private findEditor(): HTMLElement | null {
    if (this.editor && this.canUseEditor(this.editor)) return this.editor;
    const active = this.doc.activeElement instanceof HTMLElement
      ? this.editorFrom(this.doc.activeElement) : null;
    if (active) return active;
    const editors = [...this.doc.querySelectorAll<HTMLElement>(EDITOR)].filter(editor => this.canUseEditor(editor));
    return editors.length === 1 ? editors[0] : null;
  }

  private openFor(target: HTMLElement | null): void {
    if (!this.enabled || !target || !this.canUseEditor(target)) return;
    const context = this.context(target);
    if (target === this.editor && this.opened) return;
    const preset = this.opened && !this.editor && this.url === this.doc.location.href ? this.selectedPreset : null;
    this.epoch++;
    this.request = false;
    this.candidate = preset ? replaceVariables(preset.text, context ?? { name: "", handle: "", topic: "" }) : "";
    this.writeState = "idle";
    this.selectedPreset = preset;
    this.editor = target;
    this.binding = context ? `${context.handle}\n${context.topic}` : "";
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

  private openIndependent = (): void => {
    if (!this.enabled) return;
    const editor = this.findEditor();
    const context = editor ? this.context(editor) : null;
    this.close();
    this.editor = editor;
    this.binding = context ? `${context.handle}\n${context.topic}` : "";
    this.url = this.doc.location.href;
    this.opened = true;
    this.ensure();
    this.render(context);
    this.position();
  };

  private onPointerDown = (event: Event): void => {
    this.openFor(this.editorFrom(event.target));
  };

  private onClick = (event: Event): void => {
    if (!(event.target instanceof Node) || this.host?.contains(event.target)) return;
    const editor = this.editorFrom(event.target);
    if (editor) this.openFor(editor);
  };

  private ensure(): void {
    if (this.host) return;
    this.host = this.doc.createElement("div");
    this.host.dataset.xfhReplyRoot = "";
    this.shadow = this.host.attachShadow({ mode: "open" });
    this.doc.body.append(this.host);
  }

  private renderLauncher(): void {
    if (!this.shadow) return;
    this.shadow.innerHTML = `<style>
      :host{position:fixed;right:16px;bottom:16px;z-index:2147483646;font:13px/1.4 system-ui,-apple-system,"Microsoft YaHei",sans-serif}
      button{width:44px;height:44px;border:1px solid #cfd9de;border-radius:50%;background:#1d9bf0;color:#fff;box-shadow:0 4px 16px #0003;cursor:pointer;font:700 20px/1 system-ui,sans-serif}
      button:hover{background:#1a8cd8}button:focus-visible{outline:2px solid #1d9bf0;outline-offset:3px}
      @media(prefers-color-scheme:dark){button{border-color:#536471;box-shadow:0 4px 16px #0008}}
    </style><button type="button" title="打开快捷回复" aria-label="打开快捷回复">↗</button>`;
    this.shadow.querySelector("button")?.addEventListener("click", this.openIndependent);
  }

  private render(context: ReplyContext | null): void {
    if (!this.shadow) return;
    const categories = [
      ["interaction", "互动"], ["thanks", "感谢"], ["polite", "礼貌"],
    ] as const;
    this.shadow.innerHTML = `<style>
      :host{--blue:#1d9bf0;--text:#0f1419;--muted:#536471;--line:#cfd9de;--surface:#fff;--soft:#f7f9f9;position:fixed;z-index:2147483646;width:324px;max-width:calc(100vw - 16px);color:var(--text);font:13px/1.4 system-ui,-apple-system,"Microsoft YaHei",sans-serif}
      .box{padding:14px;border:1px solid var(--line);border-radius:14px;background:var(--surface);box-shadow:0 8px 28px #00000022;max-height:calc(100vh - 24px);overflow:auto;overflow-wrap:anywhere}
      .head{display:flex;justify-content:space-between;gap:8px;align-items:center}.head strong{font-size:15px;font-weight:700}.close{width:28px;height:28px;border:0;border-radius:50%;background:transparent;color:var(--text);font-size:18px;line-height:1;cursor:pointer}.close:hover{background:#eff3f4}
      .topic{margin:8px 0;color:var(--muted);display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
      .section-label{display:flex;justify-content:space-between;align-items:center;margin:12px 0 5px;font-size:12px;font-weight:700}.section-label small{font-weight:400;color:var(--muted)}
      .tabs{display:flex;gap:6px;margin:10px 0 8px}.tabs button,.item,.generate,.insert{border:1px solid var(--line);border-radius:999px;background:var(--surface);color:inherit;padding:6px 10px;cursor:pointer;font:inherit}
      .tabs button.active{border-color:var(--blue);color:var(--blue);background:#e8f5fd}.items{display:grid;gap:6px}.item{text-align:left;border-radius:10px;background:var(--soft)}
      .item:hover,.insert:hover,.send:hover{background:#eff3f4}.choices{display:flex;gap:8px;margin-top:10px}select{min-width:0;flex:1;padding:7px 8px;background:var(--surface);color:inherit;border:1px solid var(--line);border-radius:8px;font:inherit}
      .text-box{max-height:116px;min-height:34px;overflow:auto;white-space:pre-wrap;padding:9px;border:1px solid var(--line);border-radius:9px;background:var(--soft);line-height:1.5}.recommendation{border-color:#8ecdf5;background:#e8f5fd}.draft{background:var(--surface)}.empty{color:var(--muted)}
      .status{margin:7px 0 0;color:var(--muted);font-size:11px}.status.error{color:#b3261e}.status.ok{color:#167447}.actions{display:flex;gap:8px;margin-top:10px}.generate{flex:1;background:var(--blue);border-color:var(--blue);color:#fff;font-weight:700}.generate:hover{background:#1a8cd8}.insert{flex:1}.send{width:100%;margin-top:8px;border:1px solid var(--blue);border-radius:999px;background:var(--blue);color:#fff;padding:8px 10px;cursor:pointer;font:700 13px/1.4 inherit}.send:hover{background:#1a8cd8}
      button:disabled{opacity:.55;cursor:default}
      @media(prefers-color-scheme:dark){:host{--text:#e7e9ea;--muted:#8b98a5;--line:#536471;--surface:#000;--soft:#16181c}.box{box-shadow:0 8px 28px #00000088}.close:hover{background:#181818}.tabs button.active{background:#061d2b}.item:hover,.insert:hover,.send:hover{background:#181818}.recommendation{background:#061d2b}}
    </style><div class="box"><div class="head"><strong>快捷回复</strong><button class="close" title="关闭">×</button></div>
      <div class="topic"></div><div class="tabs"></div><div class="items"></div>
      <div class="choices"><select aria-label="语言"><option>中文</option><option>English</option></select><select aria-label="语气"><option>自然</option><option>简洁</option><option>热情</option><option>专业</option></select></div>
      <div class="section-label"><span>AI 推荐内容</span><small class="recommendation-state"></small></div>
      <div class="text-box recommendation empty">生成后会自动写入 X 回复框</div>
      <div class="section-label"><span>X 当前草稿</span><small class="draft-state"></small></div>
      <div class="text-box draft empty">尚未绑定回复框</div>
      <div class="actions"><button class="generate">生成并插入</button><button class="insert" disabled>重新写入</button></div>
      <button class="send" disabled>插入并回复</button>
      <div class="status" role="status"></div></div>`;
    this.shadow.querySelector(".topic")!.textContent = context
      ? `回复 @${context.handle}：${context.topic}`
      : "尚未绑定回复框。请先点击 X 的回复编辑器，再选择预置回复或生成内容。";
    const tabs = this.shadow.querySelector(".tabs")!;
    const items = this.shadow.querySelector(".items")!;
    let selected = "interaction";
    const renderItems = () => {
      tabs.querySelectorAll("button").forEach(button => button.classList.toggle("active", button.dataset.category === selected));
      items.replaceChildren(...this.presets.filter(item => item.category === selected).map(item => {
        const button = this.doc.createElement("button");
        button.className = "item"; button.textContent = item.title; button.type = "button";
        button.addEventListener("click", () => {
          this.selectedPreset = item;
          this.setCandidate(replaceVariables(item.text, context ?? { name: "", handle: "", topic: "" }));
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
    this.shadow.querySelector(".generate")!.addEventListener("click", () => void this.generate());
    this.shadow.querySelector(".insert")!.addEventListener("click", () => this.insert());
    this.shadow.querySelector(".send")!.addEventListener("click", () => this.insertAndSend());
    if (!context) {
      const generate = this.shadow.querySelector<HTMLButtonElement>(".generate")!;
      generate.disabled = true;
      this.setStatus("预置回复无需 API；生成回复需要先识别当前留言", false);
    }
    if (this.candidate) this.setCandidate(this.candidate);
    this.syncDraft();
    this.position();
  }

  private setCandidate(text: string, autoInsert = false): void {
    if (!this.shadow) return;
    this.candidate = text;
    const candidate = this.shadow.querySelector<HTMLElement>(".recommendation")!;
    candidate.textContent = text;
    candidate.classList.remove("empty");
    this.shadow.querySelector<HTMLButtonElement>(".insert")!.disabled = false;
    this.shadow.querySelector<HTMLButtonElement>(".send")!.disabled = false;
    const state = this.shadow.querySelector<HTMLElement>(".recommendation-state");
    if (state) state.textContent = autoInsert ? "正在写入…" : "待写入";
    this.setStatus(autoInsert ? "正在写入当前回复框…" : "预置回复已准备好", false);
    if (autoInsert) this.applyCandidate();
    this.position();
  }

  private async generate(): Promise<void> {
    const context = this.editor?.isConnected ? this.context(this.editor) : null;
    if (this.request || this.sending || !context) {
      this.setStatus("请先点击一个可识别的回复框", true);
      return;
    }
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
      this.selectedPreset = null;
      this.setCandidate(result.text, true);
    } catch (error) {
      if (epoch === this.epoch && this.validate()) {
        const message = error instanceof Error && /extension context invalidated/i.test(error.message)
          ? "扩展刚刚更新，请刷新当前 X 页面后再生成"
          : error instanceof Error ? error.message : "生成失败";
        this.setStatus(message, true);
      }
    } finally {
      if (epoch === this.epoch) this.request = false;
      if (button) { button.disabled = false; button.textContent = "重新生成"; }
    }
  }

  private insert(): void {
    if (!this.validate()) return;
    if (this.applyCandidate()) this.close();
  }

  private insertAndSend(): void {
    if (this.sending || !this.validate()) return;
    this.editor ??= this.findEditor();
    const editor = this.editor;
    const button = editor ? replyButton(editor) : null;
    if (!editor || !this.canUseEditor(editor) || !button
      || button.hasAttribute("disabled") || button.getAttribute("aria-disabled") === "true") {
      this.setStatus("已保留草稿，但没有找到可确认的 X 回复按钮", true);
      return;
    }
    this.sending = true;
    this.setStatus("正在提交回复…", false);
    const send = this.shadow?.querySelector<HTMLButtonElement>(".send");
    if (send) send.disabled = true;
    if (!this.applyCandidate()) {
      this.sending = false;
      if (send) send.disabled = false;
      return;
    }
    button.click();
    this.close();
  }

  private applyCandidate(): boolean {
    if (!this.candidate || !this.validate()) return false;
    this.editor ??= this.findEditor();
    const editor = this.editor;
    if (!editor || !this.canUseEditor(editor) || !insertReply(editor, this.candidate)) {
      this.writeState = "error";
      this.setStatus("写入回复框失败，请重新选择回复框", true);
      return false;
    }
    this.writeState = "written";
    const state = this.shadow?.querySelector<HTMLElement>(".recommendation-state");
    if (state) state.textContent = "已写入";
    this.syncDraft();
    return true;
  }

  private syncDraft(): void {
    if (!this.shadow) return;
    const editor = this.editor?.isConnected && this.canUseEditor(this.editor) ? this.editor : null;
    const draft = editor?.textContent ?? "";
    const draftBox = this.shadow.querySelector<HTMLElement>(".draft");
    const draftState = this.shadow.querySelector<HTMLElement>(".draft-state");
    if (draftBox) {
      draftBox.textContent = draft || "回复框还是空的";
      draftBox.classList.toggle("empty", !draft);
    }
    if (draftState) {
      if (!editor) draftState.textContent = "";
      else if (this.candidate && draft === this.candidate) draftState.textContent = "已与推荐内容一致";
      else if (this.candidate && draft) draftState.textContent = "已被手动修改";
      else draftState.textContent = "可编辑";
    }
    if (this.candidate && draft && draft !== this.candidate && this.writeState === "written") {
      this.writeState = "changed";
      this.setStatus("X 回复框内容已被手动修改", false);
    }
    const send = this.shadow.querySelector<HTMLButtonElement>(".send");
    if (send) send.disabled = !this.candidate || !draft || this.sending;
  }

  private setStatus(text: string, error: boolean): void {
    const status = this.shadow?.querySelector<HTMLElement>(".status");
    if (!status) return;
    status.textContent = text;
    status.classList.toggle("error", error);
    status.classList.toggle("ok", !error && Boolean(text));
  }

  private position = (): void => {
    if (!this.host || !this.opened) return;
    const height = this.host.getBoundingClientRect().height || 300;
    this.host.style.left = `${Math.max(8, window.innerWidth - 340)}px`;
    this.host.style.top = `${Math.max(8, window.innerHeight - height - 72)}px`;
  };

  close(): void {
    this.epoch++;
    this.candidate = "";
    this.selectedPreset = null;
    this.opened = false;
    this.editor = null;
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.request = false;
    this.sending = false;
    this.writeState = "idle";
    if (this.enabled) {
      this.ensure();
      this.renderLauncher();
    }
  }

  setEnabled(value: boolean): void {
    this.enabled = value;
    if (!value) {
      this.candidate = "";
      this.selectedPreset = null;
      this.epoch++;
      this.opened = false;
      this.editor = null;
      this.host?.remove();
      this.host = null;
      this.shadow = null;
      this.request = false;
      this.sending = false;
      this.writeState = "idle";
      return;
    }
    this.ensure();
    if (!this.opened) this.renderLauncher();
  }

  destroy(): void {
    this.epoch++;
    if (this.validationTimer !== null) window.clearTimeout(this.validationTimer);
    this.validationTimer = null;
    this.enabled = false;
    this.opened = false;
    this.editor = null;
    this.host?.remove();
    this.host = null;
    this.shadow = null;
    this.doc.removeEventListener("focusin", this.onFocus, true);
    this.doc.removeEventListener("pointerdown", this.onPointerDown, true);
    this.doc.removeEventListener("click", this.onClick, true);
    window.removeEventListener("scroll", this.position, true);
    window.removeEventListener("resize", this.position);
    this.observer.disconnect();
  }
}
