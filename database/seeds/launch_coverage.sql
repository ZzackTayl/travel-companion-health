WITH country(code, name) AS (
  VALUES
    ('US', 'United States'),
    ('GB', 'United Kingdom'),
    ('AE', 'United Arab Emirates'),
    ('FR', 'France'),
    ('DE', 'Germany'),
    ('NL', 'Netherlands'),
    ('JP', 'Japan'),
    ('SG', 'Singapore'),
    ('IN', 'India'),
    ('AU', 'Australia'),
    ('CA', 'Canada'),
    ('MX', 'Mexico'),
    ('QA', 'Qatar'),
    ('BR', 'Brazil'),
    ('ZA', 'South Africa'),
    ('KR', 'South Korea')
)
INSERT INTO jurisdictions (type, code, name, country_code, priority)
SELECT 'country', code, name, code, 10
FROM country
ON CONFLICT (type, code) DO UPDATE SET
  name = EXCLUDED.name,
  country_code = EXCLUDED.country_code,
  priority = EXCLUDED.priority;

INSERT INTO medication_categories (
  slug, label, description, risk_level_default, user_prompt
)
VALUES
  (
    'prescription',
    'Prescription medicine',
    'Medicine supplied under a prescription.',
    'medium',
    'Is this a prescription medicine?'
  ),
  (
    'over_the_counter',
    'Over-the-counter medicine',
    'Medicine available without a prescription in the traveler''s home country.',
    'medium',
    'Is this medicine available without a prescription?'
  ),
  (
    'controlled_substance',
    'Controlled substance',
    'Medicine subject to controlled-drug import or possession rules.',
    'high',
    'Is this medicine controlled in your home country or destination?'
  ),
  (
    'stimulant_adhd',
    'ADHD stimulant',
    'Stimulant medicine commonly prescribed for ADHD.',
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
    'sedative_anxiety',
    'Sedative or anxiety medicine',
    'Sedative or anti-anxiety medicine.',
    'high',
    'Is this a sedative or anti-anxiety medicine?'
  ),
  (
    'sleep_medication',
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
    'liquid_over_100ml',
    'Liquid medicine over 100 mL',
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
    'needles_or_sharps',
    'Needles or sharps',
    'Needles, syringes, lancets, or other sharps carried for medical use.',
    'medium',
    'Will you carry needles, syringes, lancets, or other medical sharps?'
  ),
  (
    'unknown',
    'Not sure',
    'Medicine whose travel-risk category has not been identified.',
    'unknown',
    'Not sure which category applies?'
  )
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  risk_level_default = EXCLUDED.risk_level_default,
  user_prompt = EXCLUDED.user_prompt,
  active = true;

WITH airport(code, name, country_code) AS (
  VALUES
    ('JFK', 'John F. Kennedy International Airport', 'US'),
    ('LGA', 'LaGuardia Airport', 'US'),
    ('EWR', 'Newark Liberty International Airport', 'US'),
    ('LAX', 'Los Angeles International Airport', 'US'),
    ('ORD', 'O''Hare International Airport', 'US'),
    ('LHR', 'Heathrow Airport', 'GB'),
    ('LGW', 'Gatwick Airport', 'GB'),
    ('MAN', 'Manchester Airport', 'GB'),
    ('DXB', 'Dubai International Airport', 'AE'),
    ('AUH', 'Zayed International Airport', 'AE'),
    ('CDG', 'Charles de Gaulle Airport', 'FR'),
    ('ORY', 'Paris Orly Airport', 'FR'),
    ('FRA', 'Frankfurt Airport', 'DE'),
    ('AMS', 'Amsterdam Airport Schiphol', 'NL'),
    ('NRT', 'Narita International Airport', 'JP'),
    ('HND', 'Haneda Airport', 'JP'),
    ('SIN', 'Singapore Changi Airport', 'SG'),
    ('DEL', 'Indira Gandhi International Airport', 'IN'),
    ('BOM', 'Chhatrapati Shivaji Maharaj International Airport', 'IN'),
    ('SYD', 'Sydney Kingsford Smith Airport', 'AU'),
    ('MEL', 'Melbourne Airport', 'AU'),
    ('YYZ', 'Toronto Pearson International Airport', 'CA'),
    ('YVR', 'Vancouver International Airport', 'CA'),
    ('MEX', 'Mexico City International Airport', 'MX'),
    ('DOH', 'Hamad International Airport', 'QA'),
    ('GRU', 'São Paulo/Guarulhos International Airport', 'BR'),
    ('JNB', 'O. R. Tambo International Airport', 'ZA'),
    ('ICN', 'Incheon International Airport', 'KR')
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
ON CONFLICT (type, code) DO UPDATE SET
  name = EXCLUDED.name,
  country_code = EXCLUDED.country_code,
  parent_id = EXCLUDED.parent_id,
  priority = EXCLUDED.priority;

INSERT INTO launch_coverage_requirements (
  jurisdiction_id, medication_category_id, guidance_type, label
)
SELECT id, NULL, required.guidance_type, name || ': ' || required.label
FROM jurisdictions
CROSS JOIN (
  VALUES
    ('general'::guidance_type, 'general entry guidance'),
    ('documentation'::guidance_type, 'documentation guidance'),
    ('packaging'::guidance_type, 'packaging guidance'),
    ('quantity_limit'::guidance_type, 'quantity-limit guidance')
) AS required(guidance_type, label)
WHERE jurisdictions.type = 'country'
  AND jurisdictions.code IN (
    'US', 'GB', 'AE', 'FR', 'DE', 'NL', 'JP', 'SG',
    'IN', 'AU', 'CA', 'MX', 'QA', 'BR', 'ZA', 'KR'
  )
ON CONFLICT (
  jurisdiction_id, medication_category_id, guidance_type
) DO UPDATE SET
  label = EXCLUDED.label,
  required_at_launch = true;

INSERT INTO launch_coverage_requirements (
  jurisdiction_id, medication_category_id, guidance_type, label
)
SELECT
  jurisdiction.id,
  medication_category.id,
  'screening',
  jurisdiction.name || ': ' || medication_category.label
FROM jurisdictions jurisdiction
CROSS JOIN medication_categories medication_category
WHERE jurisdiction.type = 'airport_authority'
  AND jurisdiction.code IN (
    'JFK', 'LGA', 'EWR', 'LAX', 'ORD', 'LHR', 'LGW', 'MAN',
    'DXB', 'AUH', 'CDG', 'ORY', 'FRA', 'AMS', 'NRT', 'HND',
    'SIN', 'DEL', 'BOM', 'SYD', 'MEL', 'YYZ', 'YVR', 'MEX',
    'DOH', 'GRU', 'JNB', 'ICN'
  )
  AND medication_category.slug IN (
    'prescription',
    'over_the_counter',
    'controlled_substance',
    'stimulant_adhd',
    'opioid',
    'sedative_anxiety',
    'sleep_medication',
    'pseudoephedrine',
    'cannabis_derived',
    'injectable',
    'liquid_over_100ml',
    'refrigerated',
    'medical_device',
    'needles_or_sharps',
    'unknown'
  )
ON CONFLICT (
  jurisdiction_id, medication_category_id, guidance_type
) DO UPDATE SET
  label = EXCLUDED.label,
  required_at_launch = true;

INSERT INTO launch_coverage_requirements (
  jurisdiction_id, medication_category_id, guidance_type, label
)
SELECT id, NULL, 'transit', name || ': transit guidance'
FROM jurisdictions
WHERE type = 'airport_authority'
  AND code IN (
    'JFK', 'LGA', 'EWR', 'LAX', 'ORD', 'LHR', 'LGW', 'MAN',
    'DXB', 'AUH', 'CDG', 'ORY', 'FRA', 'AMS', 'NRT', 'HND',
    'SIN', 'DEL', 'BOM', 'SYD', 'MEL', 'YYZ', 'YVR', 'MEX',
    'DOH', 'GRU', 'JNB', 'ICN'
  )
ON CONFLICT (
  jurisdiction_id, medication_category_id, guidance_type
) DO UPDATE SET
  label = EXCLUDED.label,
  required_at_launch = true;

INSERT INTO launch_coverage_requirements (
  jurisdiction_id, medication_category_id, guidance_type, label
)
SELECT id, NULL, 'screening', name || ': screening guidance'
FROM jurisdictions
WHERE type = 'airport_authority'
  AND code IN (
    'JFK', 'LGA', 'EWR', 'LAX', 'ORD', 'LHR', 'LGW', 'MAN',
    'DXB', 'AUH', 'CDG', 'ORY', 'FRA', 'AMS', 'NRT', 'HND',
    'SIN', 'DEL', 'BOM', 'SYD', 'MEL', 'YYZ', 'YVR', 'MEX',
    'DOH', 'GRU', 'JNB', 'ICN'
  )
ON CONFLICT (
  jurisdiction_id, medication_category_id, guidance_type
) DO UPDATE SET
  label = EXCLUDED.label,
  required_at_launch = true;

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
  AND jurisdiction.code IN (
    'US', 'GB', 'AE', 'FR', 'DE', 'NL', 'JP', 'SG',
    'IN', 'AU', 'CA', 'MX', 'QA', 'BR', 'ZA', 'KR'
  )
  AND medication_category.slug IN (
    'prescription',
    'over_the_counter',
    'controlled_substance',
    'stimulant_adhd',
    'opioid',
    'sedative_anxiety',
    'sleep_medication',
    'pseudoephedrine',
    'cannabis_derived',
    'injectable',
    'liquid_over_100ml',
    'refrigerated',
    'medical_device',
    'needles_or_sharps',
    'unknown'
  )
ON CONFLICT (
  jurisdiction_id, medication_category_id, guidance_type
) DO UPDATE SET
  label = EXCLUDED.label,
  required_at_launch = true;

UPDATE launch_coverage_requirements requirement
SET required_at_launch = false
FROM jurisdictions jurisdiction
WHERE requirement.jurisdiction_id = jurisdiction.id
  AND (
    (jurisdiction.type = 'country' AND jurisdiction.code = 'IT')
    OR (
      jurisdiction.type = 'airport_authority'
      AND jurisdiction.code IN ('SFO', 'FCO')
    )
  );