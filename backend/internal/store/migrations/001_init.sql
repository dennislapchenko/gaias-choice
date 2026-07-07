-- 001_init: a trivial hits counter proving the DB round-trip end-to-end.
-- Real schema (users/sessions/pages) belongs to the portal plan, not here.
CREATE TABLE hits (
    id    INTEGER PRIMARY KEY CHECK (id = 1),
    count INTEGER NOT NULL
);

INSERT INTO hits (id, count) VALUES (1, 0);
