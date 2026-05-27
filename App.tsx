import { useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform, StyleSheet, Text, View } from 'react-native';
import { BleManager } from 'react-native-ble-plx';

type BeaconColor = 'white' | 'red' | 'blue';

const manager = new BleManager();

async function requestAndroidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;

  const apiLevel = Platform.Version as number;

  if (apiLevel >= 31) {
    const results = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
      PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    ]);
    return Object.values(results).every(r => r === PermissionsAndroid.RESULTS.GRANTED);
  } else {
    const result = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  }
}

export default function App() {
  const [color, setColor] = useState<BeaconColor>('white');
  const [status, setStatus] = useState('Starting scan...');
  const scanning = useRef(false);

  useEffect(() => {
    let mounted = true;

    const start = async () => {
      const granted = await requestAndroidPermissions();
      if (!granted) {
        Alert.alert('Permission denied', 'Bluetooth permissions are required.');
        setStatus('Permission denied');
        return;
      }

      // Wait for BLE to power on
      const subscription = manager.onStateChange(state => {
        if (state === 'PoweredOn' && !scanning.current && mounted) {
          scanning.current = true;
          subscription.remove();
          setStatus('Scanning...');

          manager.startDeviceScan(null, null, (error, device) => {
            if (!mounted) return;
            if (error) {
              setStatus(`Error: ${error.message}`);
              return;
            }
            const name = device?.localName ?? device?.name ?? '';
            const rssi = device?.rssi ?? -100;
            if (name === 'BEACON_A' || name === 'BEACON_B') {
              if (rssi < -50) {
                setColor('white');
                setStatus(`${name} — te ver weg (RSSI: ${rssi})`);
              } else if (name === 'BEACON_A') {
                setColor('red');
                setStatus(`BEACON_A (RSSI: ${rssi})`);
              } else {
                setColor('blue');
                setStatus(`BEACON_B (RSSI: ${rssi})`);
              }
            }
          });
        } else if (state === 'PoweredOff') {
          setStatus('Bluetooth is off');
        }
      }, true);
    };

    start();

    return () => {
      mounted = false;
      manager.stopDeviceScan();
    };
  }, []);

  const textColor = color === 'white' ? '#333' : 'white';

  return (
    <View style={[styles.container, { backgroundColor: color }]}>
      <Text style={[styles.status, { color: textColor }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: {
    fontSize: 28,
    fontWeight: 'bold',
  },
});
