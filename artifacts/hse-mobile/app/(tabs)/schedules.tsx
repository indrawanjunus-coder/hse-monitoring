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
import { StatusBadge } from "@/components/StatusBadge";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

interface Schedule {
  id: number;
  supervisorId: number;
  supervisorName: string;
  templateId: number;
  templateName: string;
  plantId: number;
  plantName: string;
  weekStart: string;
  weekEnd: string;
  status: "pending" | "completed";
  createdAt: string;
}

function formatWeek(start: string, end: string) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.getDate()} - ${e.getDate()} ${e.toLocaleString("id-ID", { month: "short", year: "numeric" })}`;
}

export default function SchedulesScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { get } = useApi();
  const c = Colors.light;
  const [filter, setFilter] = useState<"all" | "pending" | "completed">("all");

  const { data = [], isLoading, refetch, isRefetching } = useQuery<Schedule[]>({
    queryKey: ["schedules", user?.id],
    queryFn: () => {
      const params = user?.role === "supervisor" ? `?supervisorId=${user.id}` : "";
      return get(`/schedules${params}`);
    },
  });

  const filtered = data.filter(s => filter === "all" || s.status === filter);
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: c.primary }]}>
        <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold" }]}>Jadwal Inspeksi</Text>
        <Text style={[styles.headerSub, { fontFamily: "Inter_400Regular" }]}>Minggu ini</Text>
      </View>

      <View style={[styles.filterRow, { backgroundColor: c.card, borderBottomColor: c.border }]}>
        {(["all", "pending", "completed"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterBtn, filter === f && { borderBottomColor: c.primary, borderBottomWidth: 2 }]}
            onPress={() => setFilter(f)}
          >
            <Text style={[
              styles.filterText,
              { fontFamily: "Inter_500Medium", color: filter === f ? c.primary : c.textSecondary },
            ]}>
              {f === "all" ? "Semua" : f === "pending" ? "Pending" : "Selesai"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        scrollEnabled={!!filtered.length}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
        contentContainerStyle={[styles.listContent, { paddingBottom: 120 + insets.bottom }]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Feather name="calendar" size={48} color={c.textMuted} />
            <Text style={[styles.emptyTitle, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>
              {isLoading ? "Memuat..." : "Tidak ada jadwal"}
            </Text>
            <Text style={[styles.emptyText, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>
              {!isLoading && filter !== "all" ? "Coba ubah filter" : "Belum ada jadwal inspeksi"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, { backgroundColor: c.card, opacity: pressed ? 0.92 : 1 }]}
            onPress={() => router.push(`/inspection/${item.id}`)}
          >
            <View style={styles.cardHeader}>
              <View style={[styles.plantBadge, { backgroundColor: c.primaryLight }]}>
                <Text style={[styles.plantText, { color: c.primary, fontFamily: "Inter_600SemiBold" }]}>
                  {item.plantName}
                </Text>
              </View>
              <StatusBadge status={item.status} size="sm" />
            </View>

            <Text style={[styles.templateName, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>
              {item.templateName}
            </Text>

            <View style={styles.infoRow}>
              <Feather name="calendar" size={13} color={c.textMuted} />
              <Text style={[styles.infoText, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>
                {formatWeek(item.weekStart, item.weekEnd)}
              </Text>
            </View>

            <View style={styles.infoRow}>
              <Feather name="user" size={13} color={c.textMuted} />
              <Text style={[styles.infoText, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>
                {item.supervisorName}
              </Text>
            </View>

            {item.status === "pending" && (
              <View style={[styles.actionRow, { borderTopColor: c.borderLight }]}>
                <Feather name="edit-3" size={14} color={c.primary} />
                <Text style={[styles.actionText, { color: c.primary, fontFamily: "Inter_500Medium" }]}>
                  Mulai Inspeksi
                </Text>
              </View>
            )}
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: "#fff", fontSize: 22 },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 },
  filterRow: {
    flexDirection: "row", borderBottomWidth: 1, paddingHorizontal: 16,
  },
  filterBtn: { flex: 1, paddingVertical: 12, alignItems: "center" },
  filterText: { fontSize: 13 },
  listContent: { padding: 16, gap: 12 },
  card: {
    borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 8, elevation: 2,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  plantBadge: { borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  plantText: { fontSize: 12 },
  templateName: { fontSize: 16, marginBottom: 8 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  infoText: { fontSize: 13 },
  actionRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, paddingTop: 12, borderTopWidth: 1 },
  actionText: { fontSize: 13 },
  emptyContainer: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 18 },
  emptyText: { fontSize: 14, textAlign: "center" },
});
