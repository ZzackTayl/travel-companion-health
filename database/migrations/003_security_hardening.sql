BEGIN;

CREATE FUNCTION protect_reviewed_guidance()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.status = 'reviewed' AND NEW.status = 'reviewed' AND (
    NEW.jurisdiction_id IS DISTINCT FROM OLD.jurisdiction_id OR
    NEW.medication_category_id IS DISTINCT FROM OLD.medication_category_id OR
    NEW.guidance_type IS DISTINCT FROM OLD.guidance_type OR
    NEW.risk_label IS DISTINCT FROM OLD.risk_label OR
    NEW.title IS DISTINCT FROM OLD.title OR
    NEW.summary IS DISTINCT FROM OLD.summary OR
    NEW.action_text IS DISTINCT FROM OLD.action_text OR
    NEW.applies_to_transit IS DISTINCT FROM OLD.applies_to_transit OR
    NEW.effective_from IS DISTINCT FROM OLD.effective_from OR
    NEW.effective_to IS DISTINCT FROM OLD.effective_to OR
    NEW.confidence IS DISTINCT FROM OLD.confidence OR
    NEW.last_reviewed_at IS DISTINCT FROM OLD.last_reviewed_at OR
    NEW.stale_after IS DISTINCT FROM OLD.stale_after OR
    NEW.unresolved_questions IS DISTINCT FROM OLD.unresolved_questions
  ) THEN
    RAISE EXCEPTION
      'reviewed guidance is immutable; create or reopen a draft revision';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER immutable_reviewed_guidance
BEFORE UPDATE ON guidance_records
FOR EACH ROW EXECUTE FUNCTION protect_reviewed_guidance();

DROP POLICY guidance_admin_insert ON guidance_records;
CREATE POLICY guidance_admin_insert ON guidance_records
FOR INSERT WITH CHECK (
  current_admin_role() IS NOT NULL AND status = 'draft'
);

REVOKE ALL ON FUNCTION protect_reviewed_guidance() FROM PUBLIC;

COMMIT;