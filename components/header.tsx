import { Stack } from "expo-router";

interface HeaderProps {
  title: string;
}

export const Header = ({ title }: HeaderProps) => {
  return (
    <Stack.Screen
      options={{
        title: title,
        headerStyle: { backgroundColor: "#4f46e5" }, // Indigo-600
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold", fontSize: 20, fontFamily : "" },
        headerShadowVisible: false,
        headerTitleAlign: "center", // Keeps it professional on both Android/iOS
      }}
    />
  );
};