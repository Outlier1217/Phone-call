
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";

type Contact = {
  id: string;
  phone_number: string;
  contact_name: string;
  created_at: string;
};

type VirtualNumber = {
  id: string;
  user_id: string;
  phone_number: string;
  label: string;
  busy_mode: boolean;
  created_at: string;
};

const QUICK_LABELS = ["Personal", "Home", "Office", "Business"];

function getFriendlyError(error: unknown): string {
  const err = error as { code?: string; message?: string };
  const message = err?.message ?? "";

  if (err?.code === "23505") {
    return "This number is already registered. Please choose another number.";
  }

  if (
    message.toLowerCase().includes("maximum 10") ||
    message.toLowerCase().includes("maximum")
  ) {
    return "You have reached your limit of 10 registered numbers.";
  }

  if (
    message.toLowerCase().includes("cannot be edited") ||
    message.toLowerCase().includes("cannot be deleted")
  ) {
    return "Registered phone numbers cannot be edited or deleted.";
  }

  if (message.toLowerCase().includes("invalid api key")) {
    return "Supabase API key is invalid. Please check your .env configuration.";
  }

  return message || "Something went wrong. Please try again.";
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [numbersLoading, setNumbersLoading] = useState(false);

  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [phoneNumber, setPhoneNumber] = useState("");
  const [label, setLabel] = useState("Personal");
  const [customLabel, setCustomLabel] = useState("");
  const [numbers, setNumbers] = useState<VirtualNumber[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactSaving, setContactSaving] = useState(false);

  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState<"success" | "error">("success");

  const showNotice = (
    message: string,
    type: "success" | "error" = "success"
  ) => {
    setNotice(message);
    setNoticeType(type);
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!mounted) return;

        if (error) showNotice(error.message, "error");

        setSession(data.session);
        setInitializing(false);
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        showNotice(getFriendlyError(error), "error");
        setInitializing(false);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (mounted) {
        setSession(nextSession);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadNumbers = useCallback(async () => {
    if (!session?.user.id) {
      setNumbers([]);
      return;
    }

    setNumbersLoading(true);

    const { data, error } = await supabase
      .from("virtual_numbers")
      .select("id, user_id, phone_number, label, busy_mode, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      showNotice(getFriendlyError(error), "error");
    } else {
      setNumbers((data ?? []) as VirtualNumber[]);
    }

    setNumbersLoading(false);
  }, [session?.user.id]);

  useEffect(() => {
    if (session?.user.id) {
      void loadNumbers();
    } else {
      setNumbers([]);
    }
  }, [session?.user.id, loadNumbers]);

  const loadContacts = useCallback(async () => {
    if (!session?.user.id) {
      setContacts([]);
      return;
    }

    setContactsLoading(true);
    const { data, error } = await supabase
      .from("contacts")
      .select("id, phone_number, contact_name, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      showNotice(getFriendlyError(error), "error");
    } else {
      setContacts((data ?? []) as Contact[]);
    }

    setContactsLoading(false);
  }, [session?.user.id]);

  useEffect(() => {
    if (session?.user.id) {
      void loadContacts();
    } else {
      setContacts([]);
    }
  }, [session?.user.id, loadContacts]);

  async function addContact() {
    setNotice("");

    const cleanPhone = contactPhone.replace(/[^0-9]/g, "");
    const cleanName = contactName.trim();

    if (!/^[0-9]{10}$/.test(cleanPhone)) {
      showNotice("Enter a valid 10-digit Phone-call number.", "error");
      return;
    }

    if (cleanName.length < 1 || cleanName.length > 80) {
      showNotice("Contact name must contain 1 to 80 characters.", "error");
      return;
    }

    setContactSaving(true);
    try {
      const { error } = await supabase.rpc("add_contact", {
        p_phone_number: cleanPhone,
        p_contact_name: cleanName,
      });

      if (error) throw error;

      setContactName("");
      setContactPhone("");
      showNotice("Contact added successfully!");
      await loadContacts();
    } catch (error) {
      const message = (error as { message?: string })?.message ?? "";
      if (message.toLowerCase().includes("duplicate key")) {
        showNotice("This number is already in your contacts.", "error");
      } else {
        showNotice(getFriendlyError(error), "error");
      }
    } finally {
      setContactSaving(false);
    }
  }

  async function handleAuth() {
    setNotice("");

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      showNotice("Please enter a valid email address.", "error");
      return;
    }

    if (password.length < 8) {
      showNotice("Password must be at least 8 characters.", "error");
      return;
    }

    if (mode === "signup") {
      if (!name.trim()) {
        showNotice("Please enter your name.", "error");
        return;
      }

      if (password !== confirmPassword) {
        showNotice("Passwords do not match.", "error");
        return;
      }
    }

    setLoading(true);

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: name.trim() },
          },
        });

        if (error) throw error;

        if (data.session) {
          showNotice("Account created successfully!");
        } else {
          setMode("login");
          showNotice(
            "Account created. Check your email for confirmation, then sign in."
          );
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;
        showNotice("You are signed in.");
      }
    } catch (error) {
      showNotice(getFriendlyError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function registerNumber() {
    setNotice("");

    if (!session?.user.id) {
      showNotice("Please sign in before registering a number.", "error");
      return;
    }

    if (!/^[0-9]{10}$/.test(phoneNumber)) {
      showNotice("Enter exactly 10 digits, without spaces or country code.", "error");
      return;
    }

    const finalLabel = (
      label === "Custom" ? customLabel : label
    ).trim();

    if (finalLabel.length < 1 || finalLabel.length > 40) {
      showNotice("Your label must contain between 1 and 40 characters.", "error");
      return;
    }

    if (numbers.length >= 10) {
      showNotice("You can register a maximum of 10 numbers.", "error");
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.from("virtual_numbers").insert({
        user_id: session.user.id,
        phone_number: phoneNumber,
        label: finalLabel,
      });

      if (error) throw error;

      setPhoneNumber("");
      setLabel("Personal");
      setCustomLabel("");

      showNotice("Your virtual number has been registered!");
      await loadNumbers();
    } catch (error) {
      showNotice(getFriendlyError(error), "error");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);

    const { error } = await supabase.auth.signOut();

    setLoading(false);

    if (error) {
      showNotice(getFriendlyError(error), "error");
    } else {
      setNumbers([]);
      setPassword("");
      setConfirmPassword("");
      showNotice("You have signed out.");
    }
  }

  if (initializing) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#087F5B" />
        <Text style={styles.muted}>Loading Phone-call...</Text>
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.safe}>
        <StatusBar barStyle="dark-content" />
        <ScrollView
          contentContainerStyle={styles.authContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logo}>
            <Text style={styles.logoText}>☎</Text>
          </View>

          <Text style={styles.brand}>Phone-call</Text>
          <Text style={styles.subtitle}>
            Your people, connected.
          </Text>

          <View style={styles.card}>
            <Text style={styles.heading}>
              {mode === "signup" ? "Create your account" : "Welcome back"}
            </Text>
            <Text style={styles.muted}>
              {mode === "signup"
                ? "Start by creating your secure account."
                : "Sign in to manage your virtual numbers."}
            </Text>

            {mode === "signup" && (
              <>
                <Text style={styles.label}>Full name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Your full name"
                  autoCapitalize="words"
                  maxLength={80}
                />
              </>
            )}

            <Text style={styles.label}>Email address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              secureTextEntry
              autoCapitalize="none"
            />

            {mode === "signup" && (
              <>
                <Text style={styles.label}>Confirm password</Text>
                <TextInput
                  style={styles.input}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder="Repeat your password"
                  secureTextEntry
                  autoCapitalize="none"
                />
              </>
            )}

            {notice ? (
              <Text
                style={[
                  styles.notice,
                  noticeType === "error" && styles.errorNotice,
                ]}
              >
                {notice}
              </Text>
            ) : null}

            <Pressable
              style={styles.primaryButton}
              onPress={handleAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.primaryButtonText}>
                  {mode === "signup" ? "Create account" : "Sign in"}
                </Text>
              )}
            </Pressable>

            <Pressable
              style={styles.switchButton}
              onPress={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setNotice("");
              }}
            >
              <Text style={styles.switchText}>
                {mode === "signup"
                  ? "Already registered? Sign in"
                  : "New here? Create an account"}
              </Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <View style={styles.smallLogo}>
            <Text style={styles.smallLogoText}>☎</Text>
          </View>
          <View>
            <Text style={styles.headerTitle}>Phone-call</Text>
            <Text style={styles.headerSubtitle}>Virtual number manager</Text>
          </View>
        </View>

        <Pressable onPress={logout} disabled={loading}>
          <Text style={styles.logoutText}>Log out</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.page}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.eyebrow}>YOUR ACCOUNT</Text>
        <Text style={styles.pageTitle}>My numbers</Text>
        <Text style={styles.pageSubtitle}>
          Register and manage your virtual numbers.
        </Text>

        <View style={styles.counterCard}>
          <View>
            <Text style={styles.counterLabel}>REGISTERED NUMBERS</Text>
            <Text style={styles.counterNumber}>{numbers.length} / 10</Text>
          </View>
          <View style={styles.counterIcon}>
            <Text style={styles.counterIconText}>▦</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.formTitle}>Register a new number</Text>
          <Text style={styles.muted}>
            Choose a unique 10-digit virtual number.
          </Text>

          <Text style={styles.label}>10-digit number</Text>
          <TextInput
            style={styles.input}
            value={phoneNumber}
            onChangeText={(value) =>
              setPhoneNumber(value.replace(/[^0-9]/g, "").slice(0, 10))
            }
            placeholder="e.g. 9876543210"
            keyboardType="number-pad"
            maxLength={10}
          />
          <Text style={styles.helper}>
            {phoneNumber.length}/10 digits
          </Text>

          <Text style={styles.label}>Assign a label</Text>
          <View style={styles.labelOptions}>
            {QUICK_LABELS.map((item) => (
              <Pressable
                key={item}
                onPress={() => setLabel(item)}
                style={[
                  styles.labelChip,
                  label === item && styles.labelChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.labelChipText,
                    label === item && styles.labelChipTextSelected,
                  ]}
                >
                  {item}
                </Text>
              </Pressable>
            ))}

            <Pressable
              onPress={() => setLabel("Custom")}
              style={[
                styles.labelChip,
                label === "Custom" && styles.labelChipSelected,
              ]}
            >
              <Text
                style={[
                  styles.labelChipText,
                  label === "Custom" && styles.labelChipTextSelected,
                ]}
              >
                Custom
              </Text>
            </Pressable>
          </View>

          {label === "Custom" && (
            <TextInput
              style={styles.input}
              value={customLabel}
              onChangeText={setCustomLabel}
              placeholder="Enter your custom label"
              maxLength={40}
            />
          )}

          {notice ? (
            <Text
              style={[
                styles.notice,
                noticeType === "error" && styles.errorNotice,
              ]}
            >
              {notice}
            </Text>
          ) : null}

          <Pressable
            style={[
              styles.primaryButton,
              (loading || numbers.length >= 10) && styles.disabledButton,
            ]}
            onPress={registerNumber}
            disabled={loading || numbers.length >= 10}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                Register virtual number
              </Text>
            )}
          </Pressable>

          <Text style={styles.footnote}>
            Registered numbers cannot be edited or deleted.
          </Text>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.formTitle}>Your registered numbers</Text>
          <Pressable onPress={loadNumbers} disabled={numbersLoading}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {numbersLoading ? (
          <ActivityIndicator
            style={styles.listLoader}
            size="large"
            color="#087F5B"
          />
        ) : numbers.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>▦</Text>
            <Text style={styles.emptyTitle}>No numbers yet</Text>
            <Text style={styles.muted}>
              Register your first virtual number above.
            </Text>
          </View>
        ) : (
          numbers.map((item) => (
            <View key={item.id} style={styles.numberCard}>
              <View style={styles.numberIcon}>
                <Text style={styles.numberIconText}>☎</Text>
              </View>

              <View style={styles.numberDetails}>
                <Text style={styles.numberLabel}>{item.label}</Text>
                <Text style={styles.numberValue}>{item.phone_number}</Text>
                <Text style={styles.numberDate}>
                  Registered{" "}
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>

              <View style={styles.lockPill}>
                <Text style={styles.lockText}>Locked</Text>
              </View>
            </View>
          ))
        )}

        {/* CONTACTS_SECTION_START */}
        <View style={styles.card}>
          <Text style={styles.formTitle}>Add a contact</Text>
          <Text style={styles.muted}>
            Add someone who already has a registered Phone-call number.
          </Text>

          <Text style={styles.label}>Contact name</Text>
          <TextInput
            style={styles.input}
            value={contactName}
            onChangeText={setContactName}
            placeholder="Enter contact name"
            maxLength={80}
          />

          <Text style={styles.label}>10-digit Phone-call number</Text>
          <TextInput
            style={styles.input}
            value={contactPhone}
            onChangeText={(value) =>
              setContactPhone(value.replace(/[^0-9]/g, "").slice(0, 10))
            }
            placeholder="e.g. 9876543210"
            keyboardType="number-pad"
            maxLength={10}
          />

          <Pressable
            style={[styles.primaryButton, contactSaving && styles.disabledButton]}
            onPress={addContact}
            disabled={contactSaving}
          >
            {contactSaving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Save contact</Text>
            )}
          </Pressable>
        </View>

        <View style={styles.listHeader}>
          <Text style={styles.formTitle}>My contacts ({contacts.length})</Text>
          <Pressable onPress={loadContacts} disabled={contactsLoading}>
            <Text style={styles.refreshText}>Refresh</Text>
          </Pressable>
        </View>

        {contactsLoading ? (
          <ActivityIndicator style={styles.listLoader} color="#087F5B" />
        ) : contacts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No contacts yet</Text>
            <Text style={styles.muted}>
              Add a registered Phone-call number above.
            </Text>
          </View>
        ) : (
          contacts.map((contact) => (
            <View key={contact.id} style={styles.numberCard}>
              <View style={styles.numberIcon}>
                <Text style={styles.numberIconText}>
                  {contact.contact_name.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.numberDetails}>
                <Text style={styles.numberLabel}>{contact.contact_name}</Text>
                <Text style={styles.numberValue}>{contact.phone_number}</Text>
              </View>
              <View style={styles.lockPill}>
                <Text style={styles.lockText}>Contact</Text>
              </View>
            </View>
          ))
        )}
        {/* CONTACTS_SECTION_END */}

        <Text style={styles.disclaimer}>
          These are app-based virtual numbers, not real SIM or telecom numbers.
          Internet calling and messaging will be added in later steps.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#F5F8F6" },
  flex: { flex: 1 },
  center: {
    flex: 1,
    backgroundColor: "#F5F8F6",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  authContainer: {
    flexGrow: 1,
    alignItems: "center",
    padding: 22,
    paddingVertical: 35,
  },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: "#087F5B",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoText: { color: "#FFFFFF", fontSize: 30 },
  brand: { fontSize: 25, fontWeight: "800", color: "#17211F" },
  subtitle: { color: "#84918A", fontSize: 13, marginTop: 5, marginBottom: 25 },
  card: {
    width: "100%",
    maxWidth: 500,
    backgroundColor: "#FFFFFF",
    padding: 22,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E5EDE8",
    marginTop: 18,
  },
  heading: { fontSize: 25, fontWeight: "800", color: "#17211F" },
  formTitle: { fontSize: 17, fontWeight: "800", color: "#17211F" },
  muted: { color: "#84918A", fontSize: 12, lineHeight: 19, marginTop: 6 },
  label: {
    color: "#34413A",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 17,
    marginBottom: 8,
  },
  input: {
    width: "100%",
    minHeight: 48,
    borderWidth: 1,
    borderColor: "#DEE8E2",
    backgroundColor: "#FCFDFC",
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    color: "#17211F",
    fontSize: 14,
  },
  primaryButton: {
    minHeight: 49,
    borderRadius: 12,
    backgroundColor: "#087F5B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: 20,
  },
  primaryButtonText: { color: "#FFFFFF", fontSize: 14, fontWeight: "800" },
  switchButton: { alignItems: "center", marginTop: 20 },
  switchText: { color: "#087F5B", fontSize: 12, fontWeight: "700" },
  notice: {
    color: "#087F5B",
    backgroundColor: "#E7F6EE",
    padding: 12,
    borderRadius: 10,
    marginTop: 15,
    overflow: "hidden",
    fontSize: 12,
    lineHeight: 18,
  },
  errorNotice: { color: "#A43B31", backgroundColor: "#FDECEA" },
  header: {
    minHeight: 72,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: "#E9EFEB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerBrand: { flexDirection: "row", alignItems: "center", gap: 10 },
  smallLogo: {
    width: 39,
    height: 39,
    borderRadius: 12,
    backgroundColor: "#087F5B",
    alignItems: "center",
    justifyContent: "center",
  },
  smallLogoText: { color: "#FFFFFF", fontSize: 22 },
  headerTitle: { fontSize: 16, fontWeight: "800", color: "#17211F" },
  headerSubtitle: { fontSize: 10, color: "#84918A", marginTop: 3 },
  logoutText: { color: "#087F5B", fontWeight: "800", fontSize: 12 },
  page: {
    width: "100%",
    maxWidth: 760,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 28,
    paddingBottom: 40,
  },
  eyebrow: {
    color: "#087F5B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
  },
  pageTitle: {
    color: "#17211F",
    fontSize: 29,
    fontWeight: "800",
    marginTop: 7,
    letterSpacing: -0.8,
  },
  pageSubtitle: { color: "#84918A", fontSize: 13, marginTop: 6, lineHeight: 20 },
  counterCard: {
    backgroundColor: "#E7F6EE",
    borderRadius: 17,
    padding: 20,
    marginTop: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  counterLabel: {
    color: "#46715B",
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1,
  },
  counterNumber: {
    color: "#087F5B",
    fontSize: 30,
    fontWeight: "800",
    marginTop: 6,
  },
  counterIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    backgroundColor: "#CDEDDD",
    alignItems: "center",
    justifyContent: "center",
  },
  counterIconText: { color: "#087F5B", fontSize: 25 },
  labelOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 },
  labelChip: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#DDE7E1",
    backgroundColor: "#FFFFFF",
  },
  labelChipSelected: { backgroundColor: "#E7F6EE", borderColor: "#087F5B" },
  labelChipText: { color: "#64716A", fontSize: 12, fontWeight: "600" },
  labelChipTextSelected: { color: "#087F5B", fontWeight: "800" },
  helper: { color: "#84918A", fontSize: 11, marginTop: 6, textAlign: "right" },
  footnote: {
    textAlign: "center",
    color: "#84918A",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 13,
  },
  listHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 28,
    marginBottom: 12,
  },
  refreshText: { color: "#087F5B", fontSize: 12, fontWeight: "800" },
  listLoader: { marginTop: 25 },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5EDE8",
    padding: 28,
    alignItems: "center",
  },
  emptyIcon: { fontSize: 35, color: "#087F5B" },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#17211F",
    marginTop: 10,
  },
  numberCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5EDE8",
    borderRadius: 16,
    padding: 15,
    marginBottom: 10,
  },
  numberIcon: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#E7F6EE",
    alignItems: "center",
    justifyContent: "center",
  },
  numberIconText: { color: "#087F5B", fontSize: 23 },
  numberDetails: { flex: 1 },
  numberLabel: { color: "#34413A", fontSize: 12, fontWeight: "800" },
  numberValue: {
    color: "#17211F",
    fontSize: 17,
    fontWeight: "800",
    marginTop: 4,
    letterSpacing: 0.5,
  },
  numberDate: { color: "#84918A", fontSize: 10, marginTop: 4 },
  lockPill: {
    backgroundColor: "#F0F2F1",
    borderRadius: 9,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  lockText: { color: "#64716A", fontSize: 10, fontWeight: "700" },
  disclaimer: {
    color: "#84918A",
    fontSize: 11,
    lineHeight: 18,
    marginTop: 20,
    textAlign: "center",
  },
  disabledButton: { opacity: 0.6 },
});
