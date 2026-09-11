package com.facilite.app.ui.screens.extractor

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.ui.theme.*

@Composable
fun ExtractorScreen(
    onBackClick: () -> Unit = {}
) {
    var detailsOpen by remember { mutableStateOf(false) }
    var selectedMethod by remember { mutableStateOf(0) } // 0: Photo, 1: Text
    var rawText by remember { mutableStateOf("") }
    var isScanning by remember { mutableStateOf(false) }
    var scanCompleted by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentPadding = PaddingValues(bottom = 80.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        // Bouton retour
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .clickable { onBackClick() }
                    .padding(vertical = 4.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(6.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.ArrowBack,
                    contentDescription = "Retour",
                    tint = RoyalBlue,
                    modifier = Modifier.size(16.dp)
                )
                Text(
                    text = "Retour aux fonctionnalités",
                    fontSize = 13.5.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = RoyalBlue
                )
            }
        }

        // 1. Bannière d'en-tête Dégradé Vert Sombre
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(
                        Brush.linearGradient(
                            colors = listOf(Color(0xFF0D3B34), Color(0xFF0F4F42))
                        )
                    )
                    .padding(16.dp)
            ) {
                Column {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Star,
                            contentDescription = null,
                            tint = Color(0xFF6EE7C9),
                            modifier = Modifier.size(14.dp)
                        )
                        Text(
                            text = "ASSISTANT CANDIDATURE IA — POSTULATION EXPRESS",
                            fontSize = 11.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF6EE7C9),
                            letterSpacing = 0.5.sp
                        )
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    Text(
                        text = "Scanner d'Annonces & Candidature Directe",
                        fontSize = 15.5.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White,
                        lineHeight = 21.sp
                    )

                    Spacer(modifier = Modifier.height(12.dp))

                    // Bouton accordéon détails
                    Box(
                        modifier = Modifier
                            .clip(PillShape)
                            .background(Color(0x24FFFFFF))
                            .clickable { detailsOpen = !detailsOpen }
                            .padding(horizontal = 14.dp, vertical = 8.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Info,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(13.dp)
                            )
                            Text(
                                text = if (detailsOpen) "Masquer les détails" else "Comment ça marche ?",
                                fontSize = 12.5.sp,
                                fontWeight = FontWeight.SemiBold,
                                color = Color.White
                            )
                            Icon(
                                imageVector = if (detailsOpen) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                                contentDescription = null,
                                tint = Color.White,
                                modifier = Modifier.size(14.dp)
                            )
                        }
                    }

                    AnimatedVisibility(visible = detailsOpen) {
                        Column(
                            modifier = Modifier.padding(top = 14.dp),
                            verticalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Text(
                                text = "Importez une photo d'affiche ou collez le texte d'une offre. L'IA extrait automatiquement les coordonnées certifiées (Email, WhatsApp, Lien externe), vous présente l'écran de revue avant validation et prépare votre candidature instantanée.",
                                fontSize = 12.5.sp,
                                color = Color(0xFFD8F3EA),
                                lineHeight = 18.sp
                            )

                            Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                StepBanner(number = "1", text = "Photo ou texte brut")
                                StepBanner(number = "2", text = "Extraction IA instantanée")
                                StepBanner(number = "3", text = "Candidature directe en 1 clic")
                            }
                        }
                    }
                }
            }
        }

        // 2. Choix de la méthode d'importation
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .shadow(1.dp, RoundedCornerShape(16.dp))
                    .clip(RoundedCornerShape(16.dp))
                    .background(CardSurface)
                    .padding(16.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        text = "CHOISISSEZ VOTRE MÉTHODE D'IMPORTATION :",
                        fontSize = 11.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = TextSecondary,
                        letterSpacing = 0.5.sp
                    )

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        // Méthode 1 : Photo
                        MethodCard(
                            title = "1. Photo d'annonce",
                            subtitle = "Importer une capture d'écran, JPEG ou PNG",
                            badge = "Image",
                            icon = Icons.Default.Image,
                            isSelected = selectedMethod == 0,
                            onClick = { selectedMethod = 0 },
                            modifier = Modifier.weight(1f)
                        )

                        // Méthode 2 : Texte
                        MethodCard(
                            title = "2. Texte brut",
                            subtitle = "Coller le texte d'une offre trouvée en ligne",
                            badge = "Texte",
                            icon = Icons.Default.TextFields,
                            isSelected = selectedMethod == 1,
                            onClick = { selectedMethod = 1 },
                            modifier = Modifier.weight(1f)
                        )
                    }

                    Spacer(modifier = Modifier.height(6.dp))

                    if (selectedMethod == 0) {
                        // Zone Drag & Drop Photo
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(160.dp)
                                .clip(RoundedCornerShape(14.dp))
                                .border(1.5.dp, MintGreen.copy(alpha = 0.4f), RoundedCornerShape(14.dp))
                                .background(Color(0xFFF0FDF4))
                                .clickable {
                                    isScanning = true
                                    scanCompleted = true
                                },
                            contentAlignment = Alignment.Center
                        ) {
                            Column(
                                horizontalAlignment = Alignment.CenterHorizontally,
                                verticalArrangement = Arrangement.spacedBy(6.dp)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(44.dp)
                                        .clip(CircleShape)
                                        .background(MintGreenLight),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.CloudUpload,
                                        contentDescription = "Upload",
                                        tint = MintGreenDark,
                                        modifier = Modifier.size(24.dp)
                                    )
                                }
                                Text(
                                    text = "Cliquez ou glissez une photo d'offre",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.sp,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "PNG, JPG jusqu'à 10 Mo",
                                    fontSize = 11.5.sp,
                                    color = TextSecondary
                                )
                            }
                        }
                    } else {
                        // Saisie Texte Brut
                        OutlinedTextField(
                            value = rawText,
                            onValueChange = { rawText = it },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(140.dp),
                            placeholder = {
                                Text(
                                    text = "Collez ici le texte complet de l'offre d'emploi (Poste, Entreprise, Missions, Email de contact)...",
                                    fontSize = 12.5.sp,
                                    color = TextMuted
                                )
                            },
                            shape = RoundedCornerShape(12.dp)
                        )
                    }

                    // Bouton Lancer l'analyse IA
                    Button(
                        onClick = {
                            isScanning = true
                            scanCompleted = true
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(46.dp),
                        shape = RoundedCornerShape(12.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = MintGreen,
                            contentColor = Color.White
                        )
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Bolt,
                                contentDescription = null,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = "Lancer l'Extraction Intelligente",
                                fontWeight = FontWeight.Bold,
                                fontSize = 14.sp
                            )
                        }
                    }

                    // Résultat d'analyse simulé
                    if (scanCompleted) {
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(MintGreenLight)
                                .border(1.dp, MintGreen.copy(alpha = 0.3f), RoundedCornerShape(12.dp))
                                .padding(12.dp)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(
                                    text = "✨ Extraction réussie (Score 96%)",
                                    fontWeight = FontWeight.Bold,
                                    color = MintGreenDark,
                                    fontSize = 13.sp
                                )
                                Text(
                                    text = "Poste : Conducteur d'Engins Polyvalent\nEntreprise : Challenge 2000 SARL\nCanal : Candidature 1-Clic activée",
                                    fontSize = 12.sp,
                                    color = TextPrimary
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StepBanner(number: String, text: String) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(10.dp))
            .background(Color(0x14FFFFFF))
            .padding(horizontal = 12.dp, vertical = 10.dp)
    ) {
        Text(
            text = "$number  $text",
            fontSize = 12.sp,
            fontWeight = FontWeight.SemiBold,
            color = Color.White
        )
    }
}

@Composable
private fun MethodCard(
    title: String,
    subtitle: String,
    badge: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .border(
                1.5.dp,
                if (isSelected) MintGreen else BorderLight,
                RoundedCornerShape(14.dp)
            )
            .background(if (isSelected) Color(0xFFF0FDF4) else CardSurface)
            .clickable { onClick() }
            .padding(12.dp)
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(34.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(MintGreenLight),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = icon,
                        contentDescription = null,
                        tint = MintGreen,
                        modifier = Modifier.size(16.dp)
                    )
                }
                Box(
                    modifier = Modifier
                        .clip(PillShape)
                        .background(MintGreenLight)
                        .padding(horizontal = 8.dp, vertical = 3.dp)
                ) {
                    Text(
                        text = badge,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        color = MintGreen
                    )
                }
            }
            Spacer(modifier = Modifier.height(10.dp))
            Text(
                text = title,
                fontSize = 13.5.sp,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
            Text(
                text = subtitle,
                fontSize = 11.5.sp,
                color = TextSecondary,
                lineHeight = 15.sp,
                modifier = Modifier.padding(top = 3.dp)
            )
        }
    }
}
