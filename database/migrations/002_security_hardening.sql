BEGIN;

UPDATE medication_categories
SET slug = 'stimulant_adhd'
WHERE slug = 'stimulant'
  AND NOT EXISTS (
    SELECT 1 FROM medication_categories WHERE slug = 'stimulant_adhd'
  );
UPDATE medication_categories
SET slug = 'sedative_anxiety'
WHERE slug = 'sedative'
  AND NOT EXISTS (
    SELECT 1 FROM medication_categories WHERE slug = 'sedative_anxiety'
  );
UPDATE medication_categories
SET slug = 'sleep_medication'
WHERE slug = 'sleep_medicine'
  AND NOT EXISTS (
    SELECT 1 FROM medication_categories WHERE slug = 'sleep_medication'
  );
UPDATE medication_categories
SET slug = 'liquid_over_100ml'
WHERE slug = 'liquid'
  AND NOT EXISTS (
    SELECT 1 FROM medication_categories WHERE slug = 'liquid_over_100ml'
  );

CREATE OR REPLACE FUNCTION record_guidance_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.guidance_audit_log (
      guidance_record_id, actor_id, action, from_status, to_status
    ) VALUES (
      NEW.id,
      coalesce(public.request_actor_id(), NEW.reviewer_id),
      CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'status_changed' END,
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.status END,
      NEW.status
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION record_source_addition()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.guidance_audit_log (
    guidance_record_id, actor_id, action, details
  ) VALUES (
    NEW.guidance_record_id,
    public.request_actor_id(),
    'evidence_added',
    jsonb_build_object('sourceId', NEW.id)
  );
  RETURN NEW;
END;
$$;

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
    NEW.lower_tier_evidence_approved_at IS DISTINCT FROM
      OLD.lower_tier_evidence_approved_at OR
    NEW.lower_tier_evidence_approved_by IS DISTINCT FROM
      OLD.lower_tier_evidence_approved_by OR
    NEW.lower_tier_evidence_reason IS DISTINCT FROM
      OLD.lower_tier_evidence_reason OR
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

ALTER TABLE source_records
ADD COLUMN verified_by uuid REFERENCES admin_users(id);

CREATE FUNCTION protect_source_verification()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  actor uuid := public.request_actor_id();
  actor_role admin_role;
BEGIN
  IF NEW.last_verified_at IS NOT NULL OR NEW.supports_summary THEN
    SELECT role INTO actor_role FROM public.admin_users WHERE id = actor;
    IF coalesce(actor_role NOT IN ('reviewer', 'admin'), true) THEN
      RAISE EXCEPTION
        'only an authenticated reviewer or admin can verify source evidence';
    END IF;
    NEW.verified_by = actor;
  ELSE
    NEW.verified_by = NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER source_verification_guard
BEFORE INSERT ON source_records
FOR EACH ROW EXECUTE FUNCTION protect_source_verification();

DROP POLICY guidance_admin_insert ON guidance_records;
CREATE POLICY guidance_admin_insert ON guidance_records
FOR INSERT WITH CHECK (
  current_admin_role() IS NOT NULL AND status = 'draft'
);

REVOKE ALL ON FUNCTION record_guidance_status_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION record_source_addition() FROM PUBLIC;
REVOKE ALL ON FUNCTION protect_reviewed_guidance() FROM PUBLIC;
REVOKE ALL ON FUNCTION protect_source_verification() FROM PUBLIC;

COMMIT;