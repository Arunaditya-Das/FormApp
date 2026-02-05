import { Stack } from "expo-router";

interface HeaderProps {
  title: string;
}

export const Header = ({ title }: HeaderProps) => {
  return (
    <Stack.Screen
      options={{
        title: title,
        headerStyle: { backgroundColor: "#9575CD" }, // Indigo-600
        headerTintColor: "#fff",
        headerTitleStyle: { fontWeight: "bold", fontSize: 20, fontFamily: "" },
        headerShadowVisible: true,
        headerTitleAlign: "center", // Keeps it professional on both Android/iOS
      }}
    />
  );
};
