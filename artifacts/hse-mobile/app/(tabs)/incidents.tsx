import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { RiskBadge } from "@/components/RiskBadge";
import { StatusBadge } from "@/components/StatusBadge";
import { useApi } from "@/hooks/useApi";

interface Incident {
  id: number;
  reporterName: string;
  plantName: string;
  categoryName: string;
  categoryRiskLevel: "high" | "medium" | "low";
  incidentDate: string;
  detail: string;
  needsFurtherAction: boolean;
  status: "open" | "in_progress" | "closed";
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function IncidentsScreen() {
  const insets = useSafeAreaInsets();
  const { get } = useApi();
  const c = Colors.light;
  const [filter, setFilter] = useState<"all" | "open" | "in_progress" | "closed">("all");
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const now = new Date();
  const { data = [], isLoading, refetch, isRefetching } = useQuery<Incident[]>({
    queryKey: ["incidents"],
    queryFn: () => get(`/incidents?month=${now.getMonth() + 1}&year=${now.getFullYear()}`),
  });

  const filtered = data.filter(i => filter === "all" || i.status === filter);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: "#DC2626" }]}>
        <View style={styles.headerContent}>
          <View>
            <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold" }]}>Hazard & Incident</Text>
            <Text style={[styles.headerSub, { fontFamily: "Inter_400Regular" }]}>Laporan temuan lapangan</Text>
          </View>
          <TouchableOpacity
            style={[styles.addButton, { backgroundColor: "rgba(255,255,255,0.2)" }]}
            onPress={() => router.push("/incident/new")}
          >
            <Feather name="plus" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.filterRow, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {(["all", "open", "in_progress", "closed"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && { borderBottomColor: c.danger, borderBottomWidth: 2 }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterText,
              { fontFamily: "Inter_500Medium", color: filter === f ? c.danger : c.textSecondary },
            ]}>
              {f === "all" ? "Semua" : f === "open" ? "Open" : f === "in_progress" ? "Proses" : "Selesai"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={!!filtered.length}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.danger} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 + insets.bottom }]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="alert-triangle" size={48} color={c.textMuted} />
            <Text style={[styles.emptyTitle, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>
              {isLoading ? "Memuat..." : "Tidak ada incident"}
            </Text>
            <Text style={[styles.emptyText, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>
              {!isLoading && "Tap + untuk melaporkan temuan"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, { backgroundColor: c.card, opacity: pressed ? 0.92 : 1 }]}
            onPress={() => router.push(`/incident/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.plantBadge, { backgroundColor: c.backgroundSecondary }]}>
                <Feather name="map-pin" size={11} color={c.textSecondary} />
                <Text style={[styles.plantText, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>
                  {item.plantName}
                </Text>
              </View>
              <StatusBadge status={item.status} size="sm" />
            </View>

            <Text style={[styles.detail, { color: c.text, fontFamily: "Inter_500Medium" }]} numberOfLines={2}>
              {item.detail}
            </Text>

            <View style={styles.badgeRow}>
              <RiskBadge level={item.categoryRiskLevel} size="sm" />
              <View style={[styles.catBadge, { backgroundColor: c.primaryLight }]}>
                <Text style={[styles.catText, { color: c.primary, fontFamily: "Inter_500Medium" }]}>
                  {item.categoryName}
                </Text>
              </View>
              {item.needsFurtherAction && (
                <View style={[styles.furtherBadge, { backgroundColor: "#FEF3C7" }]}>
                  <Feather name="alert-circle" size={11} color="#D97706" />
                  <Text style={[styles.furtherText, { fontFamily: "Inter_500Medium" }]}>Tindak Lanjut</Text>
                </View>
              )}
            </View>

            <View style={styles.footer}>
              <View style={styles.infoRow}>
                <Feather name="calendar" size={12} color={c.textMuted} />
                <Text style={[styles.infoText, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  {formatDate(item.incidentDate)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Feather name="user" size={12} color={c.textMuted} />
                <Text style={[styles.infoText, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>
                  {item.reporterName}
                </Text>
              </View>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerContent: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 22 },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 },
  addButton: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  filterRow: { flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 4 },
  filterBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  filterText: { fontSize: 12 },
  listContent: { padding: 16, gap: 12 },
  card: {
    borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  plantBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  plantText: { fontSize: 12 },
  detail: { fontSize: 14, lineHeight: 20, marginBottom: 10 },
  badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap", marginBottom: 10 },
  catBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  catText: { fontSize: 11 },
  furtherBadge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  furtherText: { fontSize: 11, color: "#D97706" },
  footer: { flexDirection: "row", gap: 16 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  infoText: { fontSize: 12 },
  emptyContainer: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
