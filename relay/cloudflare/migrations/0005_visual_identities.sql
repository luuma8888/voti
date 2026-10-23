-- Additive, appliquée une seule fois via le registre des migrations D1.
-- Aucun choix automatique : les anciens membres/groupes restent sans illustration.
ALTER TABLE space_members ADD COLUMN visual_id TEXT DEFAULT NULL;
ALTER TABLE groups ADD COLUMN visual_id TEXT DEFAULT NULL;
