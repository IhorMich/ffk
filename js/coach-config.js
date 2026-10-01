// Fill these when the Supabase project is ready.
// Empty = Coach Phase 1 runs in local cloud-mirror mode on this phone.
// Use the publishable/anon key only — never service_role or sb_secret_*.
window.FFK_COACH_CONFIG = {
  supabaseUrl: 'https://iuvggtoamklqhuaswfmi.supabase.co',
  supabaseAnonKey: 'sb_publishable_oSVHv0IEEDr_DvwZu9Kusw_WOSIFg2-',
  mode: 'local' // 'local' | 'supabase' (auto if url+key set)
};
// Firebase google-services.json is in android/app — allow Capacitor Push.register (FCM).
window.FFK_PUSH_FCM = true;
(function(){
  const c = window.FFK_COACH_CONFIG;
  if(c.supabaseUrl && c.supabaseAnonKey) c.mode = 'supabase';
})();
