# Supabase 설정

1. [supabase.com](https://supabase.com)에서 프로젝트 생성
2. **SQL Editor**에서 [`migrations/001_init.sql`](migrations/001_init.sql) 전체 실행
3. **Authentication → Providers → Email** 에서 **Confirm email** OFF (아이디 로그인용)
4. **Settings → API** 에서 Project URL · anon key 복사 → 프로젝트 루트 `.env.local`
5. 비밀번호 찾기(힌트 → 새 비밀번호)를 쓰려면 같은 화면의 **service_role** 키를  
   `SUPABASE_SERVICE_ROLE_KEY`로 `.env.local`에만 추가 (서버 전용, Git 금지)

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```
