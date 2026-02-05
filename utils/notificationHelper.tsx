// File: utils/notificationHelper.ts
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

// 1. Configure how notifications appear when app is open
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// 2. Request Permission (Simplified for Local Notifications)
export async function registerForPushNotificationsAsync() {
  // Android: Create a channel (Required for Android 8.0+)
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF231F7C",
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.log("Permission not granted!");
    return false;
  }

  // WE REMOVED THE "getExpoPushTokenAsync" CALL HERE
  // This is what was crashing Expo Go.

  return true;
}

// 3. Schedule the Notification
export async function scheduleDeInductionNotification(
  name: string,
  endDateString: string,
) {
  try {
    const triggerDate = new Date(endDateString);

    // Set time to 12:01 AM (00:01)
    triggerDate.setHours(0);
    triggerDate.setMinutes(1);
    triggerDate.setSeconds(0);

    // Don't schedule if date is in the past
    if (triggerDate.getTime() < Date.now()) {
      console.log("Date is in the past, skipping notification.");
      return;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: "📅 De-Induction Alert",
        body: `De-Induction for ${name} is scheduled for today.`,
        sound: true,
      },
      trigger: triggerDate,
    });

    console.log(`Scheduled for ${triggerDate}`);
  } catch (error) {
    console.log("Error scheduling notification:", error);
  }
}
