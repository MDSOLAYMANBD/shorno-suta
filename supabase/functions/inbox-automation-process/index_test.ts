import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { __test } from "./index.ts";

const { classify, normalize, bnDigitsToEn } = __test;

Deno.test("price-only does not trigger order", () => {
  assertEquals(classify("price koto?").kind, "pricing_only");
  assertEquals(classify("দাম কত").kind, "pricing_only");
});

Deno.test("number alone is not an order", () => {
  assertEquals(classify("850 taka").kind, "noop");
  assertEquals(classify("850?").kind, "noop");
});

Deno.test("number + intent triggers order_intent", () => {
  const d = classify("850 nibo");
  assertEquals(d.kind, "order_intent");
  if (d.kind === "order_intent") assertEquals(d.price, 850);
});

Deno.test("Bangla digits + Bangla intent", () => {
  const d = classify("৮৫০ নিবো");
  assertEquals(d.kind, "order_intent");
  if (d.kind === "order_intent") assertEquals(d.price, 850);
});

Deno.test("confirm word alone classifies as confirm", () => {
  assertEquals(classify("জি").kind, "confirm");
  assertEquals(classify("ok").kind, "confirm");
});

Deno.test("cancel takes priority", () => {
  assertEquals(classify("লাগবে না 850").kind, "cancel");
});

Deno.test("number out of range ignored", () => {
  // 5 < 50 so no priceCandidate -> intent without number is still noop
  assertEquals(classify("5 nibo").kind, "noop");
});

Deno.test("bnDigitsToEn", () => {
  assertEquals(bnDigitsToEn("৮৫০"), "850");
  assertEquals(normalize("DAM ৮৫০"), "dam 850");
});
