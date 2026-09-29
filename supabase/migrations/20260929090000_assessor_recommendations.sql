-- Private teacher drafts; never included in student queries or exports.
create table public.assessor_recommendations (
  item_id uuid primary key references public.audit_items(id) on delete cascade,
  audit_id uuid not null references public.audits(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  assessor_note text not null,
  rationale text not null,
  review_flags jsonb not null default '[]'::jsonb,
  input_snapshot jsonb not null,
  feedback_snapshot jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved')),
  model text not null,
  rubric_version text not null,
  generated_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_score integer check (approved_score between 0 and 100),
  approved_note text
);
create index assessor_recommendations_audit on public.assessor_recommendations(audit_id);
alter table public.assessor_recommendations enable row level security;
create policy "Teachers can read assessor recommendations"
  on public.assessor_recommendations for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role::text in ('admin', 'superadmin')));
revoke all on public.assessor_recommendations from anon, authenticated;
grant select on public.assessor_recommendations to authenticated;
grant all on public.assessor_recommendations to service_role;

-- All requested criteria commit or roll back together. Score and note share one update.
create or replace function public.approve_assessor_recommendations(
  p_audit_id uuid, p_approver uuid, p_entries jsonb, p_category text default null
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  entry jsonb;
  draft public.assessor_recommendations%rowtype;
  item public.audit_items%rowtype;
  exam public.audits%rowtype;
  result jsonb := '[]'::jsonb;
  approved_value integer;
begin
  if not exists (select 1 from public.profiles where id = p_approver and role::text in ('admin', 'superadmin')) then raise exception 'FORBIDDEN'; end if;
  select * into exam from public.audits where id = p_audit_id for update;
  if not found or exam.type::text not in ('midterm', 'final') then raise exception 'INVALID_EXAM'; end if;
  if not (coalesce(exam.is_manually_locked, false)
    or (exam.exam_expires_at is not null and exam.exam_expires_at <= now())
    or (exam.exam_start_time is not null and exam.exam_start_time + make_interval(mins => coalesce(nullif(exam.time_limit_minutes, 0), 90)) <= now())) then raise exception 'EXAM_ACTIVE'; end if;
  if p_entries is null or jsonb_typeof(p_entries) <> 'array' then raise exception 'INVALID_ENTRIES'; end if;
  if jsonb_array_length(p_entries) < 1 or jsonb_array_length(p_entries) > 200 then raise exception 'INVALID_ENTRIES'; end if;
  if (select count(distinct e->>'item_id') from jsonb_array_elements(p_entries) e) <> jsonb_array_length(p_entries) then raise exception 'DUPLICATE_ENTRIES'; end if;
  if p_category is null and jsonb_array_length(p_entries) <> 1 then raise exception 'INVALID_SCOPE'; end if;
  if p_category is not null and (
    exists (select 1 from public.audit_items i left join public.assessor_recommendations r on r.item_id = i.id
      where i.audit_id = p_audit_id and i.category = p_category and r.item_id is null)
    or (select count(*) from public.audit_items i join public.assessor_recommendations r on r.item_id = i.id
      where i.audit_id = p_audit_id and i.category = p_category and r.status = 'pending') <> jsonb_array_length(p_entries)
  ) then raise exception 'INCOMPLETE_COMPONENT'; end if;
  for entry in select value from jsonb_array_elements(p_entries) order by value->>'item_id' loop
    select * into item from public.audit_items where id = (entry->>'item_id')::uuid and audit_id = p_audit_id for update;
    if not found or (p_category is not null and item.category <> p_category) then raise exception 'INVALID_SCOPE'; end if;
    select * into draft from public.assessor_recommendations where item_id = item.id and audit_id = p_audit_id for update;
    if not found or draft.status <> 'pending' or (entry->>'expected_updated_at') is null or draft.updated_at <> (entry->>'expected_updated_at')::timestamptz then raise exception 'STALE_RECOMMENDATION'; end if;
    if draft.input_snapshot <> jsonb_build_object(
      'category', item.category, 'subcategory', item.subcategory, 'criteria', item.criteria,
      'jawaban_auditee', coalesce(item.jawaban_auditee, ''), 'jawaban_evaluator', coalesce(item.jawaban_evaluator, ''),
      'catatan', coalesce(item.catatan, ''), 'rekomendasi', coalesce(item.rekomendasi, '')) then raise exception 'STALE_ANSWER'; end if;
    if draft.feedback_snapshot <> jsonb_build_object('teacher_score', coalesce(item.teacher_score, 0), 'catatan_asesor', coalesce(item.catatan_asesor, '')) then raise exception 'STALE_FEEDBACK'; end if;
    if entry->'score' is null or jsonb_typeof(entry->'score') <> 'number' or (entry->>'score')::numeric <> trunc((entry->>'score')::numeric) then raise exception 'INVALID_SCORE'; end if;
    approved_value := (entry->>'score')::integer;
    if approved_value < 0 or approved_value > 100 or length(trim(coalesce(entry->>'assessor_note', ''))) = 0 or length(entry->>'assessor_note') > 6000 then raise exception 'INVALID_FEEDBACK'; end if;
    update public.audit_items set teacher_score = approved_value, catatan_asesor = entry->>'assessor_note' where id = item.id returning * into item;
    update public.assessor_recommendations set status = 'approved', approved_at = now(), approved_by = p_approver,
      approved_score = approved_value, approved_note = entry->>'assessor_note', updated_at = now() where item_id = item.id;
    result := result || jsonb_build_array(to_jsonb(item));
  end loop;
  return result;
end;
$$;
revoke all on function public.approve_assessor_recommendations(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.approve_assessor_recommendations(uuid, uuid, jsonb, text) to service_role;


-- Generation also uses a transaction: never replace a draft approved/replaced during analysis.
create or replace function public.save_assessor_recommendation(
  p_audit_id uuid, p_item_id uuid, p_generator uuid, p_expected_updated_at timestamptz, p_draft jsonb
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  item public.audit_items%rowtype;
  previous public.assessor_recommendations%rowtype;
  saved public.assessor_recommendations%rowtype;
begin
  if not exists (select 1 from public.profiles where id = p_generator and role::text in ('admin', 'superadmin')) then raise exception 'FORBIDDEN'; end if;
  perform 1 from public.audits where id = p_audit_id and type::text in ('midterm', 'final') for update;
  if not found then raise exception 'INVALID_EXAM'; end if;
  select * into item from public.audit_items where id = p_item_id and audit_id = p_audit_id for update;
  if not found then raise exception 'INVALID_SCOPE'; end if;
  select * into previous from public.assessor_recommendations where item_id = p_item_id for update;
  if (found and previous.updated_at is distinct from p_expected_updated_at) or (not found and p_expected_updated_at is not null) then raise exception 'STALE_RECOMMENDATION'; end if;
  if p_draft->'input_snapshot' is distinct from jsonb_build_object(
    'category', item.category, 'subcategory', item.subcategory, 'criteria', item.criteria,
    'jawaban_auditee', coalesce(item.jawaban_auditee, ''), 'jawaban_evaluator', coalesce(item.jawaban_evaluator, ''),
    'catatan', coalesce(item.catatan, ''), 'rekomendasi', coalesce(item.rekomendasi, '')) then raise exception 'STALE_ANSWER'; end if;
  if p_draft->'feedback_snapshot' is distinct from jsonb_build_object('teacher_score', coalesce(item.teacher_score, 0), 'catatan_asesor', coalesce(item.catatan_asesor, '')) then raise exception 'STALE_FEEDBACK'; end if;
  insert into public.assessor_recommendations
    (item_id, audit_id, score, assessor_note, rationale, review_flags, input_snapshot, feedback_snapshot, model, rubric_version, generated_by)
  values (p_item_id, p_audit_id, (p_draft->>'score')::integer, p_draft->>'assessor_note', p_draft->>'rationale',
    p_draft->'review_flags', p_draft->'input_snapshot', p_draft->'feedback_snapshot', p_draft->>'model', p_draft->>'rubric_version', p_generator)
  on conflict (item_id) do update set score = excluded.score, assessor_note = excluded.assessor_note, rationale = excluded.rationale,
    review_flags = excluded.review_flags, input_snapshot = excluded.input_snapshot, feedback_snapshot = excluded.feedback_snapshot,
    model = excluded.model, rubric_version = excluded.rubric_version, generated_by = excluded.generated_by,
    status = 'pending', created_at = clock_timestamp(), updated_at = clock_timestamp(), approved_at = null,
    approved_by = null, approved_score = null, approved_note = null
  returning * into saved;
  return to_jsonb(saved);
end;
$$;
revoke all on function public.save_assessor_recommendation(uuid, uuid, uuid, timestamptz, jsonb) from public, anon, authenticated;
grant execute on function public.save_assessor_recommendation(uuid, uuid, uuid, timestamptz, jsonb) to service_role;
