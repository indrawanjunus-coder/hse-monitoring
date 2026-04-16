import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";

interface Action { id: number; name: string; description?: string }

function ActionModal({ visible, action, onClose, onSave }: {
  visible: boolean; action?: Action; onClose: () => void; onSave: (d: Partial<Action>) => void;
}) {
  const c = Colors.light;
  const [name, setName] = useState(action?.name ?? "");
  const [description, setDescription] = useState(action?.description ?? "");
  React.useEffect(() => {
    if (visible) { setName(action?.name ?? ""); setDescription(action?.description ?? ""); }
  }, [visible, action]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[styles.modal, { backgroundColor: c.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Text style={[{ color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Batal</Text></TouchableOpacity>
          <Text style={[styles.modalTitle, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>{action ? "Edit Aksi" : "Tambah Aksi"}</Text>
          <TouchableOpacity onPress={() => onSave({ name, description })}>
            <Text style={[{ color: c.primary, fontFamily: "Inter_600SemiBold" }]}>Simpan</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.modalBody}>
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Nama Aksi *</Text>
          <TextInput style={[styles.fInput, { borderColor: c.border, backgroundColor: c.card, color: c.text, fontFamily: "Inter_400Regular" }]}
            value={name} onChangeText={setName} placeholder="Nama tindakan" placeholderTextColor={c.textMuted} />
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Deskripsi</Text>
          <TextInput style={[styles.fInput, { borderColor: c.border, backgroundColor: c.card, color: c.text, fontFamily: "Inter_400Regular" }]}
            value={description} onChangeText={setDescription} placeholder="Deskripsi aksi" placeholderTextColor={c.textMuted} multiline />
        </View>
      </View>
    </Modal>
  );
}

export default function ActionsScreen() {
  const insets = useSafeAreaInsets();
  const { get, post, put, del } = useApi();
  const queryClient = useQueryClient();
  const c = Colors.light;
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<Action | undefined>();
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data = [], isLoading } = useQuery<Action[]>({ queryKey: ["actions"], queryFn: () => get("/actions") });

  const handleSave = async (payload: Partial<Action>) => {
    try {
      if (editItem) await put(`/actions/${editItem.id}`, payload);
      else await post("/actions", payload);
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      setModalVisible(false);
    } catch (e) { Alert.alert("Error", "Gagal menyimpan"); }
  };

  const handleDelete = (item: Action) => {
    Alert.alert("Hapus", `Hapus aksi "${item.name}"?`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
        await del(`/actions/${item.id}`);
        queryClient.invalidateQueries({ queryKey: ["actions"] });
      }},
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: c.primary }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="chevron-left" size={24} color="#fff" /></TouchableOpacity>
          <Text style={[styles.headerTitle, { fontFamily: "Inter_600SemiBold" }]}>Master Aksi</Text>
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
            <View style={[styles.iconBox, { backgroundColor: "#EC489920" }]}>
              <Feather name="tool" size={20} color="#EC4899" />
            </View>
            <View style={styles.itemLeft}>
              <Text style={[styles.itemName, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>{item.name}</Text>
              {item.description && <Text style={[styles.itemSub, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>{item.description}</Text>}
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
      <ActionModal visible={modalVisible} action={editItem} onClose={() => setModalVisible(false)} onSave={handleSave} />
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
  itemLeft: { flex: 1, gap: 2 },
  itemName: { fontSize: 15 },
  itemSub: { fontSize: 12 },
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
