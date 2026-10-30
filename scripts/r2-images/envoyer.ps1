# Envoi des images publiques vers R2 'facilite-images' et verification SHA-256. Aucune ecriture sur Supabase, aucune suppression, aucun autre bucket.
#
#   powershell -ExecutionPolicy Bypass -File scripts\r2-images\envoyer.ps1 [-Essai] [-VerifierSeulement]
#
# -Essai : aucun acces reseau, aucune cle demandee : relit les fichiers locaux et les compare au manifeste de l'export.
# Sinon le script demande : l'adresse du compte R2 (non secrete), puis l'Access Key ID et le Secret Access Key du jeton limite a facilite-images (saisie masquee).
# Rien ne s'affiche ni ne s'ecrit sur le disque ; les variables sont effacees a la fin. Les variables R2_* du projet ne sont jamais lues.
param(
  [string]$Source = (Join-Path $env:USERPROFILE 'Exports-Facilite\clair-20261029-2137\stockage'),
  [switch]$Essai,
  [switch]$VerifierSeulement
)
$ErrorActionPreference = 'Stop'
$depot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script = Join-Path $PSScriptRoot 'envoyer.mjs'
if (-not (Test-Path (Join-Path $Source 'manifeste-stockage.json'))) { throw "Manifeste introuvable dans $Source. Indiquez le dossier 'stockage' de l'export avec -Source." }

function Lire-Secret([string]$invite) {
  $s = Read-Host $invite -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

Push-Location $depot
try {
  if ($Essai) {
    & node $script --source $Source --essai
    exit $LASTEXITCODE
  }
  $adresse = (Read-Host "Adresse du compte R2 (ex. https://xxxxxxxx.r2.cloudflarestorage.com, SANS le nom du bucket)").Trim()
  $env:R2IMG_ENDPOINT = $adresse
  $env:R2IMG_KEY_ID = Lire-Secret "Access Key ID du jeton limite a facilite-images (saisie masquee)"
  $env:R2IMG_SECRET = Lire-Secret "Secret Access Key (saisie masquee)"
  $args2 = @($script, '--source', $Source)
  if ($VerifierSeulement) { $args2 += '--verifier-seulement' }
  & node @args2
  exit $LASTEXITCODE
}
finally {
  Remove-Item Env:\R2IMG_ENDPOINT, Env:\R2IMG_KEY_ID, Env:\R2IMG_SECRET -ErrorAction SilentlyContinue
  Pop-Location
}
