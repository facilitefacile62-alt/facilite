# Controle de l'adresse de connexion Postgres SANS jamais l'afficher (ni elle, ni le mot de passe, ni l'hote) : seuls le type, le port et la
# reference du projet (le 'ref' : 20 caracteres, pas un secret) peuvent apparaitre. Utilise par exporter.ps1 ; ASCII seulement (PowerShell 5.1).

# Reference du projet de PRODUCTION (meme valeur que scripts/export-production/projet.mjs et tests/helpers/testEnv.js ; un test les compare).
$script:REF_PRODUCTION = 'ocfhzwwjvljintabxxlg'

# Reference du projet lue dans l'adresse : utilisateur 'postgres.<ref>' (pooler) ou hote 'db.<ref>.supabase.co' (direct). $null si introuvable.
function Extraire-Ref([string]$adresse) {
  if ($adresse -match '^postgres(?:ql)?://postgres\.([a-z0-9]{20}):') { return $Matches[1] }
  if ($adresse -match '@db\.([a-z0-9]{20})\.supabase\.co[:/]') { return $Matches[1] }
  return $null
}

# Reference du projet lue dans une adresse d'API 'https://<ref>.supabase.co'. $null si introuvable.
function Extraire-RefApi([string]$url) {
  if ($url -match '^https://([a-z0-9]{20})\.supabase\.co(?:[/:]|$)') { return $Matches[1] }
  return $null
}

# Arrete le script si la reference n'est pas celle de la production (ou si elle est introuvable). Aucun pg_dump n'a encore tourne a ce stade.
function Verifier-Projet($ref, [string]$origine) {
  if (-not $ref) { throw "Impossible de lire la reference du projet dans $origine : arret par prudence. Rien n'a ete lance." }
  if ($ref -ne $script:REF_PRODUCTION) {
    throw "ARRET : $origine pointe vers le projet '$ref' et non vers la PRODUCTION ('$($script:REF_PRODUCTION)'). Rien n'a ete lance. Utilisez l'adresse du projet de production (Connect > Session pooler)."
  }
}

# Renvoie { Type; Port; Ref } pour une adresse exploitable, ou leve une erreur au message clair (sans jamais repeter l'adresse).
# Type : 'session-pooler', 'direct' ou 'autre'.
function Controler-Adresse([string]$adresse) {
  if ($adresse -notmatch '^postgres(?:ql)?://') { throw "Ce n'est pas une adresse de connexion Postgres (elle doit commencer par postgresql://)." }
  if ($adresse -match '\[YOUR-PASSWORD\]|\[PASSWORD\]|\[MOT') { throw "L'adresse contient encore l'espace reserve du mot de passe ([YOUR-PASSWORD]). Remplacez-le par le mot de passe de la base AVANT de copier l'adresse." }
  if ($adresse -notmatch '^postgres(?:ql)?://([^:@/]+):(.+)@([^@/:]+):(\d+)/([^?]*)') { throw "Adresse illisible : il manque l'utilisateur, le mot de passe, l'hote ou le port." }
  $hote = $Matches[3]
  $port = [int]$Matches[4]
  if ($Matches[2].Length -lt 1) { throw "Mot de passe absent dans l'adresse." }
  if ($port -eq 6543) {
    throw "Cette adresse est celle du Transaction pooler (port 6543) : pg_dump ne peut pas l'utiliser. Que faire : remplacez 6543 par 5432 (meme hote, meme utilisateur, meme mot de passe), ou copiez l'adresse 'Session pooler' dans Connect."
  }
  $type = 'autre'
  if ($hote -match 'pooler\.supabase\.com$') { $type = 'session-pooler' }
  elseif ($hote -match '^db\..+\.supabase\.co$') { $type = 'direct' }
  [pscustomobject]@{ Type = $type; Port = $port; Ref = (Extraire-Ref $adresse) }
}

# Lit l'adresse dans le presse-papiers (qui est ensuite VIDE : le mot de passe n'y reste pas) ; saisie masquee si le presse-papiers n'en contient pas.
# Ne renvoie que la chaine ; n'affiche jamais rien.
function Lire-Adresse() {
  $presse = ''
  try { $presse = ((Get-Clipboard -Raw -ErrorAction Stop) | Out-String).Trim() } catch { $presse = '' }
  if ($presse -match '^postgres(?:ql)?://') {
    Set-Clipboard -Value $null
    return $presse
  }
  $s = Read-Host "Le presse-papiers ne contient pas d'adresse Postgres. Collez-la ici (rien ne s'affiche) puis Entree" -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

# Transaction pooler Supabase (hote *.pooler.supabase.com, utilisateur postgres.<ref>, port 6543) -> Session pooler (port 5432) : meme hote, meme utilisateur,
# meme mot de passe, EN MEMOIRE seulement. Retire aussi les options propres au mode transaction que pg_dump ne connait pas (pgbouncer, connection_limit, pool_timeout).
# Toute autre adresse est renvoyee telle quelle (et gardera donc son refus eventuel). Ne l'affiche jamais.
function Convertir-Session([string]$adresse) {
  if ($adresse -notmatch '^(postgres(?:ql)?://postgres\.[a-z0-9]{20}:.+@[^@/:]+\.pooler\.supabase\.com):6543(/[^?]*)?(\?.*)?$') { return $adresse }
  $base = $Matches[1]
  $chemin = $Matches[2]
  $options = @()
  if ($Matches[3]) { $options = @(($Matches[3].TrimStart('?')) -split '&' | Where-Object { $_ -and ($_ -notmatch '^(pgbouncer|connection_limit|pool_timeout)=') }) }
  $fin = if ($options.Count -gt 0) { '?' + ($options -join '&') } else { '' }
  return "${base}:5432${chemin}${fin}"
}

# Avec -DepuisEnvLocal : essaie SUPABASE_DATABASE_URL puis DATABASE_URL dans .env.local. Garde la premiere qui est une adresse exploitable ET du projet de production.
# Un Transaction pooler (6543) est converti en Session pooler (5432) en memoire : Converti = $true (a signaler "converti 6543 -> 5432", sans valeur).
# Renvoie { Nom; Adresse; Type; Port; Ref; Converti; Rejets } : le NOM de la variable, jamais sa valeur ; Rejets = les variables ecartees avec la raison (sans valeur).
function Lire-AdresseEnv([string]$fichier) {
  $rejets = @()
  foreach ($nom in 'SUPABASE_DATABASE_URL', 'DATABASE_URL') {
    $ligne = Get-Content $fichier -ErrorAction Stop | Where-Object { $_ -match "^$nom=" } | Select-Object -First 1
    if (-not $ligne) { $rejets += "$nom : absente de .env.local"; continue }
    $valeur = (($ligne -replace "^$nom=", '').Trim().Trim('"').Trim("'"))
    if (-not $valeur) { $rejets += "$nom : vide"; continue }
    $converti = $false
    $apres = Convertir-Session $valeur
    if ($apres -ne $valeur) { $valeur = $apres; $converti = $true }
    try {
      $info = Controler-Adresse $valeur
      Verifier-Projet $info.Ref "la variable $nom"
    } catch {
      $rejets += "$nom : $($_.Exception.Message)"
      continue
    }
    return [pscustomobject]@{ Nom = $nom; Adresse = $valeur; Type = $info.Type; Port = $info.Port; Ref = $info.Ref; Converti = $converti; Rejets = $rejets }
  }
  throw ("Aucune variable de .env.local ne convient :`n  - " + ($rejets -join "`n  - "))
}
