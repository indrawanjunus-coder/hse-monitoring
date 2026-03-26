import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
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
import { useAuth } from "@/context/AuthContext";

interface Incident {
  id: number;
  reporterName: string;
  plantName: string;
  categoryName: string;
  categoryRiskLevel: "high" | "medium" | "low";
  incidentDate: string;
  reportedDate: string;
  detail: string;
  actionName?: string;
  needsFurtherAction: boolean;
  status: "open" | "in_progress" | "closed";
  closedAt?: string;
  picGroupName?: string;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

export default function IncidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { get, put } = useApi();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const c = Colors.light;
  const [updating, setUpdating] = useState(false);
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data: incident, isLoading } = useQuery<Incident>({
    queryKey: ["incident", id],
    queryFn: () => get(`/incidents/${id}`),
  });

  const handleUpdateStatus = async (status: "in_progress" | "closed") => {
    Alert.alert(
      status === "closed" ? "Tutup Incident" : "Proses Incident",
      status === "closed" ? "Tandai incident ini sebagai selesai?" : "Tandai incident sebagai sedang diproses?",
      [
        { text: "Batal", style: "cancel" },
        {
          text: "Ya",
          onPress: async () => {
            setUpdating(true);
            try {
              await put(`/incidents/${id}`, { status });
              await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              queryClient.invalidateQueries({ queryKey: ["incident", id] });
              queryClient.invalidateQueries({ queryKey: ["incidents"] });
            } catch (e) {
              Alert.alert("Error", "Gagal mengupdate status");
            } finally {
              setUpdating(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  if (!incident) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <Text style={[{ color: c.text, fontFamily: "Inter_500Medium", fontSize: 16 }]}>Incident tidak ditemukan</Text>
      </View>
    );
  }

  const canUpdate = user?.role === "admin" || user?.role === "supervisor";

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: "#DC2626" }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontFamily: "Inter_600SemiBold" }]}>Detail Incident</Text>
          <View style={{ width: 32 }} />
        </View>
        <View style={styles.headerBadges}>
          <StatusBadge status={incident.status} />
          <RiskBadge level={incident.categoryRiskLevel} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: c.card }]}>
          <Text style={[styles.sectionLabel, { color: c.textMuted, fontFamily: "Inter_500Medium" }]}>Detail Kejadian</Text>
          <Text style={[styles.detail, { color: c.text, fontFamily: "Inter_400Regular" }]}>{incident.detail}</Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.card }]}>
          <Text style={[styles.sectionLabel, { color: c.textMuted, fontFamily: "Inter_500Medium" }]}>Informasi</Text>
          <InfoRow icon="map-pin" label="Plant" value={incident.plantName} />
          <InfoRow icon="tag" label="Kategori" value={incident.categoryName} />
          <InfoRow icon="calendar" label="Tanggal Kejadian" value={formatDate(incident.incidentDate)} />
          <InfoRow icon="clock" label="Tanggal Laporan" value={formatDate(incident.reportedDate)} />
          <InfoRow icon="user" label="Pelapor" value={incident.reporterName} />
          {incident.actionName && <InfoRow icon="tool" label="Tindakan" value={incident.actionName} />}
          {incident.closedAt && <InfoRow icon="check-circle" label="Ditutup" value={formatDate(incident.closedAt)} />}
        </View>

        {incident.needsFurtherAction && (
          <View style={[styles.alertCard, { backgroundColor: "#FEF3C7", borderColor: "#F59E0B" }]}>
            <Feather name="alert-circle" size={18} color="#D97706" />
            <View style={styles.alertContent}>
              <Text style={[styles.alertTitle, { color: "#92400E", fontFamily: "Inter_600SemiBold" }]}>
                Perlu Tindakan Lanjut
              </Text>
              {incident.picGroupName && (
                <Text style={[styles.alertText, { color: "#B45309", fontFamily: "Inter_400Regular" }]}>
                  PIC: {incident.picGroupName}
                </Text>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {canUpdate && incident.status !== "closed" && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: c.card, borderTopColor: c.border }]}>
          {incident.status === "open" && (
            <Pressable
              style={({ pressed }) => [styles.actionBtn, { backgroundColor: c.warning, opacity: pressed ? 0.85 : 1 }]}
              onPress={() => handleUpdateStatus("in_progress")}
              disabled={updating}
            >
              {updating ? <ActivityIndicator color="#fff" /> : (
                <>
                  <Feather name="play" size={16} color="#fff" />
                  <Text style={[styles.actionBtnText, { fontFamily: "Inter_600SemiBold" }]}>Proses</Text>
                </>
              )}
            </Pressable>
          )}
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: c.success, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => handleUpdateStatus("closed")}
            disabled={updating}
          >
            {updating ? <ActivityIndicator color="#fff" /> : (
              <>
                <Feather name="check" size={16} color="#fff" />
                <Text style={[styles.actionBtnText, { fontFamily: "Inter_600SemiBold" }]}>Tutup</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  const c = Colors.light;
  return (
    <View style={styles.infoRow}>
      <Feather name={icon as "map-pin"} size={14} color={c.textMuted} style={styles.infoIcon} />
      <Text style={[styles.infoLabel, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: c.text, fontFamily: "Inter_500Medium" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 18 },
  headerBadges: { flexDirection: "row", gap: 8 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 12 },
  card: {
    borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  sectionLabel: { fontSize: 12, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  detail: { fontSize: 15, lineHeight: 24 },
  infoRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: 8, gap: 8 },
  infoIcon: { marginTop: 2 },
  infoLabel: { width: 110, fontSize: 13 },
  infoValue: { flex: 1, fontSize: 13 },
  alertCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    borderRadius: 12, padding: 14, borderWidth: 1,
  },
  alertContent: { flex: 1 },
  alertTitle: { fontSize: 14 },
  alertText: { fontSize: 13, marginTop: 2 },
  footer: { padding: 16, paddingHorizontal: 20, borderTopWidth: 1, flexDirection: "row", gap: 10 },
  actionBtn: {
    flex: 1, height: 48, borderRadius: 12, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 6,
  },
  actionBtnText: { color: "#fff", fontSize: 15 },
});
