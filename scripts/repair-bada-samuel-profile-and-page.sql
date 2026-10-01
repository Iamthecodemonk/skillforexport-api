-- Repair Bada Samuel's profile title and student-page course independently.
-- User profile display title is the source for profile/feed/post/question user.display_title.

UPDATE user_profiles
SET display_title = 'Software Developer at Google',
    updated_at = NOW()
WHERE user_id = '24d84f48-f2d4-4a30-b448-79227fe38882';

UPDATE pages
SET metadata = JSON_SET(
      COALESCE(metadata, JSON_OBJECT()),
      '$.courseOfStudy', 'Metallurgical Engineering'
    ),
    updated_at = NOW()
WHERE id = 'ef68cf83-afea-41cd-9134-382bb5deb41f'
  AND owner_id = '24d84f48-f2d4-4a30-b448-79227fe38882'
  AND page_type = 'student';

SELECT
  up.user_id,
  up.display_title,
  JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.courseOfStudy')) AS page_course_of_study,
  JSON_UNQUOTE(JSON_EXTRACT(p.metadata, '$.university')) AS page_university
FROM user_profiles up
LEFT JOIN pages p
  ON p.owner_id = up.user_id
  AND p.id = 'ef68cf83-afea-41cd-9134-382bb5deb41f'
WHERE up.user_id = '24d84f48-f2d4-4a30-b448-79227fe38882';
