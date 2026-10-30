// Choix d'une photo ou d'une vidéo dans la galerie : AUCUNE permission de stockage n'est demandée ni déclarée (Google Play refuse READ_MEDIA_IMAGES et
// READ_MEDIA_VIDEO sans justification). On passe par le SÉLECTEUR SYSTÈME (sélecteur de photos d'Android, PHPicker sur iPhone) : la personne choisit le
// fichier, l'application n'accède qu'à celui-là. `permissionGalerie()` garde la forme de l'ancien contrôle (`granted`) pour que les écrans n'aient pas
// à changer de logique ; elle ne demande rien au système. La CAMÉRA, elle, garde sa demande habituelle.
export async function permissionGalerie(): Promise<{ granted: true }> {
  return { granted: true };
}
