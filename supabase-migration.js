async function loadOwnerWishlist() {
  // 1. Fetch existing wishlist for this owner
  let { data: wl } = await db
    .from('wishlists')
    .select('*')
    .eq('owner_id', currentUser.id)
    .maybeSingle();

  // 2. First-time user: create wishlist & migrate localStorage if present
  if (!wl) {
    wl = await bootstrapNewOwner();
  }
  wishlistMeta = wl;

  // 3. Load categories and items in parallel
  const [catRes, itemRes] = await Promise.all([
    db.from('categories').select('*').eq('wishlist_id', wl.id).order('sort_order', { ascending: true }),
    db.from('items').select('*').order('sort_order', { ascending: true })
  ]);

  categories = catRes.data || [];
  items = itemRes.data || [];
  renderOwnerApp();
}

async function bootstrapNewOwner() {
  const rawLocal = localStorage.getItem('wishlist-v3');
  const localData = rawLocal ? JSON.parse(rawLocal) : null;

  // Create the wishlist row
  const { data: wl, error } = await db
    .from('wishlists')
    .insert({
      owner_id: currentUser.id,
      title: localData?.title || 'My wishlist'
    })
    .select()
    .single();

  if (error) throw error;

  // If no local data, just create the mandatory "Default" category
  if (!localData || !localData.categories?.length) {
    await db.from('categories').insert({
      wishlist_id: wl.id,
      name: 'Default',
      icon: '🎁',
      is_default: true,
      sort_order: 0
    });
    return wl;
  }

  // Migrate localStorage categories & map old string IDs -> new Postgres UUIDs
  const idMap = {};
  for (let i = 0; i < localData.categories.length; i++) {
    const oldCat = localData.categories[i];
    const { data: newCat } = await db
      .from('categories')
      .insert({
        wishlist_id: wl.id,
        name: oldCat.name.slice(0, 30),
        icon: oldCat.icon || '🎁',
        is_default: oldCat.id === 'main' || i === 0,
        sort_order: i
      })
      .select()
      .single();
    if (newCat) idMap[oldCat.id] = newCat.id;
  }

  // Migrate localStorage items (ignoring base64 img)
  if (localData.items?.length) {
    const rowsToInsert = localData.items
      .filter(it => idMap[it.categoryId])
      .map((it, idx) => ({
        category_id: idMap[it.categoryId],
        name: it.name.slice(0, 80),
        price: Math.max(0, Number(it.price) || 0),
        link: it.link || null,
        note: it.note ? it.note.slice(0, 200) : null,
        got: Boolean(it.got),
        sort_order: idx
      }));

    if (rowsToInsert.length) {
      await db.from('items').insert(rowsToInsert);
    }
  }

  // Clear localStorage so it doesn't re-import
  localStorage.removeItem('wishlist-v3');
  return wl;
}