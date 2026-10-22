-- v0.6 additive. Les définitions/hashes/ballots historiques restent intacts.
CREATE TABLE spaces (
  space_id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  revision INTEGER NOT NULL DEFAULT 1 CHECK(revision>0)
);
CREATE TABLE groups (
  group_id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(space_id),
  name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 100),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','archived')),
  UNIQUE(space_id,group_id)
);
CREATE TABLE space_members (
  member_id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(space_id),
  display_name TEXT NOT NULL CHECK(length(display_name) BETWEEN 1 AND 60),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  UNIQUE(space_id,member_id)
);
CREATE TABLE group_memberships (
  space_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  member_id TEXT NOT NULL,
  FOREIGN KEY(space_id,group_id) REFERENCES groups(space_id,group_id),
  FOREIGN KEY(space_id,member_id) REFERENCES space_members(space_id,member_id),
  PRIMARY KEY(group_id,member_id)
) WITHOUT ROWID;
CREATE TABLE space_access (
  access_id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(space_id),
  role TEXT NOT NULL CHECK(role IN ('admin','creator')),
  group_scopes TEXT CHECK(group_scopes IS NULL OR json_valid(group_scopes)),
  credential_digest TEXT NOT NULL UNIQUE CHECK(length(credential_digest)=64),
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','revoked')),
  CHECK(role!='admin' OR group_scopes IS NULL)
);
CREATE TABLE member_credentials (
  member_id TEXT PRIMARY KEY REFERENCES space_members(member_id),
  credential_digest TEXT NOT NULL UNIQUE CHECK(length(credential_digest)=64)
);
CREATE TABLE invitations (
  invitation_id TEXT PRIMARY KEY,
  space_id TEXT NOT NULL REFERENCES spaces(space_id),
  group_ids TEXT NOT NULL CHECK(json_valid(group_ids)),
  credential_digest TEXT NOT NULL UNIQUE CHECK(length(credential_digest)=64),
  max_uses INTEGER NOT NULL CHECK(max_uses BETWEEN 1 AND 200),
  uses INTEGER NOT NULL DEFAULT 0 CHECK(uses>=0 AND uses<=max_uses),
  expires_at INTEGER NOT NULL,
  closed INTEGER NOT NULL DEFAULT 0 CHECK(closed IN (0,1))
);
CREATE TABLE poll_audiences (
  poll_id TEXT PRIMARY KEY REFERENCES polls(poll_id) ON DELETE CASCADE,
  space_id TEXT NOT NULL REFERENCES spaces(space_id),
  mode TEXT NOT NULL CHECK(mode IN ('space','groups')),
  results_audience TEXT NOT NULL CHECK(results_audience IN ('poll_audience','admins_only')),
  snapshot_size INTEGER CHECK(snapshot_size IS NULL OR snapshot_size>0)
);
CREATE TABLE poll_audience_groups (
  poll_id TEXT NOT NULL REFERENCES poll_audiences(poll_id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(group_id),
  PRIMARY KEY(poll_id,group_id)
) WITHOUT ROWID;
-- AUCUN action_id, ballot_id, digest de soumission ou temps de vote dans ce registre.
CREATE TABLE poll_member_eligibility (
  poll_id TEXT NOT NULL REFERENCES poll_audiences(poll_id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES space_members(member_id),
  consumed INTEGER NOT NULL DEFAULT 0 CHECK(consumed IN (0,1)),
  PRIMARY KEY(poll_id,member_id)
) WITHOUT ROWID;
-- Liaison exclusivement identifiée. Garder les TROIS colonnes historiques de
-- participations : le Worker v0.5 utilise INSERT ... SELECT sans liste de colonnes.
CREATE TABLE member_participations (
  participation_id TEXT PRIMARY KEY REFERENCES participations(participation_id) ON DELETE CASCADE,
  poll_id TEXT NOT NULL REFERENCES polls(poll_id) ON DELETE CASCADE,
  member_id TEXT NOT NULL REFERENCES space_members(member_id),
  UNIQUE(poll_id,member_id)
);
CREATE TRIGGER member_participation_immutable BEFORE UPDATE ON member_participations
BEGIN SELECT RAISE(ABORT,'PARTICIPATION_IMMUTABLE'); END;
CREATE INDEX group_members_by_member ON group_memberships(member_id,group_id);
CREATE INDEX eligibility_by_member ON poll_member_eligibility(member_id,poll_id);
CREATE INDEX spaces_invitation_expiry ON invitations(expires_at,invitation_id);
-- Garde transitoire NON NOMINATIVE, supprimée dans le batch ou annulée au rollback.
CREATE TABLE controlled_vote_guards (
  poll_id TEXT PRIMARY KEY REFERENCES polls(poll_id) ON DELETE CASCADE,
  guard_id TEXT NOT NULL
);
CREATE TRIGGER controlled_ballot_validate BEFORE INSERT ON ballots
WHEN EXISTS(SELECT 1 FROM poll_audiences WHERE poll_id=NEW.poll_id) BEGIN
  SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM controlled_vote_guards WHERE poll_id=NEW.poll_id)
    OR (SELECT coalesce(sum(consumed),0) FROM poll_member_eligibility WHERE poll_id=NEW.poll_id)
       !=1+(SELECT count(*) FROM ballots WHERE poll_id=NEW.poll_id)
    OR EXISTS(SELECT 1 FROM space_members WHERE member_id=NEW.action_id)
    THEN RAISE(ABORT,'CONTROLLED_VOTE_REQUIRED') END);
END;
-- Empêcher également qu’un futur identifiant membre soit choisi pour recopier un actionId.
CREATE TRIGGER member_id_namespace BEFORE INSERT ON space_members
WHEN EXISTS(SELECT 1 FROM ballots WHERE action_id=NEW.member_id)
BEGIN SELECT RAISE(ABORT,'MEMBER_ID_INVALID'); END;
CREATE INDEX ballots_action_namespace ON ballots(action_id);
CREATE TRIGGER audience_group_validate BEFORE INSERT ON poll_audience_groups BEGIN
  SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM poll_audiences a JOIN groups g USING(space_id)
    WHERE a.poll_id=NEW.poll_id AND g.group_id=NEW.group_id AND g.status='active' AND a.snapshot_size IS NULL)
    THEN RAISE(ABORT,'AUDIENCE_GROUP_INVALID') END);
END;
CREATE TRIGGER membership_active BEFORE INSERT ON group_memberships BEGIN
  SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM groups g JOIN space_members m USING(space_id)
    WHERE g.group_id=NEW.group_id AND m.member_id=NEW.member_id AND g.status='active' AND m.status='active')
    THEN RAISE(ABORT,'MEMBERSHIP_INVALID') END);
END;
-- Bornes MVP : lectures privées complètes et budget Worker Free maîtrisés.
CREATE TRIGGER space_members_bound BEFORE INSERT ON space_members
WHEN (SELECT count(*) FROM space_members WHERE space_id=NEW.space_id)>=200
BEGIN SELECT RAISE(ABORT,'SPACE_MEMBERS_LIMIT'); END;
CREATE TRIGGER groups_bound BEFORE INSERT ON groups
WHEN (SELECT count(*) FROM groups WHERE space_id=NEW.space_id)>=20
BEGIN SELECT RAISE(ABORT,'SPACE_GROUPS_LIMIT'); END;
CREATE TRIGGER space_access_bound BEFORE INSERT ON space_access
WHEN (SELECT count(*) FROM space_access WHERE space_id=NEW.space_id)>=20
BEGIN SELECT RAISE(ABORT,'SPACE_ACCESS_LIMIT'); END;
CREATE TRIGGER invitations_bound BEFORE INSERT ON invitations
WHEN (SELECT count(*) FROM invitations WHERE space_id=NEW.space_id)>=40
BEGIN SELECT RAISE(ABORT,'SPACE_INVITATIONS_LIMIT'); END;
CREATE TRIGGER space_polls_bound BEFORE INSERT ON poll_audiences
WHEN (SELECT count(*) FROM poll_audiences WHERE space_id=NEW.space_id)>=200
BEGIN SELECT RAISE(ABORT,'SPACE_POLLS_LIMIT'); END;
CREATE TRIGGER audience_snapshot_immutable BEFORE UPDATE ON poll_audiences
WHEN OLD.snapshot_size IS NOT NULL AND (NEW.space_id!=OLD.space_id OR NEW.mode!=OLD.mode
 OR NEW.snapshot_size IS NOT OLD.snapshot_size)
BEGIN SELECT RAISE(ABORT,'SNAPSHOT_IMMUTABLE'); END;
CREATE TRIGGER eligibility_immutable BEFORE UPDATE ON poll_member_eligibility
WHEN NEW.poll_id!=OLD.poll_id OR NEW.member_id!=OLD.member_id OR NEW.consumed<OLD.consumed
BEGIN SELECT RAISE(ABORT,'ELIGIBILITY_IMMUTABLE'); END;
CREATE TRIGGER eligibility_snapshot_closed BEFORE INSERT ON poll_member_eligibility
WHEN EXISTS(SELECT 1 FROM poll_audiences WHERE poll_id=NEW.poll_id AND snapshot_size IS NOT NULL)
BEGIN SELECT RAISE(ABORT,'SNAPSHOT_IMMUTABLE'); END;
CREATE TRIGGER identified_member_validate BEFORE INSERT ON member_participations BEGIN
  SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM poll_member_eligibility e JOIN space_members m USING(member_id)
    JOIN participations x ON x.participation_id=NEW.participation_id AND x.poll_id=e.poll_id
    WHERE e.poll_id=NEW.poll_id AND e.member_id=NEW.member_id AND m.status='active')
    THEN RAISE(ABORT,'NOT_ELIGIBLE') END);
END;
