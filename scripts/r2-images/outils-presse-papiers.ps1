# Lecture de valeurs dans le PRESSE-PAPIERS, sans jamais les afficher ni les ecrire : utilise par envoyer.ps1. ASCII seulement (PowerShell 5.1).
#
# Principe : la personne copie une valeur, appuie sur Entree ; le script lit le presse-papiers, verifie la FORME (jamais le contenu n'est affiche), puis VIDE le
# presse-papiers. Valeur vide ou mauvaise forme : une ligne explique quoi recopier et la meme etape est redemandee (le script ne plante pas et ne sort pas).

# Points d'entree remplacables (tests) : lecture, effacement du presse-papiers, attente de la touche Entree.
$script:LecteurPresse = {
  try { ((Get-Clipboard -Raw -ErrorAction Stop) | Out-String).Trim() } catch { '' }
}
$script:EffaceurPresse = {
  try { Set-Clipboard -Value $null } catch { try { Set-Clipboard -Value ' ' } catch { } }
}
$script:Attente = { [void](Read-Host "Appuyez sur Entree quand c'est copie") }

# Chaque controle renvoie $null si la forme est bonne, sinon UNE ligne d'aide (qui ne repete jamais la valeur lue).
function Controler-AdresseR2([string]$v) {
  if (-not $v) { return "Le presse-papiers est vide : copiez l'adresse du compte R2 (https://xxxxxxxx.r2.cloudflarestorage.com) puis appuyez sur Entree." }
  if ($v -match '\s') { return "La valeur copiee contient des espaces ou des lignes : copiez seulement l'adresse du compte R2 (une seule ligne), puis Entree." }
  if ($v -match '^https://[0-9a-f]{32}(\.(eu|fedramp))?\.r2\.cloudflarestorage\.com/.+') { return "L'adresse contient un nom de bucket a la fin : copiez seulement la partie https://...r2.cloudflarestorage.com, sans la suite, puis Entree." }
  if ($v -notmatch '^https://[0-9a-f]{32}(\.(eu|fedramp))?\.r2\.cloudflarestorage\.com/?$') { return "Ce n'est pas l'adresse du compte R2 (https://<32 caracteres>.r2.cloudflarestorage.com) : recopiez l'adresse S3 affichee sur la page du jeton, puis Entree." }
  return $null
}
function Controler-CleId([string]$v) {
  if (-not $v) { return "Le presse-papiers est vide : copiez l'Access Key ID (32 caracteres, lettres et chiffres) puis appuyez sur Entree." }
  if ($v -match '^https?://') { return "Vous avez copie une adresse : copiez l'Access Key ID (32 caracteres, lettres et chiffres), puis Entree." }
  if ($v -match '\s') { return "La valeur copiee contient des espaces ou des lignes : copiez seulement l'Access Key ID, puis Entree." }
  if ($v -notmatch '^[A-Za-z0-9]{32}$') { return "Ce n'est pas un Access Key ID (32 caracteres, lettres et chiffres, sans espace) : recopiez la ligne 'Access Key ID', puis Entree." }
  return $null
}
function Controler-Secret([string]$v, [string]$cleId) {
  if (-not $v) { return "Le presse-papiers est vide : copiez le Secret Access Key (64 caracteres, lettres et chiffres) puis appuyez sur Entree." }
  if ($v -match '^https?://') { return "Vous avez copie une adresse : copiez le Secret Access Key (64 caracteres, lettres et chiffres), puis Entree." }
  if ($cleId -and $v -ceq $cleId) { return "C'est la meme valeur que l'Access Key ID : copiez la ligne 'Secret Access Key' (la suivante), puis Entree." }
  if ($v -match '\s') { return "La valeur copiee contient des espaces ou des lignes : copiez seulement le Secret Access Key, puis Entree." }
  if ($v -notmatch '^[A-Za-z0-9]{64}$') { return "Ce n'est pas un Secret Access Key (64 caracteres, lettres et chiffres, sans espace) : recopiez la ligne 'Secret Access Key', puis Entree." }
  return $null
}

# Demande une valeur : affiche la consigne, attend Entree, lit le presse-papiers, controle la forme avec $Valider (scriptblock { param($v) ... } qui renvoie
# $null si bon, sinon une ligne d'aide). Si bon : VIDE le presse-papiers et renvoie la valeur. Sinon : affiche l'aide et recommence.
# MaxEssais (0 = sans limite) ne sert qu'aux tests.
function Demander-Valeur([string]$Consigne, [scriptblock]$Valider, [int]$MaxEssais = 0) {
  $essai = 0
  while ($true) {
    $essai++
    if ($MaxEssais -gt 0 -and $essai -gt $MaxEssais) { throw "Trop d'essais sans valeur correcte." }
    Write-Host $Consigne
    & $script:Attente
    $valeur = & $script:LecteurPresse
    $aide = & $Valider $valeur
    if (-not $aide) {
      & $script:EffaceurPresse
      return $valeur
    }
    Write-Host "  -> $aide"
  }
}
