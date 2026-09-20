// Fill these when the Supabase project is ready.
// Empty = Coach Phase 1 runs in local cloud-mirror mode on this phone.
window.FFK_COACH_CONFIG = {
  supabaseUrl: '',
  supabaseAnonKey: '',
  mode: 'local' // 'local' | 'supabase' (auto if url+key set)
};
(function(){
  const c = window.FFK_COACH_CONFIG;
  if(c.supabaseUrl && c.supabaseAnonKey) c.mode = 'supabase';
})();
