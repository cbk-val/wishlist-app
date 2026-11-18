-- Multi-user wishlists
-- Built against 20261114000000_baseline.sql + 20261114120000_lock_down_reads.sql.
--
-- Already in the baseline, so NOT re-added here: wishlists.share_token (random
-- default, unique), wishlists.sharing_active, wishlists.owner_id (unique, one list
-- per owner), categories.wishlist_id (not null), categories.is_default, the
-- default-category delete guard, and get_shared_wishlist().
--
-- What this migration changes:
--   1. Replaces the "any signed-in user can read everything" policies with
--      policies scoped to the owner, or to wishlists with sharing_active = true.
--   2. Removes the owner_id-based write policies, which let a user insert a
--      category/item into SOMEONE ELSE'S wishlist.
--   3. Adds ensure_my_wishlist() so every new user gets a wishlist + Default category.
--   4. Revokes a share link when sharing is turned off; lets wishlists be deleted
--      with their user despite the Default-category guard; refreshes get_shared_wishlist().

-- 1. Helper functions (security definer so policies never recurse) ----------

create or replace function public.owns_category(cat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.categories c
    join public.wishlists w on w.id = c.wishlist_id
    where c.id = cat and w.owner_id = auth.uid()
  );
$$;

create or replace function public.category_in_shared_wishlist(cat uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.categories c
    join public.wishlists w on w.id = c.wishlist_id
    where c.id = cat and w.sharing_active
  );
$$;

-- category_has_open_items(uuid) already exists from the lock-down migration; reused as is.

revoke all on function public.owns_category(uuid)                from public, anon;
revoke all on function public.category_in_shared_wishlist(uuid)  from public, anon;
grant execute on function public.owns_category(uuid)               to authenticated;
grant execute on function public.category_in_shared_wishlist(uuid) to authenticated;

-- 2. Row-level security: replace every existing policy ----------------------

do $$
declare r record;
begin
  for r in
    select policyname, tablename from pg_policies
    where schemaname = 'public'
      and tablename in ('wishlists', 'categories', 'items')
  loop
    execute format('drop policy %I on public.%I', r.policyname, r.tablename);
  end loop;
end $$;

alter table public.wishlists  enable row level security;
alter table public.categories enable row level security;
alter table public.items      enable row level security;

-- wishlists
create policy "Owner manages own wishlist" on public.wishlists
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create policy "Signed-in read shared wishlists" on public.wishlists
  for select to authenticated
  using (sharing_active);

-- categories
create policy "Owner manages own categories" on public.categories
  for all to authenticated
  using (exists (select 1 from public.wishlists w
                 where w.id = categories.wishlist_id and w.owner_id = auth.uid()))
  with check (exists (select 1 from public.wishlists w
                      where w.id = categories.wishlist_id and w.owner_id = auth.uid()));

create policy "Signed-in read shared categories with open items" on public.categories
  for select to authenticated
  using (public.category_in_shared_wishlist(id) and public.category_has_open_items(id));

-- items
create policy "Owner manages own items" on public.items
  for all to authenticated
  using (public.owns_category(category_id))
  with check (public.owns_category(category_id));

create policy "Signed-in read shared items that are not got" on public.items
  for select to authenticated
  using (got is not true and public.category_in_shared_wishlist(category_id));

revoke all on public.wishlists, public.categories, public.items from anon;
grant select, insert, update, delete
  on public.wishlists, public.categories, public.items to authenticated;

create index if not exists items_category_id_idx on public.items(category_id);

-- 3. Keep today's behaviour for the existing list ---------------------------
-- Before this migration any signed-in user could read the existing wishlist.
-- Under the new policies that requires sharing_active, so turn it on for rows
-- that already exist. Set it back to false for any list that should be private.
update public.wishlists set sharing_active = true where not sharing_active;

-- Make sure each existing wishlist has its Default category flagged
update public.categories c set is_default = true
where lower(trim(c.name)) = 'default'
  and not exists (select 1 from public.categories d
                  where d.wishlist_id = c.wishlist_id and d.is_default);

-- 4. Every user gets their own wishlist -------------------------------------
-- Call from the app after sign-in: db.rpc('ensure_my_wishlist')

create or replace function public.ensure_my_wishlist()
returns public.wishlists
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  uid uuid := auth.uid();
  wl  public.wishlists;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  insert into public.wishlists (owner_id) values (uid)
  on conflict (owner_id) do nothing;

  select * into wl from public.wishlists where owner_id = uid;

  if not exists (select 1 from public.categories
                 where wishlist_id = wl.id and is_default) then
    insert into public.categories (wishlist_id, name, icon, is_default, sort_order, owner_id)
    values (wl.id, 'Default', '🎁', true, 0, uid)
    on conflict do nothing;
  end if;

  return wl;
end;
$$;

revoke all on function public.ensure_my_wishlist() from public, anon;
grant execute on function public.ensure_my_wishlist() to authenticated;

-- 5. Turning sharing off revokes the old link --------------------------------

create or replace function public.rotate_share_token()
returns trigger
language plpgsql
set search_path = public, extensions
as $$
begin
  new.share_token := encode(gen_random_bytes(16), 'hex');
  return new;
end;
$$;

drop trigger if exists rotate_token_on_unshare on public.wishlists;
create trigger rotate_token_on_unshare
  before update of sharing_active on public.wishlists
  for each row
  when (old.sharing_active and not new.sharing_active)
  execute function public.rotate_share_token();

-- 6. Default-category guard must not block deleting a whole wishlist ---------
-- When a wishlist is deleted (e.g. the user's account is removed), its categories
-- are removed by cascade. Only block deleting the Default category on its own.

create or replace function public.prevent_default_category_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if old.is_default
     and exists (select 1 from public.wishlists where id = old.wishlist_id) then
    raise exception 'Cannot delete the Default category';
  end if;
  return old;
end;
$function$;

-- 7. Token-based read for anonymous viewers (same shape as before, plus img) --

create or replace function public.get_shared_wishlist(p_token text)
returns json
language sql
stable
security definer
set search_path = public
as $$
  select json_build_object(
    'title', w.title,
    'updated_at', w.updated_at,
    'categories', coalesce((
      select json_agg(
        json_build_object('id', c.id, 'name', c.name, 'icon', c.icon, 'items', ci.items)
        order by c.sort_order)
      from public.categories c
      cross join lateral (
        select json_agg(
          json_build_object('id', i.id, 'name', i.name, 'price', i.price,
                            'link', i.link, 'note', i.note, 'img', i.img)
          order by i.sort_order) as items
        from public.items i
        where i.category_id = c.id and i.got = false
      ) ci
      where c.wishlist_id = w.id and ci.items is not null
    ), '[]'::json)
  )
  from public.wishlists w
  where w.share_token = p_token and w.sharing_active;
$$;

revoke all on function public.get_shared_wishlist(text) from public;
grant execute on function public.get_shared_wishlist(text) to anon, authenticated;