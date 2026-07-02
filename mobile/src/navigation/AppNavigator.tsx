import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font, ios } from '../lib/theme';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import LiquidGlass from '../components/LiquidGlass';

import HomeScreen from '../screens/HomeScreen';
import HerdScreen from '../screens/HerdScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ScanScreen from '../screens/ScanScreen';
import ObjectCaptureScreen from '../screens/ObjectCaptureScreen';
import ResultScreen from '../screens/ResultScreen';
import AnimalDetailScreen from '../screens/AnimalDetailScreen';
import LoginScreen from '../screens/LoginScreen';

import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
  const insets = useSafeAreaInsets();
  const bottom = insets.bottom > 0 ? insets.bottom : 12;
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        // Tab bar FLUTUANTE estilo iOS 26 (pill de Liquid Glass, destacada das bordas).
        tabBarStyle: {
          position: 'absolute',
          left: 16, right: 16, bottom,
          height: 64,
          borderRadius: 32,
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          paddingTop: 0, paddingBottom: 0,
          shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
        },
        tabBarItemStyle: { paddingVertical: 10 },
        tabBarBackground: () => (
          <LiquidGlass tone="light" radius={32} style={StyleSheet.absoluteFill} />
        ),
        tabBarActiveTintColor: ios.accentDark,
        tabBarInactiveTintColor: 'rgba(60,60,67,0.6)',
        tabBarLabelStyle: { fontSize: font.xs, fontWeight: '600', marginTop: 2 },
        tabBarIcon: ({ focused, color, size }) => {
          const icons: Record<string, [string, string]> = {
            Home:      ['home',         'home-outline'],
            Herd:      ['paw',          'paw-outline'],
            Analytics: ['bar-chart',    'bar-chart-outline'],
            Settings:  ['settings',     'settings-outline'],
          };
          const [active, inactive] = icons[route.name] ?? ['ellipse', 'ellipse-outline'];
          return <Ionicons name={(focused ? active : inactive) as any} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen name="Herd" component={HerdScreen} options={{ tabBarLabel: 'Herd' }} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} options={{ tabBarLabel: 'Analytics' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!token) {
    return <LoginScreen />;
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Main" component={TabNavigator} />
        <Stack.Screen
          name="Scan"
          component={ScanScreen}
          options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="ObjectCapture"
          component={ObjectCaptureScreen}
          options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
        />
        <Stack.Screen
          name="Result"
          component={ResultScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="AnimalDetail"
          component={AnimalDetailScreen}
          options={{ animation: 'slide_from_right' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabHairline: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: StyleSheet.hairlineWidth, backgroundColor: ios.separator,
  },
});

export default function AppNavigator() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
