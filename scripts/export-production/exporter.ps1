# Export complet de la production Facilite : structure, donnees (comptes inclus), tous les fichiers du stockage, chiffres, hors du depot.
# LECTURE SEULE sur Supabase : aucune ecriture, aucune migration.
#
# Lancer depuis la racine du depot :
#   powershell -ExecutionPolicy Bypass -File scripts\export-production\exporter.ps1
#
# L'adresse de connexion a la base est LUE DANS LE PRESSE-PAPIERS (copiez l'adresse 'Session pooler', mot de passe inclus, avant de lancer) : elle n'est
# jamais affichee, et le presse-papiers est vide juste apres la lecture. Si le presse-papiers ne contient pas d'adresse, saisie masquee.
# Le script demande ensuite une phrase secrete de chiffrement (12 caracteres minimum), saisie masquee et tapee deux fois.
# Rien de tout cela ne s'ecrit sur le disque ni dans la console. Notez la phrase secrete a part : sans elle, l'archive est irrecuperable.
# -DepuisEnvLocal : lit l'adresse dans SUPABASE_DATABASE_URL de .env.local au lieu du presse-papiers (si cette variable est bien celle de production).
# Prerequis : Node 22, tar (Windows 10+), et pg_dump / pg_restore en version 17 (voir LISEZMOI-EXPORT.md si absents).
#
# -EssaiABlanc : verifie que tout demarre (outils, dossier de sortie hors depot, chiffrement aller-retour) SANS aucune connexion a la production
#                et sans demander aucun secret. A lancer d'abord.
# -Reprendre   : reprend dans le dernier dossier 'clair-...' (ou celui de -Dossier) : le dump de la base n'est PAS refait ; seuls les fichiers manquants
#                ou echoues sont retelecharges ; puis verification (5/6) et chiffrement (6/6). L'adresse et la phrase secrete sont redemandees.
# Fichiers 'absents a la source' (listes par la base, introuvables dans le stockage) : jamais contournes en silence. Ils sont inscrits dans le rapport et
#                l'export ne continue qu'apres votre choix explicite (taper CONTINUER SANS ABSENTS).
param(
  [string]$Sortie = (Join-Path $env:USERPROFILE 'Exports-Facilite'),
  [switch]$GarderEnClair,
  [switch]$EssaiABlanc,
  [switch]$DepuisEnvLocal,
  [switch]$Reprendre,
  [string]$Dossier = ''
)
$ErrorActionPreference = 'Stop'
$depot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$outils = Join-Path $depot 'scripts\export-production'
. (Join-Path $outils 'outils-adresse.ps1')

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

# Dossier d'une reprise : celui de -Dossier, sinon le plus recent 'clair-...' de $Sortie. Doit etre hors du depot et contenir les trois fichiers du dump.
function Trouver-DossierReprise() {
  if ($Dossier) { $d = (Resolve-Path $Dossier).Path }
  else {
    $dernier = Get-ChildItem $Sortie -Directory -Filter 'clair-*' -ErrorAction SilentlyContinue | Sort-Object Name -Descending | Select-Object -First 1
    if (-not $dernier) { throw "Aucun dossier 'clair-...' a reprendre dans $Sortie. Lancez l'export sans -Reprendre." }
    $d = $dernier.FullName
  }
  if ($d.TrimEnd('\') -eq $depot.TrimEnd('\') -or $d.StartsWith($depot.TrimEnd('\') + '\')) { throw "Le dossier de reprise est DANS le depot ($d) : refuse." }
  foreach ($f in 'structure.sql', 'donnees.dump', 'metadonnees.json') {
    $chemin = Join-Path $d $f
    if (-not (Test-Path $chemin) -or (Get-Item $chemin).Length -eq 0) { throw "Dossier de reprise incomplet : $f manquant ou vide. Lancez l'export complet sans -Reprendre." }
  }
  return $d
}

# Fichiers LISTES par la base mais INTROUVABLES dans le stockage : choix explicite obligatoire, enregistre dans decision-absents.json (avec l'empreinte de la liste).
function Demander-Decision-Absents([string]$dossierStockage) {
  $absents = Get-Content (Join-Path $dossierStockage 'absents-source.json') -Raw | ConvertFrom-Json
  $n = [int]$absents.nombre
  Write-Host ""
  Write-Host "ATTENTION : $n fichier(s) sont LISTES par la base mais INTROUVABLES dans le stockage Supabase (absents a la source)."
  Write-Host "Ils ne peuvent pas etre exportes. Ils seront inscrits dans le rapport comme 'absents a la source' : rien n'est contourne en silence."
  Write-Host "Pour continuer SANS ces fichiers, tapez exactement : CONTINUER SANS ABSENTS"
  Write-Host "Toute autre reponse arrete l'export (rien n'est chiffre ni supprime ; relancez avec -Reprendre une fois la question reglee)."
  $reponse = Read-Host "Votre choix"
  if ($reponse -cne 'CONTINUER SANS ABSENTS') { throw "Arret : choix non confirme pour les fichiers absents a la source. Rien n'est chiffre ni supprime." }
  @{ accepte = $true; nombre = $n; empreinte = $absents.empreinte; date = (Get-Date).ToString('s') } | ConvertTo-Json | Set-Content (Join-Path $dossierStockage 'decision-absents.json') -Encoding UTF8
  Write-Host "Choix enregistre : l'export continue SANS $n fichier(s) absent(s) a la source (inscrits dans le rapport)."
}

# 1. pg_dump / pg_restore 17
function Trouver-Outil([string]$nom) {
  $c = Get-Command $nom -ErrorAction SilentlyContinue
  if ($c) { return $c.Source }
  if ($env:EXPORT_PG_BIN -and (Test-Path (Join-Path $env:EXPORT_PG_BIN "$nom.exe"))) { return (Join-Path $env:EXPORT_PG_BIN "$nom.exe") }
  $local = Join-Path $env:USERPROFILE "Outils\postgresql-17\bin\$nom.exe"
  if (Test-Path $local) { return $local }
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
  $ligneApi = if (Test-Path $envLocal) { Get-Content $envLocal | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_URL=' } | Select-Object -First 1 } else { $null }
  $refApiEssai = if ($ligneApi) { Extraire-RefApi (($ligneApi -replace '^NEXT_PUBLIC_SUPABASE_URL=', '').Trim().Trim('"').Trim("'")) } else { $null }
  Verif 'Projet des fichiers (NEXT_PUBLIC_SUPABASE_URL de .env.local) = production' ($refApiEssai -eq $script:REF_PRODUCTION) $(if ($refApiEssai -eq $script:REF_PRODUCTION) { '' } else { 'DIFFERENT de la production ou illisible' })
  if ($DepuisEnvLocal) {
    # Controle de l'adresse de .env.local, sans connexion : nom de la variable, type, port, projet. Jamais la valeur.
    try {
      $lu = Lire-AdresseEnv $envLocal
      Verif "Adresse de .env.local (-DepuisEnvLocal) : variable $($lu.Nom), type $($lu.Type), port $($lu.Port), projet $($lu.Ref)" $true 'identique a la production'
      if ($lu.Converti) { Write-Host "  [INFO ] converti 6543 -> 5432 (en memoire ; .env.local n'est pas modifie)" }
      foreach ($r in $lu.Rejets) { Write-Host "  [INFO ] ecartee : $r" }
    } catch {
      Verif 'Adresse de .env.local (-DepuisEnvLocal)' $false ($_.Exception.Message -replace "`r?`n", ' | ')
    }
  }
  foreach ($f in 'chiffrement', 'stockage', 'verifier', 'metadonnees') {
    & node --check (Join-Path $outils "$f.mjs")
    Verif "Script $f.mjs : syntaxe" ($LASTEXITCODE -eq 0) ''
  }
  $etatPresse = 'vide ou autre contenu (normal avant l etape de copie)'
  try {
    $pp = ((Get-Clipboard -Raw -ErrorAction Stop) | Out-String).Trim()
    if ($pp -match '^postgres(?:ql)?://') {
      try { $i = Controler-Adresse $pp; $etatPresse = "adresse Postgres detectee, type $($i.Type), port $($i.Port), projet $(if ($i.Ref -eq $script:REF_PRODUCTION) { 'production' } else { 'AUTRE QUE LA PRODUCTION' }) (adresse non affichee, non videe)" } catch { $etatPresse = "adresse Postgres detectee mais a corriger : $($_.Exception.Message)" }
    }
  } catch { $etatPresse = 'illisible' }
  $pp = $null
  Write-Host "  [INFO ] Presse-papiers : $etatPresse"
  if ($Reprendre) {
    # Etat du dossier de reprise, lu sur le disque seulement (aucune connexion) : des nombres, jamais un nom de fichier.
    try {
      $dr = Trouver-DossierReprise
      Verif "Reprise : dossier $(Split-Path $dr -Leaf), structure.sql / donnees.dump / metadonnees.json presents" $true ''
      $mf = Join-Path $dr 'stockage\manifeste-stockage.json'
      if (Test-Path $mf) {
        $m = Get-Content $mf -Raw | ConvertFrom-Json
        $ok = @($m | Where-Object { $_.sha256 }).Count
        $ko = @($m | Where-Object { -not $_.sha256 }).Count
        Write-Host "  [INFO ] Reprise : manifeste de $(@($m).Count) fichier(s), $ok deja telecharge(s) et verifiables, $ko a retelecharger"
      } else { Write-Host "  [INFO ] Reprise : pas de manifeste, tous les fichiers seront retelecharges" }
    } catch { Verif 'Reprise : dossier utilisable' $false $_.Exception.Message }
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

# 2. Adresse de connexion (jamais affichee) et verification du PROJET avant toute chose.
$envLocal = Join-Path $depot '.env.local'
if ($DepuisEnvLocal) {
  $lu = Lire-AdresseEnv $envLocal
  $adresse = $lu.Adresse
  $infoAdresse = [pscustomobject]@{ Type = $lu.Type; Port = $lu.Port; Ref = $lu.Ref }
  Write-Host ("Variable de .env.local utilisee : {0} (type {1}, port {2}). Valeur non affichee." -f $lu.Nom, $lu.Type, $lu.Port)
  if ($lu.Converti) { Write-Host "  converti 6543 -> 5432 (Transaction pooler -> Session pooler, en memoire, rien n'est modifie dans .env.local)" }
  foreach ($r in $lu.Rejets) { Write-Host "  ecartee : $r" }
} else {
  $adresse = Lire-Adresse
  $infoAdresse = Controler-Adresse $adresse
  Write-Host ("Adresse de connexion lue (non affichee) : type {0}, port {1}." -f $infoAdresse.Type, $infoAdresse.Port)
}
if ($infoAdresse.Type -eq 'direct') { Write-Host "Attention : adresse DIRECTE (souvent IPv6 seulement). Si la connexion echoue, utilisez l'adresse 'Session pooler'." }
Verifier-Projet $infoAdresse.Ref "l'adresse de connexion"
Write-Host "Projet de la base (reference lue dans l'adresse) : $($infoAdresse.Ref) - IDENTIQUE a la production ($($script:REF_PRODUCTION))."
# Les fichiers sont telecharges par l'API du projet de .env.local : ce doit etre le MEME projet que la base exportee.
$ligneApi = if (Test-Path $envLocal) { Get-Content $envLocal | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_URL=' } | Select-Object -First 1 } else { $null }
$refApi = if ($ligneApi) { Extraire-RefApi (($ligneApi -replace '^NEXT_PUBLIC_SUPABASE_URL=', '').Trim().Trim('"').Trim("'")) } else { $null }
Verifier-Projet $refApi "NEXT_PUBLIC_SUPABASE_URL de .env.local (fichiers)"
Write-Host "Projet des fichiers (API de .env.local) : $refApi - IDENTIQUE a la production."
$env:EXPORT_DB_URL = $adresse
$adresse = $null

# 3. Phrase secrete (saisie masquee, deux fois)
$p1 = Lire-Secret "Phrase secrete de chiffrement (12 caracteres minimum)"
$p2 = Lire-Secret "Retapez la phrase secrete"
if ($p1 -ne $p2 -or $p1.Length -lt 12) { throw "Les deux phrases secretes different, ou font moins de 12 caracteres." }
$env:EXPORT_PASSPHRASE = $p1
$p1 = $null; $p2 = $null

try {
  $horo = Get-Date -Format 'yyyyMMdd-HHmm'
  if ($Reprendre) {
    $clair = Trouver-DossierReprise
    Write-Host "REPRISE dans $clair : le dump de la base n'est PAS refait ; seuls les fichiers manquants ou echoues sont retelecharges."
  } else {
    $clair = Join-Path $Sortie "clair-$horo"
    New-Item -ItemType Directory -Force -Path $clair | Out-Null
  }
  $schemas = @('--schema=public', '--schema=auth', '--schema=storage')
  $structure = Join-Path $clair 'structure.sql'
  $donnees = Join-Path $clair 'donnees.dump'
  $envLocal = Join-Path $depot '.env.local'

  if ($Reprendre) {
    Write-Host "`n[1/6] [2/6] [3/6] deja faits (reprise) : structure, donnees et metadonnees conservees."
  } else {
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
  }

  Write-Host "[4/6] Fichiers du stockage (peut prendre plusieurs minutes)"
  $argsStockage = @("--env-file=$envLocal", (Join-Path $outils 'stockage.mjs'), (Join-Path $clair 'stockage'))
  if ($Reprendre) { $argsStockage += '--reprendre' }
  & node @argsStockage
  $codeStockage = $LASTEXITCODE
  if ($codeStockage -eq 3) { throw "La base et les fichiers ne sont pas le meme projet : arret. Rien n'est chiffre ni supprime." }
  if ($codeStockage -eq 2) { throw "Telechargement incomplet (fichiers en echec listes ci-dessus). Rien n'est chiffre ni supprime. Relancez la meme commande avec -Reprendre : seuls les fichiers manquants ou echoues seront retelecharges (le dump de la base n'est pas refait)." }
  if ($codeStockage -eq 4) { Demander-Decision-Absents (Join-Path $clair 'stockage') }
  elseif ($codeStockage -ne 0) { throw "Telechargement du stockage en erreur (code $codeStockage). Rien n'est chiffre ni supprime." }

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
