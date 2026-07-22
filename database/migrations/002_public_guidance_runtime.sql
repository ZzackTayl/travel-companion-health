CREATE TABLE guidance_runtime_settings (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  public_evaluation_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES admin_users(id),
  reason text NOT NULL CHECK (length(trim(reason)) > 0)
);

UPDATE medication_categories
SET slug = CASE slug
  WHEN 'stimulant' THEN 'stimulant_adhd'
  WHEN 'sedative' THEN 'sedative_anxiety'
  WHEN 'sleep_medicine' THEN 'sleep_medication'
  WHEN 'liquid' THEN 'liquid_over_100ml'
END
WHERE slug IN ('stimulant', 'sedative', 'sleep_medicine', 'liquid');

INSERT INTO guidance_runtime_settings (
  singleton,
  public_evaluation_enabled,
  reason
) VALUES (
  true,
  false,
  'Public evaluation remains disabled until governed guidance is ready'
);

CREATE TABLE guidance_runtime_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  actor_id uuid NOT NULL REFERENCES admin_users(id),
  public_evaluation_enabled boolean NOT NULL,
  reason text NOT NULL CHECK (length(trim(reason)) > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON guidance_runtime_settings, guidance_runtime_audit_log FROM PUBLIC;

CREATE OR REPLACE FUNCTION record_guidance_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO guidance_audit_log (
      guidance_record_id, actor_id, action, from_status, to_status
    ) VALUES (
      NEW.id,
      coalesce(
        request_actor_id(),
        NEW.reviewer_id
      ),
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
  INSERT INTO guidance_audit_log (
    guidance_record_id, actor_id, action, details
  ) VALUES (
    NEW.guidance_record_id,
    request_actor_id(),
    'evidence_added',
    jsonb_build_object('sourceId', NEW.id)
  );
  RETURN NEW;
END;
$$;

CREATE FUNCTION set_guidance_public_evaluation_enabled(
  p_enabled boolean,
  p_reason text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id uuid := request_actor_id();
BEGIN
  IF current_admin_role() IS DISTINCT FROM 'admin'::admin_role THEN
    RAISE EXCEPTION 'only an authenticated admin can change public guidance availability';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'changing public guidance availability requires a reason';
  END IF;

  UPDATE guidance_runtime_settings
  SET
    public_evaluation_enabled = p_enabled,
    updated_at = now(),
    updated_by = actor_id,
    reason = p_reason
  WHERE singleton;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'guidance runtime settings are unavailable';
  END IF;

  INSERT INTO guidance_runtime_audit_log (
    actor_id,
    public_evaluation_enabled,
    reason
  ) VALUES (
    actor_id,
    p_enabled,
    p_reason
  );

  RETURN p_enabled;
END;
$$;

CREATE FUNCTION enforce_guidance_verification_word_boundaries()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'published'
     AND NEW.risk_label IN ('high_risk', 'unknown')
     AND (
       NEW.action_text !~*
         '\m(verify|check|confirm|contact)\M.*\m(official|authority|embassy|customs|government)\M'
       OR NEW.action_text ~* '\m(unofficial|non-government|non-governmental)\M'
     ) THEN
    RAISE EXCEPTION 'high-risk and unknown guidance requires official verification action';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER guidance_verification_word_boundary_guard
BEFORE INSERT OR UPDATE ON guidance_records
FOR EACH ROW EXECUTE FUNCTION enforce_guidance_verification_word_boundaries();

CREATE FUNCTION enforce_all_supporting_evidence_valid()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  supporting_count integer;
  invalid_count integer;
BEGIN
  IF NEW.status <> 'published' THEN
    RETURN NEW;
  END IF;

  SELECT
    count(*),
    count(*) FILTER (
      WHERE last_verified_at IS NULL
        OR last_verified_at > now()
        OR last_verified_at < NEW.last_reviewed_at
        OR accessed_at > now()
    )
  INTO supporting_count, invalid_count
  FROM source_records
  WHERE guidance_record_id = NEW.id
    AND source_type <> 'social'
    AND quality_tier < 4
    AND supports_summary;

  IF supporting_count > 20 THEN
    RAISE EXCEPTION 'published guidance cannot have more than 20 supporting sources';
  END IF;
  IF invalid_count > 0 THEN
    RAISE EXCEPTION 'all supporting sources must be current for this review';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guidance_supporting_evidence_guard
BEFORE INSERT OR UPDATE ON guidance_records
FOR EACH ROW EXECUTE FUNCTION enforce_all_supporting_evidence_valid();

DROP FUNCTION archive_guidance(uuid);

CREATE FUNCTION archive_guidance(
  p_guidance_id uuid,
  p_reason text
)
RETURNS SETOF guidance_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  archived guidance_records%ROWTYPE;
  previous_status content_status;
BEGIN
  IF current_admin_role() IS DISTINCT FROM 'admin'::admin_role THEN
    RAISE EXCEPTION 'only an authenticated admin can archive guidance';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'archiving guidance requires a reason';
  END IF;

  SELECT status INTO previous_status
  FROM guidance_records
  WHERE id = p_guidance_id AND status <> 'archived'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active guidance record not found';
  END IF;

  UPDATE guidance_records
  SET status = 'archived'
  WHERE id = p_guidance_id
  RETURNING * INTO archived;

  INSERT INTO guidance_audit_log (
    guidance_record_id,
    actor_id,
    action,
    from_status,
    to_status,
    details
  ) VALUES (
    archived.id,
    request_actor_id(),
    'archived',
    previous_status,
    'archived',
    jsonb_build_object('reason', p_reason)
  );

  RETURN NEXT archived;
END;
$$;

DROP VIEW public_guidance_records;

CREATE VIEW public_guidance_records AS
SELECT
  guidance.id,
  guidance.jurisdiction_id,
  guidance.medication_category_id,
  guidance.guidance_type,
  guidance.risk_label,
  guidance.title,
  guidance.summary,
  guidance.action_text,
  guidance.applies_to_transit,
  guidance.effective_from,
  guidance.effective_to,
  guidance.status,
  guidance.confidence,
  guidance.last_reviewed_at,
  guidance.stale_after,
  true AS reviewed_for_publication,
  (
    guidance.lower_tier_evidence_approved_at IS NOT NULL
    AND guidance.lower_tier_evidence_approved_by IS NOT NULL
    AND length(trim(coalesce(guidance.lower_tier_evidence_reason, ''))) > 0
  ) AS lower_tier_evidence_approved,
  jurisdiction.type AS jurisdiction_type,
  jurisdiction.code AS jurisdiction_code,
  category.slug AS medication_category_slug,
  jsonb_agg(
    jsonb_build_object(
      'id', source.id,
      'url', source.url,
      'title', source.title,
      'sourceType', source.source_type,
      'qualityTier', source.quality_tier,
      'excerpt', source.excerpt,
      'accessedAt', source.accessed_at,
      'lastVerifiedAt', source.last_verified_at,
      'supportsSummary', source.supports_summary
    )
    ORDER BY source.quality_tier, source.id
  ) AS sources
FROM guidance_records guidance
JOIN jurisdictions jurisdiction
  ON jurisdiction.id = guidance.jurisdiction_id
LEFT JOIN medication_categories category
  ON category.id = guidance.medication_category_id
JOIN admin_users reviewer
  ON reviewer.id = guidance.reviewer_id
  AND reviewer.role IN ('reviewer', 'admin')
JOIN source_records source
  ON source.guidance_record_id = guidance.id
  AND source.source_type <> 'social'
  AND source.quality_tier < 4
  AND source.supports_summary
  AND source.last_verified_at IS NOT NULL
  AND source.last_verified_at <= now()
  AND source.last_verified_at >= guidance.last_reviewed_at
  AND source.accessed_at <= now()
WHERE guidance.status = 'published'
  AND guidance.last_reviewed_at IS NOT NULL
  AND guidance.last_reviewed_at <= now()
  AND guidance.stale_after IS NOT NULL
  AND guidance.stale_after > now()
  AND guidance.stale_after > guidance.last_reviewed_at
  AND guidance.stale_after <= guidance.last_reviewed_at + make_interval(
    days =>
      CASE
        WHEN guidance.risk_label = 'high_risk' THEN 60
        WHEN jurisdiction.type = 'airport_authority' THEN 90
        ELSE 180
      END
  )
  AND (
    guidance.effective_from IS NULL
    OR guidance.effective_from <= current_date
  )
  AND (
    guidance.effective_to IS NULL
    OR guidance.effective_to >= current_date
  )
  AND jsonb_array_length(guidance.unresolved_questions) = 0
  AND (
    guidance.risk_label NOT IN ('high_risk', 'unknown')
    OR (
      guidance.action_text
        ~* '\m(verify|check|confirm|contact)\M.*\m(official|authority|embassy|customs|government)\M'
      AND guidance.action_text
        !~* '\m(unofficial|non-government|non-governmental)\M'
    )
  )
  AND (
    guidance.summary || ' ' || guidance.action_text
  ) !~* '(guaranteed|definitely legal|completely safe|will be allowed|will clear customs)'
GROUP BY
  guidance.id,
  jurisdiction.type,
  jurisdiction.code,
  category.slug
HAVING count(*) <= 20
  AND NOT EXISTS (
    SELECT 1
    FROM source_records invalid_source
    WHERE invalid_source.guidance_record_id = guidance.id
      AND invalid_source.source_type <> 'social'
      AND invalid_source.quality_tier < 4
      AND invalid_source.supports_summary
      AND (
        invalid_source.last_verified_at IS NULL
        OR invalid_source.last_verified_at > now()
        OR invalid_source.last_verified_at < guidance.last_reviewed_at
        OR invalid_source.accessed_at > now()
      )
  )
  AND (
    count(*) FILTER (WHERE source.quality_tier <= 2) > 0
    OR (
      count(*) FILTER (WHERE source.quality_tier = 3) >= 2
      AND guidance.confidence IN ('low', 'medium')
      AND guidance.lower_tier_evidence_approved_at IS NOT NULL
      AND guidance.lower_tier_evidence_approved_at <= now()
      AND guidance.lower_tier_evidence_approved_by IS NOT NULL
      AND length(trim(coalesce(guidance.lower_tier_evidence_reason, ''))) > 0
      AND EXISTS (
        SELECT 1
        FROM admin_users approver
        WHERE approver.id = guidance.lower_tier_evidence_approved_by
          AND approver.role IN ('reviewer', 'admin')
      )
    )
  );

REVOKE ALL ON public_guidance_records FROM PUBLIC;

CREATE FUNCTION get_public_guidance_for_route(p_requirements jsonb)
RETURNS SETOF public_guidance_records
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF jsonb_typeof(p_requirements) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'requirements must be a JSON array';
  END IF;
  IF NOT coalesce(
    (
      SELECT public_evaluation_enabled
      FROM guidance_runtime_settings
      WHERE singleton
    ),
    false
  ) THEN
    RAISE EXCEPTION 'public guidance evaluation is disabled';
  END IF;
  IF jsonb_array_length(p_requirements) NOT BETWEEN 1 AND 250 THEN
    RAISE EXCEPTION 'guidance requirement count is invalid';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_requirements) requested
    WHERE jsonb_typeof(requested) IS DISTINCT FROM 'object'
      OR NOT (requested ? 'type')
      OR requested ->> 'type' NOT IN ('country', 'airport_authority')
      OR coalesce(requested ->> 'code', '') !~ '^[A-Za-z0-9]{2,8}$'
      OR NOT (requested ? 'guidanceType')
      OR requested ->> 'guidanceType' NOT IN (
        'general', 'packaging', 'documentation', 'quantity_limit',
        'prohibited', 'restricted', 'screening', 'declaration',
        'transit', 'airline_carriage'
      )
      OR NOT (requested ? 'medicationCategorySlug')
      OR (
        jsonb_typeof(requested -> 'medicationCategorySlug') = 'string'
        AND requested ->> 'medicationCategorySlug'
          !~ '^[a-z0-9_]{1,80}$'
      )
      OR jsonb_typeof(requested -> 'medicationCategorySlug')
        NOT IN ('string', 'null')
  ) THEN
    RAISE EXCEPTION 'guidance requirement is invalid';
  END IF;

  RETURN QUERY
  SELECT guidance.*
  FROM public_guidance_records guidance
  WHERE EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_requirements) requested
    WHERE requested ->> 'type' = guidance.jurisdiction_type
      AND upper(requested ->> 'code') = upper(guidance.jurisdiction_code)
      AND requested ->> 'guidanceType' = guidance.guidance_type::text
      AND requested ->> 'medicationCategorySlug'
        IS NOT DISTINCT FROM guidance.medication_category_slug
  );
END;
$$;

REVOKE ALL ON FUNCTION set_guidance_public_evaluation_enabled(boolean, text)
FROM PUBLIC;
REVOKE ALL ON FUNCTION record_guidance_status_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION record_source_addition() FROM PUBLIC;
REVOKE ALL ON FUNCTION archive_guidance(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION get_public_guidance_for_route(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_public_guidance_for_route(jsonb) TO PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION
      set_guidance_public_evaluation_enabled(boolean, text)
      TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION archive_guidance(uuid, text)
      TO authenticated';
  END IF;
END;
$$;