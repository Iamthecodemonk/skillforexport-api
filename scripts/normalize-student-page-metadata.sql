-- Canonicalize student page course and institution data.
-- Run once after deploying the matching application update.
-- Canonical keys are metadata.courseOfStudy and metadata.university.

UPDATE pages AS p
LEFT JOIN (
  SELECT
    user_id,
    SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(field, '') ORDER BY updated_at DESC, created_at DESC SEPARATOR '\n'), '\n', 1) AS course_of_study,
    SUBSTRING_INDEX(GROUP_CONCAT(NULLIF(school, '') ORDER BY updated_at DESC, created_at DESC SEPARATOR '\n'), '\n', 1) AS university
  FROM user_education
  GROUP BY user_id
) AS education ON education.user_id = p.owner_id
SET p.metadata = JSON_REMOVE(
  JSON_SET(
    COALESCE(p.metadata, JSON_OBJECT()),
    '$.courseOfStudy', COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.courseOfStudy')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.courseName')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.course_name')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.course')), ''),
      education.course_of_study
    ),
    '$.university', COALESCE(
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.university')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.universityName')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.university_name')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.institution')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.institutionName')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.institution_name')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.school')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.schoolName')), ''),
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.school_name')), ''),
      education.university
    )
  ),
  '$.courseName', '$.course_name', '$.course',
  '$.universityName', '$.university_name',
  '$.institution', '$.institutionName', '$.institution_name',
  '$.school', '$.schoolName', '$.school_name'
)
WHERE p.page_type = 'student'
  AND COALESCE(p.moderation_status, 'approved') <> 'deleted';

-- Verify that active student pages now contain the canonical values.
SELECT
  id,
  owner_id,
  JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.courseOfStudy')) AS course_of_study,
  JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.university')) AS university
FROM pages
WHERE page_type = 'student'
  AND COALESCE(moderation_status, 'approved') <> 'deleted'
ORDER BY updated_at DESC;
