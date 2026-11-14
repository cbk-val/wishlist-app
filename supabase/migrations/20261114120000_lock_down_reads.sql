-- Lock down reads: only signed-in users can read, and non-owners never see "got" gifts.
-- Owner policies (ALL, auth.uid() = owner) are left unchanged and still give the owner full access.

begin;

-- Helper (bypasses RLS on purpose, so the items/categories policies don't recurse)
create or replace function public.category_has_open_items(cat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.items
    where category_id = cat and got is not true
  );
$$;
revoke all on function public.category_has_open_items(uuid) from public, anon;
grant execute on function public.category_has_open_items(uuid) to authenticated;

-- Remove "anyone can read"
drop policy "Allow public read access on items" on public.items;
drop policy "Allow public read access on categories" on public.categories;
drop policy "Allow public read access on wishlists" on public.wishlists;

-- Signed-in users: limited read access
create policy "Signed-in read wishlists" on public.wishlists
  for select to authenticated using (true);

create policy "Signed-in read items that are not got" on public.items
  for select to authenticated using (got is not true);

create policy "Signed-in read categories with open items" on public.categories
  for select to authenticated using (public.category_has_open_items(id));

commit;
