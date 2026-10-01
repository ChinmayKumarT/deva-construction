import { describe, it, expect, beforeAll } from "vitest";
import { ownStorageUrl } from "./storageUrl";

describe("ownStorageUrl", () => {
  beforeAll(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
  });

  it("accepts a URL in our project-images bucket", () => {
    const url = "https://abc.supabase.co/storage/v1/object/public/project-images/updates/1-x.jpg";
    expect(ownStorageUrl(url)).toBe(url);
  });

  it("treats empty as no photo", () => {
    expect(ownStorageUrl("")).toBeNull();
    expect(ownStorageUrl(null)).toBeNull();
  });

  it("rejects anything outside our bucket", () => {
    expect(() => ownStorageUrl("https://evil.example/x.jpg")).toThrow();
    expect(() => ownStorageUrl("https://abc.supabase.co/storage/v1/object/public/other-bucket/x.jpg")).toThrow();
  });
});
