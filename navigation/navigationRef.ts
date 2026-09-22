import { createNavigationContainerRef } from '@react-navigation/native';

/**
 * Navigation ref usable outside the navigation tree (e.g. App.tsx notification
 * listeners, which sit above <NavigationContainer> and can't use useNavigation()).
 */
export const navigationRef = createNavigationContainerRef();
