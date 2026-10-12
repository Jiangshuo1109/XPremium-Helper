import type { Avatar } from "./model";
import { composedParent } from "./dom";

const STYLE = `
:host { all: initial; position: fixed; inset: 0; z-index: 3; pointer-events: none; }
* { box-sizing: border-box; letter-spacing: 0; }
button, [data-friend] { position: fixed; margin: 0; padding: 0 2px; height: 22px; min-width: 32px;
  border: 1px solid #80bde5; border-radius: 4px; background: #fff; color: #006caf;
  font: 600 11px/20px system-ui, "Microsoft YaHei", sans-serif; white-space: nowrap;
  cursor: pointer; pointer-events: auto; touch-action: manipulation; }
button:hover { background: #eaf5fd; }
button:focus-visible { outline: 2px solid #1676b0; outline-offset: 2px; }
button:disabled { color: #697278; background: #f2f3f3; border-color: #c7ced1; cursor: wait; }
button[data-dark] { background: #101d28; color: #59baff; border-color: #317dab; }
button[data-dark]:hover { background: #153149; }
button[data-dark]:disabled { color: #acb4b0; background: #242827; }
button[data-action=follow-back] { color: #846000; border-color: #ba922c; background: #fff9e8; }
button[data-action=follow-back][data-dark] { color: #f4cd61; border-color: #a68530; background: #28220e; }
button[data-action=unfollow] { color: #9b3d36; border-color: #d8bcb8; }
button[data-action=unfollow]:hover { background: #fcf1ef; }
button[data-action=unfollow][data-dark] { color: #efaca5; background: #271d1c; border-color: #80554f; }
[data-friend] { color: #0878bd; border: 0; background: transparent; text-align: center;
  pointer-events: none; cursor: default; font-weight: 500; }
[data-friend][data-dark] { color: #59baff; }
dialog { pointer-events: auto; position: fixed; margin: auto; width: min(340px, calc(100vw - 32px));
  padding: 22px; border: 1px solid #d6dbd8; border-radius: 8px; background: #fff; color: #24292e;
  font: 14px/1.6 system-ui, sans-serif; box-shadow: 0 8px 32px #0003; }
dialog::backdrop { background: #0006; }
dialog h2 { font-size: 17px; margin: 0; overflow-wrap: anywhere; }
dialog p { margin: 10px 0 20px; color: #646b70; }
dialog[data-dark] { background: #202423; color: #eef2f0; border-color: #515b56; }
dialog[data-dark] p { color: #b7c2bc; }
.actions { display: flex; justify-content: flex-end; gap: 10px; }
.actions button { position: static; height: 32px; padding: 0 14px; font-size: 13px; line-height: 30px; }
.actions .confirm { color: #fff; background: #a03932; border-color: #a03932; }
.actions .confirm:hover { background: #852e29; }
[role=status] { position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  max-width: min(420px, calc(100vw - 32px)); padding: 10px 14px; border-radius: 6px;
  background: #242729; color: white; font: 13px/20px system-ui, sans-serif;
  overflow-wrap: anywhere; box-shadow: 0 2px 8px #0002; }
[hidden] { display: none !important; }
`;

export interface ButtonView {
  avatar: Avatar;
  button: HTMLButtonElement | HTMLSpanElement;
  spacer?: HTMLElement;
  spacing?: { element: HTMLElement; previous: string; priority: string; applied: string };
  external?: boolean;
}

export class View {
  readonly host: HTMLElement;
  readonly shadow: ShadowRoot;
  private readonly status: HTMLElement;
  private statusTimer: ReturnType<typeof setTimeout> | undefined;
  private cooldownTimer: ReturnType<typeof setInterval> | undefined;
  private cooldownUntil = 0;
  private cancelConfirmation: (() => void) | undefined;

  constructor(private doc: Document) {
    this.host = doc.createElement("div");
    this.host.dataset.xfhRoot = "";
    this.shadow = this.host.attachShadow({ mode: "open" });
    const style = doc.createElement("style");
    style.textContent = STYLE;
    this.status = doc.createElement("div");
    this.status.setAttribute("role", "status");
    this.status.setAttribute("aria-live", "polite");
    this.status.hidden = true;
    this.shadow.append(style, this.status);
    doc.documentElement.append(this.host);
  }

  add(avatar: Avatar, onClick: (event: MouseEvent) => void, friend = false, external = false): ButtonView {
    const button = this.doc.createElement(friend ? "span" : "button");
    if (button instanceof HTMLButtonElement) button.type = "button";
    if (friend) button.dataset.friend = "";
    if (external) button.dataset.external = "";
    button.dataset.handle = avatar.handle;
    if (!friend) button.dataset.xfhAction = "";
    if (!friend) button.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      if (event instanceof MouseEvent) onClick(event);
    });
    this.shadow.append(button);
    let spacer: HTMLElement | undefined;
    let spacing: ButtonView["spacing"];
    if (avatar.region.hasAttribute("data-dm-message-row")) {
      const slot = avatar.anchor.parentElement?.parentElement;
      if (slot?.style.gridArea === "avatar") {
        spacer = this.doc.createElement("span");
        spacer.dataset.xfhSpacer = "";
        spacer.setAttribute("aria-hidden", "true");
        spacer.style.cssText = "display:block;height:25px;width:1px;pointer-events:none";
        slot.append(spacer);
      }
    } else {
      const element = avatar.image;
      const applied = `${(parseFloat(getComputedStyle(element).marginBottom) || 0) + 25}px`;
      spacing = { element, previous: element.style.getPropertyValue("margin-bottom"),
        priority: element.style.getPropertyPriority("margin-bottom"), applied };
      element.style.setProperty("margin-bottom", applied, "important");
    }
    return { avatar, button, spacer, spacing, external };
  }

  remove(view: ButtonView): void {
    view.spacer?.remove();
    const spacing = view.spacing;
    if (spacing && spacing.element.style.getPropertyValue("margin-bottom") === spacing.applied) {
      if (spacing.previous) spacing.element.style.setProperty("margin-bottom", spacing.previous, spacing.priority);
      else spacing.element.style.removeProperty("margin-bottom");
    }
    view.button.remove();
  }

  update(view: ButtonView, label: string, busy: boolean, phase = "核实中"): void {
    const { button, avatar } = view;
    const text = busy ? phase : label;
    if (button.textContent !== text) button.textContent = text;
    if (button instanceof HTMLButtonElement) button.disabled = busy;
    button.setAttribute("aria-busy", String(busy));
    button.setAttribute("aria-label", `${text} @${avatar.handle}`);
    button.title = `${text} @${avatar.handle}`;
    if (view.external) button.title = `${text} @${avatar.handle}（打开资料页完成操作）`;
    button.dataset.action = label === "取关" ? "unfollow" : label === "回关" ? "follow-back" : "follow";
    this.position(view);
  }

  position({ avatar, button }: ButtonView): void {
    const rect = avatar.image.getBoundingClientRect();
    const region = avatar.region.getBoundingClientRect();
    const width = Math.min(48, rect.width);
    const x = rect.left + (rect.width - width) / 2;
    const y = rect.bottom + 3;
    const viewport = this.doc.defaultView!;
    const fits = avatar.anchor.isConnected && width >= 32 && rect.top >= 0
      && x >= 0 && x + width <= viewport.innerWidth
      && y + 22 <= Math.min(viewport.innerHeight, region.bottom);
    button.hidden = !fits;
    if (!fits) return;
    button.style.left = `${x}px`;
    button.style.top = `${y}px`;
    button.style.width = `${width}px`;
    button.toggleAttribute("data-dark", this.darkBackground(avatar.region));
  }

  private darkBackground(element: HTMLElement): boolean {
    for (let node: HTMLElement | null = element; node; node = composedParent(node)) {
      const color = getComputedStyle(node).backgroundColor;
      const values = color.match(/[\d.]+/g)?.map(Number);
      if (!values || values.length < 3 || (values.length === 4 && values[3] < .5)) continue;
      return values[0] * .2126 + values[1] * .7152 + values[2] * .0722 < 130;
    }
    return this.doc.defaultView?.matchMedia("(prefers-color-scheme: dark)").matches ?? false;
  }

  notify(message: string): void {
    if (this.cooldownUntil > Date.now()) return;
    clearTimeout(this.statusTimer);
    this.status.textContent = message;
    this.status.hidden = false;
    this.statusTimer = setTimeout(() => { this.status.hidden = true; }, 6000);
  }

  clearStatus(): void {
    this.cancelConfirmation?.();
    clearTimeout(this.statusTimer);
    this.status.hidden = true;
    this.status.textContent = "";
  }

  showCooldown(until: number): void {
    this.cooldownUntil = until;
    clearInterval(this.cooldownTimer);
    const update = () => {
      if (until <= Date.now()) {
        this.cooldownUntil = 0;
        clearInterval(this.cooldownTimer);
        this.cooldownTimer = undefined;
        this.status.textContent = "回关 CD 已结束，可以继续操作";
        this.status.hidden = false;
        this.statusTimer = setTimeout(() => { this.status.hidden = true; }, 6000);
        return;
      }
      const seconds = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      const minutes = Math.floor(seconds / 60);
      this.status.textContent = `X 速度限制，回关 CD：${String(minutes).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
      this.status.hidden = false;
    };
    update();
    this.cooldownTimer = setInterval(update, 1000);
  }

  destroy(): void {
    this.cancelConfirmation?.();
    clearTimeout(this.statusTimer);
    clearInterval(this.cooldownTimer);
    this.host.remove();
  }

  confirmUnfollow(handle: string): Promise<boolean> {
    this.cancelConfirmation?.();
    return new Promise(resolve => {
      const dialog = this.doc.createElement("dialog");
      const trigger = [...this.shadow.querySelectorAll<HTMLButtonElement>("button[data-handle]")]
        .find(button => button.dataset.handle === handle);
      dialog.toggleAttribute("data-dark", trigger?.hasAttribute("data-dark") ?? false);
      const heading = this.doc.createElement("h2");
      heading.id = "xfh-confirm-title";
      heading.textContent = `取消关注 @${handle}？`;
      dialog.setAttribute("aria-labelledby", heading.id);
      const detail = this.doc.createElement("p");
      detail.textContent = "确认后将通过 X 取消关注。";
      const actions = this.doc.createElement("div");
      actions.className = "actions";
      const cancel = this.doc.createElement("button");
      cancel.type = "button";
      cancel.textContent = "取消";
      cancel.autofocus = true;
      const confirm = this.doc.createElement("button");
      confirm.type = "button";
      confirm.className = "confirm";
      confirm.textContent = "确认取关";
      let finished = false;
      const finish = (accepted: boolean) => {
        if (finished) return;
        finished = true;
        this.cancelConfirmation = undefined;
        if (dialog.open) dialog.close();
        dialog.remove();
        resolve(accepted);
      };
      this.cancelConfirmation = () => finish(false);
      cancel.addEventListener("click", () => finish(false));
      confirm.addEventListener("click", event => {
        if (event.isTrusted) finish(true);
      });
      dialog.addEventListener("cancel", event => { event.preventDefault(); finish(false); });
      actions.append(cancel, confirm);
      dialog.append(heading, detail, actions);
      this.shadow.append(dialog);
      try { dialog.showModal(); } catch { finish(false); }
    });
  }
}
