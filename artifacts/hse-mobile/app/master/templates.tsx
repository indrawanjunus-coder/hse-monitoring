import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
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

interface Template {
  id: number;
  name: string;
  description?: string;
  questionCount?: number;
}

function TemplateModal({ visible, template, onClose, onSave }: {
  visible: boolean; template?: Template; onClose: () => void; onSave: (d: Partial<Template>) => void;
}) {
  const c = Colors.light;
  const [name, setName] = useState(template?.name ?? "");
  const [description, setDescription] = useState(template?.description ?? "");
  React.useEffect(() => {
    if (visible) { setName(template?.name ?? ""); setDescription(template?.description ?? ""); }
  }, [visible, template]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[styles.modal, { backgroundColor: c.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Text style={[{ color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Batal</Text></TouchableOpacity>
          <Text style={[styles.modalTitle, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>{template ? "Edit Template" : "Tambah Template"}</Text>
          <TouchableOpacity onPress={() => onSave({ name, description })}>
            <Text style={[{ color: c.primary, fontFamily: "Inter_600SemiBold" }]}>Simpan</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.modalBody}>
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Nama Template *</Text>
          <TextInput style={[styles.fInput, { borderColor: c.border, backgroundColor: c.card, color: c.text, fontFamily: "Inter_400Regular" }]}
            value={name} onChangeText={setName} placeholder="Nama template inspeksi" placeholderTextColor={c.textMuted} />
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Deskripsi</Text>
          <TextInput style={[styles.fInput, { borderColor: c.border, backgroundColor: c.card, color: c.text, fontFamily: "Inter_400Regular" }]}
            value={description} onChangeText={setDescription} placeholder="Deskripsi template" placeholderTextColor={c.textMuted} multiline numberOfLines={3} />
        </View>
      </View>
    </Modal>
  );
}

export default function TemplatesScreen() {
  const insets = useSafeAreaInsets();
  const { get, post, put, del } = useApi();
  const queryClient = useQueryClient();
  const c = Colors.light;
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<Template | undefined>();
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data = [], isLoading } = useQuery<Template[]>({ queryKey: ["templates"], queryFn: () => get("/templates") });

  const handleSave = async (payload: Partial<Template>) => {
    try {
      if (editItem) await put(`/templates/${editItem.id}`, payload);
      else await post("/templates", payload);
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      setModalVisible(false);
    } catch (e) { Alert.alert("Error", "Gagal menyimpan"); }
  };

  const handleDelete = (item: Template) => {
    Alert.alert("Hapus", `Hapus template "${item.name}"?`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
        await del(`/templates/${item.id}`);
        queryClient.invalidateQueries({ queryKey: ["templates"] });
      }},
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: c.primary }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="chevron-left" size={24} color="#fff" /></TouchableOpacity>
          <Text style={[styles.headerTitle, { fontFamily: "Inter_600SemiBold" }]}>Master Template</Text>
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
            <View style={[styles.iconBox, { backgroundColor: "#F59E0B20" }]}>
              <Feather name="layout" size={20} color="#F59E0B" />
            </View>
            <View style={styles.itemLeft}>
              <Text style={[styles.itemName, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>{item.name}</Text>
              {item.description && <Text style={[styles.itemSub, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]} numberOfLines={1}>{item.description}</Text>}
              {item.questionCount !== undefined && (
                <View style={[styles.countBadge, { backgroundColor: c.primaryLight }]}>
                  <Feather name="help-circle" size={11} color={c.primary} />
                  <Text style={[styles.countText, { color: c.primary, fontFamily: "Inter_500Medium" }]}>
                    {item.questionCount} pertanyaan
                  </Text>
                </View>
              )}
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
      <TemplateModal visible={modalVisible} template={editItem} onClose={() => setModalVisible(false)} onSave={handleSave} />
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
    borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  iconBox: { width: 42, height: 42, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  itemLeft: { flex: 1, gap: 4 },
  itemName: { fontSize: 15 },
  itemSub: { fontSize: 12 },
  countBadge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  countText: { fontSize: 11 },
  itemActions: { flexDirection: "row", gap: 4 },
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
});
