# Export de la production Facilite en DEUX MODES (-Mode Leger | Complet), chiffre, hors du depot, avec estimation de l'egress et confirmation explicite avant de commencer.
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
# -Mode Leger (par defaut) : base de donnees SEULEMENT (structure + donnees, comptes inclus), aucun fichier de stockage. Quelques dizaines de Mo d'egress.
# -Mode Complet            : base + fichiers des buckets PRIVES (avatars, covers, banque-cv, resumes, chat-attachments, invoices...). Les 3 buckets publics (job-offers,
#                            marketplace-photos, stories-media) sont deja dans R2 : exclus, sauf avec -AvecImagesPubliques. Seuls les fichiers NOUVEAUX ou MODIFIES depuis le
#                            dernier export Complet sont telecharges (etat conserve CHIFFRE : etat-dernier-export.json.enc) ; -Reference <ancienne archive .tar.enc> sert de
#                            reference la premiere fois (ou si l'etat est perdu). Sans reference : tout est telecharge (le script le dit dans l'estimation).
# AVANT tout export, le script affiche une ESTIMATION de l'egress (lectures de comptage seulement, quelques centaines de Ko) puis demande de taper OUI. Rien ne part sans cela.
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
  [string]$Dossier = '',
  [ValidateSet('Leger', 'Complet')][string]$Mode = 'Leger',
  [switch]$AvecImagesPubliques,
  [string]$Reference = ''
)
$ErrorActionPreference = 'Stop'
# Combinaisons d'options incoherentes : refusees AVANT toute connexion.
$modeExplicite = $PSBoundParameters.ContainsKey('Mode')
if ($AvecImagesPubliques -and -not $Reprendre -and -not ($modeExplicite -and $Mode -eq 'Complet')) { throw "-AvecImagesPubliques s'utilise avec -Mode Complet (le mode Leger ne telecharge aucun fichier)." }
if ($Reference -and -not $Reprendre -and -not ($modeExplicite -and $Mode -eq 'Complet')) { throw "-Reference s'utilise avec -Mode Complet (elle sert de reference pour ne telecharger que les fichiers nouveaux ou modifies)." }
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

# Etat du dernier export Complet (liste des fichiers connus), en clair dans un dossier TEMPORAIRE $tmp, ou $null s'il n'y en a pas. Source : -Reference <archive .tar.enc>
# (le manifeste du stockage y est extrait) sinon etat-dernier-export.json.enc. La phrase secrete deja saisie (EXPORT_PASSPHRASE) dechiffre ; si elle est differente de celle
# du dernier export, le script s'arrete avec une explication (jamais d'export complet silencieux).
function Preparer-Baseline([string]$tmp) {
  $etat = Join-Path $Sortie 'etat-dernier-export.json.enc'
  if ($Reference) {
    if (-not (Test-Path $Reference)) { throw "-Reference introuvable : $Reference" }
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $tarRef = Join-Path $tmp 'reference.tar'
    & node (Join-Path $outils 'chiffrement.mjs') dechiffrer $Reference $tarRef | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "La reference n'a pas pu etre dechiffree : la phrase secrete doit etre celle de CETTE archive. Rien n'est exporte." }
    # Chemins relatifs depuis le dossier temporaire : le tar de Git lirait "C:" comme une machine distante.
    Push-Location $tmp
    try { & tar -xf reference.tar './stockage/manifeste-stockage.json' } finally { Pop-Location }
    Remove-Item $tarRef -Force -ErrorAction SilentlyContinue
    $manifeste = Join-Path $tmp 'stockage\manifeste-stockage.json'
    if (-not (Test-Path $manifeste)) { throw "La reference ne contient pas de manifeste du stockage (archive en mode Leger ?). Rien n'est exporte." }
    $sortieEtat = Join-Path $tmp 'etat-reference.json'
    $idRef = (Split-Path $Reference -Leaf) -replace '\.tar\.enc$', ''
    & node (Join-Path $outils 'etat.mjs') depuis-manifeste $manifeste $sortieEtat "--archive=$idRef" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Lecture de la reference impossible. Rien n'est exporte." }
    return $sortieEtat
  }
  if (Test-Path $etat) {
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $clairEtat = Join-Path $tmp 'etat.json'
    & node (Join-Path $outils 'chiffrement.mjs') dechiffrer $etat $clairEtat | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "L'etat du dernier export est illisible avec cette phrase secrete (differente de celle du dernier export Complet ?). Utilisez la meme phrase, ou donnez -Reference <archive .tar.enc>. Rien n'est exporte." }
    return $clairEtat
  }
  return $null
}

# Affiche l'estimation de l'egress puis exige de taper OUI. Renvoie $true seulement si la reponse est exactement OUI. Aucun parametre ne permet de passer cette etape.
function Confirmer-Export([string[]]$argsEstimation) {
  Write-Host ""
  & node (Join-Path $outils 'estimer.mjs') @argsEstimation | Out-Host
  if ($LASTEXITCODE -ne 0) { throw "L'estimation a echoue : rien n'est exporte." }
  Write-Host ""
  $reponse = Read-Host "Pour LANCER cet export, tapez exactement OUI (toute autre reponse l'annule : rien n'est exporte)"
  return ($reponse -ceq 'OUI')
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
  Write-Host ("  [INFO ] Mode : {0}{1}" -f $Mode, $(if ($Mode -eq 'Complet') { $(if ($AvecImagesPubliques) { ' (buckets prives + images publiques)' } else { ' (buckets prives seulement ; images publiques exclues)' }) } else { ' (base de donnees seulement, aucun fichier de stockage)' }))
  if ($Mode -eq 'Complet') {
    $etatDernier = Join-Path $Sortie 'etat-dernier-export.json.enc'
    if ($Reference) { Verif '-Reference : archive trouvee' (Test-Path $Reference) $Reference }
    elseif (Test-Path $etatDernier) { Write-Host '  [INFO ] Etat du dernier export Complet : present (seuls les fichiers nouveaux ou modifies seront telecharges)' }
    else { Write-Host '  [INFO ] Aucune reference (ni etat du dernier export, ni -Reference) : un export Complet telechargerait TOUS les fichiers prives (environ 615 Mo)' }
  }
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
  foreach ($f in 'chiffrement', 'stockage', 'verifier', 'metadonnees', 'delta', 'estimer', 'etat') {
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

$tmp = $null
try {
  $horo = Get-Date -Format 'yyyyMMdd-HHmm'
  $tmp = Join-Path $Sortie "tmp-estimation-$horo"
  if ($Reprendre) {
    $clair = Trouver-DossierReprise
    # Le mode d'un dossier de reprise est celui de l'export interrompu (mode-export.json) ; un autre -Mode explicite est refuse.
    $fichierMode = Join-Path $clair 'mode-export.json'
    if (Test-Path $fichierMode) {
      $modeStocke = Get-Content $fichierMode -Raw | ConvertFrom-Json
      if ($modeExplicite -and $modeStocke.mode -ne $Mode) { throw "Ce dossier est un export en mode $($modeStocke.mode) : -Mode $Mode refuse. Reprenez avec le meme mode (ou sans -Mode)." }
      $Mode = $modeStocke.mode
      $AvecImagesPubliques = [bool]$modeStocke.avecImagesPubliques
    } elseif (-not $modeExplicite) {
      throw "Ce dossier de reprise date d'une ancienne version (pas de mode-export.json) : indiquez -Mode Complet (et -AvecImagesPubliques si besoin) pour le reprendre."
    }
    Write-Host "REPRISE dans $clair (mode $Mode) : le dump de la base n'est PAS refait ; seuls les fichiers manquants ou echoues sont retelecharges."
  }
  $idArchive = "facilite-export-$horo-$($Mode.ToLower())"

  # Reference (mode Complet), puis ESTIMATION de l'egress et CONFIRMATION explicite : rien n'est exporte avant la reponse OUI.
  $baseline = $null
  if ($Mode -eq 'Complet') { $baseline = Preparer-Baseline $tmp }
  $argsEstimation = @("--mode=$Mode")
  if ($AvecImagesPubliques) { $argsEstimation += '--avec-images-publiques' }
  if ($baseline) { $argsEstimation += "--baseline=$baseline" }
  if ($Reprendre) { $argsEstimation += "--reprise=$clair" }
  if (-not (Confirmer-Export $argsEstimation)) {
    Write-Host "Export ANNULE : aucune confirmation. Rien n'a ete exporte (seules des lectures de comptage ont eu lieu)."
    return
  }

  if (-not $Reprendre) {
    $clair = Join-Path $Sortie "clair-$horo"
    New-Item -ItemType Directory -Force -Path $clair | Out-Null
    @{ mode = $Mode; avecImagesPubliques = [bool]$AvecImagesPubliques; archive = $idArchive; date = (Get-Date).ToString('s') } | ConvertTo-Json | Set-Content (Join-Path $clair 'mode-export.json') -Encoding UTF8
  }
  $portee = if ($AvecImagesPubliques) { 'tous' } else { 'prives' }
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
  & $pgDump --dbname=$env:EXPORT_DB_URL --format=custom --compress=6 --no-owner @schemas --file=$donnees
  if ($LASTEXITCODE -ne 0) { throw "pg_dump (donnees) a echoue." }

  Write-Host "[3/6] Metadonnees (extensions, taches planifiees, buckets) et migrations"
  node (Join-Path $outils 'metadonnees.mjs') (Join-Path $clair 'metadonnees.json')
  if ($LASTEXITCODE -ne 0) { throw "Releve des metadonnees echoue." }
  Copy-Item (Join-Path $depot 'supabase\migrations') (Join-Path $clair 'migrations') -Recurse
  }

  if ($Mode -eq 'Leger') {
    Write-Host "[4/6] Fichiers du stockage : aucun (mode Leger : base de donnees seulement)."
  } else {
    Write-Host "[4/6] Fichiers du stockage ($(if ($AvecImagesPubliques) { 'buckets prives + images publiques' } else { 'buckets prives seulement' }) ; nouveaux ou modifies seulement si une reference existe)"
    $argsStockage = @("--env-file=$envLocal", (Join-Path $outils 'stockage.mjs'), (Join-Path $clair 'stockage'), "--portee=$portee", "--archive-id=$idArchive")
    if ($baseline) { $argsStockage += "--baseline=$baseline" }
    if ($Reprendre) { $argsStockage += '--reprendre' }
    & node @argsStockage
    $codeStockage = $LASTEXITCODE
    if ($codeStockage -eq 3) { throw "La base et les fichiers ne sont pas le meme projet : arret. Rien n'est chiffre ni supprime." }
    if ($codeStockage -eq 2) { throw "Telechargement incomplet (fichiers en echec listes ci-dessus). Rien n'est chiffre ni supprime. Relancez la meme commande avec -Reprendre : seuls les fichiers manquants ou echoues seront retelecharges (le dump de la base n'est pas refait)." }
    if ($codeStockage -eq 4) { Demander-Decision-Absents (Join-Path $clair 'stockage') }
    elseif ($codeStockage -ne 0) { throw "Telechargement du stockage en erreur (code $codeStockage). Rien n'est chiffre ni supprime." }
  }

  Write-Host "`n[5/6] Verification contre la production"
  $argsVerif = @((Join-Path $outils 'verifier.mjs'), $clair, "--mode=$Mode")
  if ($Mode -eq 'Complet') { $argsVerif += "--portee=$portee" }
  & node @argsVerif
  if ($LASTEXITCODE -ne 0) { throw "La verification a trouve des ecarts : rien n'est chiffre ni supprime (dossier clair conserve : $clair)." }
  Copy-Item (Join-Path $clair 'rapport-verification.json') (Join-Path $Sortie "rapport-verification-$horo-$($Mode.ToLower()).json")

  Write-Host "`n[6/6] Archive chiffree"
  $tar = Join-Path $Sortie "$idArchive.tar"
  $enc = "$tar.enc"
  # Nouvel etat du dernier export (mode Complet) : calcule maintenant, chiffre et mis en place SEULEMENT apres la relecture reussie de l'archive.
  $nouvelEtat = $null
  if ($Mode -eq 'Complet') {
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $nouvelEtat = Join-Path $tmp 'etat-nouveau.json'
    & node (Join-Path $outils 'etat.mjs') fusionner $(if ($baseline) { $baseline } else { '-' }) (Join-Path $clair 'stockage') $nouvelEtat "--archive=$idArchive" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Calcul du nouvel etat du dernier export impossible. Rien n'est chiffre ni supprime." }
  }
  & tar -cf $tar -C $clair .
  if ($LASTEXITCODE -ne 0) { throw "tar a echoue." }
  node (Join-Path $outils 'chiffrement.mjs') chiffrer $tar $enc
  if ($LASTEXITCODE -ne 0) { throw "Chiffrement echoue." }
  # Relecture : on dechiffre sans rien ecrire et on compare l'empreinte avec celle de l'archive claire.
  $attendu = (Get-FileHash $tar -Algorithm SHA256).Hash.ToLower()
  $relu = (node (Join-Path $outils 'chiffrement.mjs') dechiffrer $enc) -join ' '
  if ($relu -notmatch $attendu) { throw "Relecture de l'archive chiffree : empreinte differente. Archive claire conservee : $tar" }
  Write-Host "Archive chiffree relue avec succes (empreinte identique)."
  (Get-FileHash $enc -Algorithm SHA256).Hash.ToLower() + "  " + (Split-Path $enc -Leaf) | Set-Content (Join-Path $Sortie "$idArchive.sha256")
  Remove-Item $tar -Force
  if ($nouvelEtat) {
    $etatEnc = Join-Path $Sortie 'etat-dernier-export.json.enc'
    if (Test-Path $etatEnc) { Copy-Item $etatEnc "$etatEnc.precedent" -Force }
    & node (Join-Path $outils 'chiffrement.mjs') chiffrer $nouvelEtat "$etatEnc.nouveau" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "Chiffrement du nouvel etat impossible (l'archive, elle, est complete et verifiee : $enc)." }
    Move-Item "$etatEnc.nouveau" $etatEnc -Force
    Write-Host "Etat du dernier export Complet mis a jour (chiffre) : $(Split-Path $etatEnc -Leaf)"
  }
  if (-not $GarderEnClair) { Remove-Item $clair -Recurse -Force; Write-Host "Dossier en clair supprime." } else { Write-Host "Dossier en clair CONSERVE : $clair" }

  Write-Host "`nTERMINE. Fichiers dans $Sortie :"
  Get-ChildItem $Sortie -File | ForEach-Object { '  {0}  ({1:N1} Mo)' -f $_.Name, ($_.Length / 1MB) }
  Write-Host "`nPensez a comparer avec la page Usage de Supabase (egress) apres cet export : voir docs/calendrier-exports.md."
}
finally {
  Remove-Item Env:\EXPORT_DB_URL, Env:\EXPORT_PASSPHRASE -ErrorAction SilentlyContinue
  if ($tmp -and (Test-Path $tmp)) { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
}
