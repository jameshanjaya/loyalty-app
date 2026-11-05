UPDATE brands SET birthday_window = 'day';
ALTER TABLE members ADD COLUMN birthday_set_at INTEGER;
ALTER TABLE members ADD COLUMN birthday_override_year INTEGER;
