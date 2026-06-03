import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { Platform } from 'react-native';

import { colors, font } from '../lib/theme';

import HomeScreen from '../screens/HomeScreen';
import HerdScreen from '../screens/HerdScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ScanScreen from '../screens/ScanScreen';
import ResultScreen from '../screens/ResultScreen';
import LidarTestScreen from '../screens/LidarTestScreen'; // TEMP EURODEV-74 — remove in Phase 4

import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 84 : 62,
          paddingBottom: Platform.OS === 'ios' ? 26 : 8,
          shadowColor: '#64748B',
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.06,
          shadowRadius: 8,
          elevation: 8,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textDim,
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
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarLabel: 'Início' }} />
      <Tab.Screen name="Herd" component={HerdScreen} options={{ tabBarLabel: 'Rebanho' }} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} options={{ tabBarLabel: 'Análises' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Config' }} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
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
          name="Result"
          component={ResultScreen}
          options={{ animation: 'slide_from_right' }}
        />
        {/* TEMP EURODEV-74 — remove in Phase 4 */}
        <Stack.Screen
          name="LidarTest"
          component={LidarTestScreen}
          options={{ animation: 'slide_from_bottom', presentation: 'fullScreenModal' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
