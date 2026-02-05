import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Link } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { db, setupDatabase } from "../../db/database";
import {
  registerForPushNotificationsAsync,
  scheduleDeInductionNotification,
} from "../../utils/notificationHelper";

// --- Sub-Component: Styled Input Field ---
// Now accepts a 'status' prop to control border color dynamically
const FormInput = ({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
  multiline = false,
  maxLength,
  status = "neutral", // 'neutral' | 'valid' | 'invalid'
}: any) => {
  // Determine border color based on status
  let borderColor = "border-gray-100"; // Default
  if (status === "valid") borderColor = "border-green-500 border-2";
  if (status === "invalid") borderColor = "border-red-500 border-2";

  return (
    <View className="mb-5">
      <Text className="text-slate-950 font-medium mb-2 ml-1">{label}</Text>
      <TextInput
        className={`bg-white p-4 rounded-2xl border shadow-sm text-gray-800 ${borderColor} ${
          multiline ? "h-24 text-top" : ""
        }`}
        placeholder={placeholder}
        placeholderTextColor="#9ca3af"
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        maxLength={maxLength}
      />
    </View>
  );
};

export default function Index() {
  // --- State Variables ---
  const [name, setName] = useState("");

  // Aadhaar States
  const [aadhaarNo, setAadhaarNo] = useState("");
  const [aadhaarStatus, setAadhaarStatus] = useState<
    "neutral" | "valid" | "invalid"
  >("neutral");

  const [aadhaarPhoto, setAadhaarPhoto] = useState<string | null>(null);
  const [address, setAddress] = useState("");
  const [locationProceeding, setLocationProceeding] = useState("");
  const [phone, setPhone] = useState("");
  const [geoTag, setGeoTag] = useState<string | null>(null);

  // Date States
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  // Loading States
  const [loadingLocation, setLoadingLocation] = useState(false);
  const bgImage = require("../../assets/images/people.webp");

  useEffect(() => {
    setupDatabase();
    // --- 1. REQUEST PERMISSION ON LOAD ---
    registerForPushNotificationsAsync();
  }, []);

  useEffect(() => {
    setupDatabase();
  }, []);

  // --- DUPLICATE CHECKER LOGIC ---
  const checkAadhaarDuplicate = (aadhaarValue: string) => {
    try {
      const query =
        "SELECT location_proceeding FROM records WHERE aadhaar_no = ?";
      const existingRecord: any = db.getFirstSync(query, [aadhaarValue]);

      if (existingRecord) {
        // DUPLICATE FOUND -> Red Border + Alert
        setAadhaarStatus("invalid");
        Alert.alert(
          "⚠️ Already Registered",
          `This user is already registered.\n\nLocation Proceeding:\n${existingRecord.location_proceeding}`,
        );
      } else {
        // UNIQUE -> Green Border
        setAadhaarStatus("valid");
      }
    } catch (error) {
      console.log("Error checking duplicate:", error);
    }
  };

  // --- Handlers ---

  const handleAadhaarChange = (text: string) => {
    // Ensure only numbers
    const numericText = text.replace(/[^0-9]/g, "");
    setAadhaarNo(numericText);

    if (numericText.length === 0) {
      setAadhaarStatus("neutral");
      return;
    }

    // Logic: If less than 12, it is invalid (Red).
    // If exactly 12, run the DB check to see if it's Green or Red.
    if (numericText.length < 12) {
      setAadhaarStatus("invalid");
    } else {
      checkAadhaarDuplicate(numericText);
    }
  };

  const handlePickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert("Permission Required", "You need to allow access to photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [9, 16],
      quality: 0.5,
    });

    if (!result.canceled) {
      setAadhaarPhoto(result.assets[0].uri);
    }
  };

  const handleGetLocation = async () => {
    setLoadingLocation(true);
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permission Denied",
          "Allow location access to get Geo Tag.",
        );
        setLoadingLocation(false);
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      const coords = `${location.coords.latitude}, ${location.coords.longitude}`;
      setGeoTag(coords);
    } catch (error) {
      Alert.alert("Error", "Could not fetch location.");
    } finally {
      setLoadingLocation(false);
    }
  };

  const handleSave = async () => {
    // Validation
    if (!name || !aadhaarNo || !phone) {
      Alert.alert("Missing Data", "Please fill in all required fields.");
      return;
    }

    if (phone.length !== 10) {
      Alert.alert("Invalid Phone", "Mobile number must be exactly 10 digits.");
      return;
    }

    if (aadhaarNo.length !== 12) {
      Alert.alert(
        "Invalid Aadhaar",
        "Aadhaar number must be exactly 12 digits.",
      );
      return;
    }

    // Prevent saving if duplicate exists (Red status)
    if (aadhaarStatus === "invalid") {
      Alert.alert(
        "Duplicate Record",
        "Cannot save. This Aadhaar number is already registered.",
      );
      return;
    }

    try {
      db.runSync(
        `INSERT INTO records (
          name, 
          aadhaar_no, 
          aadhaar_photo, 
          present_address, 
          location_proceeding, 
          phone, 
          geo_tag, 
          start_date, 
          end_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          name,
          aadhaarNo,
          aadhaarPhoto || "",
          address,
          locationProceeding,
          phone,
          geoTag || "",
          startDate.toISOString(),
          endDate.toISOString(),
        ],
      );
      await scheduleDeInductionNotification(name, endDate.toISOString());

      Alert.alert("Success", "Record saved & Notification Scheduled!");
      reset();
    } catch (error) {
      console.error(error);
      Alert.alert("Error", "Failed to save data. Check database schema.");
    }
  };

  const reset = () => {
    setName("");
    setAadhaarNo("");
    setAadhaarStatus("neutral"); // Reset status
    setAadhaarPhoto(null);
    setAddress("");
    setLocationProceeding("");
    setPhone("");
    setGeoTag(null);
    setStartDate(new Date());
    setEndDate(new Date());
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-gray-100"
    >
      {/* <Header title="CREATE ENTRY" /> */}
      <View className="absolute inset-0 items-center justify-center pointer-events-none">
        {/* <Image
          source={bgImage}
          style={{
            width: "100%",
            height: "100%",
            opacity: 0.05, // Lower this for "lower visibility"
            // resizeMode: "contain",
          }}
        /> */}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-6">
        <View className="mb-20">
          <Text className="text-2xl font-extrabold black mx-1 mb-6">
            Enter Details
          </Text>

          {/* 1. Name */}
          <FormInput
            label="Name"
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
          />

          {/* 2. Aadhaar Card No - UPDATED with Status */}
          <FormInput
            label="Aadhaar Card No"
            placeholder="1234 5678 9012"
            value={aadhaarNo}
            onChangeText={handleAadhaarChange}
            keyboardType="numeric"
            maxLength={12}
            status={aadhaarStatus} // Pass dynamic status here
          />

          {/* 3. Aadhaar Photo Picker */}
          <View className="mb-5">
            <Text className="text-slate-950 font-medium mb-2 ml-1">
              Aadhaar Card Photo
            </Text>
            <TouchableOpacity
              onPress={handlePickImage}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm items-center justify-center min-h-[100px]"
            >
              {aadhaarPhoto ? (
                <Image
                  source={{ uri: aadhaarPhoto }}
                  className="w-full h-40 rounded-xl"
                  resizeMode="cover"
                />
              ) : (
                <Text className="text-teal-600 font-semibold">
                  + Upload Photo
                </Text>
              )}
            </TouchableOpacity>
          </View>

          {/* 4. Present Address */}
          <FormInput
            label="Present Address"
            placeholder="House No, Street, City..."
            value={address}
            onChangeText={setAddress}
            multiline={true}
          />

          {/* 5. Location Proceeding */}
          <FormInput
            label="Location Proceeding"
            placeholder="e.g. Site A, Main Office"
            value={locationProceeding}
            onChangeText={setLocationProceeding}
          />

          {/* 6. Mobile No */}
          <FormInput
            label="Mobile No"
            placeholder="+91 98765 43210"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            maxLength={10}
          />

          {/* 7. Geo Tag */}
          <View className="mb-5">
            <Text className="text-slate-950 font-medium mb-2 ml-1">
              Geo Tag (Location)
            </Text>
            <TouchableOpacity
              onPress={handleGetLocation}
              className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex-row items-center justify-between"
            >
              <Text className={geoTag ? "text-gray-800" : "text-gray-400"}>
                {geoTag ? geoTag : "Tap to fetch location"}
              </Text>
              {loadingLocation && (
                <ActivityIndicator size="small" color="#4f46e5" />
              )}
            </TouchableOpacity>
          </View>

          {/* 8. Date Pickers Section */}
          <View className="flex-row justify-between mb-8">
            {/* Start Date */}
            <View className="flex-1 mr-2">
              <Text className="text-slate-950 font-medium mb-2 ml-1">
                Induction Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowStart(true)}
                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm items-center"
              >
                <Text className="text-teal-600 font-semibold">
                  {startDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>

            {/* End Date */}
            <View className="flex-1 ml-2">
              <Text className="text-slate-950 font-medium mb-2 ml-1">
                De Induction Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowEnd(true)}
                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm items-center"
              >
                <Text className="text-teal-600 font-semibold">
                  {endDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            onPress={handleSave}
            activeOpacity={0.8}
            className="bg-teal-600 p-5 rounded-2xl shadow-lg shadow-indigo-300 items-center mt-4"
          >
            <Text className="text-white font-bold text-lg">Save Record</Text>
          </TouchableOpacity>

          <Link href="/view-entries" asChild>
            <TouchableOpacity className="mt-6 items-center mb-10">
              <Text className="text-teal-600 font-semibold">
                View All Saved Entries →
              </Text>
            </TouchableOpacity>
          </Link>
        </View>

        {/* Hidden Date Pickers (Modals) */}
        {showStart && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(e, d) => {
              setShowStart(false);
              if (d) setStartDate(d);
            }}
          />
        )}
        {showEnd && (
          <DateTimePicker
            value={endDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={(e, d) => {
              setShowEnd(false);
              if (d) setEndDate(d);
            }}
          />
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
