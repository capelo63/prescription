// =============================================================
// Configuration Supabase - Impulsion
// =============================================================
// IMPORTANT : remplacez ces valeurs par celles de votre projet
// Supabase (Settings > API dans la console Supabase).
// =============================================================

const SUPABASE_URL = 'https://VOTRE_PROJET.supabase.co';
const SUPABASE_ANON_KEY = 'VOTRE_CLE_ANON';

// Initialisation du client Supabase (chargé via CDN dans le HTML)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
