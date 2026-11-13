// supabase-migration.js

async function loadOwnerWishlist() {
  console.log("Fetching owner wishlist and items from Supabase...");

  // 1. Fetch categories from the database
  const { data: catData, error: catError } = await db
    .from('categories')
    .select('*')
    .order('sort_order', { ascending: true });

  if (catError) {
    console.error("Error loading categories:", catError.message);
  } else {
    categories = catData || [];
  }

  // 2. Fetch wishlist items from the database
  const { data: itemData, error: itemError } = await db
    .from('items')
    .select('*')
    .order('sort_order', { ascending: true });

  if (itemError) {
    console.error("Error loading items:", itemError.message);
  } else {
    items = itemData || [];
  }

  // 3. Switch the UI from the login screen to your actual wishlist app
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

// Listen for magic-link / OAuth sign-in redirects
db.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session && !currentUser) {
    currentUser = session.user;
    loadOwnerWishlist();
  }
});