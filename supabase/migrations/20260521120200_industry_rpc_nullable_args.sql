-- Migration: industry RPCs — make brand_id arg optional (default null).
-- Reason: Supabase type-gen генерит `p_brand_id: string` (required) когда
-- параметр без default. Нужно `default null` чтобы тип стал
-- `p_brand_id?: string | undefined` — иначе TS errors в client коде
-- который вызывает RPC из wizard pre-brand (где brandId ещё нет).

create or replace function public.submit_industry_request(
  p_query_text text,
  p_brand_id uuid default null,
  p_email text default null
)
returns public.industry_requests
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account_id uuid;
  v_request public.industry_requests;
begin
  v_account_id := auth.uid();
  if v_account_id is null then
    raise exception 'unauthenticated' using errcode = '42501';
  end if;
  if p_brand_id is not null then
    if not exists (
      select 1 from public.brands
      where id = p_brand_id and account_id = v_account_id
    ) then
      raise exception 'brand does not belong to account' using errcode = '42501';
    end if;
  end if;
  insert into public.industry_requests (brand_id, account_id, query_text, email)
  values (p_brand_id, v_account_id, p_query_text, p_email)
  returning * into v_request;
  return v_request;
end;
$$;

grant execute on function public.submit_industry_request(text, uuid, text) to authenticated;

create or replace function public.log_industry_search_miss(
  p_query_text text,
  p_brand_id uuid default null,
  p_top_5_ids uuid[] default '{}',
  p_picked_index int default null,
  p_clicked_other boolean default false
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_account_id uuid;
begin
  v_account_id := auth.uid();
  if v_account_id is null then
    return;
  end if;
  insert into public.industry_search_misses (
    brand_id, account_id, query_text, top_5_ids, picked_index, clicked_other
  )
  values (
    p_brand_id, v_account_id, p_query_text, p_top_5_ids, p_picked_index, p_clicked_other
  );
end;
$$;

grant execute on function public.log_industry_search_miss(text, uuid, uuid[], int, boolean) to authenticated;

-- Drop old signatures (с обязательным p_brand_id)
drop function if exists public.submit_industry_request(uuid, text, text);
drop function if exists public.log_industry_search_miss(uuid, text, uuid[], int, boolean);
