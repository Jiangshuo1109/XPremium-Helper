import { expect, it } from "vitest";
import { cooldownActive, FOLLOW_COOLDOWN_MS, formatRemaining } from "../src/cooldown";

it("uses a thirty minute cooldown window", () => {
  const now = 1_000_000;
  const until = now + FOLLOW_COOLDOWN_MS;
  expect(cooldownActive(until, now)).toBe(true);
  expect(formatRemaining(until, now)).toBe("30:00");
  expect(formatRemaining(until, until - 1_000)).toBe("00:01");
  expect(cooldownActive(until, until)).toBe(false);
});
