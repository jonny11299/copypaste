-- Exported from QuickDBD: https://www.quickdatabasediagrams.com/
-- NOTE! If you have used non-SQL datatypes in your design, you will have to change these here.

-- @Claude: cm_tool payload schema — context note
-- This schema stores clipboard payloads for a keyboard-driven Electron overlay app. Data is loaded from Excel files and parsed into this structure.
-- Navigation:
-- ⌃←→     select chunk
-- ⌃↑↓     select item within chunk
-- ⌃1–0    copy c_id 0–9
-- ⌃⇧1–0  copy c_id 10–19
-- Copy logic: c_override ?? c_contents
-- Conventions:
-- c_id 0 = chunk_title, c_id 1 = item_title (pre-populated on parse)
-- programmatic mode = one chunk, chunk selector hidden
-- c_type is always 'string' for now — placeholder, do not extend until specified

CREATE TABLE "payloads" (
    "id" text   NOT NULL,
    "name" text   NOT NULL,
    -- 'programmatic' | 'direct' | '1x1'
    "mode" text   NOT NULL,
    -- ISO timestamp, null until saved
    "saved_at" text   NULL,
    CONSTRAINT "pk_payloads" PRIMARY KEY (
        "id"
     )
);

CREATE TABLE "chunks" (
    "id" text   NOT NULL,
    "payload_id" text   NOT NULL,
    -- ordering
    "chunk_index" int   NOT NULL,
    -- e.g. 'SLI
    "chunk_title" text   NOT NULL,
    CONSTRAINT "pk_chunks" PRIMARY KEY (
        "id"
     )
);

CREATE TABLE "items" (
    "id" text   NOT NULL,
    "chunk_id" text   NOT NULL,
    -- ordering
    "item_index" int   NOT NULL,
    "item_title" text   NOT NULL,
    CONSTRAINT "pk_items" PRIMARY KEY (
        "id"
     )
);

CREATE TABLE "contents" (
    "id" text   NOT NULL,
    "item_id" text   NOT NULL,
    -- 0–19, keyboard slot
    "c_id" int   NOT NULL,
    "c_title" text   NOT NULL,
    "c_contents" text   NOT NULL,
    -- null = use c_contents
    "c_override" text   NULL,
    -- default 'string', will later be a useful field that we intentionally define and read, but for now just use 'string'.
    "c_type" text   NOT NULL,
    CONSTRAINT "pk_contents" PRIMARY KEY (
        "id"
     )
);

ALTER TABLE "chunks" ADD CONSTRAINT "fk_chunks_payload_id" FOREIGN KEY("payload_id")
REFERENCES "payloads" ("id");

ALTER TABLE "items" ADD CONSTRAINT "fk_items_chunk_id" FOREIGN KEY("chunk_id")
REFERENCES "chunks" ("id");

ALTER TABLE "contents" ADD CONSTRAINT "fk_contents_item_id" FOREIGN KEY("item_id")
REFERENCES "items" ("id");

