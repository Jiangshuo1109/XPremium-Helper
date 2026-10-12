import { beforeEach, expect, it, vi } from "vitest";
import { collectAvatars, hasBlueBadge } from "../src/adapter";
import { post } from "./fixtures";

beforeEach(() => {
  document.body.innerHTML = post("alice");
  vi.spyOn(HTMLElement.prototype, "getClientRects")
    .mockReturnValue(Object.assign([new DOMRect()], { item: () => new DOMRect() }));
});

it("accepts a blue verified badge belonging to the author", () => {
  expect(hasBlueBadge(collectAvatars(document, "/home")[0])).toBe(true);
});

it.each(["rgb(232, 185, 72)", "rgb(130, 154, 171)", ""])("rejects non-blue or unknown badges: %s", color => {
  document.querySelector<SVGElement>("svg")!.style.fill = color;
  expect(hasBlueBadge(collectAvatars(document, "/home")[0])).toBe(false);
});

it("does not borrow a badge from a quoted author", () => {
  document.querySelector("svg")!.remove();
  document.querySelector("article")!.insertAdjacentHTML("beforeend", post("bob"));
  expect(hasBlueBadge(collectAvatars(document, "/home")[0])).toBe(false);
});
