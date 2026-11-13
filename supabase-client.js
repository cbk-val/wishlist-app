const SUPABASE_URL = 'https://dfydtqqujllutkhyihlw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_khixfpUDXpCyEpwaeo2NhQ_BjD2ezIz';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// App state
let currentUser = null;
let wishlistMeta = null; // { id, title, share_token, sharing_active, updated_at }
let categories = [];     // [{ id, name, icon, is_default, sort_order }]
let items = [];          // [{ id, category_id, name, price, link, note, got, sort_order }]

// 1. BOOTSTRAP: Check for ?s=token (Viewer Mode) vs Owner Mode
async function initApp() {
  const params = new URLSearchParams(window.location.search);
  const shareToken = params.get('s');

  if (shareToken) {
    // VIEWER MODE (Anonymous, read-only)
    const { data, error } = await db.rpc('get_shared_wishlist', { p_token: shareToken });
    if (error || !data) {
      renderInvalidShareScreen(); // Show "This wishlist is private or no longer shared."
      return;
    }
    renderViewerMode(data);
    return;
  }

  // OWNER MODE: Check active session
  const { data: { session } } = await db.auth.getSession();
  if (!session) {
    renderLoginScreen(); // Show dark-mode sign-in card
    return;
  }

  currentUser = session.user;
  await loadOwnerWishlist();
}

// Listen for magic-link / OAuth sign-in redirects
db.auth.onAuthStateChange((event, session) => {
  if (event === 'SIGNED_IN' && session && !currentUser) {
    currentUser = session.user;
    loadOwnerWishlist();
  }
});