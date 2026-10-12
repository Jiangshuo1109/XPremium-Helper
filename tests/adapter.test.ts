import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  collectAvatars, collectEvidence, collectRelationFacts, currentViewer, handleFromHref,
  hasBlueBadge, readControl,
} from "../src/adapter";
import { availableAction, buttonLabel, canFollow } from "../src/model";
import { control, fixture, post } from "./fixtures";

beforeEach(() => {
  document.documentElement.innerHTML = fixture().replace(/<!doctype html>|<\/?html[^>]*>/g, "");
  vi.spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue(Object.assign([new DOMRect()], { item: () => new DOMRect() }));
});

describe("identity and relationship evidence", () => {
  it.each([
    ["/Alice", "alice"], ["https://x.com/ALICE/", "alice"],
    ["https://example.com/alice", null], ["/i/chat/123-456", null],
    ["/alice/status/123", null], ["/home", null], ["/alice/followers", null],
    ["javascript:alert(1)", null],
  ])("parses only profile links %s", (href, handle) => {
    expect(handleFromHref(href)).toBe(handle);
  });

  it("requires one visible current viewer", () => {
    expect(currentViewer(document)).toBe("viewer");
    document.querySelector("nav")!.innerHTML += '<a data-testid="AppTabBar_Profile_Link" href="/other">Profile</a>';
    expect(currentViewer(document)).toBeNull();
  });

  it("does not infer a relationship from missing buttons or prose", () => {
    document.querySelector("main")!.innerHTML += '<p>Follows you @unknown</p>';
    const evidence = collectEvidence(document);
    expect(evidence.has("unknown")).toBe(false);
    expect(buttonLabel(evidence.get("alice")!)).toBe("关注");
    expect(buttonLabel(evidence.get("bob")!)).toBe("回关");
    expect(canFollow("viewer", evidence.get("carol"))).toBe(false);
    expect(canFollow("viewer", evidence.get("viewer"))).toBe(false);
    expect(canFollow(null, evidence.get("alice"))).toBe(false);
  });

  it.each(["关注", "回关", "Follow", "Follow back"])("accepts explicit not-following state %s", text => {
    document.body.innerHTML = control("alice", text);
    expect(collectEvidence(document).get("alice")?.relationship).toBe("not-following");
  });

  it.each(["Following", "Unfollow", "正在关注", "已关注", "取消关注"])("hides following state %s", text => {
    document.body.innerHTML = control("alice", text);
    expect(collectEvidence(document).get("alice")?.relationship).toBe("following");
  });

  it.each(["Requested", "Cancel follow request", "已请求", "请求已发送"])("distinguishes pending request %s", text => {
    document.body.innerHTML = control("alice", text);
    expect(collectEvidence(document).get("alice")?.relationship).toBe("requested");
  });

  it("does not let mismatched account, arbitrary button, hidden or disabled controls become evidence", () => {
    document.body.innerHTML = control("alice");
    const button = document.querySelector("button")!;
    button.setAttribute("aria-label", "Follow @bob");
    expect(readControl(button)).toBeNull();
    button.setAttribute("aria-label", "Follow @alice");
    button.disabled = true;
    expect(readControl(button)).toBeNull();
    button.disabled = false;
    button.parentElement!.hidden = true;
    expect(readControl(button)).toBeNull();
    button.parentElement!.hidden = false;
    button.dataset.testid = "random-follow";
    expect(readControl(button)).toBeNull();
    button.remove();
    expect(readControl(button)).toBeNull();
  });

  it("rejects conflicting evidence and mismatched state/test id", () => {
    document.body.innerHTML = control("alice") + control("alice", "Following", false, 200);
    expect(collectEvidence(document).has("alice")).toBe(false);
    document.body.innerHTML = control("alice");
    document.querySelector("button")!.dataset.testid = "100-unfollow";
    expect(collectEvidence(document).has("alice")).toBe(false);
  });

  it("does not infer follows-you from text outside the same card", () => {
    document.querySelector("main")!.innerHTML += '<span data-testid="userFollowIndicator">Follows you</span>';
    expect(collectEvidence(document).get("alice")?.followsYou).toBeNull();
  });

  it("rejects two native user ids claiming the same handle", () => {
    document.body.innerHTML = control("alice", "Follow", false, 1)
      + control("alice", "Follow", false, 2);
    expect(collectEvidence(document).has("alice")).toBe(false);
  });

  it("shows unfollow when following and mutual status is not confirmed", () => {
    for (const followsYou of [false, null]) {
      document.body.innerHTML = control("alice", "Following", followsYou);
      const evidence = collectEvidence(document).get("alice")!;
      expect(availableAction("viewer", evidence)).toBe("unfollow");
      expect(buttonLabel(evidence)).toBe("取关");
    }
    document.body.innerHTML = control("alice", "Following", true);
    expect(availableAction("viewer", collectEvidence(document).get("alice"))).toBeNull();
  });

  it("rejects conflicting inbound relations", () => {
    document.body.innerHTML = control("alice", "Following", true)
      + control("alice", "Following", false);
    expect(collectEvidence(document).has("alice")).toBe(false);
  });
});

describe("avatar boundaries", () => {
  it("takes author avatars and excludes body images or nested quoted avatars", () => {
    document.querySelector("article .post-body")!.innerHTML += post("quoted", 7);
    const handles = collectAvatars(document, "/home").map(item => item.handle);
    expect(handles).not.toContain("quoted");
    expect(handles.filter(handle => handle === "alice")).toHaveLength(2);
    expect(collectAvatars(document, "/search")).toHaveLength(0);
    expect(collectAvatars(document, "/alice/status/123")).toHaveLength(6);
  });

  it("takes one avatar from each profile followers row", () => {
    document.body.innerHTML = `<nav><a data-testid="AppTabBar_Profile_Link" href="/viewer">Profile</a></nav>
      <div data-testid="UserCell">
        <div data-testid="UserAvatar-Container-alice"><a href="/alice"><img alt=""></a></div>
        <div data-testid="User-Name"><a href="/alice">@alice
          <svg data-testid="icon-verified" style="fill:rgb(29, 155, 240)"></svg></a></div>
        <button data-testid="100-follow" aria-label="Follow @alice">关注</button>
      </div>
      <div data-testid="UserCell">
        <div data-testid="UserAvatar-Container-bob"><a href="/bob"><img alt=""></a></div>
        <div data-testid="User-Name"><a href="/bob">@bob</a></div>
        <button data-testid="101-unfollow" aria-label="Following @bob">正在关注</button>
      </div>`;
    const avatars = collectAvatars(document, "/viewer/followers");
    expect(avatars.map(item => item.handle)).toEqual(["alice", "bob"]);
    expect(hasBlueBadge(avatars[0])).toBe(true);
    expect(hasBlueBadge(avatars[1])).toBe(false);
  });

  it("rejects identity mismatch after DOM reuse", () => {
    document.querySelector('[data-testid="UserAvatar-Container-alice"] a')!.setAttribute("href", "/bob");
    expect(collectAvatars(document, "/home").filter(item => item.handle === "alice")).toHaveLength(1);
  });

  it("accepts only unambiguous linked single-chat avatars", () => {
    document.body.innerHTML = `<div data-testid="conversation">${post("alice")}</div>`;
    expect(collectAvatars(document, "/messages/123")).toHaveLength(1);
    document.querySelector('[data-testid="conversation"]')!.innerHTML += post("bob");
    expect(collectAvatars(document, "/messages/123")).toHaveLength(0);
    document.body.innerHTML = `<div data-testid="conversation">${post("alice")}<a href="/i/chat/g123">群聊</a></div>`;
    expect(collectAvatars(document, "/i/chat")).toHaveLength(0);
    document.body.innerHTML = '<a href="/i/chat/123-456"><img alt="user avatar"></a>';
    expect(collectAvatars(document, "/i/chat")).toHaveLength(0);
  });

  it("accepts explicit chat relationship fields without treating missing fields as negative", () => {
    document.body.innerHTML = "";
    const row = document.createElement("div");
    row.dataset.dmMessageRow = "group-1";
    row.dataset.xfhRelationship = "not-following";
    row.dataset.xfhFollowsYou = "true";
    row.dataset.xfhBlue = "true";
    row.innerHTML = `<div style="grid-area: avatar"><a href="/alice"><img alt="user avatar"></a></div>`;
    const host = document.createElement("div");
    host.dataset.testid = "xchatEmbedRoute";
    document.body.append(host);
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<div data-testid="dm-message-list"></div>`;
    root.querySelector("[data-testid=dm-message-list]")!.append(row);
    const avatars = collectAvatars(document, "/i/chat/g123");
    const facts = collectRelationFacts(avatars, collectEvidence(document));
    expect(facts.get("alice")).toMatchObject({
      relationship: "not-following", followsYou: true, blue: true, source: "page",
    });
    row.removeAttribute("data-xfh-follows-you");
    const uncertain = collectRelationFacts(collectAvatars(document, "/i/chat/g123"), collectEvidence(document));
    expect(uncertain.get("alice")?.followsYou).toBeNull();
  });
});
