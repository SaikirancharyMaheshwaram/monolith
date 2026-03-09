import { C } from "@/components/lobby-theme";
import { HapticTab } from "@/components/haptic-tab";
import { IconSymbol } from "@/components/ui/icon-symbol";
import { Tabs } from "expo-router";
import React from "react";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor: C.mana,
        tabBarInactiveTintColor: C.slate600,
        tabBarStyle: {
          backgroundColor: "rgba(8,12,18,0.96)",
          borderTopColor: C.glassBorder,
          borderTopWidth: 1,
          height: 74,
          paddingTop: 6,
          paddingBottom: 8,
        },
        tabBarLabelStyle: {
          fontFamily: "monospace",
          fontSize: 10,
          letterSpacing: 1,
          textTransform: "uppercase",
        },
      }}
    >
    

      <Tabs.Screen
        name="index"
        options={{
          title: "Lobby",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={22} name="house.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="duel"
        options={{
          title: "Duels",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={22} name="shield.lefthalf.filled" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="battle"
        options={{
          title: "Battle",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={22} name="bolt.fill" color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="vault"
        options={{
          title: "Vault",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={22} name="shield.fill" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color }) => (
            <IconSymbol size={22} name="person.fill" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
