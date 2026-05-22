-- Migration: Industry search RPC fix + security advisor cleanup
-- Issue: search_industries('hvac', ...) returned []. Root cause: pg_trgm similarity()
-- даёт низкие баллы для коротких queries против длинных multi-word corpus
-- (4 символа vs ~80 символов = малая trigram-доля).
-- Fix: word_similarity() + exact substring boost.

-- Set search_path on immutable_array_to_string (security advisor cleanup)
create or replace function public.immutable_array_to_string(arr text[], delim text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$ select array_to_string(arr, delim) $$;

-- Updated search RPC:
--  - Exact substring match (case-insensitive): score 1.0
--  - Else word_similarity(query, searchable): score = wsim value
--  - Filter wsim > 0.3 OR exact substring present
--  - Order by score desc, return top-N
--
-- Why word_similarity not similarity():
--  similarity(a,b) = trigram_overlap / (trigrams(a) ∪ trigrams(b))
--    короткий query vs длинный corpus = низкая overlap proportion
--  word_similarity(query, doc) = best similarity между query и любой word window в doc
--    специально для short query → long doc.
create or replace function public.search_industries(
  p_query text,
  p_lang text default 'en',
  p_limit int default 5
)
returns table (
  id uuid,
  name_en text,
  name_ru text,
  industry_group text,
  similarity real
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    c.id,
    c.name_en,
    c.name_ru,
    c.industry_group,
    (case
       when lower(c.searchable) like '%' || lower(p_query) || '%' then 1.0
       else extensions.word_similarity(p_query, c.searchable)
     end)::real as similarity
  from public.industry_categories c
  where
    lower(c.searchable) like '%' || lower(p_query) || '%'
    or extensions.word_similarity(p_query, c.searchable) > 0.3
  order by similarity desc
  limit p_limit;
$$;

comment on function public.search_industries is
  'Fuzzy search across name_en+name_ru+keywords. word_similarity для short queries + exact substring boost. Sprint 1 Session 1 (fix v2).';
