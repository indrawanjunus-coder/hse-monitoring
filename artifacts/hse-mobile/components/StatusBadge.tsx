import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

type Status = "open" | "in_progress" | "closed" | "pending" | "completed";

interface Props {
  status: Status;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "md" }: Props) {
  const c = Colors.light;
  const config: Record<Status, { bg: string; text: string; label: string }> = {
    open: { bg: c.dangerLight, text: c.danger, label: "Open" },
    in_progress: { bg: c.warningLight, text: c.warning, label: "Proses" },
    closed: { bg: c.successLight, text: c.success, label: "Selesai" },
    pending: { bg: c.warningLight, text: c.warning, label: "Pending" },
    completed: { bg: c.successLight, text: c.success, label: "Selesai" },
  };
  const cfg = config[status];
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, size === "sm" ? styles.sm : styles.md]}>
      <Text style={[styles.text, { color: cfg.text, fontFamily: "Inter_600SemiBold" }, size === "sm" ? styles.textSm : styles.textMd]}>
        {cfg.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { borderRadius: 6, alignSelf: "flex-start" },
  sm: { paddingHorizontal: 8, paddingVertical: 2 },
  md: { paddingHorizontal: 10, paddingVertical: 4 },
  text: {},
  textSm: { fontSize: 11 },
  textMd: { fontSize: 12 },
});
