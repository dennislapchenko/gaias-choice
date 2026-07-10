-- 007_traffic: first-party analytics — day-bucketed hit counts, nothing else.
-- One row per (day, kind, path); kind is 'page' (SPA pageviews via /track) or
-- 'api' (every matched API request, by route template). No IPs, no user
-- agents, no user ids, no fine timestamps — the privacy page promises
-- exactly this shape.
CREATE TABLE traffic (
    day  TEXT    NOT NULL,              -- UTC 'YYYY-MM-DD'
    kind TEXT    NOT NULL,              -- 'page' | 'api'
    path TEXT    NOT NULL,
    hits INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (day, kind, path)
) WITHOUT ROWID;
