# Envoi des images publiques vers R2 'facilite-images' et verification SHA-256. Aucune ecriture sur Supabase, aucune suppression, aucun autre bucket.
#
#   powershell -ExecutionPolicy Bypass -File scripts\r2-images\envoyer.ps1 [-Essai] [-VerifierSeulement]
#
# -Essai : aucun acces reseau, aucune valeur demandee : relit les fichiers locaux et les compare au manifeste de l'export.
# Sinon, trois etapes, TOUJOURS par le presse-papiers (le collage dans la console ne fonctionne pas) : pour chacune, copiez la valeur depuis la page du jeton,
# appuyez sur Entree ; le script la lit sans l'afficher, verifie sa forme, puis VIDE le presse-papiers :
#   1/3 l'adresse du compte R2 (non secrete : elle est affichee), 2/3 l'Access Key ID, 3/3 le Secret Access Key (jamais affiches).
# Valeur vide ou mauvaise forme : une ligne dit quoi recopier et l'etape est redemandee. Rien ne s'ecrit sur le disque ; les variables sont effacees a la fin.
# Les variables R2_* du projet ne sont jamais lues.
param(
  [string]$Source = (Join-Path $env:USERPROFILE 'Exports-Facilite\clair-20261029-2137\stockage'),
  [switch]$Essai,
  [switch]$VerifierSeulement
)
$ErrorActionPreference = 'Stop'
$depot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$script = Join-Path $PSScriptRoot 'envoyer.mjs'
. (Join-Path $PSScriptRoot 'outils-presse-papiers.ps1')
if (-not (Test-Path (Join-Path $Source 'manifeste-stockage.json'))) { throw "Manifeste introuvable dans $Source. Indiquez le dossier 'stockage' de l'export avec -Source." }

Push-Location $depot
try {
  if ($Essai) {
    & node $script --source $Source --essai
    exit $LASTEXITCODE
  }

  Write-Host ""
  Write-Host "Etape 1/3 - adresse du compte R2"
  $adresse = (Demander-Valeur "Copiez l'adresse du compte R2 (https://xxxxxxxx.r2.cloudflarestorage.com, sans nom de bucket), puis appuyez sur Entree." { param($v) Controler-AdresseR2 $v }).TrimEnd('/')
  Write-Host "Adresse lue : $adresse (non secrete). Presse-papiers vide."

  Write-Host ""
  Write-Host "Etape 2/3 - Access Key ID"
  $cleId = Demander-Valeur "Copiez l'Access Key ID du jeton (32 caracteres), puis appuyez sur Entree." { param($v) Controler-CleId $v }
  Write-Host "Access Key ID lu : $($cleId.Length) caracteres, forme correcte (non affiche). Presse-papiers vide."

  Write-Host ""
  Write-Host "Etape 3/3 - Secret Access Key"
  $secret = Demander-Valeur "Copiez le Secret Access Key du jeton (64 caracteres), puis appuyez sur Entree." { param($v) Controler-Secret $v $cleId }
  Write-Host "Secret Access Key lu : $($secret.Length) caracteres, forme correcte (non affiche). Presse-papiers vide."
  Write-Host ""

  $env:R2IMG_ENDPOINT = $adresse
  $env:R2IMG_KEY_ID = $cleId
  $env:R2IMG_SECRET = $secret
  $cleId = $null
  $secret = $null
  $args2 = @($script, '--source', $Source)
  if ($VerifierSeulement) { $args2 += '--verifier-seulement' }
  & node @args2
  exit $LASTEXITCODE
}
finally {
  Remove-Item Env:\R2IMG_ENDPOINT, Env:\R2IMG_KEY_ID, Env:\R2IMG_SECRET -ErrorAction SilentlyContinue
  Pop-Location
}
