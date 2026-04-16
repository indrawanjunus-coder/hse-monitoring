import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";
import { RiskBadge } from "@/components/RiskBadge";

interface Plant { id: number; name: string; code: string }
interface Category { id: number; name: string; riskLevel: "high" | "medium" | "low"; color?: string }
interface Action { id: number; name: string }

function SelectCard<T extends { id: number; name: string }>({
  label, items, selected, onSelect, renderItem,
}: {
  label: string;
  items: T[];
  selected?: number;
  onSelect: (id: number) => void;
  renderItem?: (item: T) => React.ReactNode;
}) {
  const c = Colors.light;
  return (
    <View style={styles.fieldGroup}>
      <Text style={[styles.fieldLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalList}>
        {items.map(item => (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.selectChip,
              { borderColor: selected === item.id ? c.primary : c.border, backgroundColor: selected === item.id ? c.primaryLight : c.card },
            ]}
            onPress={() => { Haptics.selectionAsync(); onSelect(item.id); }}
          >
            {renderItem ? renderItem(item) : (
              <Text style={[styles.selectChipText, { color: selected === item.id ? c.primary : c.text, fontFamily: "Inter_500Medium" }]}>
                {item.name}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

export default function NewIncidentScreen() {
  const insets = useSafeAreaInsets();
  const { post } = useApi();
  const { get } = useApi();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const c = Colors.light;
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const today = new Date().toISOString().split("T")[0]!;

  const [plantId, setPlantId] = useState<number | undefined>();
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [incidentDate, setIncidentDate] = useState(today);
  const [detail, setDetail] = useState("");
  const [actionId, setActionId] = useState<number | undefined>();
  const [needsFurtherAction, setNeedsFurtherAction] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const { data: plants = [] } = useQuery<Plant[]>({ queryKey: ["plants"], queryFn: () => get("/plants") });
  const { data: categories = [] } = useQuery<Category[]>({ queryKey: ["categories"], queryFn: () => get("/categories") });
  const { data: actions = [] } = useQuery<Action[]>({ queryKey: ["actions"], queryFn: () => get("/actions") });

  const selectedCat = categories.find(c => c.id === categoryId);

  const handleSubmit = async () => {
    if (!plantId || !categoryId || !detail.trim()) {
      Alert.alert("Belum Lengkap", "Plant, kategori, dan detail wajib diisi");
      return;
    }
    if (!user) return;
    setSubmitting(true);
    try {
      await post("/incidents", {
        reporterId: user.id,
        plantId,
        categoryId,
        incidentDate,
        detail: detail.trim(),
        actionId,
        needsFurtherAction,
      });
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["incidents"] });
      Alert.alert("Berhasil", "Laporan incident berhasil disimpan", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: "#DC2626" }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontFamily: "Inter_600SemiBold" }]}>Laporkan Incident</Text>
          <View style={{ width: 30 }} />
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <SelectCard
          label="Plant *"
          items={plants}
          selected={plantId}
          onSelect={setPlantId}
        />

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Kategori *</Text>
          <View style={styles.categoryGrid}>
            {categories.map(cat => (
              <TouchableOpacity
                key={cat.id}
                style={[
                  styles.categoryCard,
                  { borderColor: categoryId === cat.id ? c.primary : c.border, backgroundColor: categoryId === cat.id ? c.primaryLight : c.card },
                ]}
                onPress={() => { Haptics.selectionAsync(); setCategoryId(cat.id); }}
              >
                <Text style={[styles.catName, { color: categoryId === cat.id ? c.primary : c.text, fontFamily: "Inter_600SemiBold" }]}>
                  {cat.name}
                </Text>
                <RiskBadge level={cat.riskLevel} size="sm" />
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Tanggal Kejadian *</Text>
          <TextInput
            style={[styles.textField, { borderColor: c.border, backgroundColor: c.card, color: c.text, fontFamily: "Inter_400Regular" }]}
            value={incidentDate}
            onChangeText={setIncidentDate}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={c.textMuted}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>
            Tanggal Pelaporan
          </Text>
          <View style={[styles.readonlyField, { backgroundColor: c.backgroundSecondary, borderColor: c.border }]}>
            <Text style={[{ color: c.textSecondary, fontFamily: "Inter_400Regular", fontSize: 15 }]}>{today}</Text>
            <Feather name="lock" size={14} color={c.textMuted} />
          </View>
        </View>

        <View style={styles.fieldGroup}>
          <Text style={[styles.fieldLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Detail Laporan *</Text>
          <TextInput
            style={[styles.textArea, { borderColor: c.border, backgroundColor: c.card, color: c.text, fontFamily: "Inter_400Regular" }]}
            value={detail}
            onChangeText={setDetail}
            placeholder="Deskripsikan incident yang ditemukan secara detail..."
            placeholderTextColor={c.textMuted}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>

        <SelectCard
          label="Tindakan yang Dilakukan"
          items={actions}
          selected={actionId}
          onSelect={setActionId}
        />

        <View style={[styles.switchCard, { backgroundColor: c.card }]}>
          <View style={styles.switchContent}>
            <View>
              <Text style={[styles.switchLabel, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>
                Perlu Tindakan Lanjut?
              </Text>
              {selectedCat?.id && needsFurtherAction && (
                <Text style={[styles.switchHint, { color: c.warning, fontFamily: "Inter_400Regular" }]}>
                  PIC Group akan dinotifikasi
                </Text>
              )}
            </View>
            <Switch
              value={needsFurtherAction}
              onValueChange={(v) => { Haptics.selectionAsync(); setNeedsFurtherAction(v); }}
              trackColor={{ false: c.border, true: c.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: c.card, borderTopColor: c.border }]}>
        <Pressable
          style={({ pressed }) => [styles.submitBtn, { backgroundColor: "#DC2626", opacity: pressed ? 0.85 : 1 }]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="send" size={18} color="#fff" />
              <Text style={[styles.submitText, { fontFamily: "Inter_600SemiBold" }]}>Kirim Laporan</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 18 },
  scroll: { flex: 1 },
  content: { padding: 16, gap: 16 },
  fieldGroup: {},
  fieldLabel: { fontSize: 13, marginBottom: 8 },
  horizontalList: { flexDirection: "row", gap: 8, paddingHorizontal: 2 },
  selectChip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  selectChipText: { fontSize: 14 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  categoryCard: {
    borderWidth: 1.5, borderRadius: 12, padding: 12, gap: 4,
    minWidth: "45%", flex: 1,
  },
  catName: { fontSize: 14 },
  textField: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  readonlyField: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  textArea: {
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    minHeight: 120,
  },
  switchCard: {
    borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  switchContent: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  switchLabel: { fontSize: 15 },
  switchHint: { fontSize: 12, marginTop: 2 },
  footer: { padding: 16, paddingHorizontal: 20, borderTopWidth: 1 },
  submitBtn: {
    height: 52, borderRadius: 14, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  submitText: { color: "#fff", fontSize: 16 },
});
