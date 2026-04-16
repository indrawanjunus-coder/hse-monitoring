import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
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
import { useAuth } from "@/context/AuthContext";

const roleLabels: Record<string, string> = {
  admin: "Administrator",
  supervisor: "Supervisor",
  employee: "Karyawan",
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuth();
  const c = Colors.light;
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  const handleLogout = () => {
    Alert.alert("Keluar", "Apakah Anda yakin ingin keluar?", [
      { text: "Batal", style: "cancel" },
      { text: "Keluar", style: "destructive", onPress: logout },
    ]);
  };

  if (!user) return null;

  const initials = user.name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);

  const menuItems = [
    ...(user.role === "admin" ? [
      { icon: "settings" as const, label: "Master Data", onPress: () => router.push("/master/index") },
    ] : []),
    { icon: "help-circle" as const, label: "Bantuan", onPress: () => {} },
    { icon: "info" as const, label: "Tentang Aplikasi", onPress: () => {} },
  ];

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: topPadding + 16, paddingBottom: insets.bottom + 100 }]}
      >
        <View style={[styles.profileCard, { backgroundColor: c.primary }]}>
          <View style={[styles.avatar, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Text style={[styles.avatarText, { fontFamily: "Inter_700Bold" }]}>{initials}</Text>
          </View>
          <Text style={[styles.userName, { fontFamily: "Inter_700Bold" }]}>{user.name}</Text>
          <View style={[styles.roleBadge, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
            <Text style={[styles.roleText, { fontFamily: "Inter_500Medium" }]}>{roleLabels[user.role] ?? user.role}</Text>
          </View>
        </View>

        <View style={[styles.infoCard, { backgroundColor: c.card }]}>
          <View style={styles.infoRow}>
            <Feather name="credit-card" size={16} color={c.textMuted} />
            <View style={styles.infoTextGroup}>
              <Text style={[styles.infoLabel, { color: c.textMuted, fontFamily: "Inter_400Regular" }]}>NIK</Text>
              <Text style={[styles.infoValue, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>{user.nik}</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: c.borderLight }]} />
          <View style={styles.infoRow}>
            <Feather name="mail" size={16} color={c.textMuted} />
            <View style={styles.infoTextGroup}>
              <Text style={[styles.infoLabel, { color: c.textMuted, fontFamily: "Inter_400Regular" }]}>Email</Text>
              <Text style={[styles.infoValue, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>{user.email}</Text>
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: c.borderLight }]} />
          <View style={styles.infoRow}>
            <Feather name="briefcase" size={16} color={c.textMuted} />
            <View style={styles.infoTextGroup}>
              <Text style={[styles.infoLabel, { color: c.textMuted, fontFamily: "Inter_400Regular" }]}>Role</Text>
              <Text style={[styles.infoValue, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>{roleLabels[user.role]}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.menuCard, { backgroundColor: c.card }]}>
          {menuItems.map((item, index) => (
            <React.Fragment key={item.label}>
              <TouchableOpacity style={styles.menuItem} onPress={item.onPress}>
                <View style={[styles.menuIconContainer, { backgroundColor: c.primaryLight }]}>
                  <Feather name={item.icon} size={18} color={c.primary} />
                </View>
                <Text style={[styles.menuLabel, { color: c.text, fontFamily: "Inter_500Medium" }]}>{item.label}</Text>
                <Feather name="chevron-right" size={18} color={c.textMuted} />
              </TouchableOpacity>
              {index < menuItems.length - 1 && <View style={[styles.divider, { backgroundColor: c.borderLight, marginLeft: 56 }]} />}
            </React.Fragment>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [styles.logoutButton, { backgroundColor: c.dangerLight, opacity: pressed ? 0.8 : 1 }]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={18} color={c.danger} />
          <Text style={[styles.logoutText, { color: c.danger, fontFamily: "Inter_600SemiBold" }]}>Keluar</Text>
        </Pressable>

        <Text style={[styles.version, { color: c.textMuted, fontFamily: "Inter_400Regular" }]}>HSE Monitor v1.0.0</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 12 },
  profileCard: {
    borderRadius: 16, padding: 24, alignItems: "center", gap: 8,
  },
  avatar: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { color: "#fff", fontSize: 28 },
  userName: { color: "#fff", fontSize: 20 },
  roleBadge: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 4 },
  roleText: { color: "#fff", fontSize: 13 },
  infoCard: {
    borderRadius: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16 },
  infoTextGroup: { flex: 1 },
  infoLabel: { fontSize: 11, marginBottom: 2 },
  infoValue: { fontSize: 15 },
  divider: { height: 1, marginHorizontal: 16 },
  menuCard: {
    borderRadius: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14 },
  menuIconContainer: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuLabel: { flex: 1, fontSize: 15 },
  logoutButton: {
    borderRadius: 14, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, padding: 16,
  },
  logoutText: { fontSize: 16 },
  version: { textAlign: "center", fontSize: 12, marginTop: 4 },
});
