import db from '../knexConfig.js';

export const userSkillsAggregate = () => db('user_skills')
  .select('user_id')
  .select(db.raw("JSON_ARRAYAGG(JSON_OBJECT('id', id, 'skill', skill, 'level', level)) as skills"))
  .groupBy('user_id');

export const studentPageAggregate = () => db('pages')
  .select('owner_id')
  .select(
    db.raw("MAX(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.courseOfStudy')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.courseName')))) as course_name"),
    db.raw("MAX(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.university')), JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.institution')))) as institution")
  )
  .where('page_type', 'student')
  .whereRaw("COALESCE(moderation_status, 'approved') <> 'deleted'")
  .groupBy('owner_id');

export const communityMemberCountAggregate = () => db('community_members')
  .select('community_id')
  .count({ members_count: 'id' })
  .whereNotNull('community_id')
  .groupBy('community_id');

export const postCommentCountAggregate = () => db('comments')
  .select('post_id')
  .count({ comment_count: 'id' })
  .whereRaw("COALESCE(moderation_status, 'approved') NOT IN ('suspended', 'deleted')")
  .groupBy('post_id');

export const postReactionCountAggregate = () => db('post_reactions')
  .select('post_id')
  .count({ score: 'id' })
  .groupBy('post_id');

export const postMediaAggregate = () => db('post_media')
  .select('post_id')
  .select(db.raw(`JSON_ARRAYAGG(JSON_OBJECT(
    'id', id,
    'url', url,
    'media_type', media_type,
    'thumbnail_url', thumbnail_url,
    'display_order', display_order,
    'created_at', created_at
  )) as media_path`))
  .groupBy('post_id');

export const questionReactionCountAggregate = () => db('question_reactions')
  .select('question_id')
  .count({ score: 'id' })
  .groupBy('question_id');

export const questionAnswerCountAggregate = () => db('answers')
  .select('question_id')
  .count({ total_answers: 'id' })
  .countDistinct({ total_answerers: 'user_id' })
  .groupBy('question_id');

export const viewerFollowingAggregate = (userId) => db('followers')
  .select('following_id')
  .where('follower_id', userId)
  .groupBy('following_id');

export const viewerPostReactionAggregate = (userId) => db('post_reactions')
  .select('post_id')
  .where('user_id', userId)
  .groupBy('post_id');

export const viewerPostSaveAggregate = (userId) => db('post_saves')
  .select('post_id')
  .where('user_id', userId)
  .groupBy('post_id');

export const viewerPostReportAggregate = (userId) => db('generic_reports')
  .select('target_id')
  .where({ user_id: userId, target_type: 'post' })
  .groupBy('target_id');

export const viewerCommunityAggregate = (userId) => db('community_members')
  .select('community_id')
  .where('user_id', userId)
  .groupBy('community_id');

export const viewerQuestionReactionAggregate = (userId) => db('question_reactions')
  .select('question_id')
  .where('user_id', userId)
  .groupBy('question_id');

export const viewerQuestionSaveAggregate = (userId) => db('saved_items')
  .select('target_id')
  .where({ user_id: userId, target_type: 'question' })
  .groupBy('target_id');
