import React from "react";
import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";

type RiskLevel = "high" | "medium" | "low";

interface Props {
  level: RiskLevel;
  size?: "sm" | "md";
}

const labels: Record<RiskLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function RiskBadge({ level, size = "md" }: Props) {
  const c = Colors.light;
  const colorMap: Record<RiskLevel, { bg: string; text: string }> = {
    high: { bg: c.highLight, text: c.high },
    medium: { bg: c.mediumLight, text: c.medium },
    low: { bg: c.lowLight, text: c.low },
  };
  const colors = colorMap[level];
  return (
    <View style={[styles.badge, { backgroundColor: colors.bg }, size === "sm" ? styles.sm : styles.md]}>
      <Text style={[styles.text, { color: colors.text, fontFamily: "Inter_600SemiBold" }, size === "sm" ? styles.textSm : styles.textMd]}>
        {labels[level]}
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
