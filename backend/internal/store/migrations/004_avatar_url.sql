-- 004_avatar_url: profile editing (the account-fields panel) adds an
-- optional avatar image URL, shown instead of the initial-letter avatar
-- around the campfire once a user sets one. No CHECK constraint involved, so
-- a plain ADD COLUMN suffices (unlike 003's table rebuild).
ALTER TABLE users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';
