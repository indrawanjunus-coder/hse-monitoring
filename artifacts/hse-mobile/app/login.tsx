import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Colors from "@/constants/colors";
import { useAuth } from "@/context/AuthContext";

export default function LoginScreen() {
  const { login, isLoading } = useAuth();
  const insets = useSafeAreaInsets();
  const [nik, setNik] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const c = Colors.light;

  const handleLogin = async () => {
    if (!nik.trim() || !password.trim()) {
      setError("NIK dan password harus diisi");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await login(nik.trim(), password);
      router.replace("/(tabs)");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Login gagal");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: c.primary }]}>
        <ActivityIndicator color="#fff" size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: c.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + (Platform.OS === "web" ? 67 : 40), paddingBottom: insets.bottom + 40 },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={[styles.logoContainer, { backgroundColor: c.primary }]}>
            <Ionicons name="shield-checkmark" size={40} color="#fff" />
          </View>
          <Text style={[styles.appName, { color: c.primary, fontFamily: "Inter_700Bold" }]}>HSE Monitor</Text>
          <Text style={[styles.tagline, { color: c.textSecondary, fontFamily: "Inter_400Regular" }]}>
            Health, Safety & Environment
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: c.card }]}>
          <Text style={[styles.cardTitle, { color: c.text, fontFamily: "Inter_600SemiBold" }]}>Masuk</Text>

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: c.dangerLight }]}>
              <Ionicons name="alert-circle" size={16} color={c.danger} />
              <Text style={[styles.errorText, { color: c.danger, fontFamily: "Inter_400Regular" }]}>{error}</Text>
            </View>
          ) : null}

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>NIK</Text>
            <View style={[styles.inputWrapper, { borderColor: c.border, backgroundColor: c.backgroundSecondary }]}>
              <Ionicons name="card-outline" size={18} color={c.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: c.text, fontFamily: "Inter_400Regular" }]}
                value={nik}
                onChangeText={setNik}
                placeholder="Masukkan NIK Anda"
                placeholderTextColor={c.textMuted}
                autoCapitalize="characters"
                returnKeyType="next"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={[styles.label, { color: c.textSecondary, fontFamily: "Inter_500Medium" }]}>Password</Text>
            <View style={[styles.inputWrapper, { borderColor: c.border, backgroundColor: c.backgroundSecondary }]}>
              <Ionicons name="lock-closed-outline" size={18} color={c.textMuted} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: c.text, fontFamily: "Inter_400Regular" }]}
                value={password}
                onChangeText={setPassword}
                placeholder="Masukkan password"
                placeholderTextColor={c.textMuted}
                secureTextEntry={!showPassword}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                <Ionicons name={showPassword ? "eye-off" : "eye"} size={18} color={c.textMuted} />
              </Pressable>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.loginButton,
              { backgroundColor: c.primary, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleLogin}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.loginButtonText, { fontFamily: "Inter_600SemiBold" }]}>Masuk</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.demoInfo}>
          <Text style={[styles.demoText, { color: c.textMuted, fontFamily: "Inter_400Regular" }]}>
            Demo: NIK ADM001 | Password: admin123
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 24 },
  header: { alignItems: "center", marginBottom: 32 },
  logoContainer: {
    width: 80, height: 80, borderRadius: 20,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  appName: { fontSize: 28, marginBottom: 4 },
  tagline: { fontSize: 14 },
  card: {
    borderRadius: 16, padding: 24,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  cardTitle: { fontSize: 22, marginBottom: 20 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    padding: 12, borderRadius: 10, marginBottom: 16,
  },
  errorText: { fontSize: 14, flex: 1 },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, marginBottom: 8 },
  inputWrapper: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, height: 48,
  },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, height: 48 },
  eyeButton: { padding: 4 },
  loginButton: {
    height: 50, borderRadius: 12, alignItems: "center",
    justifyContent: "center", marginTop: 8,
  },
  loginButtonText: { color: "#fff", fontSize: 16 },
  demoInfo: { marginTop: 24, alignItems: "center" },
  demoText: { fontSize: 12, textAlign: "center" },
});
