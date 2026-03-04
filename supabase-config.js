// =============================================================
// Configuration Supabase - Impulsion
// =============================================================
// IMPORTANT : remplacez ces valeurs par celles de votre projet
// Supabase (Settings > API dans la console Supabase).
// =============================================================

const SUPABASE_URL = 'https://VOTRE_PROJET.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oa2txbXJsc2plYml1dGlqZGFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MjA0OTAsImV4cCI6MjA4ODE5NjQ5MH0.phQkUajKQbkCDOijcpwbI40pRK8RYOR3yHSd-GLvYg4';

// Initialisation du client Supabase (chargé via CDN dans le HTML)
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
