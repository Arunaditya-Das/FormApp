import DateTimePicker from "@react-native-community/datetimepicker";
import { Link } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../../components/header";
import { db, setupDatabase } from "../../db/database";

// --- Sub-Component: Styled Input Field ---
const FormInput = ({
  label,
  placeholder,
  value,
  onChangeText,
  keyboardType = "default",
}: any) => (
  <View className="mb-5">
    <Text className="text-gray-500 font-medium mb-2 ml-1">{label}</Text>
    <TextInput
      className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm text-gray-800"
      placeholder={placeholder}
      placeholderTextColor="#9ca3af"
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
    />
  </View>
);

export default function Index() {
  const [name, setName] = useState("");
  const [userId, setUserId] = useState("");
  const [phone, setPhone] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());

  const [showStart, setShowStart] = useState(false);
  const [showEnd, setShowEnd] = useState(false);

  const handleSave = () => {
    try {
      db.runSync(
        "INSERT INTO records (user_id, name, phone, start_date, end_date) VALUES (?, ?, ?, ?, ?)",
        [userId, name, phone, startDate.toISOString(), endDate.toISOString()]
      );
      Alert.alert("Success", "Record saved to local storage!");
      // Clear form after save
      reset();
    } catch (error) {
      Alert.alert("Error", "Failed to save data.");
    }
  };

  const reset = () => {
    setName("");
    setUserId("");
    setPhone("");
    setStartDate(new Date());
    setEndDate(new Date());
  };

  useEffect(() => {
    setupDatabase(); // Runs once when the component mounts
  }, []);

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-slate-200"
    >
      <Header title="CREATE RECORD" />

      <ScrollView showsVerticalScrollIndicator={false} className="flex-1 p-10">
        <View className="py-0">
          <Text className="text-2xl font-extrabold text-slate-500 mx-1 mb-6">
            Please put your details !
          </Text>

          {/* Form Fields */}
          <FormInput
            label="Full Name"
            placeholder="John Doe"
            value={name}
            onChangeText={setName}
          />
          <FormInput
            label="Employee/User ID"
            placeholder="EX-1024"
            value={userId}
            onChangeText={setUserId}
          />
          <FormInput
            label="Phone Number"
            placeholder="+91 98765 43210"
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
          />

          {/* Date Pickers Section */}
          <View className="flex-row justify-between mb-8">
            {/* Start Date */}
            <View className="flex-1 mr-2">
              <Text className="text-gray-500 font-medium mb-2 ml-1">
                Start Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowStart(true)}
                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm items-center"
              >
                <Text className="text-indigo-600 font-semibold">
                  {startDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>

            {/* End Date */}
            <View className="flex-1 ml-2">
              <Text className="text-gray-500 font-medium mb-2 ml-1">
                End Date
              </Text>
              <TouchableOpacity
                onPress={() => setShowEnd(true)}
                className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm items-center"
              >
                <Text className="text-indigo-600 font-semibold">
                  {endDate.toLocaleDateString()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Action Button */}
          <TouchableOpacity
            onPress={handleSave}
            activeOpacity={0.8}
            className="bg-indigo-600 p-5 rounded-2xl shadow-lg shadow-indigo-300 items-center mt-4"
          >
            <Text className="text-white font-bold text-lg">Save Record</Text>
          </TouchableOpacity>
          <Link href="/view-entries" asChild>
            <TouchableOpacity className="mt-4 items-center">
              <Text className="text-indigo-600 font-semibold">
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
