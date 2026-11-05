import { describe, expect, it } from "vitest";
import { deriveTopics } from "@/lib/ads/topic";

describe("deriveTopics (question -> Blisscco topic slugs)", () => {
  it("maps the pilot example to gaming first, technology as fallback", () => {
    expect(deriveTopics("Suggest some good gaming laptops.")).toEqual(["gaming", "technology"]);
  });
  it("maps clear single-topic questions", () => {
    expect(deriveTopics("Best hotels and flights for a trip to Japan?")[0]).toBe("travel");
    expect(deriveTopics("Easy dinner recipe for tonight")[0]).toBe("food");
  });
  it("returns no topic for small talk", () => {
    expect(deriveTopics("hello, how are you?")).toEqual([]);
    expect(deriveTopics("")).toEqual([]);
  });
  it("returns no topic when the question touches a sensitive subject, even if a topic word is present", () => {
    expect(deriveTopics("Best gym workout for my depression")).toEqual([]);
    expect(deriveTopics("Which political game should I play")).toEqual([]);
  });
  it("never returns more than 3 topics and only valid slugs", () => {
    const t = deriveTopics("gaming laptop course recipe trip workout budget javascript");
    expect(t.length <= 3).toBe(true);
  });
  it("does not match inside longer words", () => {
    expect(deriveTopics("the pcb gamely tripod")).toEqual([]);
  });
});
