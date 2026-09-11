package com.facilite.app.ui.screens.home

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.models.CvTemplateModel
import com.facilite.app.data.models.JobOffer
import com.facilite.app.data.repository.MockDataRepository
import com.facilite.app.ui.components.JobCard
import com.facilite.app.ui.components.MicFabButton
import com.facilite.app.ui.theme.*

@Composable
fun HomeScreen(
    jobOffers: List<JobOffer> = MockDataRepository.jobOffers,
    cvTemplates: List<CvTemplateModel> = MockDataRepository.cvTemplates,
    onOfferClick: (JobOffer) -> Unit = {},
    onApplyClick: (JobOffer) -> Unit = {},
    onTemplateClick: (CvTemplateModel) -> Unit = {},
    onMicClick: () -> Unit = {}
) {
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(ScreenBackground)
    ) {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(bottom = 80.dp)
        ) {
            // 1. Carrousel horizontal des Modèles de CV (01-accueil.html)
            item {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 12.dp, vertical = 10.dp)
                        .shadow(1.dp, RoundedCornerShape(16.dp))
                        .clip(RoundedCornerShape(16.dp))
                        .background(CardSurface)
                        .padding(14.dp)
                ) {
                    LazyRow(
                        horizontalArrangement = Arrangement.spacedBy(16.dp),
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        items(cvTemplates) { template ->
                            CvTemplateItem(
                                template = template,
                                onClick = { onTemplateClick(template) }
                            )
                        }
                    }
                }
            }

            // 2. Fil des Offres d'emploi
            items(jobOffers) { offer ->
                JobCard(
                    offer = offer,
                    onOfferClick = onOfferClick,
                    onApplyClick = onApplyClick,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 6.dp)
                )
            }
        }

        // Bouton flottant Micro IA en bas à droite
        MicFabButton(
            onClick = onMicClick,
            modifier = Modifier
                .align(Alignment.BottomEnd)
                .padding(end = 16.dp, bottom = 16.dp)
        )
    }
}

@Composable
fun CvTemplateItem(
    template: CvTemplateModel,
    onClick: () -> Unit
) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
        modifier = Modifier.clickable { onClick() }
    ) {
        Box(
            modifier = Modifier
                .size(56.dp)
                .clip(CircleShape)
                .border(2.5.dp, RoyalBlue, CircleShape)
                .padding(2.dp)
        ) {
            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .clip(CircleShape)
                    .background(
                        Brush.linearGradient(
                            colors = listOf(
                                Color(template.previewGradientColors[0]),
                                Color(template.previewGradientColors[1])
                            )
                        )
                    )
            )
        }
        Text(
            text = template.name,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            color = RoyalBlue
        )
    }
}
