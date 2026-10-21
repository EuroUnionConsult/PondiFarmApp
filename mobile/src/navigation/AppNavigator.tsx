import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, ActivityIndicator } from 'react-native';
import { colors } from '../lib/theme';
import { AuthProvider, useAuth } from '../lib/AuthContext';
import GlassTabBar from '../components/GlassTabBar';

import HomeScreen from '../screens/HomeScreen';
import HerdScreen from '../screens/HerdScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ScanScreen from '../screens/ScanScreen';
import ObjectCaptureScreen from '../screens/ObjectCaptureScreen';
import ResultScreen from '../screens/ResultScreen';
import AnimalDetailScreen from '../screens/AnimalDetailScreen';
import LoginScreen from '../screens/LoginScreen';
import ProfileScreen from '../screens/ProfileScreen';
import OrganizationGateScreen from '../screens/OrganizationGateScreen';

import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <GlassTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Herd" component={HerdScreen} />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
    </Tab.Navigator>
  );
}

function RootNavigator() {
  const { token, user, loading } = useAuth();

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

  // Com sessão mas ainda sem organização escolhida: criar uma ou pedir entrada.
  // À espera de aprovação (`pending`) já entra na app: faz scans, que ficam no
  // telemóvel até o Líder aprovar (aviso na Home e no Perfil). `user` null =
  // /me ainda não respondeu ou está offline — segue para a app (offline-first).
  if (user && user.membershipStatus === 'none') {
    return <OrganizationGateScreen />;
  }

  return (
    <NavigationContainer>
      {/* Voltar atrás deslizando de qualquer ponto do ecrã (não só da borda),
          como nas apps nativas do iOS. */}
      <Stack.Navigator screenOptions={{ headerShown: false, fullScreenGestureEnabled: true }}>
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
          name="Profile"
          component={ProfileScreen}
          options={{ animation: 'slide_from_right' }}
        />
        <Stack.Screen
          name="Settings"
          component={SettingsScreen}
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

export default function AppNavigator() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}
