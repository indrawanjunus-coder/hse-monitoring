import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
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

interface User {
  id: number; nik: string; name: string; email: string;
  role: "admin" | "supervisor" | "employee";
  groupId?: number; groupName?: string;
  departmentId?: number; departmentName?: string;
  isActive: boolean;
}
interface Group { id: number; name: string }

const ROLES = [
  { value: "admin" as const, label: "Admin" },
  { value: "supervisor" as const, label: "Supervisor" },
  { value: "employee" as const, label: "Karyawan" },
];

function UserModal({ visible, user, groups, onClose, onSave }: {
  visible: boolean; user?: User; groups: Group[];
  onClose: () => void; onSave: (data: Record<string, unknown>) => void;
}) {
  const c = Colors.light;
  const [nik, setNik] = useState(user?.nik ?? "");
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");
  const [role, setRole] = useState<"admin" | "supervisor" | "employee">(user?.role ?? "employee");
  const [groupId, setGroupId] = useState<number | undefined>(user?.groupId);
  const [password, setPassword] = useState("");

  React.useEffect(() => {
    if (visible) {
      setNik(user?.nik ?? ""); setName(user?.name ?? ""); setEmail(user?.email ?? "");
      setRole(user?.role ?? "employee"); setGroupId(user?.groupId); setPassword("");
    }
  }, [visible, user]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={[styles.modal, { backgroundColor: c.background }]}>
        <View style={[styles.modalHeader, { borderBottomColor: c.border }]}>
          <TouchableOpacity onPress={onClose}><Text style={[{ color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Batal</Text></TouchableOpacity>
          <Text style={[styles.modalTitle, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>
            {user ? "Edit User" : "Tambah User"}
          </Text>
          <TouchableOpacity onPress={() => onSave({ nik, name, email, role, groupId, ...(password ? { password } : {}) })}>
            <Text style={[{ color: c.primary, fontFamily: "Inter_600SemiBold" }]}>Simpan</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>NIK *</Text>
          <TextInput style={[styles.fInput, { borderColor: c.border, backgroundColor: c.card, color: c.text, fontFamily: "Inter_400Regular" }]}
            value={nik} onChangeText={setNik} placeholder="NIK karyawan" placeholderTextColor={c.textMuted} />
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Nama *</Text>
          <TextInput style={[styles.fInput, { borderColor: c.border, backgroundColor: c.card, color: c.text, fontFamily: "Inter_400Regular" }]}
            value={name} onChangeText={setName} placeholder="Nama lengkap" placeholderTextColor={c.textMuted} />
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Email *</Text>
          <TextInput style={[styles.fInput, { borderColor: c.border, backgroundColor: c.card, color: c.text, fontFamily: "Inter_400Regular" }]}
            value={email} onChangeText={setEmail} placeholder="email@company.com" placeholderTextColor={c.textMuted} keyboardType="email-address" />
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Password {user ? "(kosongkan jika tidak diubah)" : "*"}</Text>
          <TextInput style={[styles.fInput, { borderColor: c.border, backgroundColor: c.card, color: c.text, fontFamily: "Inter_400Regular" }]}
            value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={c.textMuted} secureTextEntry />
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Role *</Text>
          <View style={styles.chipRow}>
            {ROLES.map(r => (
              <TouchableOpacity key={r.value} style={[styles.chip, role === r.value && { borderColor: c.primary, backgroundColor: c.primaryLight }]}
                onPress={() => { Haptics.selectionAsync(); setRole(r.value); }}>
                <Text style={[styles.chipText, { color: role === r.value ? c.primary : c.textSecondary, fontFamily: "Inter_500Medium" }]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={[styles.fLabel, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Group</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            <TouchableOpacity style={[styles.chip, !groupId && { borderColor: c.primary, backgroundColor: c.primaryLight }]}
              onPress={() => setGroupId(undefined)}>
              <Text style={[styles.chipText, { color: !groupId ? c.primary : c.textSecondary, fontFamily: "Inter_500Medium" }]}>Tidak Ada</Text>
            </TouchableOpacity>
            {groups.map(g => (
              <TouchableOpacity key={g.id} style={[styles.chip, groupId === g.id && { borderColor: c.primary, backgroundColor: c.primaryLight }]}
                onPress={() => setGroupId(g.id)}>
                <Text style={[styles.chipText, { color: groupId === g.id ? c.primary : c.textSecondary, fontFamily: "Inter_500Medium" }]}>{g.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </ScrollView>
      </View>
    </Modal>
  );
}

export default function UsersScreen() {
  const insets = useSafeAreaInsets();
  const { get, post, put, del } = useApi();
  const queryClient = useQueryClient();
  const c = Colors.light;
  const [modalVisible, setModalVisible] = useState(false);
  const [editItem, setEditItem] = useState<User | undefined>();
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const { data = [], isLoading } = useQuery<User[]>({ queryKey: ["users"], queryFn: () => get("/users") });
  const { data: groups = [] } = useQuery<Group[]>({ queryKey: ["groups"], queryFn: () => get("/groups") });

  const handleSave = async (payload: Record<string, unknown>) => {
    try {
      if (editItem) await put(`/users/${editItem.id}`, payload);
      else await post("/users", payload);
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setModalVisible(false);
    } catch (e) { Alert.alert("Error", e instanceof Error ? e.message : "Gagal menyimpan"); }
  };

  const handleDelete = (item: User) => {
    Alert.alert("Hapus", `Hapus user "${item.name}"?`, [
      { text: "Batal", style: "cancel" },
      { text: "Hapus", style: "destructive", onPress: async () => {
        await del(`/users/${item.id}`);
        queryClient.invalidateQueries({ queryKey: ["users"] });
      }},
    ]);
  };

  const roleColor = (role: string) => {
    if (role === "admin") return "#EF4444";
    if (role === "supervisor") return "#F59E0B";
    return "#10B981";
  };

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: c.primary }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}><Feather name="chevron-left" size={24} color="#fff" /></TouchableOpacity>
          <Text style={[styles.headerTitle, { fontFamily: "Inter_600SemiBold" }]}>Master User</Text>
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
            <View style={[styles.avatar, { backgroundColor: roleColor(item.role) + "20" }]}>
              <Text style={[styles.avatarText, { color: roleColor(item.role), fontFamily: "Inter_700Bold" }]}>
                {item.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={styles.itemLeft}>
              <Text style={[styles.itemName, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>{item.name}</Text>
              <Text style={[styles.itemSub, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>{item.nik} · {item.email}</Text>
              <View style={styles.tagRow}>
                <View style={[styles.roleTag, { backgroundColor: roleColor(item.role) + "20" }]}>
                  <Text style={[styles.roleText, { color: roleColor(item.role), fontFamily: "Inter_600SemiBold" }]}>{item.role}</Text>
                </View>
                {item.groupName && (
                  <View style={[styles.groupTag, { backgroundColor: c.primaryLight }]}>
                    <Text style={[styles.groupTagText, { color: c.primary, fontFamily: "Inter_500Medium" }]}>{item.groupName}</Text>
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
      <UserModal visible={modalVisible} user={editItem} groups={groups} onClose={() => setModalVisible(false)} onSave={handleSave} />
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
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16 },
  itemLeft: { flex: 1, gap: 3 },
  itemName: { fontSize: 15 },
  itemSub: { fontSize: 12 },
  tagRow: { flexDirection: "row", gap: 6 },
  roleTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  roleText: { fontSize: 11 },
  groupTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  groupTagText: { fontSize: 11, color: "#3B82F6" },
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
  chipRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, borderColor: "#E2E8F0" },
  chipText: { fontSize: 13 },
});
