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
import androidx.compose.material.icons.filled.HourglassBottom
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Work
import androidx.compose.material.icons.filled.WorkOutline
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.models.JobOffer
import com.facilite.app.data.repository.MockDataRepository
import com.facilite.app.ui.components.JobCard
import com.facilite.app.ui.theme.*

@Composable
fun OffersScreen(
    jobOffers: List<JobOffer> = MockDataRepository.jobOffers,
    onOfferClick: (JobOffer) -> Unit = {},
    onApplyClick: (JobOffer) -> Unit = {},
    onSearchIaClick: () -> Unit = {}
) {
    var selectedFilter by remember { mutableStateOf("disponibles") } // "disponibles" | "expirees"

    val filteredOffers = remember(selectedFilter, jobOffers) {
        if (selectedFilter == "expirees") {
            jobOffers.filter { it.isExpired }
        } else {
            jobOffers.filter { !it.isExpired }
        }
    }

    LazyColumn(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
            .padding(horizontal = 12.dp, vertical = 10.dp),
        contentPadding = PaddingValues(bottom = 80.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // 1. Bannière Catalogue Dégradé Vert Sombre
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
                    Text(
                        text = "CATALOGUE DES EMPLOIS",
                        fontSize = 10.5.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF6EE7C9),
                        letterSpacing = 0.5.sp
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Offres d'Emploi Disponibles",
                        fontSize = 18.sp,
                        fontWeight = FontWeight.ExtraBold,
                        color = Color.White
                    )
                    Spacer(modifier = Modifier.height(6.dp))
                    Text(
                        text = "Explorez toutes les opportunités publiées par nos recruteurs au Sénégal et postulez en un clic.",
                        fontSize = 12.sp,
                        color = Color(0xFFD8F3EA),
                        lineHeight = 17.sp
                    )
                }

                // Icône mallette en haut à droite
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .size(34.dp)
                        .clip(RoundedCornerShape(10.dp))
                        .background(Color(0x24FFFFFF)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.WorkOutline,
                        contentDescription = null,
                        tint = Color.White,
                        modifier = Modifier.size(18.dp)
                    )
                }
            }
        }

        // 2. Bouton Recherche IA
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(PillShape)
                    .background(Color(0xFF6EE7C9))
                    .clickable { onSearchIaClick() }
                    .padding(vertical = 13.dp),
                contentAlignment = Alignment.Center
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Icon(
                        imageVector = Icons.Default.Search,
                        contentDescription = null,
                        tint = Color(0xFF0D3B34),
                        modifier = Modifier.size(16.dp)
                    )
                    Text(
                        text = "Recherche IA",
                        fontSize = 14.sp,
                        fontWeight = FontWeight.Bold,
                        color = Color(0xFF0D3B34)
                    )
                }
            }
        }

        // 3. Filtres : Offres disponibles vs Offres expirées
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                FilterTabButton(
                    label = "Offres disponibles",
                    count = "12",
                    isActive = selectedFilter == "disponibles",
                    activeBadgeBg = Color(0xFFD7F2EA),
                    activeBadgeColor = Color(0xFF0D3B34),
                    onClick = { selectedFilter = "disponibles" },
                    modifier = Modifier.weight(1f)
                )

                FilterTabButton(
                    label = "Offres expirées",
                    count = "0",
                    isActive = selectedFilter == "expirees",
                    activeBadgeBg = Color(0xFFF6D9D9),
                    activeBadgeColor = RedAlert,
                    onClick = { selectedFilter = "expirees" },
                    modifier = Modifier.weight(1f)
                )
            }
        }

        // 4. Bandeau d'info
        item {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(12.dp))
                    .background(Color(0xFFD7F2EA))
                    .padding(horizontal = 14.dp, vertical = 11.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(7.dp)
                            .clip(CircleShape)
                            .background(AmberAccent)
                    )
                    Text(
                        text = "Recrutements en cours : postulez rapidement avant clôture !",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.SemiBold,
                        color = Color(0xFF0D3B34)
                    )
                }
            }
        }

        // 5. Liste des offres
        items(filteredOffers) { offer ->
            JobCard(
                offer = offer,
                onOfferClick = onOfferClick,
                onApplyClick = onApplyClick
            )
        }
    }
}

@Composable
private fun FilterTabButton(
    label: String,
    count: String,
    isActive: Boolean,
    activeBadgeBg: Color,
    activeBadgeColor: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .border(
                1.5.dp,
                if (isActive) MintGreen else Color(0x14000000),
                RoundedCornerShape(14.dp)
            )
            .background(if (isActive) Color(0xFFF0FDF4) else CardSurface)
            .clickable { onClick() }
            .padding(12.dp)
    ) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Text(
                text = label,
                fontSize = 12.sp,
                fontWeight = FontWeight.SemiBold,
                color = TextPrimary
            )
            Box(
                modifier = Modifier
                    .clip(PillShape)
                    .background(activeBadgeBg)
                    .padding(horizontal = 9.dp, vertical = 3.dp)
            ) {
                Text(
                    text = count,
                    fontSize = 11.5.sp,
                    fontWeight = FontWeight.Bold,
                    color = activeBadgeColor
                )
            }
        }
    }
}
