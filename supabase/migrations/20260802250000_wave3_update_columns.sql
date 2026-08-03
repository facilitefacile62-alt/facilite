-- =====================================================================
-- VAGUE 3 (Partie 1 du chantier) — UPDATE authenticated restreint aux
-- colonnes réellement utilisées côté client, table par table. Voir
-- docs/grants-matrix.md pour le recensement exhaustif (.update()/.upsert()
-- client trouvés dans src/).
-- =====================================================================

-- Tables sans besoin d'UPDATE authenticated : tout passe par service_role
-- ou par une fonction RPC dédiée. Simple révocation, aucun GRANT de colonne.
REVOKE UPDATE ON public.ai_usage_daily FROM authenticated;
REVOKE UPDATE ON public.applications FROM authenticated;
REVOKE UPDATE ON public.assistant_messages FROM authenticated;
REVOKE UPDATE ON public.contact_messages FROM authenticated;
REVOKE UPDATE ON public.interviews FROM authenticated;
REVOKE UPDATE ON public.subscriptions FROM authenticated;

-- agent_assignments : commandes-agent (admin) + complete-assignment (agent)
REVOKE UPDATE ON public.agent_assignments FROM authenticated;
GRANT UPDATE (status, agent_id, completed_cv_url) ON public.agent_assignments TO authenticated;

-- candidatures : changement de statut par le recruteur (pipeline)
REVOKE UPDATE ON public.candidatures FROM authenticated;
GRANT UPDATE (status) ON public.candidatures TO authenticated;

-- conversations : dernier message affiché dans la liste des conversations
REVOKE UPDATE ON public.conversations FROM authenticated;
GRANT UPDATE (last_message, updated_at) ON public.conversations TO authenticated;

-- job_offers : formulaire recruteur. `embedding` explicitement EXCLU (calcul
-- serveur uniquement, route /api/recruteur/offres/[id]/embedding) et
-- `archived_at` explicitement EXCLU (uniquement via archive_own_job_offer())
-- — sinon un recruteur pourrait manipuler son classement sémantique ou
-- désarchiver une offre sans repasser par la fonction contrôlée.
REVOKE UPDATE ON public.job_offers FROM authenticated;
GRANT UPDATE (
  title, company, location, contract_type, salary_range,
  min_education_level, description, image_url, deadline, updated_at,
  is_active
) ON public.job_offers TO authenticated;

-- messages : marquage lu/non lu
REVOKE UPDATE ON public.messages FROM authenticated;
GRANT UPDATE (is_read) ON public.messages TO authenticated;

-- orders : référence de paiement posée au moment du checkout (le reste —
-- payment_status, invoice_url — n'est écrit que par le webhook, service_role)
REVOKE UPDATE ON public.orders FROM authenticated;
GRANT UPDATE (payment_reference) ON public.orders TO authenticated;

-- recruiter_profiles : formulaire de profil entreprise recruteur
REVOKE UPDATE ON public.recruiter_profiles FROM authenticated;
GRANT UPDATE (company_name, sector, location, description, website, logo_url, banner_url)
  ON public.recruiter_profiles TO authenticated;

-- resumes : traitement OCR/embedding d'un CV importé (api/process-resume)
REVOKE UPDATE ON public.resumes FROM authenticated;
GRANT UPDATE (status, content, embedding, updated_at) ON public.resumes TO authenticated;

-- support_threads : changement de statut par l'admin support
REVOKE UPDATE ON public.support_threads FROM authenticated;
GRANT UPDATE (status, updated_at) ON public.support_threads TO authenticated;

-- transactions : référence de paiement posée au moment du checkout (le
-- reste — status, invoice_url — n'est écrit que par le webhook, service_role)
REVOKE UPDATE ON public.transactions FROM authenticated;
GRANT UPDATE (provider_reference) ON public.transactions TO authenticated;

-- Aucune action sur profiles ni user_roles ni badge_requests ni
-- security_logs : déjà verrouillées par des correctifs antérieurs, hors
-- périmètre de cette vague.
