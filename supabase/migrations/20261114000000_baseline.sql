-- =====================================================================
-- BASELINE: the database as it was BEFORE 20261114120000_lock_down_reads.sql
--
-- This file is a record of the schema, reconstructed from a catalog dump.
-- DO NOT run it on your existing Supabase project: everything in it already
-- exists and it would fail. It is only for rebuilding the database in a fresh,
-- empty Supabase project (apply this file first, then the later migrations).
--
-- If you adopt the Supabase CLI later, mark this one as already applied:
--   supabase migration repair --status applied 20261114000000
--
-- Not restated here: Supabase's default table grants to anon/authenticated
-- (a new Supabase project applies them automatically).
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------- functions used by triggers ----------

create or replace function public.prevent_default_category_delete()
returns trigger
language plpgsql
as $function$
begin
  if old.is_default then
    raise exception 'Cannot delete the Default category';
  end if;
  return old;
end;
$function$;

create or replace function public.touch_wishlist_updated_at()
returns trigger
language plpgsql
as $function$
begin
  update wishlists set updated_at = now()
  where id = coalesce(new.wishlist_id, old.wishlist_id);
  return null;
end;
$function$;

-- ---------- tables ----------

create table public.wishlists (
  id uuid not null default gen_random_uuid(),
  owner_id uuid not null,
  title text not null default 'My wishlist',
  share_token text default encode(gen_random_bytes(16), 'hex'),
  sharing_active boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint wishlists_pkey primary key (id),
  constraint wishlists_owner_id_key unique (owner_id),
  constraint wishlists_share_token_key unique (share_token),
  constraint wishlists_owner_id_fkey foreign key (owner_id) references auth.users(id) on delete cascade,
  constraint wishlists_title_check check (char_length(trim(both from title)) > 0)
);

create table public.categories (
  id uuid not null default gen_random_uuid(),
  wishlist_id uuid not null,
  name text not null,
  icon text not null default '🎁',
  is_default boolean not null default false,
  sort_order integer not null default 0,
  owner_id uuid default auth.uid(),
  constraint categories_pkey primary key (id),
  constraint categories_name_check check (
    char_length(trim(both from name)) >= 1 and char_length(trim(both from name)) <= 30),
  constraint categories_owner_id_fkey foreign key (owner_id) references auth.users(id),
  constraint categories_wishlist_id_fkey foreign key (wishlist_id) references public.wishlists(id) on delete cascade
);

create unique index categories_unique_name_idx
  on public.categories using btree (wishlist_id, lower(trim(both from name)));

create table public.items (
  id uuid not null default gen_random_uuid(),
  category_id uuid not null,
  name text not null,
  price numeric not null default 0,
  link text,
  note text,
  got boolean not null default false,
  sort_order integer not null default 0,
  owner_id uuid default auth.uid(),
  img text,
  constraint items_pkey primary key (id),
  constraint items_category_id_fkey foreign key (category_id) references public.categories(id) on delete cascade,
  constraint items_link_check check ((link is null) or (link = ''::text) or (link ~* '^https?://'::text)),
  constraint items_name_check check (
    char_length(trim(both from name)) >= 1 and char_length(trim(both from name)) <= 80),
  constraint items_note_check check ((note is null) or (char_length(note) <= 200)),
  constraint items_owner_id_fkey foreign key (owner_id) references auth.users(id),
  constraint items_price_check check (price >= (0)::numeric)
);

-- ---------- triggers ----------

create trigger guard_default_category_delete
  before delete on public.categories
  for each row execute function public.prevent_default_category_delete();

create trigger update_wishlist_timestamp_cat
  after insert or delete or update on public.categories
  for each row execute function public.touch_wishlist_updated_at();

-- ---------- token-based read function (kept for the future "Public" option) ----------

create or replace function public.get_shared_wishlist(p_token text)
returns json
language plpgsql
security definer
as $function$
declare
  v_wishlist wishlists%rowtype;
  v_result json;
begin
  select * into v_wishlist
  from wishlists
  where share_token = p_token and sharing_active = true;

  if not found then
    return null;
  end if;

  select json_build_object(
    'title', v_wishlist.title,
    'updated_at', v_wishlist.updated_at,
    'categories', coalesce((
      select json_agg(
        json_build_object(
          'id', c.id,
          'name', c.name,
          'icon', c.icon,
          'items', cat_items.items
        ) order by c.sort_order asc
      )
      from categories c
      cross join lateral (
        select json_agg(
          json_build_object(
            'id', i.id,
            'name', i.name,
            'price', i.price,
            'link', i.link,
            'note', i.note
          ) order by i.sort_order asc
        ) as items
        from items i
        where i.category_id = c.id and i.got = false
      ) cat_items
      where c.wishlist_id = v_wishlist.id
        and cat_items.items is not null
    ), '[]'::json)
  ) into v_result;

  return v_result;
end;
$function$;

-- ---------- row-level security ----------

alter table public.wishlists enable row level security;
alter table public.categories enable row level security;
alter table public.items enable row level security;

-- wishlists
create policy "Allow public read access on wishlists" on public.wishlists
  for select using (true);
create policy "Owners manage own wishlist" on public.wishlists
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
create policy "Users can manage their own wishlists" on public.wishlists
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- categories
create policy "Allow public read access on categories" on public.categories
  for select using (true);
create policy "Owners manage own categories" on public.categories
  for all using (exists (
    select 1 from wishlists w
    where w.id = categories.wishlist_id and w.owner_id = auth.uid()));
create policy "Users can manage categories of their wishlists" on public.categories
  for all
  using (wishlist_id in (select wishlists.id from wishlists where wishlists.owner_id = auth.uid()))
  with check (wishlist_id in (select wishlists.id from wishlists where wishlists.owner_id = auth.uid()));
create policy "Users can manage their own categories" on public.categories
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);

-- items
create policy "Allow public read access on items" on public.items
  for select using (true);
create policy "Owners manage own items" on public.items
  for all using (exists (
    select 1 from categories c join wishlists w on w.id = c.wishlist_id
    where c.id = items.category_id and w.owner_id = auth.uid()));
create policy "Users can manage items of their categories" on public.items
  for all
  using (category_id in (
    select c.id from categories c join wishlists w on c.wishlist_id = w.id
    where w.owner_id = auth.uid()))
  with check (category_id in (
    select c.id from categories c join wishlists w on c.wishlist_id = w.id
    where w.owner_id = auth.uid()));
create policy "Users can manage their own items" on public.items
  for all using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
