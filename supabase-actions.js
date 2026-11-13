// AUTH: Send Magic Link (no password needed) or Google OAuth
async function signInWithEmail(email) {
  return await db.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.origin + window.location.pathname }
  });
}

// TITLE: Update wishlist title
async function updateWishlistTitle(newTitle) {
  const { error } = await db
    .from('wishlists')
    .update({ title: newTitle.trim() })
    .eq('id', wishlistMeta.id);
  if (!error) wishlistMeta.title = newTitle.trim();
  return !error;
}

// SHARING: Toggle active or regenerate token (fixes GitHub Pages URL bug!)
function getShareUrl() {
  const base = window.location.origin + window.location.pathname;
  return `${base}?s=${wishlistMeta.share_token}`;
}

async function enableSharing() {
  const { data } = await db
    .from('wishlists')
    .update({ sharing_active: true })
    .eq('id', wishlistMeta.id)
    .select()
    .single();
  if (data) wishlistMeta = data;
  return getShareUrl();
}

async function stopSharing() {
  // Generates a fresh random hex token in JS so the old link immediately breaks
  const newToken = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  const { data } = await db
    .from('wishlists')
    .update({ sharing_active: false, share_token: newToken })
    .eq('id', wishlistMeta.id)
    .select()
    .single();
  if (data) wishlistMeta = data;
}

// GIFTS: Add, Edit, Toggle Got, Delete, Reorder
async function saveGift(payload, editingId = null) {
  if (editingId) {
    const { data, error } = await db
      .from('items')
      .update(payload)
      .eq('id', editingId)
      .select()
      .single();
    return { data, error };
  } else {
    const catItems = items.filter(i => i.category_id === payload.category_id);
    const { data, error } = await db
      .from('items')
      .insert({ ...payload, sort_order: catItems.length })
      .select()
      .single();
    return { data, error };
  }
}

async function persistItemOrder(orderedIds) {
  // Batch update sort_order after drag-and-drop "Done" is tapped
  await Promise.all(
    orderedIds.map((id, index) =>
      db.from('items').update({ sort_order: index }).eq('id', id)
    )
  );
}