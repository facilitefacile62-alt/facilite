# Controle de l'adresse de connexion Postgres SANS jamais l'afficher (ni elle, ni le mot de passe, ni l'hote).
# Utilise par exporter.ps1 ; ASCII seulement (PowerShell 5.1).

# Renvoie un objet { Type; Port } pour une adresse exploitable, ou leve une erreur au message clair.
# Type : 'session-pooler', 'direct' ou 'autre'.
function Controler-Adresse([string]$adresse) {
  if ($adresse -notmatch '^postgres(?:ql)?://') { throw "Ce n'est pas une adresse de connexion Postgres (elle doit commencer par postgresql://)." }
  if ($adresse -match '\[YOUR-PASSWORD\]|\[PASSWORD\]|\[MOT') { throw "L'adresse contient encore l'espace reserve du mot de passe ([YOUR-PASSWORD]). Remplacez-le par le mot de passe de la base AVANT de copier l'adresse." }
  if ($adresse -notmatch '^postgres(?:ql)?://([^:@/]+):(.+)@([^@/:]+):(\d+)/([^?]*)') { throw "Adresse illisible : il manque l'utilisateur, le mot de passe, l'hote ou le port." }
  $hote = $Matches[3]
  $port = [int]$Matches[4]
  if ($Matches[2].Length -lt 1) { throw "Mot de passe absent dans l'adresse." }
  if ($port -eq 6543) { throw "Cette adresse est celle du Transaction pooler (port 6543), inadaptee a pg_dump. Prenez l'adresse 'Session pooler' (port 5432)." }
  $type = 'autre'
  if ($hote -match 'pooler\.supabase\.com$') { $type = 'session-pooler' }
  elseif ($hote -match '^db\..+\.supabase\.co$') { $type = 'direct' }
  [pscustomobject]@{ Type = $type; Port = $port }
}

# Lit l'adresse : presse-papiers d'abord (puis le presse-papiers est VIDE : le mot de passe n'y reste pas), saisie masquee sinon,
# ou la variable SUPABASE_DATABASE_URL de .env.local si -DepuisEnvLocal. Ne renvoie que la chaine ; n'affiche jamais rien.
function Lire-Adresse([bool]$depuisEnvLocal, [string]$fichierEnv) {
  if ($depuisEnvLocal) {
    $ligne = Get-Content $fichierEnv -ErrorAction Stop | Where-Object { $_ -match '^SUPABASE_DATABASE_URL=' } | Select-Object -First 1
    if (-not $ligne) { throw "SUPABASE_DATABASE_URL est absente de .env.local." }
    return (($ligne -replace '^SUPABASE_DATABASE_URL=', '').Trim().Trim('"').Trim("'"))
  }
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
