-- Aucun changement du schéma métier ou des bulletins. Cleanup borné sans scan global.
CREATE INDEX publications_expiry ON publications(expires_at, poll_id);
CREATE INDEX garbage_due ON r2_garbage(delete_after, object_key);
