-- 기존에 업장명을 입력했는데 「부동산」「공인중개사사무소」가 없으면 접미사 보정
-- 미입력(빈 값)·기본값「현장동선」은 그대로 둠
update public.profiles
set
  shop_name = trim(shop_name) || ' 공인중개사사무소'
where
  nullif(trim(shop_name), '') is not null
  and trim(shop_name) <> '현장동선'
  and position('부동산' in shop_name) = 0
  and position('공인중개사사무소' in shop_name) = 0;
