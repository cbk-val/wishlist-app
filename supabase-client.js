const SUPABASE_URL = 'https://dfydtqqujllutkhyihlw.supabase.co';
const SUPABASE_KEY = 'sb_publishable_khixfpUDXpCyEpwaeo2NhQ_BjD2ezIz';

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

function getWishlistAppUrl() {
  var path = window.location.pathname
    .replace(/\/(?:landing(?:\/index\.html)?|index\.html)\/?$/, "/");
  return new URL(path.endsWith("/") ? path : path + "/", window.location.origin).href;
}

async function signInWithGoogle(redirectTo) {
  return await db.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectTo || getWishlistAppUrl()
    }
  });
}