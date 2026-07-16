-- 008_drop_hits: the /hello scaffold (001's hits counter) is deleted; drop
-- its table. /api/healthz's non-mutating Ping is the DB probe now.
DROP TABLE hits;
