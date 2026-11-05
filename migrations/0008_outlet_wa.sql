ALTER TABLE outlets ADD COLUMN wa TEXT NOT NULL DEFAULT '';

UPDATE outlets SET wa = '6281211112580' WHERE id = 'o_loft' AND (wa IS NULL OR wa = '');
UPDATE outlets SET wa = '6281322223691' WHERE id = 'o_soto' AND (wa IS NULL OR wa = '');
UPDATE outlets SET wa = '6281344447024' WHERE id = 'o_kris' AND (wa IS NULL OR wa = '');
