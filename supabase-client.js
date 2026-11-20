const SUPABASE_URL = 'https://dfydtqqujllutkhyihlw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_khixfpUDXpCyEpwaeo2NhQ_BjD2ezIz';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function getWishlistAppUrl() {
  return new URL("../", window.location.href).href;
}

async function signInWithGoogle() {
  return await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getWishlistAppUrl()
    }
  });
}