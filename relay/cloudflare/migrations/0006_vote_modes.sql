-- Additive : anciens bulletins et définitions conservés, colonne NULL historique.
ALTER TABLE ballots ADD COLUMN selection_json TEXT CHECK(selection_json IS NULL OR json_valid(selection_json));
CREATE TRIGGER ballot_modes_validate BEFORE INSERT ON ballots BEGIN
 SELECT CASE WHEN
  (coalesce((SELECT json_extract(definition,'$.mode') FROM polls WHERE poll_id=NEW.poll_id),'single_choice')='single_choice' AND NEW.selection_json IS NOT NULL)
  OR
  (coalesce((SELECT json_extract(definition,'$.mode') FROM polls WHERE poll_id=NEW.poll_id),'single_choice')!='single_choice' AND NOT EXISTS(
   SELECT 1 FROM polls p JOIN poll_audiences a USING(poll_id)
   WHERE p.poll_id=NEW.poll_id AND json_extract(p.definition,'$.mode') IN ('multiple_choice','ranked_choice')
    AND json_extract(p.definition,'$.voteConfig.version')=1
    AND json_type(p.definition,'$.voteConfig.limit')='integer'
    AND json_type(NEW.selection_json)='array'
    AND json_array_length(NEW.selection_json) BETWEEN 1 AND json_extract(p.definition,'$.voteConfig.limit')
    AND json_extract(p.definition,'$.voteConfig.limit') BETWEEN CASE json_extract(p.definition,'$.mode') WHEN 'ranked_choice' THEN 2 ELSE 1 END AND json_array_length(p.definition,'$.choices')
    AND json_extract(p.definition,'$.voteConfig.rule') IN ('up_to','exact','all')
    AND (json_extract(p.definition,'$.voteConfig.rule')='up_to' OR json_array_length(NEW.selection_json)=json_extract(p.definition,'$.voteConfig.limit'))
    AND (json_extract(p.definition,'$.voteConfig.rule')!='all' OR (json_extract(p.definition,'$.mode')='ranked_choice' AND json_extract(p.definition,'$.voteConfig.limit')=json_array_length(p.definition,'$.choices')))
    AND json_array_length(NEW.selection_json)=(SELECT count(DISTINCT value) FROM json_each(NEW.selection_json))
    AND NOT EXISTS(SELECT 1 FROM json_each(NEW.selection_json) s WHERE s.type!='text' OR NOT EXISTS(SELECT 1 FROM json_each(p.definition,'$.choices') c WHERE json_extract(c.value,'$.id')=s.value))
    AND NEW.choice_id=json_extract(NEW.selection_json,'$[0]')
  )) THEN RAISE(ABORT,'INVALID_BALLOT_MODE') END;
END;
CREATE TRIGGER ballot_selection_immutable BEFORE UPDATE OF selection_json ON ballots
BEGIN SELECT RAISE(ABORT,'BALLOT_IMMUTABLE'); END;
