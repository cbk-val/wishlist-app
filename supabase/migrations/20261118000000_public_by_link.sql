-- Public by link
-- Viewers need no account: they open ?s=<token>, which calls get_shared_wishlist()
-- (security definer, granted to anon). The signed-in read policies are therefore
-- unnecessary, and they let any account list every shared wishlist and its token.
-- After this, only the owner can read or write the tables directly.

drop policy if exists "Signed-in read shared wishlists"                  on public.wishlists;
drop policy if exists "Signed-in read shared categories with open items" on public.categories;
drop policy if exists "Signed-in read shared items that are not got"     on public.items;

-- Helpers only those policies used
drop function if exists public.category_in_shared_wishlist(uuid);
drop function if exists public.category_has_open_items(uuid);

-- Re-assert the one public entry point
revoke all on function public.get_shared_wishlist(text) from public;
grant execute on function public.get_shared_wishlist(text) to anon, authenticated;
