CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TYPE content_status AS ENUM (
  'draft', 'reviewed', 'published', 'stale', 'archived', 'needs_verification'
);
CREATE TYPE guidance_type AS ENUM (
  'general', 'packaging', 'documentation', 'quantity_limit', 'prohibited',
  'restricted', 'screening', 'declaration', 'transit', 'airline_carriage'
);
CREATE TYPE risk_label AS ENUM (
  'likely_ok', 'check_documentation', 'prior_permission_may_be_required',
  'high_risk', 'unknown'
);
CREATE TYPE confidence_level AS ENUM (
  'official_verified', 'high', 'medium', 'low', 'unknown'
);
CREATE TYPE source_type AS ENUM (
  'government', 'customs', 'health_authority', 'embassy',
  'aviation_authority', 'airport', 'airline', 'incb', 'cdc', 'tsa',
  'trusted_secondary', 'social'
);
CREATE TYPE admin_role AS ENUM ('admin', 'researcher', 'reviewer');

CREATE TABLE admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL UNIQUE,
  role admin_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

CREATE TABLE jurisdictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (
    type IN ('country', 'region', 'city', 'airport_authority', 'airline', 'transit')
  ),
  code text NOT NULL,
  name text NOT NULL,
  country_code char(2) NOT NULL,
  parent_id uuid REFERENCES jurisdictions(id),
  priority integer NOT NULL DEFAULT 0,
  UNIQUE (type, code)
);

CREATE TABLE medication_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  label text NOT NULL,
  description text NOT NULL,
  risk_level_default text NOT NULL CHECK (
    risk_level_default IN ('low', 'medium', 'high', 'unknown')
  ),
  user_prompt text,
  active boolean NOT NULL DEFAULT true
);

CREATE TABLE guidance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  medication_category_id uuid REFERENCES medication_categories(id),
  guidance_type guidance_type NOT NULL,
  risk_label risk_label NOT NULL,
  title text NOT NULL CHECK (length(trim(title)) > 0),
  summary text NOT NULL CHECK (length(trim(summary)) > 0),
  action_text text NOT NULL CHECK (length(trim(action_text)) > 0),
  applies_to_transit boolean NOT NULL DEFAULT false,
  effective_from date,
  effective_to date,
  status content_status NOT NULL DEFAULT 'draft',
  confidence confidence_level NOT NULL DEFAULT 'unknown',
  last_reviewed_at timestamptz,
  stale_after timestamptz,
  reviewer_id uuid REFERENCES admin_users(id),
  lower_tier_evidence_approved_at timestamptz,
  lower_tier_evidence_approved_by uuid REFERENCES admin_users(id),
  lower_tier_evidence_reason text,
  unresolved_questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (effective_to IS NULL OR effective_from IS NULL OR effective_to >= effective_from),
  CHECK (jsonb_typeof(unresolved_questions) = 'array')
);

CREATE TABLE source_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guidance_record_id uuid NOT NULL REFERENCES guidance_records(id) ON DELETE RESTRICT,
  url text NOT NULL CHECK (url ~ '^https://'),
  title text NOT NULL CHECK (length(trim(title)) > 0),
  source_type source_type NOT NULL,
  quality_tier smallint NOT NULL CHECK (quality_tier BETWEEN 1 AND 4),
  excerpt text NOT NULL CHECK (length(trim(excerpt)) >= 20),
  published_at date,
  accessed_at timestamptz NOT NULL,
  last_verified_at timestamptz,
  supports_summary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    (source_type IN (
      'government', 'customs', 'health_authority', 'embassy', 'incb', 'cdc', 'tsa'
    ) AND quality_tier = 1)
    OR (source_type IN ('aviation_authority', 'airport', 'airline') AND quality_tier = 2)
    OR (source_type = 'trusted_secondary' AND quality_tier = 3)
    OR (source_type = 'social' AND quality_tier = 4)
  )
);

CREATE TABLE launch_coverage_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jurisdiction_id uuid NOT NULL REFERENCES jurisdictions(id),
  medication_category_id uuid REFERENCES medication_categories(id),
  guidance_type guidance_type NOT NULL,
  label text NOT NULL,
  required_at_launch boolean NOT NULL DEFAULT true,
  UNIQUE NULLS NOT DISTINCT (
    jurisdiction_id, medication_category_id, guidance_type
  )
);

CREATE TABLE guidance_audit_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  guidance_record_id uuid NOT NULL REFERENCES guidance_records(id) ON DELETE RESTRICT,
  actor_id uuid REFERENCES admin_users(id),
  action text NOT NULL,
  from_status content_status,
  to_status content_status,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX guidance_lookup_idx ON guidance_records (
  jurisdiction_id, medication_category_id, guidance_type, status
);
CREATE INDEX guidance_stale_idx ON guidance_records (stale_after)
  WHERE status = 'published';
CREATE INDEX source_guidance_idx ON source_records (guidance_record_id);
CREATE UNIQUE INDEX one_published_guidance_per_scope_idx
ON guidance_records (
  jurisdiction_id,
  coalesce(medication_category_id, '00000000-0000-0000-0000-000000000000'::uuid),
  guidance_type
)
WHERE status = 'published';

CREATE FUNCTION request_actor_id()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid
$$;

CREATE FUNCTION prevent_source_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'source evidence is append-only; create a replacement record';
END;
$$;

CREATE TRIGGER immutable_source_evidence
BEFORE UPDATE OR DELETE ON source_records
FOR EACH ROW EXECUTE FUNCTION prevent_source_mutation();

CREATE FUNCTION prevent_published_source_attachment()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM guidance_records
    WHERE id = NEW.guidance_record_id AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'create a new guidance revision before attaching evidence';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER source_requires_draft_revision
BEFORE INSERT ON source_records
FOR EACH ROW EXECUTE FUNCTION prevent_published_source_attachment();

CREATE FUNCTION protect_evidence_approval()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  actor_role admin_role;
BEGIN
  IF (
    NEW.lower_tier_evidence_approved_at IS DISTINCT FROM
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.lower_tier_evidence_approved_at END
    OR NEW.lower_tier_evidence_approved_by IS DISTINCT FROM
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.lower_tier_evidence_approved_by END
    OR NEW.lower_tier_evidence_reason IS DISTINCT FROM
      CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.lower_tier_evidence_reason END
  ) THEN
    SELECT role INTO actor_role
    FROM admin_users
    WHERE id = request_actor_id();
    IF actor_role NOT IN ('reviewer', 'admin')
       OR NEW.lower_tier_evidence_approved_by <> request_actor_id() THEN
      RAISE EXCEPTION 'lower-tier evidence approval requires the authenticated reviewer';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER evidence_approval_guard
BEFORE INSERT OR UPDATE ON guidance_records
FOR EACH ROW EXECUTE FUNCTION protect_evidence_approval();

CREATE FUNCTION set_guidance_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER guidance_updated_at
BEFORE UPDATE ON guidance_records
FOR EACH ROW EXECUTE FUNCTION set_guidance_updated_at();

CREATE FUNCTION validate_guidance_publication()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  supporting_count integer;
  strong_count integer;
  reviewer_authorized boolean;
  fallback_approver_authorized boolean;
  actor_id uuid;
  jurisdiction_kind text;
  maximum_review_days integer;
BEGIN
  IF NEW.status <> 'published' THEN
    RETURN NEW;
  END IF;

  IF NEW.reviewer_id IS NULL OR NEW.last_reviewed_at IS NULL OR NEW.stale_after IS NULL THEN
    RAISE EXCEPTION 'published guidance requires reviewer, review date, and stale date';
  END IF;
  actor_id := request_actor_id();
  IF actor_id IS NULL OR actor_id <> NEW.reviewer_id THEN
    RAISE EXCEPTION 'publishing reviewer must match the authenticated actor';
  END IF;
  IF NEW.last_reviewed_at > now() OR NEW.stale_after <= NEW.last_reviewed_at THEN
    RAISE EXCEPTION 'guidance review and stale dates are invalid';
  END IF;
  IF NEW.stale_after <= now() THEN
    RAISE EXCEPTION 'published guidance stale date must be in the future';
  END IF;
  SELECT type INTO jurisdiction_kind
  FROM jurisdictions
  WHERE id = NEW.jurisdiction_id;
  maximum_review_days :=
    CASE
      WHEN NEW.risk_label = 'high_risk' THEN 60
      WHEN jurisdiction_kind = 'airport_authority' THEN 90
      ELSE 180
    END;
  IF NEW.stale_after >
     NEW.last_reviewed_at + make_interval(days => maximum_review_days) THEN
    RAISE EXCEPTION 'guidance stale date exceeds the permitted review cadence';
  END IF;
  SELECT role IN ('reviewer', 'admin')
  INTO reviewer_authorized
  FROM admin_users
  WHERE id = NEW.reviewer_id;
  IF coalesce(reviewer_authorized, false) = false THEN
    RAISE EXCEPTION 'published guidance requires an authorized reviewer';
  END IF;
  IF jsonb_array_length(NEW.unresolved_questions) > 0 THEN
    RAISE EXCEPTION 'published guidance cannot have unresolved questions';
  END IF;
  IF NEW.risk_label IN ('high_risk', 'unknown')
     AND NEW.action_text !~* '(verify|check|confirm|contact).*(official|authority|embassy|customs|government)' THEN
    RAISE EXCEPTION 'high-risk and unknown guidance requires official verification action';
  END IF;
  IF (NEW.summary || ' ' || NEW.action_text)
     ~* '(guaranteed|definitely legal|completely safe|will be allowed|will clear customs)' THEN
    RAISE EXCEPTION 'guidance cannot make a legal or medical guarantee';
  END IF;

  SELECT
    count(*),
    count(*) FILTER (WHERE quality_tier <= 2)
  INTO supporting_count, strong_count
  FROM source_records
  WHERE guidance_record_id = NEW.id
    AND source_type <> 'social'
    AND quality_tier < 4
    AND supports_summary
    AND last_verified_at IS NOT NULL
    AND last_verified_at <= now()
    AND last_verified_at >= NEW.last_reviewed_at
    AND accessed_at <= now();

  IF supporting_count = 0 THEN
    RAISE EXCEPTION 'published guidance requires verified supporting evidence';
  END IF;
  IF strong_count = 0 AND (
    NEW.lower_tier_evidence_approved_at IS NULL OR
    NEW.lower_tier_evidence_approved_by IS NULL OR
    length(trim(coalesce(NEW.lower_tier_evidence_reason, ''))) = 0
  ) THEN
    RAISE EXCEPTION 'Tier 3 evidence requires documented reviewer approval';
  END IF;
  IF strong_count = 0 THEN
    IF supporting_count < 2 THEN
      RAISE EXCEPTION 'Tier 3 fallback guidance requires at least two sources';
    END IF;
    IF NEW.confidence NOT IN ('low', 'medium') THEN
      RAISE EXCEPTION 'Tier 3 fallback guidance must use low or medium confidence';
    END IF;
    IF NEW.lower_tier_evidence_approved_at > now() THEN
      RAISE EXCEPTION 'lower-tier evidence approval cannot be in the future';
    END IF;
    SELECT role IN ('reviewer', 'admin')
    INTO fallback_approver_authorized
    FROM admin_users
    WHERE id = NEW.lower_tier_evidence_approved_by;
    IF coalesce(fallback_approver_authorized, false) = false THEN
      RAISE EXCEPTION 'Tier 3 evidence requires an authorized reviewer';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER guidance_publication_guard
BEFORE INSERT OR UPDATE ON guidance_records
FOR EACH ROW EXECUTE FUNCTION validate_guidance_publication();

CREATE FUNCTION protect_published_guidance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.status = 'published' AND NEW.status = 'published' AND (
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
    NEW.confidence IS DISTINCT FROM OLD.confidence
    OR NEW.last_reviewed_at IS DISTINCT FROM OLD.last_reviewed_at
    OR NEW.stale_after IS DISTINCT FROM OLD.stale_after
    OR NEW.reviewer_id IS DISTINCT FROM OLD.reviewer_id
    OR NEW.lower_tier_evidence_approved_at IS DISTINCT FROM OLD.lower_tier_evidence_approved_at
    OR NEW.lower_tier_evidence_approved_by IS DISTINCT FROM OLD.lower_tier_evidence_approved_by
    OR NEW.lower_tier_evidence_reason IS DISTINCT FROM OLD.lower_tier_evidence_reason
    OR NEW.unresolved_questions IS DISTINCT FROM OLD.unresolved_questions
  ) THEN
    RAISE EXCEPTION 'published guidance is immutable; create a new draft revision';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER immutable_published_guidance
BEFORE UPDATE ON guidance_records
FOR EACH ROW EXECUTE FUNCTION protect_published_guidance();

CREATE FUNCTION publish_guidance(p_guidance_id uuid)
RETURNS SETOF guidance_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id uuid :=
    request_actor_id();
  actor_role admin_role;
  target guidance_records%ROWTYPE;
BEGIN
  SELECT role INTO actor_role FROM admin_users WHERE id = actor_id;
  IF actor_role NOT IN ('reviewer', 'admin') THEN
    RAISE EXCEPTION 'only an authenticated reviewer or admin can publish guidance';
  END IF;

  SELECT * INTO target
  FROM guidance_records
  WHERE id = p_guidance_id AND status = 'reviewed'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'reviewed guidance record not found';
  END IF;

  UPDATE guidance_records
  SET status = 'archived'
  WHERE status = 'published'
    AND jurisdiction_id = target.jurisdiction_id
    AND medication_category_id IS NOT DISTINCT FROM target.medication_category_id
    AND guidance_type = target.guidance_type;

  RETURN QUERY
  UPDATE guidance_records
  SET status = 'published', reviewer_id = actor_id
  WHERE id = p_guidance_id
  RETURNING *;
END;
$$;

CREATE FUNCTION approve_lower_tier_evidence(
  p_guidance_id uuid,
  p_reason text
)
RETURNS SETOF guidance_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  actor_id uuid := request_actor_id();
  actor_role admin_role;
BEGIN
  SELECT role INTO actor_role FROM admin_users WHERE id = actor_id;
  IF actor_role NOT IN ('reviewer', 'admin') THEN
    RAISE EXCEPTION 'only an authenticated reviewer or admin can approve evidence';
  END IF;
  IF length(trim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'lower-tier evidence approval requires a reason';
  END IF;

  RETURN QUERY
  UPDATE guidance_records
  SET
    lower_tier_evidence_approved_at = now(),
    lower_tier_evidence_approved_by = actor_id,
    lower_tier_evidence_reason = p_reason
  WHERE id = p_guidance_id AND status IN ('draft', 'reviewed')
  RETURNING *;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'draft or reviewed guidance record not found';
  END IF;
END;
$$;

CREATE FUNCTION submit_guidance_for_review(p_guidance_id uuid)
RETURNS SETOF guidance_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_admin_role() IS NULL THEN
    RAISE EXCEPTION 'authenticated admin access is required';
  END IF;

  RETURN QUERY
  UPDATE guidance_records
  SET status = 'reviewed'
  WHERE id = p_guidance_id AND status IN ('draft', 'needs_verification')
  RETURNING *;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'draft guidance record not found';
  END IF;
END;
$$;

CREATE FUNCTION archive_guidance(p_guidance_id uuid)
RETURNS SETOF guidance_records
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_admin_role() <> 'admin' THEN
    RAISE EXCEPTION 'only an authenticated admin can archive guidance';
  END IF;

  RETURN QUERY
  UPDATE guidance_records
  SET status = 'archived'
  WHERE id = p_guidance_id AND status <> 'archived'
  RETURNING *;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active guidance record not found';
  END IF;
END;
$$;

CREATE FUNCTION record_guidance_status_change()
RETURNS trigger
LANGUAGE plpgsql
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

CREATE TRIGGER guidance_status_audit
AFTER INSERT OR UPDATE OF status ON guidance_records
FOR EACH ROW EXECUTE FUNCTION record_guidance_status_change();

CREATE FUNCTION record_source_addition()
RETURNS trigger
LANGUAGE plpgsql
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

CREATE TRIGGER source_addition_audit
AFTER INSERT ON source_records
FOR EACH ROW EXECUTE FUNCTION record_source_addition();

CREATE FUNCTION mark_stale_guidance()
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  changed integer;
BEGIN
  UPDATE guidance_records
  SET status = 'stale', updated_at = now()
  WHERE status = 'published' AND stale_after <= now();
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;

CREATE VIEW public_guidance_records AS
SELECT
  guidance_records.id,
  guidance_records.jurisdiction_id,
  guidance_records.medication_category_id,
  guidance_records.guidance_type,
  guidance_records.risk_label,
  guidance_records.title,
  guidance_records.summary,
  guidance_records.action_text,
  guidance_records.applies_to_transit,
  guidance_records.effective_from,
  guidance_records.effective_to,
  guidance_records.status,
  guidance_records.confidence,
  guidance_records.last_reviewed_at,
  guidance_records.stale_after,
  true AS reviewed_for_publication,
  (
    guidance_records.lower_tier_evidence_approved_at IS NOT NULL
    AND guidance_records.lower_tier_evidence_approved_by IS NOT NULL
  ) AS lower_tier_evidence_approved,
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', source_records.id,
        'url', source_records.url,
        'title', source_records.title,
        'sourceType', source_records.source_type,
        'qualityTier', source_records.quality_tier,
        'excerpt', source_records.excerpt,
        'accessedAt', source_records.accessed_at,
        'lastVerifiedAt', source_records.last_verified_at,
        'supportsSummary', source_records.supports_summary
      )
    ) FILTER (WHERE source_records.id IS NOT NULL),
    '[]'::jsonb
  ) AS sources
FROM guidance_records
LEFT JOIN source_records
  ON source_records.guidance_record_id = guidance_records.id
  AND source_records.source_type <> 'social'
  AND source_records.quality_tier < 4
  AND source_records.supports_summary
  AND source_records.last_verified_at IS NOT NULL
WHERE guidance_records.status = 'published'
  AND guidance_records.stale_after > now()
  AND (guidance_records.effective_from IS NULL OR guidance_records.effective_from <= current_date)
  AND (guidance_records.effective_to IS NULL OR guidance_records.effective_to >= current_date)
GROUP BY guidance_records.id;

REVOKE ALL ON guidance_records, source_records, guidance_audit_log FROM PUBLIC;
GRANT SELECT ON public_guidance_records TO PUBLIC;
REVOKE ALL ON FUNCTION publish_guidance(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION approve_lower_tier_evidence(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION submit_guidance_for_review(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION archive_guidance(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION mark_stale_guidance() FROM PUBLIC;

CREATE FUNCTION current_admin_role()
RETURNS admin_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role
  FROM admin_users
  WHERE id = request_actor_id()
$$;

ALTER TABLE guidance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE source_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE launch_coverage_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY guidance_admin_read ON guidance_records
FOR SELECT USING (current_admin_role() IS NOT NULL);
CREATE POLICY guidance_admin_insert ON guidance_records
FOR INSERT WITH CHECK (current_admin_role() IS NOT NULL AND status <> 'published');
CREATE POLICY guidance_admin_update ON guidance_records
FOR UPDATE USING (current_admin_role() IS NOT NULL)
WITH CHECK (current_admin_role() IS NOT NULL);
CREATE POLICY source_admin_read ON source_records
FOR SELECT USING (current_admin_role() IS NOT NULL);
CREATE POLICY source_admin_insert ON source_records
FOR INSERT WITH CHECK (current_admin_role() IS NOT NULL);
CREATE POLICY coverage_admin_read ON launch_coverage_requirements
FOR SELECT USING (current_admin_role() IS NOT NULL);

REVOKE ALL ON FUNCTION current_admin_role() FROM PUBLIC;
REVOKE ALL ON FUNCTION request_actor_id() FROM PUBLIC;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'GRANT SELECT, INSERT ON guidance_records TO authenticated';
    EXECUTE 'GRANT UPDATE (
      jurisdiction_id, medication_category_id, guidance_type, risk_label,
      title, summary, action_text, applies_to_transit, effective_from,
      effective_to, confidence, last_reviewed_at, stale_after,
      unresolved_questions
    ) ON guidance_records TO authenticated';
    EXECUTE 'GRANT SELECT, INSERT ON source_records TO authenticated';
    EXECUTE 'GRANT SELECT ON launch_coverage_requirements TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION publish_guidance(uuid) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION approve_lower_tier_evidence(uuid, text) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION submit_guidance_for_review(uuid) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION archive_guidance(uuid) TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION current_admin_role() TO authenticated';
    EXECUTE 'GRANT EXECUTE ON FUNCTION request_actor_id() TO authenticated';
  END IF;
END;
$$;