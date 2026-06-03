import { describe, expect, it } from "vitest";
import {
  classifyDatabaseContainer,
  databaseCategoryLabel,
  databaseStatusLabel,
} from "./database-runtime-types";

describe("database runtime helpers", () => {
  it("classifies active ArchIToken data-service containers", () => {
    expect(
      classifyDatabaseContainer({
        name: "architoken-postgres",
        image: "pgvector/pgvector:pg16",
      }),
    ).toEqual({
      group: "architoken",
      category: "relational",
      provider: "PostgreSQL",
    });
    expect(
      classifyDatabaseContainer({
        name: "architoken-qdrant",
        image: "qdrant/qdrant:v1.13.4",
      }),
    ).toEqual({
      group: "architoken",
      category: "vector",
      provider: "Qdrant",
    });
  });

  it("classifies same-host database services without marking them active", () => {
    expect(
      classifyDatabaseContainer({
        name: "chat-mongodb",
        image: "mongo:8.0.20",
      }),
    ).toEqual({
      group: "same_host",
      category: "document",
      provider: "MongoDB",
    });
    expect(
      classifyDatabaseContainer({
        name: "supabase_storage_cadam",
        image: "public.ecr.aws/supabase/storage-api:v1.25.9",
      }),
    ).toEqual({
      group: "same_host",
      category: "storage",
      provider: "Supabase Storage",
    });
  });

  it("keeps Chinese labels stable for the management UI", () => {
    expect(databaseStatusLabel("empty")).toBe("在线 · 空数据");
    expect(databaseCategoryLabel("time_series")).toBe("时序库");
  });
});
