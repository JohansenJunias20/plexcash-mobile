import React from 'react';
import { View, Text } from 'react-native';
import { getTokenAuth } from '../../services/token';

export default function NewOnlineScreen(): JSX.Element {
  // Placeholder: Full management will be implemented per web's NewOnline parity (no staging per user request)
  // All requests from this screen must include Authorization: Bearer ${await getTokenAuth()}
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>NewOnline - full management coming in this iteration</Text>
    </View>
  );
}

