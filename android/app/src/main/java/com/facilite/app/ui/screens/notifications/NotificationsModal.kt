package com.facilite.app.ui.screens.notifications

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.facilite.app.data.models.NotificationItem
import com.facilite.app.data.repository.MockDataRepository
import com.facilite.app.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NotificationsModal(
    onDismiss: () -> Unit,
    onNotificationClick: (NotificationItem) -> Unit = {}
) {
    val notifications = remember { mutableStateListOf(*MockDataRepository.notifications.toTypedArray()) }
    var selectedFilter by remember { mutableStateOf("Toutes") }
    val filterTabs = listOf("Toutes", "Offres d'emploi", "Mes posts", "Mentions")

    val filteredNotifications = remember(selectedFilter, notifications.toList()) {
        when (selectedFilter) {
            "Offres d'emploi" -> notifications.filter { it.title.contains("Offre", ignoreCase = true) || it.title.contains("Candidature", ignoreCase = true) }
            "Mes posts" -> notifications.filter { it.title.contains("CV", ignoreCase = true) || it.title.contains("profil", ignoreCase = true) }
            "Mentions" -> notifications.filter { it.title.contains("Message", ignoreCase = true) || it.title.contains("Recruteur", ignoreCase = true) }
            else -> notifications
        }
    }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = ScreenBackground,
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 24.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp)
        ) {
            // Header Row
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Text(
                        "Notifications",
                        fontWeight = FontWeight.ExtraBold,
                        fontSize = 20.sp,
                        color = TextPrimary
                    )
                    val unreadCount = notifications.count { !it.isRead }
                    if (unreadCount > 0) {
                        Box(
                            modifier = Modifier
                                .clip(CircleShape)
                                .background(Color(0xFFDC2626))
                                .padding(horizontal = 8.dp, vertical = 2.dp)
                        ) {
                            Text(
                                "$unreadCount+",
                                color = Color.White,
                                fontSize = 11.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                    }
                }

                TextButton(
                    onClick = {
                        val updated = notifications.map { it.copy(isRead = true) }
                        notifications.clear()
                        notifications.addAll(updated)
                    }
                ) {
                    Text(
                        "Tout marquer comme lu",
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        color = RoyalBlue
                    )
                }
            }

            // Filter Pills
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                filterTabs.forEach { tab ->
                    val isSelected = selectedFilter == tab
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(20.dp))
                            .background(if (isSelected) RoyalBlue else CardSurface)
                            .clickable { selectedFilter = tab }
                            .padding(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Text(
                            text = tab,
                            fontSize = 12.sp,
                            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
                            color = if (isSelected) Color.White else TextMuted
                        )
                    }
                }
            }

            // Notifications List
            LazyColumn(
                modifier = Modifier
                    .fillMaxWidth()
                    .heightIn(max = 500.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                items(filteredNotifications) { item ->
                    NotificationCardItem(
                        item = item,
                        onClick = {
                            val idx = notifications.indexOfFirst { it.id == item.id }
                            if (idx != -1) {
                                notifications[idx] = notifications[idx].copy(isRead = true)
                            }
                            onNotificationClick(item)
                        }
                    )
                }
            }
        }
    }
}

@Composable
fun NotificationCardItem(
    item: NotificationItem,
    onClick: () -> Unit
) {
    Card(
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(
            containerColor = if (item.isRead) CardSurface else Color.White
        ),
        elevation = CardDefaults.cardElevation(defaultElevation = if (item.isRead) 0.dp else 2.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(14.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
            verticalAlignment = Alignment.Top
        ) {
            Box(
                modifier = Modifier
                    .size(42.dp)
                    .clip(CircleShape)
                    .background(
                        when (item.type) {
                            "job" -> RoyalBlueLight
                            "ai" -> Color(0xFFEDE9FE)
                            else -> MintGreenLight
                        }
                    ),
                contentAlignment = Alignment.Center
            ) {
                Icon(
                    imageVector = when (item.type) {
                        "job" -> Icons.Default.Work
                        "ai" -> Icons.Default.AutoAwesome
                        else -> Icons.Default.Notifications
                    },
                    contentDescription = null,
                    tint = when (item.type) {
                        "job" -> RoyalBlue
                        "ai" -> PurpleBadge
                        else -> MintGreen
                    },
                    modifier = Modifier.size(20.dp)
                )
            }

            Column(
                modifier = Modifier.weight(1f),
                verticalArrangement = Arrangement.spacedBy(4.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        item.title,
                        fontWeight = if (item.isRead) FontWeight.SemiBold else FontWeight.Bold,
                        fontSize = 14.sp,
                        color = TextPrimary
                    )
                    if (!item.isRead) {
                        Box(
                            modifier = Modifier
                                .size(8.dp)
                                .clip(CircleShape)
                                .background(RoyalBlue)
                        )
                    }
                }

                Text(
                    item.description,
                    fontSize = 12.sp,
                    color = TextMuted,
                    lineHeight = 16.sp
                )

                Text(
                    item.timeAgo,
                    fontSize = 11.sp,
                    color = TextMuted.copy(alpha = 0.7f),
                    fontWeight = FontWeight.Medium
                )
            }
        }
    }
}
