import { Feather } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import { RiskBadge } from "@/components/RiskBadge";

interface Category {
  id: number;
  name: string;
  description?: string;
  riskLevel: "high" | "medium" | "low";
  picGroupId?: number;
  picGroupName?: string;
  color?: string;
}
interface Group { id: number; name: string }

function CategoryModal({ visible, category, groups, onClose, onSave }: {
  visible: boolean; category?: Category; groups: Group[];
  onClose: () => void; onSave: (data: Partial<Category>) => void;
}) {
  const c = Colors.light;
  const [name, setName] = useState(category?.name ?? "");
  const [description, setDescription] = useState(category?.description ?? "");
  const [riskLevel, setRiskLevel] = useState<"high" | "medium" | "low">(category?.riskLevel ?? "low");
  const [picGroupId, setPicGroupId] = useState<number | undefined>(category?.picGroupId);

  React.useEffect(() => {
    if (visible) {
      setName(category?.name ?? "");
      setDescription(category?.description ?? "");
      setRiskLevel(category?.riskLevel ?? "low");
      setPicGroupId(category?.picGroupId);
    }
  }, [visible, category]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[styles.modal, { backgroundColor: c.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Text style={[{ color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Batal</Text></TouchableOpacity>
          <Text style={[styles.modalTitle, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>
            {category ? "Edit Kategori" : "Tambah Kategori"}
          </Text>
          <TouchableOpacity onPress={() => onSave({ name, description, riskLevel, picGroupId })}>
            <Text style={[{ color: c.primary, fontFamily: "Inter_600SemiBold" }]}>Simpan</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Nama *</Text>
          <TextInput style={[styles.fInput, { borderColor: c.border, backgroundColor: c.card, color: c.text, fontFamily: "Inter_400Regular" }]}
            value={name} onChangeText={setName} placeholder="Nama kategori" placeholderTextColor={c.textMuted} />
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Deskripsi</Text>
          <TextInput style={[styles.fInput, { borderColor: c.border, backgroundColor: c.card, color: c.text, fontFamily: "Inter_400Regular" }]}
            value={description} onChangeText={setDescription} placeholder="Deskripsi (opsional)" placeholderTextColor={c.textMuted} />
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Level Risiko *</Text>
          <View style={styles.riskRow}>
            {(["high", "medium", "low"] as const).map(r => (
              <TouchableOpacity key={r} style={[styles.riskBtn, riskLevel === r && { borderColor: c.primary, backgroundColor: c.primaryLight }]}
                onPress={() => { Haptics.selectionAsync(); setRiskLevel(r); }}>
                <RiskBadge level={r} />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>PIC Group</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            <TouchableOpacity style={[styles.groupChip, !picGroupId && { borderColor: c.primary, backgroundColor: c.primaryLight }]}
              onPress={() => setPicGroupId(undefined)}>
              <Text style={[{ color: !picGroupId ? c.primary : c.textSecondary, fontFamily: "Inter_500Medium", fontSize: 13 }]}>Tidak Ada</Text>
            </TouchableOpacity>
            {groups.map(g => (
              <TouchableOpacity key={g.id} style={[styles.groupChip, picGroupId === g.id && { borderColor: c.primary, backgroundColor: c.primaryLight }]}
                onPress={() => setPicGroupId(g.id)}>
                <Text style={[{ color: picGroupId === g.id ? c.primary : c.textSecondary, fontFamily: "Inter_500Medium", fontSize: 13 }]}>{g.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const { get, post, put, del } = useApi();
  const queryClient = useQueryClient();
  const c = Colors.light;
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<Category | undefined>();
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data = [], isLoading } = useQuery<Category[]>({ queryKey: ["categories"], queryFn: () => get("/categories") });
  const { data: groups = [] } = useQuery<Group[]>({ queryKey: ["groups"], queryFn: () => get("/groups") });

  const handleSave = async (data: Partial<Category>) => {
    try {
      if (editItem) {
        await put(`/categories/${editItem.id}`, data);
      } else {
        await post("/categories", data);
      }
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      setModalVisible(false);
    } catch (e) { Alert.alert("Error", "Gagal menyimpan"); }
  };

  const handleDelete = (item: Category) => {
    Alert.alert("Hapus", `Hapus kategori "${item.name}"?`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
        await del(`/categories/${item.id}`);
        queryClient.invalidateQueries({ queryKey: ["categories"] });
      }},
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: c.primary }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="chevron-left" size={24} color="#fff" /></TouchableOpacity>
          <Text style={[styles.headerTitle, { fontFamily: "Inter_600SemiBold" }]}>Master Kategori</Text>
          <TouchableOpacity onPress={() => { setEditItem(undefined); setModalVisible(true); }} style={styles.addBtn}>
            <Feather name="plus" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={data}
        scrollEnabled={!!data.length}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 40 }]}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: c.textMuted, fontFamily: "Inter_400Regular" }]}>
              {isLoading ? "Memuat..." : "Belum ada data"}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.itemCard, { backgroundColor: c.card }]}>
            <View style={styles.itemLeft}>
              <Text style={[styles.itemName, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>{item.name}</Text>
              {item.description && <Text style={[styles.itemSub, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>{item.description}</Text>}
              <View style={styles.itemBadges}>
                <RiskBadge level={item.riskLevel} size="sm" />
                {item.picGroupName && (
                  <View style={[styles.groupTag, { backgroundColor: c.primaryLight }]}>
                    <Text style={[styles.groupTagText, { color: c.primary, fontFamily: "Inter_500Medium" }]}>PIC: {item.picGroupName}</Text>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.itemActions}>
              <TouchableOpacity onPress={() => { setEditItem(item); setModalVisible(true); }} style={styles.editBtn}>
                <Feather name="edit-2" size={16} color={c.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteBtn}>
                <Feather name="trash-2" size={16} color={c.danger} />
              </TouchableOpacity>
            </View>
          </View>
        )}
      />
      <CategoryModal visible={modalVisible} category={editItem} groups={groups} onClose={() => setModalVisible(false)} onSave={handleSave} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { padding: 4 },
  addBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 18 },
  list: { padding: 16, gap: 10 },
  itemCard: {
    borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  itemLeft: { flex: 1, gap: 4 },
  itemName: { fontSize: 15 },
  itemSub: { fontSize: 12 },
  itemBadges: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  groupTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  groupTagText: { fontSize: 11 },
  itemActions: { flexDirection: "row", gap: 8 },
  editBtn: { padding: 8 },
  deleteBtn: { padding: 8 },
  empty: { paddingVertical: 60, alignItems: "center" },
  emptyText: { fontSize: 14 },
  modal: { flex: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, borderBottomWidth: 1 },
  modalTitle: { fontSize: 17 },
  modalBody: { flex: 1, padding: 16 },
  fLabel: { fontSize: 13, marginBottom: 6, marginTop: 12 },
  fInput: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15 },
  riskRow: { flexDirection: "row", gap: 10 },
  riskBtn: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, borderColor: "#E2E8F0" },
  groupChip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderColor: "#E2E8F0" },
});
