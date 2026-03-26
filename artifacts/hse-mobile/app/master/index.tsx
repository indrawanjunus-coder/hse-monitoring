import { Feather } from "@expo/vector-icons";
import { router } from "expo-router";
import React from "react";
import {
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

const MASTERS = [
  { icon: "users" as const, label: "Master User", route: "/master/users", color: "#3B82F6" },
  { icon: "tag" as const, label: "Master Kategori", route: "/master/categories", color: "#EF4444" },
  { icon: "users" as const, label: "Master Group", route: "/master/groups", color: "#8B5CF6" },
  { icon: "layout" as const, label: "Master Template", route: "/master/templates", color: "#F59E0B" },
  { icon: "map-pin" as const, label: "Master Plant", route: "/master/plants", color: "#10B981" },
  { icon: "tool" as const, label: "Master Aksi", route: "/master/actions", color: "#EC4899" },
];

export default function MasterIndexScreen() {
  const insets = useSafeAreaInsets();
  const c = Colors.light;
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: c.primary }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { fontFamily: "Inter_600SemiBold" }]}>Master Data</Text>
          <View style={{ width: 32 }} />
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.grid}>
          {MASTERS.map((item) => (
            <Pressable
              key={item.route}
              style={({ pressed }) => [styles.masterCard, { backgroundColor: c.card, opacity: pressed ? 0.88 : 1 }]}
              onPress={() => router.push(item.route as any)}
            >
              <View style={[styles.iconContainer, { backgroundColor: item.color + "1A" }]}>
                <Feather name={item.icon} size={24} color={item.color} />
              </View>
              <Text style={[styles.masterLabel, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>
                {item.label}
              </Text>
              <Feather name="chevron-right" size={16} color={c.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { padding: 4 },
  headerTitle: { color: "#fff", fontSize: 18 },
  content: { padding: 16, gap: 0 },
  grid: { gap: 10 },
  masterCard: {
    flexDirection: "row", alignItems: "center", gap: 14,
    borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  iconContainer: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  masterLabel: { flex: 1, fontSize: 15 },
});
