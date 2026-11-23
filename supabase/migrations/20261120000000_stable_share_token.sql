-- Stable share link
-- The share token no longer changes when sharing is turned off. Turning sharing
-- off simply makes get_shared_wishlist() return null for that token; turning it
-- back on makes the same link work again.
--
-- If a link ever needs to be replaced in an emergency, rotate it manually:
--   update public.wishlists
--   set share_token = encode(extensions.gen_random_bytes(16), 'hex')
--   where id = '<wishlist id>';

drop trigger  if exists rotate_token_on_unshare on public.wishlists;
drop function if exists public.rotate_share_token();