package com.facilite.app.ui.screens.menu

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.Text
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
fun MenuDrawerOverlay(
    onClose: () -> Unit = {},
    onNavigateTo: (String) -> Unit = {},
    onProfileClick: () -> Unit = {}
) {
    var isBusinessSpace by remember { mutableStateOf(false) }

    val shortcuts = remember {
        listOf(
            ShortcutItem("Fonctionnalités & Outils", "⚡", "features", Color(0xFFF59E0B)),
            ShortcutItem("Offres d'emploi", "💼", "offers", RoyalBlue),
            ShortcutItem("Candidature Spontanée (77)", "🏢", "companies", MintGreen),
            ShortcutItem("Créer un CV (Builder)", "🎨", "cv_builder", Color(0xFF8B5CF6)),
            ShortcutItem("Messagerie Directe", "💬", "messages", Color(0xFF06B6D4)),
            ShortcutItem("Mon Profil Candidat", "👤", "profile", RoyalBlue),
            ShortcutItem("Centre de Notifications", "🔔", "notifications", RedAlert),
            ShortcutItem("Administration", "🛡️", "admin", OrangeAdmin)
        )
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 14.dp, vertical = 14.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            // 1. En-tête : < Menu + Loupe + Croix X
            item {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                        modifier = Modifier.clickable { onClose() }
                    ) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Retour",
                            tint = TextPrimary,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = "Menu",
                            fontSize = 17.sp,
                            fontWeight = FontWeight.Black,
                            color = TextPrimary
                        )
                    }

                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(CardSurface)
                                .clickable { onNavigateTo("search") },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Search,
                                contentDescription = "Recherche",
                                tint = TextPrimary,
                                modifier = Modifier.size(16.dp)
                            )
                        }

                        Box(
                            modifier = Modifier
                                .size(32.dp)
                                .clip(CircleShape)
                                .background(CardSurface)
                                .clickable { onClose() },
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Close,
                                contentDescription = "Fermer",
                                tint = TextPrimary,
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }

            // 2. VOS ESPACES (Mode Candidat vs Mode Business)
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .shadow(1.dp, RoundedCornerShape(16.dp))
                        .clip(RoundedCornerShape(16.dp))
                        .background(CardSurface)
                        .padding(14.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Text(
                                text = "VOS ESPACES",
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = TextMuted,
                                letterSpacing = 0.5.sp
                            )
                            Text(
                                text = if (isBusinessSpace) "Mode Business" else "Mode Candidat",
                                fontSize = 12.sp,
                                fontWeight = FontWeight.Bold,
                                color = if (isBusinessSpace) RoyalBlue else MintGreen
                            )
                        }

                        // Espace Candidat
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (!isBusinessSpace) Color(0xFFF0FDF4) else ScreenBackground)
                                .clickable { isBusinessSpace = false }
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .background(RoyalBlue),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(
                                    text = "FD",
                                    color = Color.White,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 14.sp
                                )
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "facile demo",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.5.sp,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "Espace Candidature & CV",
                                    fontSize = 11.5.sp,
                                    color = TextSecondary
                                )
                            }
                            if (!isBusinessSpace) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = "Actif",
                                    tint = MintGreen,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }

                        // Espace Business
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(if (isBusinessSpace) Color(0xFFEFF6FF) else ScreenBackground)
                                .clickable { isBusinessSpace = true }
                                .padding(10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(10.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(38.dp)
                                    .clip(CircleShape)
                                    .background(Color(0xFF1D2547)),
                                contentAlignment = Alignment.Center
                            ) {
                                Icon(
                                    imageVector = Icons.Default.Storefront,
                                    contentDescription = null,
                                    tint = Color.White,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                            Column(modifier = Modifier.weight(1f)) {
                                Text(
                                    text = "Facilite Business",
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 13.5.sp,
                                    color = TextPrimary
                                )
                                Text(
                                    text = "Espace Vendeur & Marketplace",
                                    fontSize = 11.5.sp,
                                    color = TextSecondary
                                )
                            }
                            if (isBusinessSpace) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = "Actif",
                                    tint = RoyalBlue,
                                    modifier = Modifier.size(18.dp)
                                )
                            }
                        }
                    }
                }
            }

            // 3. Diagnostic CV Gratuit Banner
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(
                            Brush.linearGradient(
                                colors = listOf(Color(0xFF141A33), Color(0xFF1D2547))
                            )
                        )
                        .padding(16.dp)
                ) {
                    Column {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "Diagnostic CV Gratuit",
                                fontSize = 14.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                            Box(
                                modifier = Modifier
                                    .clip(PillShape)
                                    .background(MintGreen)
                                    .padding(horizontal = 9.dp, vertical = 3.dp)
                            ) {
                                Text(
                                    text = "GRATUIT",
                                    fontSize = 9.5.sp,
                                    fontWeight = FontWeight.ExtraBold,
                                    color = Color.White
                                )
                            }
                        }
                        Spacer(modifier = Modifier.height(6.dp))
                        Text(
                            text = "Importez votre CV pour obtenir une analyse IA complète de votre score ATS et vos mots-clés.",
                            fontSize = 12.sp,
                            color = Color(0xB2FFFFFF),
                            lineHeight = 17.sp
                        )
                        Spacer(modifier = Modifier.height(12.dp))
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(PillShape)
                                .background(MintGreen)
                                .clickable { onNavigateTo("extractor") }
                                .padding(vertical = 11.dp),
                            contentAlignment = Alignment.Center
                        ) {
                            Text(
                                text = "🔍 Diagnostiquer mon CV",
                                fontSize = 13.sp,
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        }
                    }
                }
            }

            // 4. TOUS LES RACCOURCIS Grid
            item {
                Text(
                    text = "TOUS LES RACCOURCIS",
                    fontSize = 11.sp,
                    fontWeight = FontWeight.Bold,
                    color = TextMuted,
                    letterSpacing = 0.5.sp,
                    modifier = Modifier.padding(vertical = 4.dp)
                )
            }

            items(shortcuts.chunked(2)) { pair ->
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    pair.forEach { shortcut ->
                        Box(
                            modifier = Modifier
                                .weight(1f)
                                .clip(RoundedCornerShape(14.dp))
                                .background(CardSurface)
                                .clickable {
                                    onClose()
                                    onNavigateTo(shortcut.route)
                                }
                                .padding(12.dp)
                        ) {
                            Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(RoundedCornerShape(9.dp))
                                        .background(shortcut.color.copy(alpha = 0.15f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Text(text = shortcut.icon, fontSize = 15.sp)
                                }
                                Text(
                                    text = shortcut.title,
                                    fontSize = 12.5.sp,
                                    fontWeight = FontWeight.Bold,
                                    color = TextPrimary,
                                    lineHeight = 16.sp
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

private data class ShortcutItem(
    val title: String,
    val icon: String,
    val route: String,
    val color: Color
)
