import {
  collectAvatars, collectEvidence, collectRelationFacts, currentViewer, hasBlueBadge,
  quarantineControls, supportedRoute,
} from "./adapter";
import { performAction } from "./action";
import { actionFromRelation, availableAction, buttonLabel, isMutual } from "./model";
import type { Avatar, Evidence, PageState, RelationFact } from "./model";
import { View } from "./view";
import type { ButtonView } from "./view";
import { pageRoots } from "./dom";
import { ProbeInterrupted, withNativeCard } from "./native-card";
import { mayProbe, planProbes } from "./probe-queue";
import type { ProbeAttempt } from "./probe-queue";
import { cooldownActive, FOLLOW_COOLDOWN_MS } from "./cooldown";
import type { ExternalActionTask } from "./task";

export class Controller {
  private enabled = false;
  private viewer: string | null = null;
  private route = "";
  private generation = 0;
  private view: View | null = null;
  private buttons = new Map<HTMLAnchorElement, ButtonView>();
  private pending = new Map<string, AbortController>();
  private observer: MutationObserver;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private heartbeat: ReturnType<typeof setInterval>;
  private frame = 0;
  private stopped = false;
  private previouslyIdentified = false;
  private excluded = new WeakSet<HTMLElement>();
  private confirming = false;
  private observedRoots: Array<Document | ShadowRoot> = [];
  private verified = new Map<string, { evidence: Evidence; expires: number }>();
  private attempted = new Map<string, ProbeAttempt>();
  private probing: AbortController | null = null;
  private probeTask: Promise<void> | null = null;
  private queue: Avatar[] = [];
  private resumeAt = 0;
  private phases = new Map<string, string>();
  private cooldownUntil = 0;
  private relations = new Map<string, RelationFact>();
  private errors = new Map<string, string>();
  private timings: Record<string, number> = {};

  constructor(
    private doc: Document,
    private win: Window,
    private requireTrustedClick = true,
    private onRateLimit?: (until: number) => void,
    private onState?: (state: PageState) => void,
    private onExternalAction?: (handle: string, action: "follow" | "unfollow") => Promise<void>,
  ) {
    this.observer = new MutationObserver(() => this.schedule());
    this.observeRoots();
    win.addEventListener("scroll", this.reposition, true);
    win.addEventListener("resize", this.reposition);
    win.addEventListener("popstate", this.schedule);
    doc.addEventListener("visibilitychange", this.onVisibility);
    doc.addEventListener("focusout", this.schedule, true);
    doc.addEventListener("pointermove", this.onInteraction, true);
    doc.addEventListener("pointerdown", this.onInteraction, true);
    doc.addEventListener("keydown", this.onInteraction, true);
    // pushState and attachShadow do not emit mutations on the document.
    this.heartbeat = setInterval(() => {
      if (this.enabled && !doc.hidden && (win.location.href !== this.route
        || currentViewer(doc) !== this.viewer
        || pageRoots(doc).some(root => !this.observedRoots.includes(root))
        || (this.resumeAt > 0 && this.resumeAt <= Date.now())
        || this.queue.some(item => this.readyToProbe(item))
        || [...this.verified.values()].some(item => item.expires <= Date.now()))) this.schedule();
    }, 750);
  }

  private observeRoots(): void {
    const roots = pageRoots(this.doc);
    if (roots.length === this.observedRoots.length
      && roots.every((root, index) => root === this.observedRoots[index])) return;
    this.observer.disconnect();
    for (const root of this.observedRoots) root.removeEventListener("scroll", this.reposition, true);
    this.observedRoots = roots;
    for (const root of roots) {
      this.observer.observe(root, {
        subtree: true, childList: true, characterData: true, attributes: true,
        attributeFilter: ["href", "data-testid", "aria-label", "aria-disabled", "disabled",
          "hidden", "aria-hidden", "class", "style", "data-dm-message-row"],
      });
      root.addEventListener("scroll", this.reposition, true);
    }
  }

  setEnabled(enabled: boolean): void {
    if (this.stopped) return;
    this.enabled = enabled;
    if (!enabled) {
      this.reset();
      this.view?.destroy();
      this.view = null;
    } else {
      this.scan();
    }
  }

  setCooldownUntil(until: number): void {
    this.cooldownUntil = Math.max(this.cooldownUntil, Number.isFinite(until) ? until : 0);
  }

  private reset(keepRelationships = false): void {
    this.generation++;
    for (const abort of this.pending.values()) abort.abort();
    this.pending.clear();
    this.phases.clear();
    this.probing?.abort();
    this.probing = null;
    if (!keepRelationships) this.verified.clear();
    if (!keepRelationships) this.relations.clear();
    this.attempted.clear();
    this.errors.clear();
    this.queue = [];
    this.resumeAt = 0;
    for (const item of this.buttons.values()) this.view?.remove(item);
    this.buttons.clear();
    this.view?.clearStatus();
    this.publishState();
  }

  schedule = (): void => {
    if (this.timer || this.stopped || !this.enabled) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.scan();
    }, 100);
  };

  private onVisibility = (): void => {
    if (this.doc.hidden) {
      this.reset();
    } else {
      this.schedule();
    }
  };

  private onInteraction = (event: Event): void => {
    if (!event.isTrusted || !this.enabled) return;
    this.resumeAt = Date.now() + 500;
    this.probing?.abort();
  };

  private readyToProbe(avatar: Avatar): boolean {
    const rect = avatar.image.getBoundingClientRect();
    return !this.verified.has(avatar.handle) && rect.bottom > 0
      && rect.top < this.win.innerHeight * 2
      && mayProbe(this.attempted.get(avatar.handle), rect.top < this.win.innerHeight, Date.now());
  }

  scan(): void {
    const started = performance.now();
    if (!this.enabled || this.stopped || this.doc.hidden) return;
    this.observeRoots();
    const viewer = currentViewer(this.doc);
    this.timings.identity = performance.now() - started;
    const route = this.win.location.href;
    if (viewer !== this.viewer || route !== this.route) {
      if (viewer !== this.viewer && this.previouslyIdentified) {
        // A new viewer link can render before old timeline controls have been replaced.
        quarantineControls(this.doc, this.excluded);
      }
      this.reset(viewer !== null && viewer === this.viewer);
      this.viewer = viewer;
      this.route = route;
      if (viewer) this.previouslyIdentified = true;
    }
    if (!viewer || !supportedRoute(this.win.location.pathname)) {
      this.reset();
      return;
    }
    this.view ??= new View(this.doc);
    const conflicts = new Set<string>();
    const evidence = collectEvidence(this.doc, this.excluded, conflicts);
    for (const handle of conflicts) {
      this.verified.delete(handle);
      this.relations.delete(handle);
    }
    for (const [handle, proof] of evidence) {
      if (!this.pending.has(handle)) {
        this.verified.set(handle, { evidence: proof, expires: Date.now() + 60_000 });
      }
    }
    for (const [handle, cached] of this.verified) {
      if (cached.expires <= Date.now()) {
        this.verified.delete(handle);
        this.attempted.delete(handle);
      }
      else if (!evidence.has(handle)) evidence.set(handle, cached.evidence);
    }
    const keep = new Set<HTMLAnchorElement>();
    const chatSeen = new Set<string>();
    const avatars = collectAvatars(this.doc, this.win.location.pathname);
    this.timings.discovery = performance.now() - started - this.timings.identity;
    const badgeStart = performance.now();
    const facts = collectRelationFacts(avatars, evidence);
    for (const avatar of avatars) {
      const fact = facts.get(avatar.handle);
      this.relations.set(avatar.handle, fact ? { ...fact, blue: hasBlueBadge(avatar) || evidence.get(avatar.handle)?.blue ? true : fact.blue }
        : { handle: avatar.handle, relationship: "unknown", followsYou: null,
          blue: hasBlueBadge(avatar) ? true : null, source: "page", observedAt: Date.now() });
    }
    for (const handle of [...this.relations.keys()]) {
      if (!avatars.some(avatar => avatar.handle === handle)) this.relations.delete(handle);
    }
    this.timings.badges = performance.now() - badgeStart;
    this.queue = planProbes(avatars, viewer, this.win.innerHeight,
      avatar => !this.verified.has(avatar.handle)
        && (this.attempted.get(avatar.handle)?.count ?? 0) < 2);
    const renderStart = performance.now();
    for (const avatar of avatars) {
      const proof = evidence.get(avatar.handle);
      const relation = this.relations.get(avatar.handle);
      const busy = this.pending.has(avatar.handle);
      const friend = !busy && (isMutual(viewer, proof)
        || (relation?.relationship === "following" && relation.followsYou === true));
      const action = availableAction(viewer, proof) ?? actionFromRelation(viewer, relation);
      const blue = relation?.blue === true || hasBlueBadge(avatar);
      const fallback = !proof?.control && Boolean(action);
      if ((!busy && !friend && !action)
        || (!busy && action === "follow" && !blue)
        || (proof && avatar.region.contains(proof.control))) continue;
      if (avatar.region.hasAttribute("data-dm-message-row")) {
        const rect = avatar.image.getBoundingClientRect();
        if (rect.bottom < 0 || rect.top > this.win.innerHeight || chatSeen.has(avatar.handle)) continue;
        chatSeen.add(avatar.handle);
      }
      keep.add(avatar.anchor);
      let item = this.buttons.get(avatar.anchor);
      if (item && (item.avatar.handle !== avatar.handle || item.button.hasAttribute("data-friend") !== friend)) {
        this.view.remove(item);
        this.buttons.delete(avatar.anchor);
        item = undefined;
      }
      if (!item) {
        item = this.view.add(avatar, event => {
          if (this.requireTrustedClick && !event.isTrusted) return;
          void this.act(avatar);
        }, friend, fallback);
        this.buttons.set(avatar.anchor, item);
      }
      item.avatar = avatar;
      this.view.update(item, friend ? "蓝朋友" : relation ? this.relationLabel(relation) : proof ? buttonLabel(proof) : "关注",
        busy, this.phases.get(avatar.handle));
    }
    this.timings.render = performance.now() - renderStart;
    for (const [anchor, item] of this.buttons) {
      if (!keep.has(anchor)) {
        this.view.remove(item);
        this.buttons.delete(anchor);
      }
    }
    if (this.requireTrustedClick && !this.probeTask) {
      const task = this.probeNext();
      const route = this.route;
      this.probeTask = task;
      void task.finally(() => {
        if (this.probeTask === task) this.probeTask = null;
        if (route !== this.route) this.schedule();
      });
    }
    this.publishState();
  }

  private relationLabel(relation: RelationFact): string {
    if (relation.relationship === "following") return relation.followsYou === true ? "蓝朋友" : "取关";
    if (relation.relationship === "requested") return "请求已发送";
    return relation.followsYou === true ? "回关" : "关注";
  }

  async executeExternalTask(task: ExternalActionTask): Promise<void> {
    const viewer = currentViewer(this.doc);
    const targetPath = this.win.location.pathname.replace(/^\/+/, "").split("/")[0]?.toLowerCase();
    if (!viewer || viewer !== task.viewer || targetPath !== task.target.toLowerCase()) {
      this.view?.notify("资料页账号与操作任务不匹配");
      return;
    }
    const evidence = collectEvidence(this.doc, this.excluded).get(task.target);
    if (!evidence || availableAction(viewer, evidence) !== task.action) {
      this.view?.notify("资料页没有确认的原生关注控件");
      return;
    }
    try {
      const result = await performAction({
        doc: this.doc, viewer, evidence, signal: new AbortController().signal,
        validContext: () => currentViewer(this.doc) === viewer,
        excluded: this.excluded, kind: task.action,
        onDispatch: () => this.view?.notify("已在资料页执行操作"),
        onRateLimited: () => {
          const until = Date.now() + FOLLOW_COOLDOWN_MS;
          this.setCooldownUntil(until);
          this.onRateLimit?.(until);
        },
      });
      this.view?.notify(result === "requested" ? "关注请求已发送" : "资料页操作已确认");
    } catch (error) {
      this.view?.notify(error instanceof Error ? error.message : "资料页操作未确认");
    }
  }

  private publishState(): void {
    if (!this.onState) return;
    const records = [...this.relations.values()].filter(relation => relation.handle !== this.viewer).map(relation => ({
      handle: relation.handle, relationship: relation.relationship,
      followsYou: relation.followsYou, blue: relation.blue,
      source: relation.source, observedAt: relation.observedAt,
      error: this.errors.get(relation.handle)
        ?? (relation.blue === null ? "蓝 V 待确认" : relation.relationship === "unknown" ? "关系未知"
          : !relation.control?.isConnected ? "缺少当前可执行控件" : undefined),
    }));
    this.onState({
      viewer: this.viewer, route: this.route, discovered: records.length,
      verified: records.filter(item => item.source === "native-card").length,
      pending: this.pending.size + this.queue.length, failed: this.errors.size,
      paused: Date.now() < this.resumeAt, records, updatedAt: Date.now(),
      timings: { ...this.timings },
      diagnostic: !this.viewer ? "当前登录账号身份未确认" : undefined,
    });
  }

  recheck(handle: string): void {
    if (!/^[a-z0-9_]{1,15}$/.test(handle) || this.pending.has(handle)) return;
    this.verified.delete(handle);
    this.attempted.delete(handle);
    this.errors.delete(handle);
    this.schedule();
  }

  private async probeNext(): Promise<void> {
    if (this.probing || this.pending.size || this.confirming || !this.viewer) return;
    if (Date.now() < this.resumeAt) return;
    this.resumeAt = 0;
    const native = collectEvidence(this.doc, this.excluded);
    const avatar = this.queue.find(item => !native.has(item.handle) && this.readyToProbe(item));
    if (!avatar) return;
    const visible = avatar.image.getBoundingClientRect().top < this.win.innerHeight;
    const abort = new AbortController();
    this.probing = abort;
    const generation = this.generation;
    const viewer = this.viewer;
    const started = performance.now();
    const valid = () => this.enabled && !this.doc.hidden && this.generation === generation
      && currentViewer(this.doc) === viewer && this.win.location.href === this.route
      && collectAvatars(this.doc, this.win.location.pathname).some(item =>
        item.anchor === avatar.anchor && item.handle === avatar.handle);
    try {
      await withNativeCard(this.doc, avatar, abort.signal, valid, proof => {
        this.verified.set(avatar.handle, { evidence: proof, expires: Date.now() + 60_000 });
        this.attempted.set(avatar.handle, { count: 2, after: Infinity });
        this.errors.delete(avatar.handle);
      }, this.excluded, true);
    } catch (error) {
      if (valid()) {
        if (!(error instanceof ProbeInterrupted)) this.errors.set(avatar.handle,
          error instanceof Error ? error.message : "资料卡读取失败");
        const previous = this.attempted.get(avatar.handle);
        this.attempted.set(avatar.handle, {
          count: (previous?.count ?? 0) + (error instanceof ProbeInterrupted || !visible ? 0 : 1),
          after: Date.now() + (error instanceof ProbeInterrupted || !visible ? 750 : 10_000),
          prefetched: previous?.prefetched || (!visible && !(error instanceof ProbeInterrupted)),
        });
      }
    } finally {
      this.timings.relationship = performance.now() - started;
      if (this.probing === abort) this.probing = null;
      if (valid()) this.schedule();
    }
  }

  private async act(avatar: Avatar): Promise<void> {
    if (!this.enabled || this.confirming || this.pending.size) return;
    if (cooldownActive(this.cooldownUntil)) {
      this.view?.showCooldown(this.cooldownUntil);
      return;
    }
    const viewer = currentViewer(this.doc);
    if (!viewer || viewer !== this.viewer || this.win.location.href !== this.route) {
      this.scan();
      return;
    }
    const liveAvatar = collectAvatars(this.doc, this.win.location.pathname)
      .find(item => item.anchor === avatar.anchor && item.handle === avatar.handle);
    const cached = this.verified.get(avatar.handle);
    const proof = collectEvidence(this.doc, this.excluded).get(avatar.handle)
      ?? (cached && cached.expires > Date.now() ? cached.evidence : undefined);
    const relation = this.relations.get(avatar.handle);
    const kind = availableAction(viewer, proof) ?? actionFromRelation(viewer, relation);
    const blue = liveAvatar && (relation?.blue === true || hasBlueBadge(liveAvatar));
    if (!liveAvatar || !kind || (kind === "follow" && !blue)
      || (proof && liveAvatar.region.contains(proof.control))) {
      this.view?.notify("状态已变化，请查看 X 原生关注入口");
      this.scan();
      return;
    }
    const generation = this.generation;
    const actionStarted = performance.now();
    if (kind === "unfollow") {
      this.confirming = true;
      const accepted = await this.view?.confirmUnfollow(avatar.handle);
      this.confirming = false;
      if (!accepted || generation !== this.generation || !this.enabled) return;
    }
    if (!proof?.control) {
      if (!this.onExternalAction) {
        this.view?.notify("当前页面没有可用的原生关注控件");
        return;
      }
      try {
        this.phases.set(avatar.handle, "打开资料页");
        this.scan();
        await this.onExternalAction(avatar.handle, kind);
      } catch (error) {
        this.view?.notify(error instanceof Error ? error.message : "无法打开资料页");
      } finally {
        this.phases.delete(avatar.handle);
        this.scan();
      }
      return;
    }
    const abort = new AbortController();
    const background = this.probeTask;
    this.probing?.abort();
    this.pending.set(avatar.handle, abort);
    this.phases.set(avatar.handle, "核实中");
    this.scan();
    const validContext = () => this.enabled && !this.doc.hidden
      && this.generation === generation && this.route === this.win.location.href
      && currentViewer(this.doc) === viewer
      && collectAvatars(this.doc, this.win.location.pathname).some(item =>
        item.anchor === avatar.anchor && item.handle === avatar.handle);
    try {
      if (background) await background;
      const result = await withNativeCard(this.doc, avatar, abort.signal, validContext, async fresh => {
        if (fresh.nativeId !== proof!.nativeId || availableAction(viewer, fresh) !== kind) {
          throw new Error("关注关系已变化，请重新查看");
        }
        const result = await performAction({
          doc: this.doc, viewer, evidence: fresh, signal: abort.signal, validContext,
          excluded: this.excluded, kind,
          onDispatch: () => {
            this.timings.dispatch = performance.now() - actionStarted;
            this.phases.set(avatar.handle, "确认中");
            this.scan();
          },
          onRateLimited: () => {
            const until = Date.now() + FOLLOW_COOLDOWN_MS;
            this.setCooldownUntil(until);
            this.onRateLimit?.(until);
          },
        });
        const confirmed = collectEvidence(this.doc, this.excluded).get(avatar.handle);
        this.timings.confirmation = performance.now() - actionStarted - (this.timings.dispatch ?? 0);
        if (validContext() && confirmed?.nativeId === fresh.nativeId && confirmed.relationship === result) {
          this.verified.set(avatar.handle, { evidence: confirmed, expires: Date.now() + 60_000 });
        }
        return result;
      }, this.excluded);
      if (validContext()) this.view?.notify(result === "requested" ? "关注请求已发送"
        : result === "not-following" ? "X 已显示为未关注" : "X 已显示为已关注");
    } catch (error) {
      if (validContext()) {
        this.verified.delete(avatar.handle);
        if (!cooldownActive(this.cooldownUntil)) {
          this.view?.notify(error instanceof Error ? error.message : "无法确认关注结果");
        }
      }
    } finally {
      if (this.pending.get(avatar.handle) === abort) {
        this.pending.delete(avatar.handle);
        this.phases.delete(avatar.handle);
      }
      this.scan();
    }
  }

  private reposition = (): void => {
    this.schedule();
    if (this.frame || !this.view) return;
    this.frame = this.win.requestAnimationFrame(() => {
      this.frame = 0;
      for (const item of this.buttons.values()) this.view?.position(item);
    });
  };

  destroy(): void {
    this.setEnabled(false);
    this.stopped = true;
    clearTimeout(this.timer);
    clearInterval(this.heartbeat);
    this.win.cancelAnimationFrame(this.frame);
    this.observer.disconnect();
    for (const root of this.observedRoots) root.removeEventListener("scroll", this.reposition, true);
    this.observedRoots = [];
    this.win.removeEventListener("scroll", this.reposition, true);
    this.win.removeEventListener("resize", this.reposition);
    this.win.removeEventListener("popstate", this.schedule);
    this.doc.removeEventListener("visibilitychange", this.onVisibility);
    this.doc.removeEventListener("focusout", this.schedule, true);
    this.doc.removeEventListener("pointermove", this.onInteraction, true);
    this.doc.removeEventListener("pointerdown", this.onInteraction, true);
    this.doc.removeEventListener("keydown", this.onInteraction, true);
  }
}
