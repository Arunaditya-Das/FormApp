import { Ionicons } from "@expo/vector-icons";
// import * as FileSystem from "expo-file-system";
import * as FileSystem from "expo-file-system/legacy";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../db/database";

export default function ViewEntries() {
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);

  const fetchEntries = () => {
    try {
      const result = db.getAllSync("SELECT * FROM records ORDER BY id DESC");
      setEntries(result);
    } catch (e) {
      console.log("Error fetching:", e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchEntries();
    }, [])
  );

  // ---------------- DELETE ALL ----------------
  const deleteAll = () => {
    if (entries.length === 0) return;

    Alert.alert(
      "Delete All Records?",
      "This action is permanent and cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            try {
              db.runSync("DELETE FROM records");
              fetchEntries();
              Alert.alert("Success", "All records deleted.");
            } catch {
              Alert.alert("Error", "Could not delete records.");
            }
          },
        },
      ]
    );
  };

  // ---------------- CSV EXPORT (FIXED) ----------------
  const generateCSV = async () => {
    if (entries.length === 0) {
      Alert.alert("No Data", "Nothing to export yet!");
      return;
    }

    try {
      // Build CSV
      let csvContent = "ID,Full Name,User ID,Phone,Start Date,End Date\n";

      entries.forEach((item) => {
        const name = `"${item.name.replace(/"/g, '""')}"`;
        const userId = `"${item.user_id}"`;
        const start = new Date(item.start_date).toLocaleDateString();
        const end = new Date(item.end_date).toLocaleDateString();

        csvContent += `${item.id},${name},${userId},${item.phone},${start},${end}\n`;
      });

      // IMPORTANT: documentDirectory works on Android
      const fileName = `entries_${Date.now()}.csv`;
      const fileUri = FileSystem.documentDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: "utf8",
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Export CSV",
        UTI: "public.comma-separated-values-text",
      });
    } catch (error: any) {
      console.error("CSV export error:", error);
      Alert.alert("Export Failed", "Could not export CSV");
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* Top Bar */}
      <View className="flex-row justify-between items-center px-6 py-4 bg-white border-b border-slate-100">
        <Text className="text-xl font-bold text-slate-800">History</Text>

        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={deleteAll}
            className="w-10 h-10 items-center justify-center bg-red-50 rounded-full border border-red-100 mr-2"
          >
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={generateCSV}
            className="flex-row items-center bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100"
          >
            <Ionicons name="download" size={18} color="#4f46e5" />
            <Text className="text-indigo-600 font-bold ml-2">Export</Text>
          </TouchableOpacity>
        </View>
      </View>

      <FlatList
        data={entries}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View className="items-center justify-center mt-20">
            <Ionicons name="documents-outline" size={64} color="#cbd5e1" />
            <Text className="text-slate-400 mt-4">No records found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => setSelectedEntry(item)}
            activeOpacity={0.7}
            className="bg-white p-5 rounded-3xl mb-3 border border-slate-100 shadow-sm flex-row justify-between items-center"
          >
            <View className="flex-row items-center">
              <View className="bg-slate-100 p-3 rounded-2xl mr-4">
                <Ionicons name="person" size={20} color="#64748b" />
              </View>
              <View>
                <Text className="text-slate-800 font-bold text-lg">
                  {item.name}
                </Text>
                <Text className="text-slate-400 text-xs tracking-widest">
                  {item.user_id}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        )}
      />

      {/* DETAILS MODAL */}
      <Modal
        animationType="slide"
        transparent
        visible={!!selectedEntry}
        onRequestClose={() => setSelectedEntry(null)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable
            className="flex-1"
            onPress={() => setSelectedEntry(null)}
          />
          <View className="bg-white rounded-t-[40px] p-8">
            <View className="w-12 h-1.5 bg-slate-200 rounded-full self-center mb-8" />

            <Text className="text-2xl font-black text-slate-900 mb-6">
              Record Details
            </Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              <DetailRow
                label="Name"
                value={selectedEntry?.name}
                icon="person-outline"
              />
              <DetailRow
                label="Employee ID"
                value={selectedEntry?.user_id}
                icon="id-card-outline"
              />
              <DetailRow
                label="Phone"
                value={selectedEntry?.phone}
                icon="call-outline"
              />
              <DetailRow
                label="Start Date"
                value={
                  selectedEntry
                    ? new Date(selectedEntry.start_date).toLocaleDateString()
                    : ""
                }
                icon="calendar-outline"
              />
              <DetailRow
                label="End Date"
                value={
                  selectedEntry
                    ? new Date(selectedEntry.end_date).toLocaleDateString()
                    : ""
                }
                icon="time-outline"
              />
            </ScrollView>

            <TouchableOpacity
              onPress={() => setSelectedEntry(null)}
              className="bg-slate-900 p-5 rounded-2xl items-center mt-6"
            >
              <Text className="text-white font-bold text-lg">
                Close Details
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ---------------- DETAIL ROW ----------------
const DetailRow = ({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: any;
}) => (
  <View className="flex-row items-center mb-6">
    <View className="bg-slate-50 p-3 rounded-xl mr-4">
      <Ionicons name={icon} size={22} color="#475569" />
    </View>
    <View>
      <Text className="text-slate-400 text-[10px] uppercase font-black tracking-widest">
        {label}
      </Text>
      <Text className="text-slate-800 text-lg font-semibold">
        {value || "---"}
      </Text>
    </View>
  </View>
);
