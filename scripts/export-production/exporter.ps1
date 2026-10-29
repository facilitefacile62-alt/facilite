# Export complet de la production Facilite : structure, donnees (comptes inclus), tous les fichiers du stockage, chiffres, hors du depot.
# LECTURE SEULE sur Supabase : aucune ecriture, aucune migration.
#
# Lancer depuis la racine du depot :
#   powershell -ExecutionPolicy Bypass -File scripts\export-production\exporter.ps1
#
# Le script demande, sans rien afficher a l'ecran : (1) l'adresse de connexion a la base, (2) une phrase secrete de chiffrement (12 caracteres minimum).
# Ni l'une ni l'autre ne s'ecrit sur le disque ni dans la console. Notez la phrase secrete a part : sans elle, l'archive est irrecuperable.
# Prerequis : Node 22, tar (Windows 10+), et pg_dump / pg_restore en version 17 (voir LISEZMOI-EXPORT.md si absents).
#
# -EssaiABlanc : verifie que tout demarre (outils, dossier de sortie hors depot, chiffrement aller-retour) SANS aucune connexion a la production
#                et sans demander aucun secret. A lancer d'abord.
param(
  [string]$Sortie = (Join-Path $env:USERPROFILE 'Exports-Facilite'),
  [switch]$GarderEnClair,
  [switch]$EssaiABlanc
)
$ErrorActionPreference = 'Stop'
$depot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$outils = Join-Path $depot 'scripts\export-production'

# 0. Le dossier de sortie doit etre HORS du depot (jamais de donnees personnelles a cote du code).
New-Item -ItemType Directory -Force -Path $Sortie | Out-Null
$Sortie = (Resolve-Path $Sortie).Path
if ($Sortie.TrimEnd('\') -eq $depot.TrimEnd('\') -or $Sortie.StartsWith($depot.TrimEnd('\') + '\')) {
  throw "Le dossier de sortie est DANS le depot ($Sortie). Choisissez un dossier ailleurs, par exemple $env:USERPROFILE\Exports-Facilite."
}

function Lire-Secret([string]$invite) {
  $s = Read-Host $invite -AsSecureString
  $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { [Runtime.InteropServices.Marshal]::PtrToStringBSTR($b) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) }
}

# 1. pg_dump / pg_restore 17
function Trouver-Outil([string]$nom) {
  $c = Get-Command $nom -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  if ($env:EXPORT_PG_BIN -and (Test-Path (Join-Path $env:EXPORT_PG_BIN "$nom.exe"))) { return (Join-Path $env:EXPORT_PG_BIN "$nom.exe") }
  $trouve = Get-ChildItem "$env:ProgramFiles\PostgreSQL\*\bin\$nom.exe" -ErrorAction SilentlyContinue | Sort-Object FullName -Descending | Select-Object -First 1
  if ($trouve) { return $trouve.FullName }
  return $null
}
$pgDump = Trouver-Outil 'pg_dump'
$pgRestore = Trouver-Outil 'pg_restore'
if (-not $pgDump -or -not $pgRestore) { throw "pg_dump / pg_restore introuvables. Voir scripts\export-production\LISEZMOI-EXPORT.md (installation en 2 minutes)." }
$version = (& $pgDump --version) -join ' '
if ($version -notmatch ' (\d+)[\. ]' -or [int]$Matches[1] -lt 17) { throw "pg_dump doit etre en version 17 ou plus (la base est en 17). Trouve : $version" }
$env:EXPORT_PG_BIN = Split-Path $pgRestore

# 1bis. Essai a blanc : aucune connexion, aucun secret demande.
if ($EssaiABlanc) {
  Write-Host "ESSAI A BLANC : aucune connexion a la production, aucun secret demande."
  $script:echecs = 0
  function Verif([string]$nom, [bool]$bon, [string]$detail) {
    if (-not $bon) { $script:echecs++ }
    Write-Host ('  [{0}] {1}{2}' -f $(if ($bon) { 'OK   ' } else { 'ECHEC' }), $nom, $(if ($detail) { " : $detail" } else { '' }))
  }
  Verif 'Dossier de sortie hors du depot' $true $Sortie
  Verif 'pg_dump 17' $true $version
  Verif 'pg_restore' $true ((& $pgRestore --version) -join ' ')
  $nodeV = (& node --version) -join ''
  Verif 'Node 22 ou plus' ($nodeV -match '^v(\d+)' -and [int]$Matches[1] -ge 22) $nodeV
  Verif 'tar disponible' ([bool](Get-Command tar -ErrorAction SilentlyContinue)) ''
  $envLocal = Join-Path $depot '.env.local'
  Verif '.env.local : adresse du projet et cle de service presentes (valeurs non lues a l ecran)' ((Test-Path $envLocal) -and [bool](Select-String -Path $envLocal -Pattern '^NEXT_PUBLIC_SUPABASE_URL=.+' -Quiet) -and [bool](Select-String -Path $envLocal -Pattern '^SUPABASE_SERVICE_ROLE_KEY=.+' -Quiet)) ''
  foreach ($f in 'chiffrement', 'stockage', 'verifier', 'metadonnees') {
    & node --check (Join-Path $outils "$f.mjs")
    Verif "Script $f.mjs : syntaxe" ($LASTEXITCODE -eq 0) ''
  }
  $libreGo = [math]::Round((Get-PSDrive -Name ($Sortie.Substring(0, 1))).Free / 1GB, 1)
  Verif 'Place libre sur le disque de sortie (5 Go minimum)' ($libreGo -ge 5) "$libreGo Go"

  # Chiffrement aller-retour avec une phrase aleatoire propre a l'essai (jamais affichee, jamais ecrite).
  $essai = Join-Path $Sortie ('essai-a-blanc-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
  New-Item -ItemType Directory -Force -Path $essai | Out-Null
  try {
    $octets = New-Object byte[] (5MB)
    (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($octets)
    $clairEssai = Join-Path $essai 'a.bin'
    [IO.File]::WriteAllBytes($clairEssai, $octets)
    $cle = New-Object byte[] 24
    (New-Object Security.Cryptography.RNGCryptoServiceProvider).GetBytes($cle)
    $env:EXPORT_PASSPHRASE = [Convert]::ToBase64String($cle)
    $attendu = (Get-FileHash $clairEssai -Algorithm SHA256).Hash.ToLower()
    & node (Join-Path $outils 'chiffrement.mjs') chiffrer $clairEssai (Join-Path $essai 'a.enc') | Out-Null
    $res = (& node (Join-Path $outils 'chiffrement.mjs') dechiffrer (Join-Path $essai 'a.enc')) -join ' '
    Verif 'Chiffrement : archive de test relue, empreinte identique' ($res -match $attendu) ''
    $env:EXPORT_PASSPHRASE = 'une-autre-phrase-secrete-xyz'
    $ancienne = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    & node (Join-Path $outils 'chiffrement.mjs') dechiffrer (Join-Path $essai 'a.enc') 2>&1 | Out-Null
    $refus = ($LASTEXITCODE -ne 0)
    $ErrorActionPreference = $ancienne
    Verif 'Chiffrement : une mauvaise phrase secrete est refusee' $refus ''
  } finally {
    Remove-Item Env:\EXPORT_PASSPHRASE -ErrorAction SilentlyContinue
    Remove-Item $essai -Recurse -Force -ErrorAction SilentlyContinue
  }
  if ($script:echecs -gt 0) { Write-Host "`nESSAI A BLANC : $($script:echecs) point(s) a corriger."; exit 1 }
  Write-Host "`nESSAI A BLANC REUSSI : tout demarre. Rien n'a ete envoye a la production."
  exit 0
}

# 2. Saisies masquees
$env:EXPORT_DB_URL = Lire-Secret "Adresse de connexion a la base (collez-la, rien ne s'affiche) puis Entree"
if ($env:EXPORT_DB_URL -notmatch '^postgres(ql)?://') { throw "Ce n'est pas une adresse de connexion Postgres (elle doit commencer par postgresql://)." }
$p1 = Lire-Secret "Phrase secrete de chiffrement (12 caracteres minimum)"
$p2 = Lire-Secret "Retapez la phrase secrete"
if ($p1 -ne $p2 -or $p1.Length -lt 12) { throw "Les deux phrases secretes different, ou font moins de 12 caracteres." }
$env:EXPORT_PASSPHRASE = $p1
$p1 = $null; $p2 = $null

try {
  $horo = Get-Date -Format 'yyyyMMdd-HHmm'
  $clair = Join-Path $Sortie "clair-$horo"
  New-Item -ItemType Directory -Force -Path $clair | Out-Null
  $schemas = @('--schema=public', '--schema=auth', '--schema=storage')
  $structure = Join-Path $clair 'structure.sql'
  $donnees = Join-Path $clair 'donnees.dump'
  $envLocal = Join-Path $depot '.env.local'

  Write-Host "`n[1/6] Structure (structure.sql)"
  & $pgDump --dbname=$env:EXPORT_DB_URL --schema-only --no-owner @schemas --file=$structure
  if ($LASTEXITCODE -ne 0) { throw "pg_dump (structure) a echoue." }

  Write-Host "[2/6] Donnees, comptes inclus (donnees.dump)"
  & $pgDump --dbname=$env:EXPORT_DB_URL --format=custom --no-owner @schemas --file=$donnees
  if ($LASTEXITCODE -ne 0) { throw "pg_dump (donnees) a echoue." }

  Write-Host "[3/6] Metadonnees (extensions, taches planifiees, buckets) et migrations"
  node (Join-Path $outils 'metadonnees.mjs') (Join-Path $clair 'metadonnees.json')
  if ($LASTEXITCODE -ne 0) { throw "Releve des metadonnees echoue." }
  Copy-Item (Join-Path $depot 'supabase\migrations') (Join-Path $clair 'migrations') -Recurse

  Write-Host "[4/6] Fichiers du stockage (peut prendre plusieurs minutes)"
  node "--env-file=$envLocal" (Join-Path $outils 'stockage.mjs') (Join-Path $clair 'stockage')
  if ($LASTEXITCODE -ne 0) { throw "Telechargement du stockage incomplet : voir les echecs ci-dessus. Rien n'est chiffre ni supprime." }

  Write-Host "`n[5/6] Verification contre la production"
  node (Join-Path $outils 'verifier.mjs') $clair
  if ($LASTEXITCODE -ne 0) { throw "La verification a trouve des ecarts : rien n'est chiffre ni supprime (dossier clair conserve : $clair)." }
  Copy-Item (Join-Path $clair 'rapport-verification.json') (Join-Path $Sortie "rapport-verification-$horo.json")

  Write-Host "`n[6/6] Archive chiffree"
  $tar = Join-Path $Sortie "facilite-export-$horo.tar"
  $enc = "$tar.enc"
  & tar -cf $tar -C $clair .
  if ($LASTEXITCODE -ne 0) { throw "tar a echoue." }
  node (Join-Path $outils 'chiffrement.mjs') chiffrer $tar $enc
  if ($LASTEXITCODE -ne 0) { throw "Chiffrement echoue." }
  # Relecture : on dechiffre sans rien ecrire et on compare l'empreinte avec celle de l'archive claire.
  $attendu = (Get-FileHash $tar -Algorithm SHA256).Hash.ToLower()
  $relu = (node (Join-Path $outils 'chiffrement.mjs') dechiffrer $enc) -join ' '
  if ($relu -notmatch $attendu) { throw "Relecture de l'archive chiffree : empreinte differente. Archive claire conservee : $tar" }
  Write-Host "Archive chiffree relue avec succes (empreinte identique)."
  (Get-FileHash $enc -Algorithm SHA256).Hash.ToLower() + "  " + (Split-Path $enc -Leaf) | Set-Content (Join-Path $Sortie "facilite-export-$horo.sha256")
  Remove-Item $tar -Force
  if (-not $GarderEnClair) { Remove-Item $clair -Recurse -Force; Write-Host "Dossier en clair supprime." } else { Write-Host "Dossier en clair CONSERVE : $clair" }

  Write-Host "`nTERMINE. Fichiers dans $Sortie :"
  Get-ChildItem $Sortie -File | ForEach-Object { '  {0}  ({1:N1} Mo)' -f $_.Name, ($_.Length / 1MB) }
}
finally {
  Remove-Item Env:\EXPORT_DB_URL, Env:\EXPORT_PASSPHRASE -ErrorAction SilentlyContinue
}
