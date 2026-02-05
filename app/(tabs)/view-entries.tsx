import { Ionicons } from "@expo/vector-icons";
// --- FIXED IMPORT: Use standard import, NOT legacy, NOT named ---
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db } from "../../db/database";
import { scheduleDeInductionNotification } from "../../utils/notificationHelper";

export default function ViewEntries() {
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedEntry, setSelectedEntry] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // --- Relatives State ---
  const [relatives, setRelatives] = useState<any[]>([]);
  const [showRelativeForm, setShowRelativeForm] = useState(false);
  const [selectedRelative, setSelectedRelative] = useState<any>(null);

  // --- New Relative Form State ---
  const [relName, setRelName] = useState("");
  const [relAadhaar, setRelAadhaar] = useState("");
  const [relPhoto, setRelPhoto] = useState<string | null>(null);
  const [relAddress, setRelAddress] = useState("");
  const [relMobile, setRelMobile] = useState("");
  const [relRelationship, setRelRelationship] = useState("");

  // --- FETCH MAIN ENTRIES ---
  const fetchEntries = () => {
    try {
      const result = db.getAllSync("SELECT * FROM records ORDER BY id DESC");
      setEntries(result);
    } catch (e) {
      console.log("Error fetching:", e);
    }
  };

  // --- FETCH RELATIVES ---
  const fetchRelatives = (recordId: number) => {
    try {
      const result = db.getAllSync(
        "SELECT * FROM relatives WHERE record_id = ? ORDER BY id DESC",
        [recordId],
      );
      setRelatives(result);
    } catch (e) {
      console.log("Error fetching relatives:", e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchEntries();
    }, []),
  );

  // ---------------------------------------------------------
  // ------------------- IMPORT CSV LOGIC --------------------
  // ---------------------------------------------------------

  const handleImportCSV = async () => {
    try {
      // 1. Pick the file
      const result = await DocumentPicker.getDocumentAsync({
        type: ["text/csv", "text/comma-separated-values", "application/csv"],
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      setIsImporting(true);
      const fileUri = result.assets[0].uri;

      // 2. Read content (Fixed usage: FileSystem.readAsStringAsync)
      const fileContent = await FileSystem.readAsStringAsync(fileUri);

      // 3. Process
      await processCSV(fileContent);
    } catch (error) {
      Alert.alert("Import Error", "Failed to read the file.");
      console.error(error);
    } finally {
      setIsImporting(false);
    }
  };

  const safeISODate = (value: string) => {
    if (!value) return null;

    const d = new Date(value);
    if (isNaN(d.getTime())) return null;

    return d.toISOString();
  };

  const processCSV = async (csvText: string) => {
    const rows = csvText.split(/\r?\n/);
    let importedCount = 0;
    let skippedCount = 0;
    let lastRecordId = null;

    const clean = (val: string) =>
      val ? val.replace(/^"|"$/g, "").trim() : "";

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row.trim()) continue;

      const cols = row.split(",");

      const mainName = clean(cols[1]);
      const mainAadhaar = clean(cols[2]);

      // --- CASE 1: MAIN RECORD ---
      if (mainName && mainAadhaar) {
        const exists: any = db.getFirstSync(
          "SELECT id FROM records WHERE aadhaar_no = ?",
          [mainAadhaar],
        );

        if (!exists) {
          try {
            const result: any = db.runSync(
              `INSERT INTO records (name, aadhaar_no, present_address, location_proceeding, phone, geo_tag, start_date, end_date) 
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                mainName,
                mainAadhaar,
                clean(cols[3]),
                clean(cols[4]),
                clean(cols[5]),
                clean(cols[6]),
                clean(cols[9]),
                clean(cols[10]),
              ],
            );

            lastRecordId = result.lastInsertRowId;
            importedCount++;

            // Schedule Notification
            const endDateString = safeISODate(clean(cols[8]));
            if (endDateString) {
              await scheduleDeInductionNotification(mainName, endDateString);
            }
          } catch (e) {
            console.log("Error inserting row:", e);
          }
        } else {
          lastRecordId = exists.id;
          skippedCount++;
        }
      }

      // --- CASE 2: RELATIVE DATA ---
      const relName = clean(cols[10]);
      const relRelation = clean(cols[11]); // Column 10 is Relation
      const relAadhaar = clean(cols[12]); // Column 11 is Aadhaar
      const relMobile = clean(cols[13]); // Column 12 is Mobile
      const relAddress = clean(cols[14]); // Column 13 is Address

      if (relName && lastRecordId) {
        db.runSync(
          `INSERT INTO relatives (record_id, name, relationship, aadhaar_no, mobile_no, present_address) 
     VALUES (?, ?, ?, ?, ?, ?)`,
          [
            lastRecordId,
            relName,
            relRelation,
            relAadhaar,
            relMobile,
            relAddress,
          ],
        );
      }
    }

    fetchEntries();
    Alert.alert(
      "Import Complete",
      `Records Imported: ${importedCount}\nSkipped (Duplicates): ${skippedCount}`,
    );
  };

  // ---------------------------------------------------------
  // ---------------------------------------------------------

  const handleOpenDetails = (item: any) => {
    setSelectedEntry(item);
    fetchRelatives(item.id);
  };

  // --- SAVE RELATIVE ---
  const handleSaveRelative = () => {
    if (!relName || !relAadhaar || !relRelationship) {
      Alert.alert(
        "Missing Data",
        "Name, Aadhaar and Relationship are required.",
      );
      return;
    }

    if (relMobile.length !== 10) {
      Alert.alert("Invalid Phone", "Mobile number must be exactly 10 digits.");
      return;
    }

    if (relAadhaar.length !== 12) {
      Alert.alert(
        "Invalid Aadhaar",
        "Aadhaar number must be exactly 12 digits.",
      );
      return;
    }

    try {
      const duplicateMain: any = db.getFirstSync(
        "SELECT name FROM records WHERE aadhaar_no = ?",
        [relAadhaar],
      );

      if (duplicateMain) {
        Alert.alert(
          "Duplicate Found",
          `This Aadhaar No is already registered as a Main User (${duplicateMain.name}).`,
        );
        return;
      }

      const duplicateRel: any = db.getFirstSync(
        "SELECT name, relationship FROM relatives WHERE aadhaar_no = ?",
        [relAadhaar],
      );

      if (duplicateRel) {
        Alert.alert(
          "Duplicate Found",
          `This Aadhaar No is already added as a relative: ${duplicateRel.name} (${duplicateRel.relationship}).`,
        );
        return;
      }

      db.runSync(
        `INSERT INTO relatives (record_id, name, aadhaar_no, aadhaar_photo, present_address, mobile_no, relationship) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          selectedEntry.id,
          relName,
          relAadhaar,
          relPhoto || "",
          relAddress,
          relMobile,
          relRelationship,
        ],
      );

      Alert.alert("Success", "Relative added successfully!");
      fetchRelatives(selectedEntry.id);
      setShowRelativeForm(false);
      resetRelativeForm();
    } catch (e) {
      Alert.alert("Error", "Could not save relative.");
    }
  };

  const resetRelativeForm = () => {
    setRelName("");
    setRelAadhaar("");
    setRelPhoto(null);
    setRelAddress("");
    setRelMobile("");
    setRelRelationship("");
  };

  const handlePickRelativeImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
    });
    if (!result.canceled) {
      setRelPhoto(result.assets[0].uri);
    }
  };

  const deleteRelative = (id: number) => {
    Alert.alert("Delete Relative?", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          db.runSync("DELETE FROM relatives WHERE id = ?", [id]);
          setSelectedRelative(null);
          fetchRelatives(selectedEntry.id);
        },
      },
    ]);
  };

  const filteredEntries = entries.filter((item) => {
    const query = searchQuery.toLowerCase();
    const name = item.name ? item.name.toLowerCase() : "";
    const aadhaar = item.aadhaar_no ? item.aadhaar_no.toString() : "";
    const phone = item.phone ? item.phone.toString() : "";
    return (
      name.includes(query) || aadhaar.includes(query) || phone.includes(query)
    );
  });

  const getMaskedAadhaar = (num: string) => {
    if (!num) return "N/A";
    const cleanNum = num.replace(/\s/g, "");
    if (cleanNum.length < 6) return cleanNum;
    return `${cleanNum.substring(0, 4)} ${cleanNum.substring(4, 6)}XX XXXX`;
  };

  const deleteSingleEntry = (id: number) => {
    Alert.alert("Delete Entry?", "This will also delete all relatives.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          try {
            db.runSync("DELETE FROM records WHERE id = ?", [id]);
            db.runSync("DELETE FROM relatives WHERE record_id = ?", [id]);
            setSelectedEntry(null);
            fetchEntries();
          } catch (e) {
            Alert.alert("Error", "Failed to delete record.");
          }
        },
      },
    ]);
  };

  const deleteAll = () => {
    if (entries.length === 0) return;
    Alert.alert("Delete All?", "Irreversible action.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          db.runSync("DELETE FROM records");
          db.runSync("DELETE FROM relatives");
          fetchEntries();
        },
      },
    ]);
  };

  const generateCSV = async () => {
    try {
      const allData = db.getAllSync(`
        SELECT 
          r.id, r.name, r.aadhaar_no, r.present_address, r.location_proceeding, r.phone, r.geo_tag, r.start_date, r.end_date,
          rel.name as rel_name, 
          rel.aadhaar_no as rel_aadhaar, 
          rel.relationship as rel_relation, 
          rel.mobile_no as rel_mobile, 
          rel.present_address as rel_address
        FROM records r
        LEFT JOIN relatives rel ON r.id = rel.record_id
        ORDER BY r.id DESC
      `);

      if (allData.length === 0) {
        Alert.alert("No Data", "Nothing to export yet!");
        return;
      }

      let csvContent =
        "ID,Main Name,Main Aadhaar,Main Address,Location,Phone,Geo Tag,Start Date,End Date,Relative Name,Relation,Relative Aadhaar,Relative Mobile,Relative Address\n";

      const safe = (str: any) => {
        if (!str) return "";
        return `"${String(str).replace(/"/g, '""')}"`;
      };

      allData.forEach((item: any) => {
        const start = item.start_date;
        const end = item.end_date;

        csvContent +=
          [
            item.id,
            safe(item.name),
            safe(item.aadhaar_no),
            safe(item.present_address),
            safe(item.location_proceeding),
            safe(item.phone),
            safe(item.geo_tag),
            start,
            end,
            safe(item.rel_name),
            safe(item.rel_relation),
            safe(item.rel_aadhaar),
            safe(item.rel_mobile),
            safe(item.rel_address),
          ].join(",") + "\n";
      });

      const fileName = `full_records_${Date.now()}.csv`;

      // --- FIXED USAGE: FileSystem.documentDirectory ---
      const fileUri = FileSystem.documentDirectory + fileName;

      // --- FIXED USAGE: FileSystem.writeAsStringAsync ---
      await FileSystem.writeAsStringAsync(fileUri, csvContent, {
        encoding: "utf8",
      });

      await Sharing.shareAsync(fileUri, {
        mimeType: "text/csv",
        dialogTitle: "Export Data",
        UTI: "public.comma-separated-values-text",
      });
    } catch (error: any) {
      console.error("CSV export error:", error);
      Alert.alert("Export Failed", "Could not export CSV");
    }
  };

  return (
    <View className="flex-1 bg-slate-50">
      {/* --- LOADING OVERLAY --- */}
      {isImporting && (
        <View className="absolute z-50 w-full h-full bg-black/50 justify-center items-center">
          <View className="bg-white p-6 rounded-2xl items-center shadow-lg">
            <ActivityIndicator size="large" color="#4f46e5" />
            <Text className="mt-4 font-bold text-slate-700 text-lg">
              Importing Records...
            </Text>
            <Text className="text-slate-400 text-xs mt-1">
              Checking duplicates & scheduling alarms
            </Text>
          </View>
        </View>
      )}

      {/* --- TOP BAR & SEARCH --- */}
      <View className="bg-white border-b border-slate-100 pb-4">
        <View className="flex-row justify-between items-center px-6 py-4">
          <Text className="text-xl font-bold text-slate-800">History</Text>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={deleteAll}
              className="w-10 h-10 items-center justify-center bg-red-50 rounded-full border border-red-100 mr-1"
            >
              <Ionicons name="trash-outline" size={20} color="#ef4444" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleImportCSV}
              className="flex-row items-center bg-green-50 px-3 py-2 rounded-full border border-green-100 mr-1"
            >
              <Ionicons name="cloud-upload-outline" size={18} color="#16a34a" />
              <Text className="text-green-600 font-bold ml-1 text-xs">
                Import
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={generateCSV}
              className="flex-row items-center bg-indigo-50 px-3 py-2 rounded-full border border-indigo-100"
            >
              <Ionicons name="download" size={18} color="#4f46e5" />
              <Text className="text-indigo-600 font-bold ml-2 text-xs">
                Export
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        <View className="px-6">
          <View className="flex-row items-center bg-slate-100 px-4 py-3 rounded-2xl border border-slate-200">
            <Ionicons name="search" size={20} color="#94a3b8" />
            <TextInput
              placeholder="Search Name, Aadhaar or Phone..."
              placeholderTextColor="#94a3b8"
              className="flex-1 ml-3 text-slate-800 font-medium"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color="#cbd5e1" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>

      {/* --- MAIN LIST --- */}
      <FlatList
        data={filteredEntries}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        ListEmptyComponent={
          <View className="items-center justify-center mt-20">
            <Ionicons name="search-outline" size={64} color="#cbd5e1" />
            <Text className="text-slate-400 mt-4">No records found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            onPress={() => handleOpenDetails(item)}
            activeOpacity={0.7}
            className="bg-white p-5 rounded-3xl mb-3 border border-slate-100 shadow-sm flex-row justify-between items-center"
          >
            <View className="flex-row items-center flex-1">
              <View className="bg-slate-100 p-3 rounded-2xl mr-4">
                <Ionicons name="person" size={20} color="#64748b" />
              </View>
              <View className="flex-1">
                <Text className="text-slate-800 font-bold text-lg">
                  {item.name}
                </Text>
                <Text className="text-slate-500 text-xs font-medium mt-1">
                  UID: {getMaskedAadhaar(item.aadhaar_no)}
                </Text>
                <Text className="text-slate-400 text-xs mt-1" numberOfLines={1}>
                  {item.location_proceeding}
                </Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#cbd5e1" />
          </TouchableOpacity>
        )}
      />

      {/* --- MAIN DETAILS SLIDER --- */}
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
          <View className="bg-white rounded-t-[40px] h-[90%]">
            <View className="items-center pt-4 pb-2 border-b border-slate-100">
              <View className="w-12 h-1.5 bg-slate-200 rounded-full mb-4" />
              <Text className="text-xl font-black text-slate-800 mb-2">
                Entry Details
              </Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
            >
              {/* Photo */}
              {selectedEntry?.aadhaar_photo ? (
                <View className="mb-8">
                  <Text className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-2">
                    Aadhaar Photo
                  </Text>
                  <Image
                    source={{ uri: selectedEntry.aadhaar_photo }}
                    className="w-full h-48 rounded-2xl bg-slate-100"
                    resizeMode="cover"
                  />
                </View>
              ) : null}

              <DetailRow
                label="Full Name"
                value={selectedEntry?.name}
                icon="person-outline"
              />
              <DetailRow
                label="Aadhaar Number"
                value={selectedEntry?.aadhaar_no}
                icon="card-outline"
              />
              <DetailRow
                label="Mobile No"
                value={selectedEntry?.phone}
                icon="call-outline"
              />
              <DetailRow
                label="Present Address"
                value={selectedEntry?.present_address}
                icon="home-outline"
              />
              <DetailRow
                label="Location Proceeding"
                value={selectedEntry?.location_proceeding}
                icon="business-outline"
              />
              <DetailRow
                label="Geo Tag"
                value={selectedEntry?.geo_tag}
                icon="map-outline"
              />

              <View className="flex-row gap-4 mt-2">
                <View className="flex-1">
                  <DetailRow
                    label="Induction Date"
                    value={
                      selectedEntry
                        ? new Date(
                            selectedEntry.start_date,
                          ).toLocaleDateString()
                        : ""
                    }
                    icon="calendar-outline"
                  />
                </View>
                <View className="flex-1">
                  <DetailRow
                    label="De Induction Date"
                    value={
                      selectedEntry
                        ? new Date(selectedEntry.end_date).toLocaleDateString()
                        : ""
                    }
                    icon="time-outline"
                  />
                </View>
              </View>

              <View className="h-[1px] bg-slate-200 my-8" />

              {/* --- RELATIVES LIST SECTION --- */}
              <View className="flex-row justify-between items-center mb-6">
                <Text className="text-lg font-black text-slate-800">
                  Relatives
                </Text>
                <TouchableOpacity
                  onPress={() => setShowRelativeForm(true)}
                  className="bg-indigo-600 px-4 py-2 rounded-full shadow-md shadow-indigo-200"
                >
                  <Text className="text-white font-bold text-xs">
                    + Add Relative
                  </Text>
                </TouchableOpacity>
              </View>

              {relatives.length === 0 ? (
                <View className="bg-slate-50 p-6 rounded-2xl border border-dashed border-slate-300 items-center">
                  <Text className="text-slate-400 italic">
                    No relatives added yet.
                  </Text>
                </View>
              ) : (
                relatives.map((rel, index) => (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.7}
                    onPress={() => setSelectedRelative(rel)}
                    className="bg-white p-4 rounded-2xl mb-4 border border-slate-100 shadow-sm flex-row items-center"
                  >
                    {rel.aadhaar_photo ? (
                      <Image
                        source={{ uri: rel.aadhaar_photo }}
                        className="w-14 h-14 rounded-full bg-slate-100 mr-4"
                      />
                    ) : (
                      <View className="w-14 h-14 rounded-full bg-indigo-50 mr-4 items-center justify-center">
                        <Ionicons name="person" size={24} color="#6366f1" />
                      </View>
                    )}
                    <View className="flex-1">
                      <Text className="text-xs text-indigo-600 font-bold uppercase tracking-wide">
                        {rel.relationship}
                      </Text>
                      <Text className="font-bold text-slate-800 text-lg">
                        {rel.name}
                      </Text>
                      <Text className="text-xs text-slate-500">
                        UID: {getMaskedAadhaar(rel.aadhaar_no)}
                      </Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color="#cbd5e1"
                    />
                  </TouchableOpacity>
                ))
              )}

              {/* Close / Delete Main Buttons */}
              <TouchableOpacity
                onPress={() => setSelectedEntry(null)}
                className="bg-slate-900 p-5 rounded-2xl items-center mt-8 shadow-lg shadow-slate-300"
              >
                <Text className="text-white font-bold text-lg">
                  Close Details
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => deleteSingleEntry(selectedEntry?.id)}
                className="bg-white p-5 rounded-2xl items-center mt-4 border border-red-100"
              >
                <Text className="text-red-500 font-bold text-lg">
                  Delete This Record
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- RELATIVE DETAILS VIEWER --- */}
      <Modal
        animationType="slide"
        visible={!!selectedRelative}
        transparent
        onRequestClose={() => setSelectedRelative(null)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable
            className="flex-1"
            onPress={() => setSelectedRelative(null)}
          />
          <View className="bg-white rounded-t-[40px] h-[85%]">
            <View className="items-center pt-4 pb-2 border-b border-slate-100">
              <View className="w-12 h-1.5 bg-slate-200 rounded-full mb-4" />
              <Text className="text-xl font-black text-slate-800 mb-2">
                Relative Details
              </Text>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 24, paddingBottom: 100 }}
            >
              {selectedRelative?.aadhaar_photo ? (
                <View className="mb-8">
                  <Text className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-2">
                    Aadhaar Photo
                  </Text>
                  <Image
                    source={{ uri: selectedRelative.aadhaar_photo }}
                    className="w-full h-48 rounded-2xl bg-slate-100"
                    resizeMode="cover"
                  />
                </View>
              ) : null}

              <DetailRow
                label="Relationship"
                value={selectedRelative?.relationship}
                icon="people-outline"
              />
              <DetailRow
                label="Full Name"
                value={selectedRelative?.name}
                icon="person-outline"
              />
              <DetailRow
                label="Aadhaar No"
                value={selectedRelative?.aadhaar_no}
                icon="card-outline"
              />
              <DetailRow
                label="Mobile No"
                value={selectedRelative?.mobile_no}
                icon="call-outline"
              />
              <DetailRow
                label="Present Address"
                value={selectedRelative?.present_address}
                icon="home-outline"
              />

              <TouchableOpacity
                onPress={() => setSelectedRelative(null)}
                className="bg-slate-900 p-5 rounded-2xl items-center mt-8 shadow-lg shadow-slate-300"
              >
                <Text className="text-white font-bold text-lg">Close</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => deleteRelative(selectedRelative?.id)}
                className="bg-white p-5 rounded-2xl items-center mt-4 border border-red-100"
              >
                <Text className="text-red-500 font-bold text-lg">
                  Delete Relative
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- ADD RELATIVE FORM MODAL --- */}
      <Modal
        animationType="slide"
        visible={showRelativeForm}
        transparent
        onRequestClose={() => setShowRelativeForm(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          className="flex-1 justify-end bg-black/60"
        >
          <View className="bg-slate-100 h-[85%] rounded-t-[30px] p-0 overflow-hidden">
            <View className="bg-white px-6 py-5 border-b border-slate-200 flex-row justify-between items-center">
              <Text className="text-xl font-black text-slate-800">
                Add New Relative
              </Text>
              <TouchableOpacity
                onPress={() => setShowRelativeForm(false)}
                className="bg-slate-100 p-2 rounded-full"
              >
                <Ionicons name="close" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 24 }}
            >
              <View className="items-center mb-8">
                <TouchableOpacity
                  onPress={handlePickRelativeImage}
                  className="relative"
                >
                  <View className="w-28 h-28 rounded-full bg-white items-center justify-center border-4 border-white shadow-sm">
                    {relPhoto ? (
                      <Image
                        source={{ uri: relPhoto }}
                        className="w-full h-full rounded-full"
                      />
                    ) : (
                      <View className="items-center justify-center">
                        <Ionicons name="camera" size={32} color="#cbd5e1" />
                        <Text className="text-[10px] text-slate-400 font-bold mt-1">
                          UPLOAD
                        </Text>
                      </View>
                    )}
                  </View>
                  <View className="absolute bottom-0 right-0 bg-indigo-600 w-8 h-8 rounded-full items-center justify-center border-2 border-white">
                    <Ionicons name="add" size={16} color="white" />
                  </View>
                </TouchableOpacity>
              </View>

              <View className="space-y-4">
                <View>
                  <Text className="text-slate-500 font-bold text-xs uppercase mb-2 ml-1">
                    Relationship
                  </Text>
                  <TextInput
                    className="bg-white p-4 rounded-2xl border border-slate-200 text-slate-800 text-base shadow-sm"
                    placeholder="e.g. Wife, Son, Father"
                    placeholderTextColor="#cbd5e1"
                    value={relRelationship}
                    onChangeText={setRelRelationship}
                  />
                </View>
                <View className="mt-4">
                  <Text className="text-slate-500 font-bold text-xs uppercase mb-2 ml-1">
                    Full Name
                  </Text>
                  <TextInput
                    className="bg-white p-4 rounded-2xl border border-slate-200 text-slate-800 text-base shadow-sm"
                    placeholder="Relative's Name"
                    placeholderTextColor="#cbd5e1"
                    value={relName}
                    onChangeText={setRelName}
                  />
                </View>
                <View className="mt-4">
                  <Text className="text-slate-500 font-bold text-xs uppercase mb-2 ml-1">
                    Aadhaar No
                  </Text>
                  <TextInput
                    className="bg-white p-4 rounded-2xl border border-slate-200 text-slate-800 text-base shadow-sm"
                    placeholder="12 Digit UID"
                    placeholderTextColor="#cbd5e1"
                    keyboardType="numeric"
                    maxLength={12}
                    value={relAadhaar}
                    onChangeText={setRelAadhaar}
                  />
                </View>
                <View className="mt-4">
                  <Text className="text-slate-500 font-bold text-xs uppercase mb-2 ml-1">
                    Mobile No
                  </Text>
                  <TextInput
                    className="bg-white p-4 rounded-2xl border border-slate-200 text-slate-800 text-base shadow-sm"
                    placeholder="Phone Number"
                    placeholderTextColor="#cbd5e1"
                    keyboardType="phone-pad"
                    maxLength={10}
                    value={relMobile}
                    onChangeText={setRelMobile}
                  />
                </View>
                <View className="mt-4">
                  <Text className="text-slate-500 font-bold text-xs uppercase mb-2 ml-1">
                    Present Address
                  </Text>
                  <TextInput
                    className="bg-white p-4 rounded-2xl border border-slate-200 text-slate-800 text-base shadow-sm min-h-[100px]"
                    placeholder="Current Address"
                    placeholderTextColor="#cbd5e1"
                    multiline
                    textAlignVertical="top"
                    value={relAddress}
                    onChangeText={setRelAddress}
                  />
                </View>
              </View>

              <TouchableOpacity
                onPress={handleSaveRelative}
                className="bg-indigo-600 p-5 rounded-2xl items-center mt-8 mb-10 shadow-lg shadow-indigo-300"
              >
                <Text className="text-white font-bold text-lg">
                  Save Relative Record
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const DetailRow = ({ label, value, icon }: any) => (
  <View className="flex-row items-center mb-6">
    <View className="bg-indigo-50 p-3 rounded-xl mr-4">
      <Ionicons name={icon} size={22} color="#4f46e5" />
    </View>
    <View className="flex-1">
      <Text className="text-slate-400 text-[10px] uppercase font-black tracking-widest mb-0.5">
        {label}
      </Text>
      <Text className="text-slate-800 text-lg font-semibold leading-6">
        {value || "---"}
      </Text>
    </View>
  </View>
);
