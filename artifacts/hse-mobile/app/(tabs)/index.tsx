import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/context/AuthContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface DashboardSummary {
  month: number;
  year: number;
  totalIncidents: number;
  openIncidents: number;
  closedIncidents: number;
  dailyIncidents: { date: string; count: number }[];
  dailyStatus: { date: string; open: number; closed: number }[];
  riskMatrix: { categoryId: number; categoryName: string; high: number; medium: number; low: number; total: number }[];
  categoryTrend: { date: string; categoryId: number; categoryName: string; count: number }[];
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function SimpleBarChart({ data, color, maxVal }: { data: { date: string; count: number }[]; color: string; maxVal: number }) {
  const c = Colors.light;
  const barWidth = Math.max(6, (SCREEN_WIDTH - 80) / Math.max(data.length, 1) - 2);
  const nonZero = data.filter(d => d.count > 0);
  const displayData = nonZero.length > 15 ? nonZero : data;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={styles.chartContainer}>
        {displayData.map((d, i) => {
          const h = maxVal > 0 ? (d.count / maxVal) * 80 : 0;
          return (
            <View key={i} style={[styles.barWrapper, { width: barWidth + 8 }]}>
              <Text style={[styles.barCount, { color: c.textMuted, fontFamily: "Inter_400Regular" }]}>
                {d.count > 0 ? d.count : ""}
              </Text>
              <View style={[styles.bar, { height: Math.max(h, 2), backgroundColor: h > 0 ? color : c.border, width: barWidth, borderRadius: 3 }]} />
              <Text style={[styles.barLabel, { color: c.textMuted, fontFamily: "Inter_400Regular" }]}>
                {d.date.split("-")[2]}
              </Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { get } = useApi();
  const c = Colors.light;
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const { data, isLoading, refetch, isRefetching } = useQuery<DashboardSummary>({
    queryKey: ["dashboard", month, year],
    queryFn: () => get(`/dashboard/summary?month=${month}&year=${year}`),
  });

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
  };

  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 16, backgroundColor: c.primary }]}>
        <Text style={[styles.headerTitle, { fontFamily: "Inter_700Bold" }]}>Dashboard HSE</Text>
        <Text style={[styles.headerSub, { fontFamily: "Inter_400Regular" }]}>Selamat datang, {user?.name}</Text>
      </View>

      <ScrollView
        style={styles.scroll}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={c.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 120 + insets.bottom }}
      >
        <View style={[styles.filterCard, { backgroundColor: c.card }]}>
          <TouchableOpacity onPress={prevMonth} style={styles.navBtn}>
            <Feather name="chevron-left" size={20} color={c.primary} />
          </TouchableOpacity>
          <Text style={[styles.monthLabel, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>
            {MONTHS[month - 1]} {year}
          </Text>
          <TouchableOpacity onPress={nextMonth} style={styles.navBtn}>
            <Feather name="chevron-right" size={20} color={c.primary} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={c.primary} size="large" />
          </View>
        ) : data ? (
          <>
            <View style={styles.statsRow}>
              <View style={[styles.statCard, { backgroundColor: c.card }]}>
                <Text style={[styles.statNumber, { color: c.primary, fontFamily: "Inter_700Bold" }]}>{data.totalIncidents}</Text>
                <Text style={[styles.statLabel, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>Total</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: c.card }]}>
                <Text style={[styles.statNumber, { color: c.danger, fontFamily: "Inter_700Bold" }]}>{data.openIncidents}</Text>
                <Text style={[styles.statLabel, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>Open</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: c.card }]}>
                <Text style={[styles.statNumber, { color: c.success, fontFamily: "Inter_700Bold" }]}>{data.closedIncidents}</Text>
                <Text style={[styles.statLabel, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>Selesai</Text>
              </View>
            </View>

            <View style={[styles.section, { backgroundColor: c.card }]}>
              <Text style={[styles.sectionTitle, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>Incident Harian</Text>
              {data.dailyIncidents.length > 0 ? (
                <SimpleBarChart
                  data={data.dailyIncidents}
                  color={c.primary}
                  maxVal={Math.max(...data.dailyIncidents.map(d => d.count), 1)}
                />
              ) : (
                <Text style={[styles.emptyText, { color: c.textMuted, fontFamily: "Inter_400Regular" }]}>Tidak ada data</Text>
              )}
            </View>

            <View style={[styles.section, { backgroundColor: c.card }]}>
              <Text style={[styles.sectionTitle, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>Masuk vs Selesai Per Hari</Text>
              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: c.danger }]} />
                  <Text style={[styles.legendText, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>Open</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: c.success }]} />
                  <Text style={[styles.legendText, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>Closed</Text>
                </View>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={styles.chartContainer}>
                  {data.dailyStatus.filter(d => d.open + d.closed > 0).map((d, i) => {
                    const max = Math.max(...data.dailyStatus.map(x => x.open + x.closed), 1);
                    const openH = (d.open / max) * 70;
                    const closedH = (d.closed / max) * 70;
                    return (
                      <View key={i} style={styles.dualBarWrapper}>
                        <View style={styles.dualBars}>
                          <View style={[styles.dualBar, { height: Math.max(openH, 2), backgroundColor: c.danger }]} />
                          <View style={[styles.dualBar, { height: Math.max(closedH, 2), backgroundColor: c.success }]} />
                        </View>
                        <Text style={[styles.barLabel, { color: c.textMuted, fontFamily: "Inter_400Regular" }]}>
                          {d.date.split("-")[2]}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>

            <View style={[styles.section, { backgroundColor: c.card }]}>
              <Text style={[styles.sectionTitle, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>Matrix Risiko per Kategori</Text>
              {data.riskMatrix.length === 0 ? (
                <Text style={[styles.emptyText, { color: c.textMuted, fontFamily: "Inter_400Regular" }]}>Tidak ada data</Text>
              ) : (
                <>
                  <View style={[styles.tableHeader, { borderBottomColor: c.border }]}>
                    <Text style={[styles.tableHeaderCell, { color: c.textSecondary, fontFamily: "Inter_600SemiBold", flex: 2 }]}>Kategori</Text>
                    <Text style={[styles.tableHeaderCell, { color: c.high, fontFamily: "Inter_600SemiBold" }]}>High</Text>
                    <Text style={[styles.tableHeaderCell, { color: c.medium, fontFamily: "Inter_600SemiBold" }]}>Med</Text>
                    <Text style={[styles.tableHeaderCell, { color: c.success, fontFamily: "Inter_600SemiBold" }]}>Low</Text>
                    <Text style={[styles.tableHeaderCell, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>Tot</Text>
                  </View>
                  {data.riskMatrix.map((r) => (
                    <View key={r.categoryId} style={[styles.tableRow, { borderBottomColor: c.borderLight }]}>
                      <Text style={[styles.tableCell, { color: c.text, fontFamily: "Inter_500Medium", flex: 2 }]}>{r.categoryName}</Text>
                      <Text style={[styles.tableCell, { color: c.high, fontFamily: "Inter_700Bold" }]}>{r.high}</Text>
                      <Text style={[styles.tableCell, { color: c.medium, fontFamily: "Inter_700Bold" }]}>{r.medium}</Text>
                      <Text style={[styles.tableCell, { color: c.success, fontFamily: "Inter_700Bold" }]}>{r.low}</Text>
                      <Text style={[styles.tableCell, { color: c.text, fontFamily: "Inter_700Bold" }]}>{r.total}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>

            {data.categoryTrend.length > 0 && (
              <View style={[styles.section, { backgroundColor: c.card }]}>
                <Text style={[styles.sectionTitle, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>Trend Kategori</Text>
                {Object.entries(
                  data.categoryTrend.reduce<Record<string, number>>((acc, item) => {
                    acc[item.categoryName] = (acc[item.categoryName] ?? 0) + item.count;
                    return acc;
                  }, {})
                ).map(([name, count]) => (
                  <View key={name} style={styles.trendRow}>
                    <Text style={[styles.trendName, { color: c.text, fontFamily: "Inter_500Medium" }]}>{name}</Text>
                    <View style={styles.trendBarContainer}>
                      <View style={[styles.trendBar, { backgroundColor: c.primaryLight, flex: 1 }]}>
                        <View style={[styles.trendBarFill, { backgroundColor: c.primary, flex: count / Math.max(...Object.values(data.categoryTrend.reduce<Record<string, number>>((a, i) => { a[i.categoryName] = (a[i.categoryName] ?? 0) + i.count; return a; }, {}))) }]} />
                      </View>
                    </View>
                    <Text style={[styles.trendCount, { color: c.primary, fontFamily: "Inter_700Bold" }]}>{count}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerTitle: { color: "#fff", fontSize: 22 },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, marginTop: 2 },
  scroll: { flex: 1 },
  filterCard: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    margin: 16, borderRadius: 12, padding: 12, gap: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  navBtn: { padding: 4 },
  monthLabel: { fontSize: 16, minWidth: 100, textAlign: "center" },
  statsRow: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginBottom: 12 },
  statCard: {
    flex: 1, borderRadius: 12, padding: 16, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statNumber: { fontSize: 28 },
  statLabel: { fontSize: 12, marginTop: 2 },
  section: {
    marginHorizontal: 16, marginBottom: 12, borderRadius: 12, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: { fontSize: 15, marginBottom: 12 },
  chartContainer: { flexDirection: "row", alignItems: "flex-end", minHeight: 100, paddingBottom: 4 },
  barWrapper: { alignItems: "center", gap: 2 },
  barCount: { fontSize: 9 },
  bar: { borderRadius: 3 },
  barLabel: { fontSize: 9, marginTop: 2 },
  dualBarWrapper: { alignItems: "center", marginRight: 8 },
  dualBars: { flexDirection: "row", alignItems: "flex-end", gap: 2, height: 70 },
  dualBar: { width: 10, borderRadius: 2 },
  legendRow: { flexDirection: "row", gap: 16, marginBottom: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 12 },
  tableHeader: { flexDirection: "row", paddingBottom: 8, borderBottomWidth: 1, marginBottom: 4 },
  tableHeaderCell: { flex: 1, fontSize: 12, textAlign: "center" },
  tableRow: { flexDirection: "row", paddingVertical: 8, borderBottomWidth: 1 },
  tableCell: { flex: 1, fontSize: 13, textAlign: "center" },
  trendRow: { flexDirection: "row", alignItems: "center", marginBottom: 8, gap: 8 },
  trendName: { width: 80, fontSize: 12 },
  trendBarContainer: { flex: 1, height: 16, borderRadius: 8, overflow: "hidden" },
  trendBar: { flex: 1, flexDirection: "row", borderRadius: 8, overflow: "hidden" },
  trendBarFill: { borderRadius: 8 },
  trendCount: { width: 30, fontSize: 13, textAlign: "right" },
  emptyText: { textAlign: "center", paddingVertical: 20, fontSize: 14 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", paddingVertical: 60 },
});
