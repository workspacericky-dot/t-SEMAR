-- Apply after 20260929090000_assessor_recommendations.sql.
-- A server-owned manifest binds manual ChatGPT results to one complete student exam.
create table public.assessor_export_packages (
  id uuid primary key,
  audit_id uuid not null references public.audits(id) on delete cascade,
  exported_by uuid not null references public.profiles(id),
  exported_at timestamptz not null default now(),
  payload jsonb not null,
  reasoning_snapshots jsonb not null,
  feedback_snapshots jsonb not null,
  draft_versions jsonb not null,
  imported_at timestamptz,
  imported_by uuid references public.profiles(id),
  imported_output jsonb
);
create index assessor_export_packages_audit on public.assessor_export_packages(audit_id);
alter table public.assessor_export_packages enable row level security;
create policy "Teachers can read assessor export manifests"
  on public.assessor_export_packages for select to authenticated
  using (exists (select 1 from public.profiles where id = auth.uid() and role::text in ('admin', 'superadmin')));
revoke all on public.assessor_export_packages from anon, authenticated;
grant select on public.assessor_export_packages to authenticated;
grant all on public.assessor_export_packages to service_role;

-- null is explicitly unscored, never a substitute for a zero score.
alter table public.assessor_recommendations alter column score drop not null;
alter table public.assessor_recommendations
  add column package_id uuid references public.assessor_export_packages(id),
  add column diagnosis jsonb not null default '{}'::jsonb,
  add column issue_codes jsonb not null default '[]'::jsonb,
  add column basis_refs jsonb not null default '[]'::jsonb,
  add column needs_manual_review boolean not null default false;
alter table public.assessor_recommendations add constraint assessor_null_requires_review
  check (score is not null or (needs_manual_review and jsonb_array_length(review_flags) > 0));

create or replace function public.import_assessor_chatgpt_results(
  p_audit_id uuid, p_importer uuid, p_output jsonb
) returns jsonb language plpgsql security invoker set search_path = public as $$
declare
  exam public.audits%rowtype;
  manifest public.assessor_export_packages%rowtype;
  item public.audit_items%rowtype;
  previous public.assessor_recommendations%rowtype;
  entry jsonb;
  input jsonb;
  had_previous boolean;
  value numeric;
  result jsonb;
begin
  if not exists (select 1 from public.profiles where id = p_importer and role::text in ('admin', 'superadmin')) then raise exception 'FORBIDDEN'; end if;
  select * into exam from public.audits where id = p_audit_id for update;
  if not found or exam.type::text not in ('midterm', 'final') then raise exception 'INVALID_EXAM'; end if;
  if not (coalesce(exam.is_manually_locked, false)
    or (exam.exam_expires_at is not null and exam.exam_expires_at <= now())
    or (exam.exam_start_time is not null and exam.exam_start_time + make_interval(mins => coalesce(nullif(exam.time_limit_minutes, 0), 90)) <= now())) then raise exception 'EXAM_ACTIVE'; end if;
  select * into manifest from public.assessor_export_packages where id = (p_output->>'package_id')::uuid and audit_id = p_audit_id for update;
  if not found then raise exception 'UNKNOWN_PACKAGE'; end if;
  if exists (select 1 from public.assessor_export_packages m where m.audit_id = p_audit_id
    and (m.exported_at, m.id) > (manifest.exported_at, manifest.id)) then raise exception 'SUPERSEDED_PACKAGE'; end if;
  if manifest.imported_at is not null then raise exception 'PACKAGE_ALREADY_IMPORTED'; end if;
  if p_output->>'audit_id' is distinct from p_audit_id::text
    or p_output->>'schema_version' is distinct from manifest.payload->>'schema_version'
    or p_output->>'rubric_version' is distinct from manifest.payload->>'rubric_version'
    or p_output->>'completion_status' is distinct from 'complete'
    or exam.type::text is distinct from manifest.payload->>'exam_type'
    or exam.year is distinct from (manifest.payload->>'evaluation_year')::integer then raise exception 'INVALID_PACKAGE'; end if;
  if jsonb_typeof(p_output->'results') is distinct from 'array' then raise exception 'INVALID_RESULTS'; end if;
  if jsonb_array_length(p_output->'results') <> jsonb_array_length(manifest.payload->'items')
    or p_output->'expected_item_count' is distinct from manifest.payload->'expected_item_count'
    or (p_output->>'result_count')::integer is distinct from jsonb_array_length(p_output->'results')
    or jsonb_array_length(p_output->'results') not between 1 and 200
    or (select count(distinct r->>'item_id') from jsonb_array_elements(p_output->'results') r) <> jsonb_array_length(p_output->'results') then raise exception 'INCOMPLETE_RESULTS'; end if;
  if (select count(*) from public.audit_items where audit_id = p_audit_id) <> jsonb_array_length(manifest.payload->'items') then raise exception 'STALE_ITEMS'; end if;
  -- Validate every snapshot/version within one transaction; the whole import is atomic.
  for entry in select r from jsonb_array_elements(p_output->'results') r order by r->>'item_id' loop
    select e into input from jsonb_array_elements(manifest.payload->'items') e where e->>'item_id' = entry->>'item_id';
    if not found or input->>'input_fingerprint' is distinct from entry->>'input_fingerprint' then raise exception 'INVALID_FINGERPRINT'; end if;
    select * into item from public.audit_items where id = (entry->>'item_id')::uuid and audit_id = p_audit_id for update;
    if not found then raise exception 'STALE_ITEMS'; end if;
    if manifest.reasoning_snapshots->item.id::text is distinct from jsonb_build_object(
      'category', item.category, 'subcategory', item.subcategory, 'criteria', item.criteria,
      'jawaban_auditee', coalesce(item.jawaban_auditee, ''), 'jawaban_evaluator', coalesce(item.jawaban_evaluator, ''),
      'catatan', coalesce(item.catatan, ''), 'rekomendasi', coalesce(item.rekomendasi, ''))
      or (input->>'sort_order')::integer is distinct from item.sort_order then raise exception 'STALE_ANSWER'; end if;
    if manifest.feedback_snapshots->item.id::text is distinct from jsonb_build_object(
      'teacher_score', coalesce(item.teacher_score, 0), 'catatan_asesor', coalesce(item.catatan_asesor, '')) then raise exception 'STALE_FEEDBACK'; end if;
    select * into previous from public.assessor_recommendations where item_id = item.id for update;
    had_previous := found;
    if (had_previous and previous.updated_at is distinct from (manifest.draft_versions->>item.id::text)::timestamptz)
      or (not had_previous and manifest.draft_versions->>item.id::text is not null) then raise exception 'STALE_RECOMMENDATION'; end if;
    if not (entry ? 'score') or jsonb_typeof(entry->'score') not in ('number', 'null') then raise exception 'INVALID_SCORE'; end if;
    value := (entry->>'score')::numeric;
    if value is not null and (value <> trunc(value) or value < 0 or value > 100) then raise exception 'INVALID_SCORE'; end if;
    if value = 0 and (trim(coalesce(item.jawaban_evaluator, '')) not in ('', '-')
      or trim(coalesce(item.catatan, '')) not in ('', '-') or trim(coalesce(item.rekomendasi, '')) not in ('', '-')
      or not coalesce(entry->'issue_codes' @> '["empty_answer"]'::jsonb, false)) then raise exception 'INVALID_ZERO_SCORE'; end if;
    if length(trim(coalesce(entry->>'assessor_note', ''))) = 0 or length(entry->>'assessor_note') > 6000
      or length(trim(coalesce(entry->>'rationale', ''))) = 0 or length(entry->>'rationale') > 6000
      or jsonb_typeof(entry->'review_flags') is distinct from 'array' then raise exception 'INVALID_FEEDBACK'; end if;
    if value is null and (entry->'needs_manual_review' is distinct from 'true'::jsonb or jsonb_array_length(entry->'review_flags') = 0) then raise exception 'UNSCORED_REVIEW_REQUIRED'; end if;
    -- Previously approved pairs are retained. Importing cannot undo an approval.
    if had_previous and previous.status = 'approved' then continue; end if;
    insert into public.assessor_recommendations
      (item_id, audit_id, score, assessor_note, rationale, review_flags, input_snapshot, feedback_snapshot,
       model, rubric_version, generated_by, package_id, diagnosis, issue_codes, basis_refs, needs_manual_review)
    values (item.id, p_audit_id, value::integer, entry->>'assessor_note', entry->>'rationale', entry->'review_flags',
      manifest.reasoning_snapshots->item.id::text, manifest.feedback_snapshots->item.id::text,
      'ChatGPT (impor manual)', p_output->>'rubric_version', p_importer, manifest.id,
      entry->'diagnosis', entry->'issue_codes', entry->'basis_refs', (entry->>'needs_manual_review')::boolean)
    on conflict (item_id) do update set score = excluded.score, assessor_note = excluded.assessor_note,
      rationale = excluded.rationale, review_flags = excluded.review_flags, input_snapshot = excluded.input_snapshot,
      feedback_snapshot = excluded.feedback_snapshot, model = excluded.model, rubric_version = excluded.rubric_version,
      generated_by = excluded.generated_by, package_id = excluded.package_id, diagnosis = excluded.diagnosis,
      issue_codes = excluded.issue_codes, basis_refs = excluded.basis_refs, needs_manual_review = excluded.needs_manual_review,
      status = 'pending', created_at = clock_timestamp(), updated_at = clock_timestamp(),
      approved_at = null, approved_by = null, approved_score = null, approved_note = null;
  end loop;
  update public.assessor_export_packages set imported_at = clock_timestamp(), imported_by = p_importer, imported_output = p_output where id = manifest.id;
  select coalesce(jsonb_agg(to_jsonb(r)), '[]'::jsonb) into result from public.assessor_recommendations r where audit_id = p_audit_id;
  return result;
end;
$$;
revoke all on function public.import_assessor_chatgpt_results(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.import_assessor_chatgpt_results(uuid, uuid, jsonb) to service_role;
