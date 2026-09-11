package com.facilite.app.ui.screens.profile

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Person
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.models.UserProfile
import com.facilite.app.data.repository.MockDataRepository
import com.facilite.app.ui.theme.*

@Composable
fun ProfileAboutScreen(
    profile: UserProfile = MockDataRepository.userProfile,
    onSectionClick: (String) -> Unit = {}
) {
    val sections = listOf(
        ProfileSectionItem("infos_perso", "Informations personnelles", "👤"),
        ProfileSectionItem("experiences", "Expériences professionnelles", "💼"),
        ProfileSectionItem("formation", "Formation & Diplômes", "🎓"),
        ProfileSectionItem("competences", "Compétences professionnelles", "⚡"),
        ProfileSectionItem("langues", "Langues parlées", "🌐"),
        ProfileSectionItem("projets", "Projets & Réalisations", "📁"),
        ProfileSectionItem("certifications", "Certifications & Licences", "📜"),
        ProfileSectionItem("benevolat", "Bénévolat & Vie associative", "🤝")
    )

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground),
        contentPadding = PaddingValues(bottom = 80.dp)
    ) {
        // 1. Bannière CV + Photo Profil + Bouton Appareil photo
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .height(180.dp)
            ) {
                // Fond sombre avec texte CV
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(150.dp)
                        .background(
                            Brush.linearGradient(
                                colors = listOf(Color(0xFF161B2E), Color(0xFF1D2547))
                            )
                        ),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "CV",
                        fontSize = 60.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color(0x24FFFFFF),
                        letterSpacing = 4.sp
                    )

                    // Bouton changer bannière
                    Box(
                        modifier = Modifier
                            .align(Alignment.TopEnd)
                            .padding(12.dp)
                            .size(34.dp)
                            .clip(CircleShape)
                            .background(CardSurface)
                            .clickable { /* Camera */ },
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.CameraAlt,
                            contentDescription = "Changer bannière",
                            tint = TextPrimary,
                            modifier = Modifier.size(16.dp)
                        )
                    }
                }

                // Avatar flottant
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomStart)
                        .padding(start = 20.dp)
                        .size(64.dp)
                        .clip(CircleShape)
                        .border(3.dp, CardSurface, CircleShape)
                        .background(Color(0xFF0B0D10)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Person,
                        contentDescription = "Photo",
                        tint = Color.White,
                        modifier = Modifier.size(36.dp)
                    )
                }
            }
        }

        // 2. Nom + Badges Admin / Vérifié
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 6.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text(
                        text = profile.fullName,
                        fontSize = 20.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = TextPrimary
                    )
                    Box(
                        modifier = Modifier
                            .clip(PillShape)
                            .background(Color(0xFFEDE9FE))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "👑 ADMIN",
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = Color(0xFF7C3AED)
                        )
                    }
                    Box(
                        modifier = Modifier
                            .clip(PillShape)
                            .background(Color(0xFFD7F2EA))
                            .padding(horizontal = 8.dp, vertical = 3.dp)
                    ) {
                        Text(
                            text = "✔ Profil Vérifié",
                            fontSize = 10.5.sp,
                            fontWeight = FontWeight.Bold,
                            color = MintGreen
                        )
                    }
                }

                Text(
                    text = profile.headline,
                    fontSize = 13.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = RoyalBlue,
                    modifier = Modifier.padding(top = 4.dp)
                )

                // Tags rapides
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 10.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    TagItem(text = "💼 Juriste Droit Privé")
                    TagItem(text = "📍 ${profile.location}")
                }
            }
        }

        // 3. Onglets de profil (À propos, Mes documents, Paramètres)
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 10.dp)
                    .border(1.dp, Color(0x14000000), RoundedCornerShape(100.dp))
                    .padding(4.dp)
            ) {
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .clip(PillShape)
                        .background(RoyalBlue)
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "À propos",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Mes documents",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextSecondary
                    )
                }
                Box(
                    modifier = Modifier
                        .weight(1f)
                        .padding(vertical = 8.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = "Paramètres",
                        fontSize = 13.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = TextSecondary
                    )
                }
            }
        }

        // 4. Scanner document CTA
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 6.dp)
                    .clip(PillShape)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(MintGreen, MintGreenDark)
                        )
                    )
                    .clickable { /* Scan document */ }
                    .padding(vertical = 11.dp),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = "⛶ Scanner Document (CV, CNI, Passeport)",
                    fontSize = 12.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
            }
        }

        // 5. Liste des rubriques
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 8.dp)
                    .clip(RoundedCornerShape(16.dp))
                    .background(CardSurface)
            ) {
                Column {
                    sections.forEach { sec ->
                        Row(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clickable { onSectionClick(sec.id) }
                                .padding(horizontal = 16.dp, vertical = 14.dp),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(12.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(34.dp)
                                    .clip(RoundedCornerShape(10.dp))
                                    .background(Color(0xFFEEF1FB)),
                                contentAlignment = Alignment.Center
                            ) {
                                Text(text = sec.icon, fontSize = 16.sp)
                            }
                            Text(
                                text = sec.label,
                                fontSize = 13.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = RoyalBlue,
                                modifier = Modifier.weight(1f)
                            )
                            Icon(
                                imageVector = Icons.Default.ChevronRight,
                                contentDescription = null,
                                tint = Color(0x4D000000),
                                modifier = Modifier.size(16.dp)
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun TagItem(text: String) {
    Box(
        modifier = Modifier
            .clip(PillShape)
            .border(1.dp, Color(0x1A000000), PillShape)
            .padding(horizontal = 10.dp, vertical = 5.dp)
    ) {
        Text(
            text = text,
            fontSize = 11.5.sp,
            color = TextSecondary
        )
    }
}

private data class ProfileSectionItem(
    val id: String,
    val label: String,
    val icon: String
)
