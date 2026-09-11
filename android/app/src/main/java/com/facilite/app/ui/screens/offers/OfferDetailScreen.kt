package com.facilite.app.ui.screens.offers

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Check
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.models.JobOffer
import com.facilite.app.ui.theme.*

@Composable
fun OfferDetailScreen(
    offer: JobOffer,
    onBackClick: () -> Unit = {},
    onApplyToggle: (JobOffer) -> Unit = {}
) {
    var isSaved by remember { mutableStateOf(offer.isSaved) }
    var isApplied by remember { mutableStateOf(offer.isApplied) }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(DarkFrameBackground)
    ) {
        // 1. En-tête : Bouton retour + Bouton Sauvegarder
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 16.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(DarkSurface)
                        .clickable { onBackClick() },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.ArrowBack,
                        contentDescription = "Retour",
                        tint = Color(0xFFF5F6F7),
                        modifier = Modifier.size(20.dp)
                    )
                }

                Box(
                    modifier = Modifier
                        .size(38.dp)
                        .clip(CircleShape)
                        .background(DarkSurface)
                        .clickable { isSaved = !isSaved },
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = if (isSaved) Icons.Default.Bookmark else Icons.Default.BookmarkBorder,
                        contentDescription = "Sauvegarder",
                        tint = if (isSaved) MintGreen else Color(0xFFF5F6F7),
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }

        // 2. Logo Entreprise + Titre + Entreprise/Ville + Badges
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                // Logo Entreprise
                Box(
                    modifier = Modifier
                        .size(64.dp)
                        .clip(RoundedCornerShape(18.dp))
                        .background(MintGreen),
                    contentAlignment = Alignment.Center
                ) {
                    Text(
                        text = offer.companyName.take(2).uppercase(),
                        fontWeight = FontWeight.Bold,
                        fontSize = 22.sp,
                        color = DarkFrameBackground
                    )
                }

                Spacer(modifier = Modifier.height(14.dp))

                Text(
                    text = offer.title,
                    fontSize = 19.sp,
                    fontWeight = FontWeight.ExtraBold,
                    color = Color.White,
                    textAlign = TextAlign.Center,
                    lineHeight = 25.sp
                )

                Spacer(modifier = Modifier.height(4.dp))

                Text(
                    text = "${offer.companyName} · ${offer.location}",
                    fontSize = 14.sp,
                    color = Color(0x8CF5F6F7)
                )

                Spacer(modifier = Modifier.height(12.dp))

                // Badges Contrat + Opportunité
                Row(
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .clip(PillShape)
                            .background(Color(0x0FFFFFFF))
                            .padding(horizontal = 10.dp, vertical = 5.dp)
                    ) {
                        Text(
                            text = offer.contractType,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = Color(0xB2F5F6F7)
                        )
                    }

                    Box(
                        modifier = Modifier
                            .clip(PillShape)
                            .background(MintGreen.copy(alpha = 0.14f))
                            .padding(horizontal = 10.dp, vertical = 5.dp)
                    ) {
                        Text(
                            text = offer.category,
                            fontSize = 12.sp,
                            fontWeight = FontWeight.Medium,
                            color = MintGreen
                        )
                    }
                }
            }
        }

        // 3. Cartes Statistiques : Salaire, Date, Candidats
        item {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                StatCard(
                    title = offer.salary,
                    subtitle = "Salaire",
                    titleColor = MintGreen,
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    title = offer.publicationDate,
                    subtitle = "Publiée",
                    modifier = Modifier.weight(1f)
                )
                StatCard(
                    title = "18",
                    subtitle = "Candidats",
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // 4. Description complète
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp)
            ) {
                Text(
                    text = "Description du poste",
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(8.dp))
                Text(
                    text = if (offer.descriptionFull.isNotEmpty()) offer.descriptionFull else offer.descriptionShort,
                    fontSize = 14.sp,
                    lineHeight = 22.sp,
                    color = Color(0xB8F5F6F7)
                )
            }
        }

        // 5. Compétences requises (Chips)
        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 18.dp)
            ) {
                Text(
                    text = "Compétences requises",
                    fontSize = 14.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = Color.White
                )
                Spacer(modifier = Modifier.height(10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    offer.requiredSkills.forEach { skill ->
                        Box(
                            modifier = Modifier
                                .clip(PillShape)
                                .background(DarkSurface)
                                .border(1.dp, Color(0x12FFFFFF), PillShape)
                                .padding(horizontal = 12.dp, vertical = 7.dp)
                        ) {
                            Text(
                                text = skill,
                                fontSize = 12.5.sp,
                                color = Color(0xC0F5F6F7)
                            )
                        }
                    }
                }
            }
        }

        // 6. Bouton Postuler en 1 clic
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 20.dp, vertical = 16.dp)
            ) {
                Button(
                    onClick = {
                        isApplied = !isApplied
                        onApplyToggle(offer.copy(isApplied = isApplied))
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(50.dp),
                    shape = RoundedCornerShape(14.dp),
                    colors = ButtonDefaults.buttonColors(
                        containerColor = if (isApplied) MintGreenLight else MintGreen,
                        contentColor = if (isApplied) MintGreenDark else Color(0xFF0B0D10)
                    )
                ) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        if (isApplied) {
                            Icon(
                                imageVector = Icons.Default.Check,
                                contentDescription = "Postulé",
                                tint = MintGreenDark,
                                modifier = Modifier.size(20.dp)
                            )
                            Text(
                                text = "Candidature envoyée avec succès",
                                fontSize = 14.5.sp,
                                fontWeight = FontWeight.Bold,
                                color = MintGreenDark
                            )
                        } else {
                            Text(
                                text = "Postuler en 1 clic avec mon CV",
                                fontSize = 14.5.sp,
                                fontWeight = FontWeight.ExtraBold
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun StatCard(
    title: String,
    subtitle: String,
    titleColor: Color = Color.White,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(16.dp))
            .background(DarkSurface)
            .padding(12.dp),
        contentAlignment = Alignment.Center
    ) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(3.dp)
        ) {
            Text(
                text = title,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                color = titleColor,
                textAlign = TextAlign.Center
            )
            Text(
                text = subtitle,
                fontSize = 11.sp,
                color = Color(0x73F5F6F7)
            )
        }
    }
}
