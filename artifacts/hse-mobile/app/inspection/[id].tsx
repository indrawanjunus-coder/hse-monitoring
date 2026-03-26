import { Feather, Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Haptics from "expo-haptics";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { useAuth } from "@/context/AuthContext";

interface Question {
  id: number;
  templateId: number;
  text: string;
  answerType: "yes_no" | "text";
  isMandatory: boolean;
  requiresPhoto: boolean;
  categoryId?: number;
  categoryName?: string;
  orderIndex: number;
}

interface Schedule {
  id: number;
  supervisorId: number;
  supervisorName: string;
  templateId: number;
  templateName: string;
  plantId: number;
  plantName: string;
  weekStart: string;
  weekEnd: string;
  status: "pending" | "completed";
}

interface TemplateWithQuestions {
  id: number;
  name: string;
  questions: Question[];
}

type AnswerMap = Record<number, { answerYesNo?: boolean; answerText?: string }>;

function QuestionCard({ q, answer, onChange }: {
  q: Question;
  answer?: { answerYesNo?: boolean; answerText?: string };
  onChange: (qId: number, ans: { answerYesNo?: boolean; answerText?: string }) => void;
}) {
  const c = Colors.light;
  return (
    <View style={[styles.questionCard, { backgroundColor: c.card }]}>
      <View style={styles.questionHeader}>
        <View style={styles.questionMeta}>
          {q.categoryName && (
            <View style={[styles.catTag, { backgroundColor: c.primaryLight }]}>
              <Text style={[styles.catTagText, { color: c.primary, fontFamily: "Inter_500Medium" }]}>
                {q.categoryName}
              </Text>
            </View>
          )}
          {q.isMandatory && (
            <View style={[styles.mandatoryTag, { backgroundColor: c.dangerLight }]}>
              <Text style={[styles.mandatoryText, { color: c.danger, fontFamily: "Inter_500Medium" }]}>Wajib</Text>
            </View>
          )}
          {q.requiresPhoto && (
            <View style={[styles.photoTag, { backgroundColor: c.warningLight }]}>
              <Feather name="camera" size={11} color={c.warning} />
              <Text style={[styles.photoTagText, { color: c.warning, fontFamily: "Inter_500Medium" }]}>Foto</Text>
            </View>
          )}
        </View>
      </View>

      <Text style={[styles.questionText, { color: c.text, fontFamily: "Inter_500Medium" }]}>{q.text}</Text>

      {q.answerType === "yes_no" ? (
        <View style={styles.yesNoRow}>
          <TouchableOpacity
            style={[
              styles.yesNoBtn,
              { borderColor: answer?.answerYesNo === true ? c.success : c.border },
              answer?.answerYesNo === true && { backgroundColor: c.successLight },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(q.id, { answerYesNo: true });
            }}
          >
            <Feather name="check" size={18} color={answer?.answerYesNo === true ? c.success : c.textMuted} />
            <Text style={[styles.yesNoBtnText, { color: answer?.answerYesNo === true ? c.success : c.textMuted, fontFamily: "Inter_600SemiBold" }]}>
              Ya
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.yesNoBtn,
              { borderColor: answer?.answerYesNo === false ? c.danger : c.border },
              answer?.answerYesNo === false && { backgroundColor: c.dangerLight },
            ]}
            onPress={() => {
              Haptics.selectionAsync();
              onChange(q.id, { answerYesNo: false });
            }}
          >
            <Feather name="x" size={18} color={answer?.answerYesNo === false ? c.danger : c.textMuted} />
            <Text style={[styles.yesNoBtnText, { color: answer?.answerYesNo === false ? c.danger : c.textMuted, fontFamily: "Inter_600SemiBold" }]}>
              Tidak
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <TextInput
          style={[styles.textAnswer, { borderColor: c.border, backgroundColor: c.backgroundSecondary, color: c.text, fontFamily: "Inter_400Regular" }]}
          value={answer?.answerText ?? ""}
          onChangeText={(t) => onChange(q.id, { answerText: t })}
          placeholder="Tulis catatan di sini..."
          placeholderTextColor={c.textMuted}
          multiline
          numberOfLines={3}
        />
      )}
    </View>
  );
}

export default function InspectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { get, post } = useApi();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const c = Colors.light;
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [submitting, setSubmitting] = useState(false);

  const { data: schedule, isLoading: scheduleLoading } = useQuery<Schedule>({
    queryKey: ["schedule", id],
    queryFn: async () => {
      const all = await get(`/schedules`);
      return all.find((s: Schedule) => s.id === parseInt(id));
    },
  });

  const { data: template, isLoading: templateLoading } = useQuery<TemplateWithQuestions>({
    queryKey: ["template", schedule?.templateId],
    queryFn: () => get(`/templates/${schedule!.templateId}`),
    enabled: !!schedule?.templateId,
  });

  const handleAnswer = (qId: number, ans: { answerYesNo?: boolean; answerText?: string }) => {
    setAnswers(prev => ({ ...prev, [qId]: ans }));
  };

  const handleSubmit = async () => {
    if (!schedule || !template || !user) return;
    const mandatory = template.questions.filter(q => q.isMandatory);
    const unanswered = mandatory.filter(q => {
      const ans = answers[q.id];
      if (q.answerType === "yes_no") return ans?.answerYesNo === undefined;
      return !ans?.answerText?.trim();
    });
    if (unanswered.length > 0) {
      Alert.alert("Belum Lengkap", `${unanswered.length} pertanyaan wajib belum dijawab`);
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        scheduleId: schedule.id,
        supervisorId: user.id,
        plantId: schedule.plantId,
        templateId: schedule.templateId,
        inspectedAt: new Date().toISOString().split("T")[0],
        answers: template.questions.map(q => ({
          questionId: q.id,
          answerYesNo: answers[q.id]?.answerYesNo,
          answerText: answers[q.id]?.answerText,
        })),
      };
      await post("/inspections", payload);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["schedules"] });
      Alert.alert("Berhasil", "Inspeksi berhasil disimpan", [{ text: "OK", onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert("Error", e instanceof Error ? e.message : "Gagal menyimpan");
    } finally {
      setSubmitting(false);
    }
  };

  const isLoading = scheduleLoading || templateLoading;
  const topPadding = insets.top + (Platform.OS === "web" ? 67 : 0);

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <ActivityIndicator color={c.primary} size="large" />
      </View>
    );
  }

  if (!schedule) {
    return (
      <View style={[styles.centered, { backgroundColor: c.background }]}>
        <Text style={[styles.errorText, { color: c.text, fontFamily: "Inter_500Medium" }]}>Jadwal tidak ditemukan</Text>
      </View>
    );
  }

  const answeredCount = template?.questions.filter(q => answers[q.id] !== undefined).length ?? 0;
  const totalCount = template?.questions.length ?? 0;

  return (
    <View style={[styles.container, { backgroundColor: c.background }]}>
      <View style={[styles.header, { paddingTop: topPadding + 12, backgroundColor: c.primary }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Feather name="chevron-left" size={24} color="#fff" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={[styles.headerTitle, { fontFamily: "Inter_600SemiBold" }]} numberOfLines={1}>
              {schedule.templateName}
            </Text>
            <Text style={[styles.headerSub, { fontFamily: "Inter_400Regular" }]}>
              {schedule.plantName}
            </Text>
          </View>
        </View>
        <View style={[styles.progressBar, { backgroundColor: "rgba(255,255,255,0.3)" }]}>
          <View style={[
            styles.progressFill,
            { backgroundColor: "#fff", width: totalCount ? `${(answeredCount / totalCount) * 100}%` : "0%" },
          ]} />
        </View>
        <Text style={[styles.progressText, { fontFamily: "Inter_400Regular" }]}>
          {answeredCount} / {totalCount} dijawab
        </Text>
      </View>

      {schedule.status === "completed" ? (
        <View style={[styles.completedBanner, { backgroundColor: c.successLight }]}>
          <Feather name="check-circle" size={16} color={c.success} />
          <Text style={[styles.completedText, { color: c.success, fontFamily: "Inter_500Medium" }]}>
            Inspeksi ini sudah selesai dikerjakan
          </Text>
        </View>
      ) : null}

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        {template?.questions.sort((a, b) => a.orderIndex - b.orderIndex).map(q => (
          <QuestionCard
            key={q.id}
            q={q}
            answer={answers[q.id]}
            onChange={handleAnswer}
          />
        ))}
      </ScrollView>

      {schedule.status === "pending" && (
        <View style={[styles.footer, { paddingBottom: insets.bottom + 16, backgroundColor: c.card, borderTopColor: c.border }]}>
          <Pressable
            style={({ pressed }) => [styles.submitBtn, { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Feather name="check-square" size={18} color="#fff" />
                <Text style={[styles.submitText, { fontFamily: "Inter_600SemiBold" }]}>Simpan Inspeksi</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { fontSize: 16 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  backBtn: { padding: 4 },
  headerContent: { flex: 1 },
  headerTitle: { color: "#fff", fontSize: 16 },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 13 },
  progressBar: { height: 4, borderRadius: 2, overflow: "hidden", marginBottom: 4 },
  progressFill: { height: 4, borderRadius: 2 },
  progressText: { color: "rgba(255,255,255,0.9)", fontSize: 12 },
  completedBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, paddingHorizontal: 16, margin: 12, borderRadius: 10,
  },
  completedText: { fontSize: 14 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, gap: 12 },
  questionCard: {
    borderRadius: 14, padding: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  questionHeader: { marginBottom: 8 },
  questionMeta: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  catTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  catTagText: { fontSize: 11 },
  mandatoryTag: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  mandatoryText: { fontSize: 11 },
  photoTag: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  photoTagText: { fontSize: 11 },
  questionText: { fontSize: 14, lineHeight: 20, marginBottom: 12 },
  yesNoRow: { flexDirection: "row", gap: 10 },
  yesNoBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, height: 44, borderRadius: 10, borderWidth: 1.5,
  },
  yesNoBtnText: { fontSize: 15 },
  textAnswer: {
    borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 14,
    minHeight: 80, textAlignVertical: "top",
  },
  footer: {
    padding: 16, paddingHorizontal: 20, borderTopWidth: 1,
  },
  submitBtn: {
    height: 52, borderRadius: 14, flexDirection: "row",
    alignItems: "center", justifyContent: "center", gap: 8,
  },
  submitText: { color: "#fff", fontSize: 16 },
});
