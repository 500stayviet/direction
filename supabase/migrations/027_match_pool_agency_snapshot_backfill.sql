-- 사이트내 공유 매칭 — 등록 부동산 스냅샷 백필 (createdByShopName·Phone)
-- payload에 스냅샷이 없는 기존 행에 profiles 기준 보정

update public.customers c
set payload = c.payload
  || jsonb_strip_nulls(
    jsonb_build_object(
      'createdByShopName',
      case
        when nullif(trim(p.shop_name), '') is null
          or trim(p.shop_name) = '현장동선' then null
        else trim(p.shop_name)
      end,
      'createdByPhone',
      nullif(trim(p.phone), '')
    )
  )
from public.profiles p
where c.created_by = p.id
  and coalesce(c.payload->>'createdByShopName', '') = ''
  and c.deleted_at is null;

update public.listed_properties lp
set payload = lp.payload
  || jsonb_strip_nulls(
    jsonb_build_object(
      'createdByShopName',
      case
        when nullif(trim(p.shop_name), '') is null
          or trim(p.shop_name) = '현장동선' then null
        else trim(p.shop_name)
      end,
      'createdByPhone',
      nullif(trim(p.phone), '')
    )
  )
from public.profiles p
where lp.created_by = p.id
  and coalesce(lp.payload->>'createdByShopName', '') = ''
  and lp.deleted_at is null;
