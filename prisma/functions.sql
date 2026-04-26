-- Supabase Auth trigger: auto-create profile on signup
-- This SQL would run in Supabase SQL editor, not through Prisma
-- (Prisma doesn't manage Supabase Auth triggers)

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (user_id, email, name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
