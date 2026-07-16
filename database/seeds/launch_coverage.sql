WITH country(code, name) AS (
  VALUES
    ('US', 'United States'),
    ('GB', 'United Kingdom'),
    ('AE', 'United Arab Emirates'),
    ('JP', 'Japan'),
    ('FR', 'France'),
    ('IT', 'Italy'),
    ('CA', 'Canada')
)
INSERT INTO jurisdictions (type, code, name, country_code, priority)
SELECT 'country', code, name, code, 10
FROM country
ON CONFLICT (type, code) DO NOTHING;

INSERT INTO medication_categories (
  slug, label, description, risk_level_default, user_prompt
)
VALUES
  (
    'controlled_substance',
    'Controlled substance',
    'Medicine subject to controlled-drug import or possession rules.',
    'high',
    'Is this medicine controlled in your home country or destination?'
  ),
  (
    'stimulant',
    'Stimulant',
    'Prescription stimulant medicine.',
    'high',
    'Is this a prescription stimulant?'
  ),
  (
    'opioid',
    'Opioid',
    'Prescription or over-the-counter opioid medicine.',
    'high',
    'Does this medicine contain an opioid?'
  ),
  (
    'sedative',
    'Sedative',
    'Sedative or anti-anxiety medicine.',
    'high',
    'Is this a sedative or anti-anxiety medicine?'
  ),
  (
    'sleep_medicine',
    'Sleep medicine',
    'Medicine used to support sleep.',
    'high',
    'Is this a prescription sleep medicine?'
  ),
  (
    'pseudoephedrine',
    'Pseudoephedrine',
    'Cold or allergy medicine containing pseudoephedrine.',
    'high',
    'Does this medicine contain pseudoephedrine?'
  ),
  (
    'cannabis_derived',
    'Cannabis-derived product',
    'Medicine or supplement containing cannabis-derived ingredients.',
    'high',
    'Does this item contain CBD, THC, or another cannabis-derived ingredient?'
  ),
  (
    'injectable',
    'Injectable medicine',
    'Medicine carried with needles, syringes, or an injector.',
    'medium',
    'Will you carry needles, syringes, or an injector?'
  ),
  (
    'liquid',
    'Liquid medicine',
    'Liquid, gel, or aerosol medicine that may need screening.',
    'medium',
    'Is this medicine a liquid, gel, or aerosol?'
  ),
  (
    'refrigerated',
    'Temperature-controlled medicine',
    'Medicine requiring cooling or temperature control.',
    'medium',
    'Does this medicine need to stay cool?'
  ),
  (
    'medical_device',
    'Medical device',
    'Medical device or medicine-delivery equipment.',
    'medium',
    'Will you carry a medical device or medicine-delivery equipment?'
  ),
  (
    'unknown',
    'Not sure',
    'Medicine whose travel-risk category has not been identified.',
    'unknown',
    'Not sure which category applies?'
  )
ON CONFLICT (slug) DO NOTHING;

WITH airport(code, name, country_code) AS (
  VALUES
    ('JFK', 'John F. Kennedy International Airport', 'US'),
    ('LAX', 'Los Angeles International Airport', 'US'),
    ('SFO', 'San Francisco International Airport', 'US'),
    ('ORD', 'O''Hare International Airport', 'US'),
    ('LHR', 'Heathrow Airport', 'GB'),
    ('DXB', 'Dubai International Airport', 'AE'),
    ('NRT', 'Narita International Airport', 'JP'),
    ('CDG', 'Charles de Gaulle Airport', 'FR'),
    ('FCO', 'Rome Fiumicino Airport', 'IT'),
    ('YYZ', 'Toronto Pearson International Airport', 'CA')
)
INSERT INTO jurisdictions (type, code, name, country_code, parent_id, priority)
SELECT
  'airport_authority',
  airport.code,
  airport.name,
  airport.country_code,
  country.id,
  40
FROM airport
JOIN jurisdictions country
  ON country.type = 'country' AND country.code = airport.country_code
ON CONFLICT (type, code) DO NOTHING;

INSERT INTO launch_coverage_requirements (
  jurisdiction_id, medication_category_id, guidance_type, label
)
SELECT id, NULL, required.guidance_type, name || ': ' || required.label
FROM jurisdictions
CROSS JOIN (
  VALUES
    ('general'::guidance_type, 'general entry guidance'),
    ('documentation'::guidance_type, 'documentation guidance'),
    ('packaging'::guidance_type, 'packaging guidance')
) AS required(guidance_type, label)
WHERE jurisdictions.type = 'country'
  AND jurisdictions.code IN ('US', 'GB', 'AE', 'JP', 'FR', 'IT', 'CA')
ON CONFLICT (
  jurisdiction_id, medication_category_id, guidance_type
) DO NOTHING;

INSERT INTO launch_coverage_requirements (
  jurisdiction_id, medication_category_id, guidance_type, label
)
SELECT id, NULL, 'transit', name || ': transit guidance'
FROM jurisdictions
WHERE type = 'airport_authority'
  AND code IN ('LHR', 'CDG')
ON CONFLICT (
  jurisdiction_id, medication_category_id, guidance_type
) DO NOTHING;

INSERT INTO launch_coverage_requirements (
  jurisdiction_id, medication_category_id, guidance_type, label
)
SELECT id, NULL, 'screening', name || ': screening guidance'
FROM jurisdictions
WHERE type = 'airport_authority'
  AND code IN ('JFK', 'LAX', 'SFO', 'ORD', 'LHR', 'DXB', 'NRT', 'CDG', 'FCO', 'YYZ')
ON CONFLICT (
  jurisdiction_id, medication_category_id, guidance_type
) DO NOTHING;

INSERT INTO launch_coverage_requirements (
  jurisdiction_id, medication_category_id, guidance_type, label
)
SELECT
  jurisdiction.id,
  medication_category.id,
  'restricted',
  jurisdiction.name || ': ' || medication_category.label
FROM jurisdictions jurisdiction
CROSS JOIN medication_categories medication_category
WHERE jurisdiction.type = 'country'
  AND jurisdiction.code IN ('US', 'GB', 'AE', 'JP', 'FR', 'IT', 'CA')
  AND medication_category.slug IN (
    'controlled_substance',
    'stimulant',
    'opioid',
    'sedative',
    'sleep_medicine',
    'pseudoephedrine',
    'cannabis_derived',
    'injectable',
    'liquid',
    'refrigerated',
    'medical_device',
    'unknown'
  )
ON CONFLICT (
  jurisdiction_id, medication_category_id, guidance_type
) DO NOTHING;