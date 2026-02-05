import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#0097A7",
        tabBarInactiveTintColor: "#94a3b8",

        // --- FIX 2: Taller Bar to avoid overlapping Android buttons ---
        tabBarStyle: {
          height: Platform.OS === "android" ? 90 : 90, // Taller on Android
          paddingBottom: Platform.OS === "android" ? 20 : 30, // Push icons up
          paddingTop: 8,
          backgroundColor: "#ffffff",
          borderTopWidth: 0,
          elevation: 10, // Adds a nice shadow on Android
          shadowColor: "#000", // Adds shadow on iOS
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },

        // Header settings (This controls the PURPLE bar)
        headerStyle: {
          backgroundColor: "#4DB6AC",
          borderBottomLeftRadius: 100,
        },
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold", fontSize: 18 },
        headerTitleAlign: "center",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "CREATE ENTRY",
          tabBarLabel: "New Entry", // Shorter text fits better
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "add-circle" : "add-circle-outline"}
              size={28}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="view-entries"
        options={{
          title: "ALL ENTRIES",
          tabBarLabel: "History",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "list" : "list-outline"}
              size={28}
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}
